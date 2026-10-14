import { createHash } from 'node:crypto';

import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';

import type { Request } from 'express';

import type { ServicePrincipal } from '@insurance-max/contracts';

@Injectable()
export class TiramisInsuredDataContextGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<
      Request & {
        servicePrincipal?: ServicePrincipal;
      }
    >();

    const insuredData = request.servicePrincipal?.insuredData;

    if (
      !insuredData ||
      !insuredData.customerId ||
      !insuredData.customerSnapshotHash ||
      !insuredData.assetManifestHash
    ) {
      throw new ForbiddenException({
        code: 'TIRAMIS_INSURED_DATA_CONTEXT_REQUIRED',
        message: 'A signed customer and insured-asset context is required.',
      });
    }

    if (insuredData.assetCount < 1) {
      throw new ForbiddenException({
        code: 'TIRAMIS_INSURED_ASSET_REQUIRED',
        message: 'At least one insured asset is required.',
      });
    }

    const body = request.body as Record<string, any> | undefined;

    if (body) {
      this.validatePolicyHolderManifest(body, insuredData);
      this.validateAssetManifest(body, insuredData);
    }

    return true;
  }

  private validatePolicyHolderManifest(
    body: Record<string, any>,
    insuredData: ServicePrincipal['insuredData'],
  ): void {
    if (!Array.isArray(body.policyHolders)) {
      return;
    }

    if (!insuredData?.tiramisPolicyHolderHash) {
      throw new ForbiddenException({
        code: 'TIRAMIS_POLICYHOLDER_HASH_REQUIRED',
        message: 'A signed TIRAMIS policyholder hash is required.',
      });
    }

    const manifest = body.policyHolders
      .map((holder) => ({
        policyHolderName: String(holder.policyHolderName ?? '').trim(),
        policyHolderBirthDate: holder.policyHolderBirthDate
          ? this.formatDate(holder.policyHolderBirthDate)
          : null,
        policyHolderType: Number(holder.policyHolderType),
        policyHolderIdNumber: String(holder.policyHolderIdNumber ?? '')
          .replace(/[^A-Za-z0-9]/g, '')
          .toUpperCase(),
        policyHolderIdType: Number(holder.policyHolderIdType),
        phoneNumber: String(holder.phoneNumber ?? '').replace(/[\s()-]/g, ''),
        email:
          (holder.email ?? holder.emailAddress)?.trim().toLowerCase() ?? null,
      }))
      .sort((left, right) =>
        left.policyHolderIdNumber.localeCompare(right.policyHolderIdNumber),
      );

    this.assertHashMatches(
      manifest,
      insuredData.tiramisPolicyHolderHash,
      'tiramisPolicyHolderHash',
    );
  }

  private validateAssetManifest(
    body: Record<string, any>,
    insuredData: ServicePrincipal['insuredData'],
  ): void {
    const manifest = this.buildAssetManifest(body);

    if (!manifest) {
      return;
    }

    if (manifest.length !== insuredData?.assetCount) {
      throw new ForbiddenException({
        code: 'TIRAMIS_INSURED_ASSET_COUNT_MISMATCH',
        message: 'The signed insured-asset count does not match the payload.',
      });
    }

    this.assertHashMatches(
      manifest,
      insuredData.assetManifestHash,
      'assetManifestHash',
    );
  }

  private buildAssetManifest(body: Record<string, any>): unknown[] | null {
    const fleetItems = body.fleet?.items;

    if (Array.isArray(fleetItems)) {
      return fleetItems
        .map((item) => this.mapMotorManifestItem(item.motorDetail ?? {}))
        .sort((left, right) =>
          (left.registrationNumber ?? left.chassisNumber ?? '').localeCompare(
            right.registrationNumber ?? right.chassisNumber ?? '',
          ),
        );
    }

    if (body.motorDetail) {
      return [this.mapMotorManifestItem(body.motorDetail)];
    }

    if (Array.isArray(body.subjectMatters)) {
      return body.subjectMatters
        .map((subject) => ({
          reference: String(subject.subjectMatterReference ?? '')
            .trim()
            .toUpperCase(),
          description: String(subject.subjectMatterDesc ?? '').trim(),
        }))
        .sort((left, right) => left.reference.localeCompare(right.reference));
    }

    return null;
  }

  private mapMotorManifestItem(motor: Record<string, any>) {
    return {
      registrationNumber: this.normalizeMotorField(motor.registrationNumber),
      chassisNumber: this.normalizeMotorField(motor.chassisNumber),
      engineNumber: this.normalizeMotorField(motor.engineNumber),
      make: motor.make?.trim() ?? null,
      model: motor.model?.trim() ?? null,
      yearOfManufacture: motor.yearOfManufacture
        ? Number(motor.yearOfManufacture)
        : null,
      ownerName: motor.ownerName?.trim() ?? null,
    };
  }

  private normalizeMotorField(value: unknown): string | null {
    const normalized = String(value ?? '')
      .replace(/[^A-Za-z0-9]/g, '')
      .toUpperCase();

    return normalized || null;
  }

  private formatDate(value: unknown): string {
    if (typeof value === 'string') {
      const trimmed = value.trim();

      if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
        return trimmed.slice(0, 10);
      }
    }

    return new Date(value as string | number | Date).toISOString().slice(0, 10);
  }

  private assertHashMatches(
    manifest: unknown,
    expectedHash: string,
    fieldName: string,
  ): void {
    const actualHash = this.hashDefinition(manifest);

    if (actualHash !== expectedHash) {
      throw new ForbiddenException({
        code: 'TIRAMIS_INSURED_DATA_HASH_MISMATCH',
        message: `The signed ${fieldName} does not match the payload.`,
      });
    }
  }

  private hashDefinition(definition: unknown): string {
    return createHash('sha256')
      .update(JSON.stringify(this.sortValue(definition)), 'utf8')
      .digest('hex');
  }

  private sortValue(value: unknown): unknown {
    if (Array.isArray(value)) {
      return value.map((item) => this.sortValue(item));
    }

    if (value && typeof value === 'object') {
      return Object.keys(value)
        .sort()
        .reduce<Record<string, unknown>>((result, key) => {
          result[key] = this.sortValue((value as Record<string, unknown>)[key]);
          return result;
        }, {});
    }

    if (typeof value === 'string') {
      return value.trim().replace(/\r\n/g, '\n');
    }

    return value;
  }
}

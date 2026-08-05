import { BadRequestException, Injectable } from '@nestjs/common';

import {
  ProductDefinitionHashService,
  RequestContextService,
} from '@insurance-max/shared-kernel';
import type { ServiceProductContext } from '@insurance-max/contracts';

/**
 * Validates that incoming TIRAMIS submissions match the signed
 * product-definition context issued by Portal. TIRAMIS never invents
 * insurance wording — it only verifies what was signed.
 */
@Injectable()
export class TiramisProductWordingValidationService {
  constructor(
    private readonly requestContextService: RequestContextService,
    private readonly productDefinitionHashService: ProductDefinitionHashService,
  ) {}

  private getProductContext(): ServiceProductContext {
    const product = this.requestContextService.getServicePrincipal()?.product;

    if (!product) {
      throw new BadRequestException({
        code: 'TIRAMIS_PRODUCT_CONTEXT_REQUIRED',
        message: 'Signed product context is required.',
      });
    }

    return product;
  }

  assertCoverNoteWording(dto: {
    productCode?: string | null;
    coverNoteType?: number | null;
    coverNoteDesc?: string | null;
    operativeClause?: string | null;
  }): void {
    const product = this.getProductContext();

    this.assertSignedValue(
      dto.productCode,
      product.tiramisProductCode,
      'productCode',
    );
    this.assertSignedNumber(
      dto.coverNoteType,
      product.coverNoteType,
      'coverNoteType',
    );
    this.assertTextHash(
      dto.coverNoteDesc,
      product.coverNoteDescriptionHash,
      'coverNoteDesc',
    );
    this.assertTextHash(
      dto.operativeClause,
      product.operativeClauseHash,
      'operativeClause',
    );
  }

  assertPolicyWording(dto: {
    policyOperativeClause?: string | null;
    specialConditions?: string | null;
    exclusions?: string | null;
  }): void {
    const product = this.getProductContext();

    this.assertTextHash(
      dto.policyOperativeClause,
      product.policyOperativeClauseHash,
      'policyOperativeClause',
    );
    this.assertTextHash(
      dto.specialConditions ?? '',
      product.specialConditionsHash,
      'specialConditions',
    );
    this.assertTextHash(
      dto.exclusions ?? '',
      product.exclusionsHash,
      'exclusions',
    );
  }

  private assertSignedValue(
    value: string | null | undefined,
    expected: string,
    fieldName: string,
  ): void {
    if ((value ?? '').trim().toUpperCase() !== expected.trim().toUpperCase()) {
      throw new BadRequestException({
        code: 'SIGNED_PRODUCT_WORDING_MISMATCH',
        message: `${fieldName} does not match the signed product definition.`,
        details: { field: fieldName },
      });
    }
  }

  private assertSignedNumber(
    value: number | null | undefined,
    expected: number,
    fieldName: string,
  ): void {
    if (value !== expected) {
      throw new BadRequestException({
        code: 'SIGNED_PRODUCT_WORDING_MISMATCH',
        message: `${fieldName} does not match the signed product definition.`,
        details: { field: fieldName },
      });
    }
  }

  private assertTextHash(
    value: string | null | undefined,
    expectedHash: string,
    fieldName: string,
  ): void {
    const actualHash = this.productDefinitionHashService.hashText(value);

    if (actualHash !== expectedHash) {
      throw new BadRequestException({
        code: 'SIGNED_PRODUCT_WORDING_MISMATCH',
        message: `${fieldName} does not match the signed product definition.`,
        details: { field: fieldName },
      });
    }
  }
}

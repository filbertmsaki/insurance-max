import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';

import { resolveTiramisBusinessRecordMapping } from '../constants/tiramis-business-record-map.constant';
import { TiramisRequestType } from '../enums/tiramis-request-type.enum';

@Injectable()
export class TiramisBusinessPayloadBuilderService {
  constructor(private readonly dataSource: DataSource) {}

  async buildPayload(params: {
    requestType: TiramisRequestType;
    sourceModule: string;
    sourceRecordId: string;
    overridePayload?: Record<string, any> | null;
  }) {
    if (
      params.overridePayload &&
      typeof params.overridePayload === 'object' &&
      Object.keys(params.overridePayload).length > 0
    ) {
      return {
        payload: params.overridePayload,
        source: 'override_payload',
      };
    }

    const mapping = resolveTiramisBusinessRecordMapping({
      sourceModule: params.sourceModule,
      requestType: params.requestType,
    });

    if (!mapping) {
      throw new BadRequestException(
        `No business record mapping found for ${params.requestType}`,
      );
    }

    const record = await this.findBusinessRecord({
      tableName: mapping.tableName,
      idColumn: mapping.idColumn,
      id: params.sourceRecordId,
    });

    const storedPayload = this.extractStoredPayload(record, params.requestType);
    if (storedPayload) {
      return {
        payload: storedPayload,
        source: 'stored_json_payload',
      };
    }

    switch (params.requestType) {
      case TiramisRequestType.POLICY:
        return {
          payload: this.buildPolicyPayload(record),
          source: 'auto_policy_builder',
        };

      case TiramisRequestType.NON_MOTOR:
      case TiramisRequestType.MOTOR:
      case TiramisRequestType.MOTOR_FLEET:
        return {
          payload: this.buildCoverNotePayload(record, params.requestType),
          source: 'auto_cover_note_builder',
        };

      case TiramisRequestType.NIN_VERIFICATION:
        return {
          payload: this.buildNinVerificationPayload(record),
          source: 'auto_customer_nin_verification_builder',
        };

      case TiramisRequestType.COMPANY_VERIFICATION:
        return {
          payload: this.buildCompanyVerificationPayload(record),
          source: 'auto_customer_company_verification_builder',
        };

      case TiramisRequestType.MOTOR_VERIFICATION:
        return {
          payload: this.buildMotorVerificationPayload(record),
          source: 'auto_motor_verification_builder',
        };

      case TiramisRequestType.DETAILS_VERIFICATION:
        return {
          payload: this.buildDetailsVerificationPayload(record),
          source: 'auto_details_verification_builder',
        };

      default:
        return {
          payload: this.buildFallbackPayload(record, params.requestType),
          source: 'auto_record_fallback_builder',
        };
    }
  }

  private async findBusinessRecord(params: {
    tableName: string;
    idColumn: string;
    id: string;
  }) {
    const tableName = this.quoteIdentifier(params.tableName);
    const idColumn = this.quoteIdentifier(params.idColumn);

    const rows = await this.dataSource.query(
      `SELECT * FROM ${tableName} WHERE ${idColumn} = $1 LIMIT 1`,
      [params.id],
    );

    if (!rows?.[0]) {
      throw new NotFoundException(
        `Business record not found in ${params.tableName}`,
      );
    }

    return rows[0];
  }

  private extractStoredPayload(
    record: any,
    requestType: TiramisRequestType,
  ): Record<string, any> | null {
    const possiblePayload =
      record.payload?.[requestType] ||
      record.payload?.[String(requestType).toLowerCase()] ||
      record.payload ||
      record.tiramis_payload?.[requestType] ||
      record.tiramis_payload?.[String(requestType).toLowerCase()] ||
      record.tiramis_payload ||
      record.tiramis_request_payload ||
      null;

    if (
      possiblePayload &&
      typeof possiblePayload === 'object' &&
      Object.keys(possiblePayload).length > 0
    ) {
      return possiblePayload;
    }

    return null;
  }

  private buildPolicyPayload(record: any) {
    const policyNumber =
      this.value(record, 'policy_no', 'policyNumber') ||
      this.value(record, 'policy_number', 'policyNumber');

    return {
      insurerCompanyCode:
        this.value(record, 'insurer_company_code', 'insurerCompanyCode') ||
        this.value(record, 'company_code', 'companyCode') ||
        this.value(record, 'insurer_company_id', 'insurerCompanyId'),
      policyNumber: this.required('policyNumber', policyNumber),
      policyOperativeClause:
        this.value(
          record,
          'policy_operative_clause',
          'policyOperativeClause',
          'operative_clause',
          'policyClause',
        ) ||
        this.value(record, 'metadata')?.policyOperativeClause ||
        this.value(record, 'metadata')?.policy_operative_clause,
      specialConditions:
        this.value(
          record,
          'special_conditions',
          'specialConditions',
        ) || this.value(record, 'metadata')?.specialConditions,
      exclusions:
        this.value(record, 'exclusions') ||
        this.value(record, 'metadata')?.exclusions,
      coverNoteReferenceNumbers: this.toArray(
        this.value(
          record,
          'cover_note_reference_numbers',
          'coverNoteReferenceNumbers',
          'cover_note_refs',
        ) ||
          this.value(record, 'cover_note_no', 'coverNoteNo') ||
          this.value(record, 'metadata')?.coverNoteReferenceNumbers,
      ),
    };
  }

  private buildCoverNotePayload(record: any, requestType: TiramisRequestType) {
    const storedPayload = this.extractStoredPayload(record, requestType);
    if (storedPayload) {
      return storedPayload;
    }

    const reference =
      this.value(record, 'cover_note_no', 'coverNoteNo') ||
      this.value(record, 'policy_no', 'policyNumber') ||
      this.value(record, 'fleet_no', 'fleetNo');

    if (!reference) {
      throw new BadRequestException(
        'Automatic cover note payload builder requires tiramis_payload or a cover note / policy / fleet reference on the business record.',
      );
    }

    return {
      insurerCompanyCode:
        this.value(record, 'insurer_company_code', 'insurerCompanyCode') ||
        this.value(record, 'company_code', 'companyCode') ||
        this.value(record, 'insurer_company_id', 'insurerCompanyId'),
      coverNoteReferenceNumber: reference,
      policyNumber: this.value(record, 'policy_no', 'policyNumber') || reference,
      fleet: this.value(record, 'fleet_no', 'fleetNo')
        ? {
            fleetId: this.value(record, 'fleet_no', 'fleetNo'),
            fleetName: this.value(record, 'fleet_name', 'fleetName'),
          }
        : undefined,
    };
  }

  private buildFallbackPayload(record: any, requestType: TiramisRequestType) {
    const storedPayload = this.extractStoredPayload(record, requestType);
    if (storedPayload) {
      return storedPayload;
    }

    throw new BadRequestException(
      `Automatic payload builder could not infer a payload for ${requestType}. Store a ready payload in payload/tiramis_payload or pass an override payload.`,
    );
  }

  private buildNinVerificationPayload(record: any) {
    return {
      nin: this.required(
        'nin',
        this.value(record, 'nida_no', 'nidaNo', 'nin', 'NIN', 'id_number'),
      ),
      customerName: this.buildCustomerName(record),
      customerNumber: this.value(record, 'customer_no', 'customerNo'),
    };
  }

  private buildCompanyVerificationPayload(record: any) {
    return {
      companyName: this.required(
        'companyName',
        this.value(record, 'company_name', 'companyName'),
      ),
      tin: this.value(record, 'tin', 'TIN'),
      registrationNumber: this.value(
        record,
        'registration_no',
        'registrationNumber',
      ),
      incorporationCertificateNumber: this.value(
        record,
        'incorporation_certificate_no',
        'incorporationCertificateNumber',
      ),
      customerNumber: this.value(record, 'customer_no', 'customerNo'),
    };
  }

  private buildMotorVerificationPayload(record: any) {
    return {
      motorRegistrationNumber: this.required(
        'motorRegistrationNumber',
        this.value(
          record,
          'registration_no',
          'registrationNumber',
          'motorRegistrationNumber',
        ),
      ),
      motorChassisNumber: this.value(
        record,
        'chassis_no',
        'chassisNumber',
        'motorChassisNumber',
      ),
      engineNumber: this.value(record, 'engine_no', 'engineNumber'),
      make: this.value(record, 'make'),
      model: this.value(record, 'model'),
    };
  }

  private buildDetailsVerificationPayload(record: any) {
    return {
      coverNoteReferenceNumber: this.value(
        record,
        'cover_note_reference_number',
        'coverNoteReferenceNumber',
        'cover_note_no',
        'coverNoteNo',
      ),
      stickerNumber: this.value(record, 'sticker_no', 'stickerNumber'),
      motorRegistrationNumber: this.value(
        record,
        'registration_no',
        'registrationNumber',
        'motorRegistrationNumber',
      ),
      motorChassisNumber: this.value(
        record,
        'chassis_no',
        'chassisNumber',
        'motorChassisNumber',
      ),
      nin: this.value(record, 'nida_no', 'nidaNo', 'nin', 'NIN', 'id_number'),
      tin: this.value(record, 'tin', 'TIN'),
      policyNumber: this.value(record, 'policy_no', 'policyNumber'),
      customerName: this.buildCustomerName(record),
      companyName: this.value(record, 'company_name', 'companyName'),
    };
  }

  private buildCustomerName(record: any): string | null {
    const companyName = this.value(record, 'company_name', 'companyName');

    if (companyName) {
      return companyName;
    }

    const names = [
      this.value(record, 'first_name', 'firstName'),
      this.value(record, 'middle_name', 'middleName'),
      this.value(record, 'last_name', 'lastName'),
    ].filter(Boolean);

    return names.length ? names.join(' ') : null;
  }

  private value(record: any, ...keys: string[]) {
    for (const key of keys) {
      if (
        record?.[key] !== undefined &&
        record?.[key] !== null &&
        record?.[key] !== ''
      ) {
        return record[key];
      }
    }

    return null;
  }

  private required(label: string, value: any) {
    if (value === null || value === undefined || value === '') {
      throw new BadRequestException(
        `Cannot build TIRAMIS payload. Missing required field: ${label}`,
      );
    }

    return value;
  }

  private toArray(value: any): any[] {
    if (!value) {
      return [];
    }

    if (Array.isArray(value)) {
      return value;
    }

    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [parsed];
      } catch {
        return value
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean);
      }
    }

    if (typeof value === 'object') {
      return [value];
    }

    return [];
  }

  private quoteIdentifier(identifier: string): string {
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(identifier)) {
      throw new Error(`Unsafe SQL identifier: ${identifier}`);
    }

    return `"${identifier}"`;
  }
}

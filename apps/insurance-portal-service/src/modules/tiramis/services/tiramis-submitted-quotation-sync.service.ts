import { ConflictException, Injectable } from '@nestjs/common';
import { XMLParser } from 'fast-xml-parser';
import { DataSource, EntityManager } from 'typeorm';

import { parseTiramisDateTime } from '../../tenant/quotations/utils/tiramis-date.util';

type XmlRecord = Record<string, unknown>;
type FieldMap = Record<string, string>;
type Change = {
  table: string;
  rowId: string;
  field: string;
  previous: unknown;
  submitted: unknown;
};

const COVER_NOTE_FIELDS: FieldMap = {
  cover_note_type: 'CoverNoteType',
  sale_point_code: 'SalePointCode',
  cover_note_start_date: 'CoverNoteStartDate',
  cover_note_end_date: 'CoverNoteEndDate',
  payment_mode: 'PaymentMode',
  currency_code: 'CurrencyCode',
  exchange_rate: 'ExchangeRate',
  total_premium_excluding_tax: 'TotalPremiumExcludingTax',
  total_premium_including_tax: 'TotalPremiumIncludingTax',
  commission_paid: 'CommisionPaid',
  commission_rate: 'CommisionRate',
  officer_name: 'OfficerName',
  officer_title: 'OfficerTitle',
  product_code: 'ProductCode',
  fleet_id: 'FleetId',
  fleet_type: 'FleetType',
  fleet_size: 'FleetSize',
  comprehensive_insured: 'ComprehensiveInsured',
};
const ENTRY_FIELDS: FieldMap = {
  fleet_entry: 'FleetEntry',
  prev_cover_note_reference_number: 'PrevCoverNoteReferenceNumber',
  cover_note_desc: 'CoverNoteDesc',
  operative_clause: 'OperativeClause',
  endorsement_type: 'EndorsementType',
  endorsement_reason: 'EndorsementReason',
  endorsement_premium_earned: 'EndorsementPremiumEarned',
};
const HOLDER_FIELDS: FieldMap = {
  policy_holder_name: 'PolicyHolderName',
  policy_holder_birth_date: 'PolicyHolderBirthDate',
  policy_holder_type: 'PolicyHolderType',
  policy_holder_id_number: 'PolicyHolderIdNumber',
  policy_holder_id_type: 'PolicyHolderIdType',
  gender: 'Gender',
  country_code: 'CountryCode',
  region: 'Region',
  district: 'District',
  street: 'Street',
  policy_holder_phone_number: 'PolicyHolderPhoneNumber',
  policy_holder_fax: 'PolicyHolderFax',
  postal_address: 'PostalAddress',
  email_address: 'EmailAddress',
};
const RISK_FIELDS: FieldMap = {
  sum_insured: 'SumInsured',
  sum_insured_equivalent: 'SumInsuredEquivalent',
  premium_rate: 'PremiumRate',
  premium_before_discount: 'PremiumBeforeDiscount',
  premium_after_discount: 'PremiumAfterDiscount',
  premium_excluding_tax_equivalent: 'PremiumExcludingTaxEquivalent',
  premium_including_tax: 'PremiumIncludingTax',
};
const DISCOUNT_FIELDS: FieldMap = {
  discount_type: 'DiscountType',
  discount_rate: 'DiscountRate',
  discount_amount: 'DiscountAmount',
};
const TAX_FIELDS: FieldMap = {
  is_tax_exempted: 'IsTaxExempted',
  tax_exemption_type: 'TaxExemptionType',
  tax_exemption_reference: 'TaxExemptionReference',
  tax_rate: 'TaxRate',
  tax_amount: 'TaxAmount',
};
const SUBJECT_FIELDS: FieldMap = {
  subject_matter_desc: 'SubjectMatterDesc',
};
const ADDON_FIELDS: FieldMap = {
  addon_desc: 'AddonDesc',
  addon_amount: 'AddonAmount',
  addon_premium_rate: 'AddonPremiumRate',
  premium_excluding_tax: 'PremiumExcludingTax',
  premium_excluding_tax_equivalent: 'PremiumExcludingTaxEquivalent',
  premium_including_tax: 'PremiumIncludingTax',
};
const MOTOR_FIELDS: FieldMap = {
  motor_category: 'MotorCategory',
  motor_type: 'MotorType',
  registration_number: 'RegistrationNumber',
  chassis_number: 'ChassisNumber',
  make: 'Make',
  model: 'Model',
  model_number: 'ModelNumber',
  body_type: 'BodyType',
  color: 'Color',
  engine_number: 'EngineNumber',
  engine_capacity: 'EngineCapacity',
  fuel_used: 'FuelUsed',
  number_of_axles: 'NumberOfAxles',
  axle_distance: 'AxleDistance',
  sitting_capacity: 'SittingCapacity',
  year_of_manufacture: 'YearOfManufacture',
  tare_weight: 'TareWeight',
  gross_weight: 'GrossWeight',
  motor_usage: 'MotorUsage',
  owner_name: 'OwnerName',
  owner_category: 'OwnerCategory',
  owner_address: 'OwnerAddress',
};
const INTEGER_FIELDS = new Set([
  'cover_note_type',
  'payment_mode',
  'fleet_type',
  'fleet_size',
  'fleet_entry',
  'comprehensive_insured',
  'endorsement_type',
  'policy_holder_type',
  'policy_holder_id_type',
  'discount_type',
  'motor_category',
  'motor_type',
  'number_of_axles',
  'sitting_capacity',
  'year_of_manufacture',
  'motor_usage',
  'owner_category',
]);
const NUMERIC_FIELDS = new Set([
  'exchange_rate',
  'total_premium_excluding_tax',
  'total_premium_including_tax',
  'commission_paid',
  'commission_rate',
  'endorsement_premium_earned',
  'sum_insured',
  'sum_insured_equivalent',
  'premium_rate',
  'premium_before_discount',
  'premium_after_discount',
  'premium_excluding_tax_equivalent',
  'premium_including_tax',
  'discount_rate',
  'discount_amount',
  'tax_rate',
  'tax_amount',
  'addon_amount',
  'addon_premium_rate',
  'premium_excluding_tax',
  'axle_distance',
  'tare_weight',
  'gross_weight',
]);
const NULLABLE_FIELDS = new Set([
  'fleet_id',
  'fleet_type',
  'fleet_size',
  'comprehensive_insured',
  'prev_cover_note_reference_number',
  'endorsement_type',
  'endorsement_reason',
  'endorsement_premium_earned',
  'gender',
  'street',
  'policy_holder_fax',
  'postal_address',
  'email_address',
  'tax_exemption_type',
  'tax_exemption_reference',
  'registration_number',
  'model_number',
  'number_of_axles',
  'axle_distance',
  'sitting_capacity',
  'motor_usage',
  'owner_address',
]);

@Injectable()
export class TiramisSubmittedQuotationSyncService {
  private readonly parser = new XMLParser({
    ignoreAttributes: false,
    parseTagValue: false,
    trimValues: true,
  });

  constructor(private readonly dataSource: DataSource) {}

  async reconcile(params: {
    companyId: string;
    quotationId: string;
    requestId: string;
    requestXml: string;
  }): Promise<{ changed: number }> {
    const root = this.record(this.parser.parse(params.requestXml)?.TiraMsg);
    const body = this.record(root.MotorCoverNoteRefReq ?? root.CoverNoteRefReq);
    const header = this.record(body.CoverNoteHdr);
    const detail = this.record(body.CoverNoteDtl);
    if (!Object.keys(detail).length || header.RequestId !== params.requestId) {
      throw new ConflictException(
        'Submitted TIRA request does not match the notification request ID',
      );
    }
    const fleet = this.record(detail.FleetHdr);
    const cover = Object.keys(fleet).length ? fleet : detail;
    for (const key of [
      'CoverNoteStartDate',
      'CoverNoteEndDate',
      'ProductCode',
    ]) {
      if (typeof cover[key] !== 'string' || !cover[key]) {
        throw new ConflictException(`Submitted TIRA request is missing ${key}`);
      }
    }

    return this.dataSource.transaction(async (manager) => {
      const quotations = await manager.query(
        'SELECT * FROM quotations WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL FOR UPDATE',
        [params.quotationId, params.companyId],
      );
      const quotation = quotations[0];
      if (!quotation)
        throw new ConflictException(
          'Quotation not found for submitted TIRA request',
        );
      if (
        quotation.tira_request_id &&
        quotation.tira_request_id !== params.requestId
      ) {
        throw new ConflictException(
          'A different TIRA request is current for this quotation',
        );
      }
      const changes: Change[] = [];
      const notes = await this.rows(
        manager,
        'quotation_cover_notes',
        'quotation_id',
        quotation.id,
      );
      if (notes.length !== 1)
        throw new ConflictException('Quotation cover note is missing');
      const note = notes[0];
      if (String(note.product_code) !== String(cover.ProductCode)) {
        throw new ConflictException(
          'Submitted TIRA product differs from the configured quotation product',
        );
      }
      await this.update(
        manager,
        'quotation_cover_notes',
        note,
        {
          ...header,
          ...cover,
        },
        COVER_NOTE_FIELDS,
        changes,
      );

      const entries = await this.rows(
        manager,
        'quotation_cover_note_entries',
        'cover_note_id',
        note.id,
      );
      const submittedEntries = Object.keys(fleet).length
        ? this.list(detail.FleetDtl)
        : [detail];
      this.assertCount('cover note entries', entries, submittedEntries);
      for (let index = 0; index < entries.length; index += 1) {
        const entry = entries[index];
        const submitted = this.record(submittedEntries[index]);
        if (
          String(entry.cover_note_number) !== String(submitted.CoverNoteNumber)
        ) {
          throw new ConflictException(
            'Submitted cover note entry identity differs from the quotation',
          );
        }
        await this.update(
          manager,
          'quotation_cover_note_entries',
          entry,
          submitted,
          ENTRY_FIELDS,
          changes,
        );
        await this.syncEntry(manager, entry, submitted, changes);
      }

      const holders = await this.rows(
        manager,
        'quotation_policy_holders',
        'quotation_id',
        quotation.id,
      );
      const submittedHolders = this.list(
        this.record(cover.PolicyHolders).PolicyHolder,
      );
      this.assertCount('policy holders', holders, submittedHolders);
      for (let index = 0; index < holders.length; index += 1) {
        await this.update(
          manager,
          'quotation_policy_holders',
          holders[index],
          this.record(submittedHolders[index]),
          HOLDER_FIELDS,
          changes,
        );
      }

      if (changes.length) {
        await manager.query(
          `INSERT INTO quotation_status_history
            (quotation_id, previous_quotation_status, new_quotation_status,
             previous_approval_status, new_approval_status,
             previous_payment_status, new_payment_status,
             previous_tira_status, new_tira_status, transition_type,
             changed_by_type, source, request_id, tira_request_id, metadata, created_at)
           VALUES ($1,$2,$2,$3,$3,$4,$4,$5,$5,'TIRAMIS_PAYLOAD_SYNC',
             'SYSTEM','TIRAMIS',$6,$6,$7::jsonb,now())`,
          [
            quotation.id,
            quotation.quotation_status,
            quotation.approval_status,
            quotation.payment_status,
            quotation.tira_status,
            params.requestId,
            JSON.stringify({ changes }),
          ],
        );
      }
      return { changed: changes.length };
    });
  }

  private async syncEntry(
    manager: EntityManager,
    entry: XmlRecord,
    submitted: XmlRecord,
    changes: Change[],
  ) {
    const motors = await this.rows(
      manager,
      'quotation_motor_details',
      'entry_id',
      entry.id,
    );
    if (submitted.MotorDtl) {
      if (motors.length !== 1)
        throw new ConflictException(
          'Submitted motor detail has no quotation match',
        );
      await this.update(
        manager,
        'quotation_motor_details',
        motors[0],
        this.record(submitted.MotorDtl),
        MOTOR_FIELDS,
        changes,
      );
    } else if (motors.length) {
      throw new ConflictException(
        'Quotation motor detail is absent from submitted request',
      );
    }
    const risks = await this.rows(
      manager,
      'quotation_entry_risks',
      'entry_id',
      entry.id,
    );
    const submittedRisks = this.list(
      this.record(submitted.RisksCovered).RiskCovered,
    );
    this.assertCount('risks', risks, submittedRisks);
    for (let index = 0; index < risks.length; index += 1) {
      const risk = risks[index];
      const value = this.record(submittedRisks[index]);
      if (String(risk.risk_code) !== String(value.RiskCode)) {
        throw new ConflictException(
          'Submitted risk identity differs from the quotation',
        );
      }
      await this.update(
        manager,
        'quotation_entry_risks',
        risk,
        value,
        RISK_FIELDS,
        changes,
      );
      await this.syncNested(
        manager,
        'quotation_risk_discounts',
        'risk_id',
        risk.id,
        this.list(this.record(value.DiscountsOffered).DiscountOffered),
        DISCOUNT_FIELDS,
        changes,
      );
      await this.syncNested(
        manager,
        'quotation_risk_taxes',
        'risk_id',
        risk.id,
        this.list(this.record(value.TaxesCharged).TaxCharged),
        TAX_FIELDS,
        changes,
        'tax_code',
        'TaxCode',
      );
    }
    await this.syncNested(
      manager,
      'quotation_subject_matters',
      'entry_id',
      entry.id,
      this.list(this.record(submitted.SubjectMattersCovered).SubjectMatter),
      SUBJECT_FIELDS,
      changes,
      'subject_matter_reference',
      'SubjectMatterReference',
    );
    const addons = await this.rows(
      manager,
      'quotation_entry_addons',
      'entry_id',
      entry.id,
    );
    const submittedAddons = this.list(
      this.record(submitted.CoverNoteAddons).CoverNoteAddon,
    );
    this.assertCount('addons', addons, submittedAddons);
    for (let index = 0; index < addons.length; index += 1) {
      const addon = addons[index];
      const value = this.record(submittedAddons[index]);
      if (String(addon.addon_reference) !== String(value.AddonReference)) {
        throw new ConflictException(
          'Submitted addon identity differs from the quotation',
        );
      }
      await this.update(
        manager,
        'quotation_entry_addons',
        addon,
        value,
        ADDON_FIELDS,
        changes,
      );
      await this.syncNested(
        manager,
        'quotation_entry_addon_taxes',
        'addon_id',
        addon.id,
        this.list(this.record(value.TaxesCharged).TaxCharged),
        TAX_FIELDS,
        changes,
        'tax_code',
        'TaxCode',
      );
    }
  }

  private async syncNested(
    manager: EntityManager,
    table: string,
    foreignKey: string,
    parentId: unknown,
    values: unknown[],
    fields: FieldMap,
    changes: Change[],
    identityColumn?: string,
    identityKey?: string,
  ) {
    const rows = await this.rows(manager, table, foreignKey, parentId);
    this.assertCount(table, rows, values);
    for (let index = 0; index < rows.length; index += 1) {
      const value = this.record(values[index]);
      if (
        identityColumn &&
        String(rows[index][identityColumn]) !== String(value[identityKey!])
      ) {
        throw new ConflictException(
          `Submitted ${table} identity differs from quotation`,
        );
      }
      await this.update(manager, table, rows[index], value, fields, changes);
    }
  }

  private async rows(
    manager: EntityManager,
    table: string,
    key: string,
    value: unknown,
  ): Promise<XmlRecord[]> {
    const order =
      table === 'quotation_cover_note_entries'
        ? 'entry_number'
        : table === 'quotation_cover_notes' ||
            table === 'quotation_motor_details'
          ? 'id'
          : 'sequence_no';
    return manager.query(
      `SELECT * FROM ${table} WHERE ${key} = $1 ORDER BY ${order} FOR UPDATE`,
      [value],
    );
  }

  private async update(
    manager: EntityManager,
    table: string,
    row: XmlRecord,
    source: XmlRecord,
    fields: FieldMap,
    changes: Change[],
  ) {
    const patch: Record<string, unknown> = {};
    for (const [column, key] of Object.entries(fields)) {
      if (source[key] === undefined) continue;
      const submitted = this.convert(column, source[key], row[column]);
      if (this.equal(column, row[column], submitted)) continue;
      patch[column] = submitted;
      changes.push({
        table,
        rowId: String(row.id),
        field: column,
        previous: this.auditValue(row[column]),
        submitted: this.auditValue(submitted),
      });
    }
    const columns = Object.keys(patch);
    if (!columns.length) return;
    await manager.query(
      `UPDATE ${table} SET ${columns.map((column, index) => `${column} = $${index + 1}`).join(', ')}, updated_at = now() WHERE id = $${columns.length + 1}`,
      [...columns.map((column) => patch[column]), row.id],
    );
  }

  private convert(column: string, value: unknown, previous: unknown): unknown {
    if (value === '' && NULLABLE_FIELDS.has(column)) return null;
    if (value === '' && previous == null) return null;
    if (
      column === 'cover_note_start_date' ||
      column === 'cover_note_end_date'
    ) {
      const parsed = parseTiramisDateTime(String(value));
      if (Number.isNaN(parsed.getTime()))
        throw new ConflictException('Invalid submitted cover date');
      return parsed;
    }
    if (column === 'policy_holder_birth_date') {
      if (!value)
        throw new ConflictException(
          'Submitted policy holder birth date is missing',
        );
      return String(value).slice(0, 10);
    }
    if (INTEGER_FIELDS.has(column)) {
      if (value === '')
        throw new ConflictException(`Submitted ${column} is missing`);
      const numeric = Number(value);
      if (!Number.isInteger(numeric))
        throw new ConflictException(`Invalid submitted ${column}`);
      return numeric;
    }
    return value === '' && previous === null ? null : String(value);
  }

  private equal(column: string, left: unknown, right: unknown): boolean {
    if (left instanceof Date || right instanceof Date) {
      return (
        new Date(left as any).getTime() === new Date(right as any).getTime()
      );
    }
    if (left == null || right == null) return left == null && right == null;
    if (
      (NUMERIC_FIELDS.has(column) || INTEGER_FIELDS.has(column)) &&
      /^-?\d+(?:\.\d+)?$/.test(String(left)) &&
      /^-?\d+(?:\.\d+)?$/.test(String(right))
    ) {
      return this.decimal(String(left)) === this.decimal(String(right));
    }
    return String(left) === String(right);
  }

  private decimal(value: string): string {
    const [integer, fraction = ''] = value.split('.');
    return `${BigInt(integer).toString()}.${fraction.replace(/0+$/, '')}`;
  }

  private auditValue(value: unknown): unknown {
    return value instanceof Date ? value.toISOString() : value;
  }

  private assertCount(label: string, rows: unknown[], values: unknown[]) {
    if (rows.length !== values.length) {
      throw new ConflictException(
        `Submitted ${label} structure differs from quotation`,
      );
    }
  }

  private record(value: unknown): XmlRecord {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as XmlRecord)
      : {};
  }

  private list(value: unknown): unknown[] {
    return value == null || value === ''
      ? []
      : Array.isArray(value)
        ? value
        : [value];
  }
}

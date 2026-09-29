import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

export interface FleetVehicleRow {
  entry_id: string;
  entry_number: number;
  registration_number: string | null;
  chassis_number: string | null;
  make: string | null;
  model: string | null;
  body_type: string | null;
  year_of_manufacture: number | null;
  risk_codes: string[];
  sum_insured: number;
  premium_excluding_tax: number;
  premium_including_tax: number;
  cover_note_number: string | null;
  cover_note_reference_number: string | null;
  sticker_number: string | null;
  cover_note_status: string | null;
  motor_vehicle_id: string | null;
  fleet_item_id: string | null;
  policy_risk_statuses: string[];
}

export interface FleetSummary {
  fleet_id: string | null;
  fleet_reference: string | null;
  fleet_type: number | null;
  fleet_size: number | null;
  comprehensive_insured: number | null;
  register_fleet_id: string | null;
  register_status: string | null;
  vehicles: FleetVehicleRow[];
  totals: {
    vehicles: number;
    sum_insured: number;
    premium_excluding_tax: number;
    premium_including_tax: number;
    issued_cover_notes: number;
  };
}

type RawRow = Record<string, unknown>;

const num = (value: unknown) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};
const str = (value: unknown) =>
  value === null || value === undefined ? null : String(value);

/**
 * Vehicle-level view of a fleet quotation or fleet policy. Each vehicle is a
 * `FLEET_ITEM` cover-note entry; this joins it to its risks (premium), its
 * issued cover note (TIRA reference and sticker), the fleet register item and,
 * for policies, the policy risks created from it.
 *
 * Callers must have already authorised access to the quotation/policy (the
 * line-scoped query service applies data scope); this service only reads.
 */
@Injectable()
export class FleetVehiclesService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async forQuotation(quotationId: string): Promise<FleetSummary> {
    return this.build(quotationId, null);
  }

  async forPolicy(policyId: string): Promise<FleetSummary> {
    const [policy] = await this.dataSource.query<
      Array<{ quotation_id: string | null }>
    >(`SELECT quotation_id FROM policies WHERE id = $1`, [policyId]);
    return this.build(policy?.quotation_id ?? null, policyId);
  }

  private async build(
    quotationId: string | null,
    policyId: string | null,
  ): Promise<FleetSummary> {
    if (!quotationId) return this.empty();

    const [header] = await this.dataSource.query<RawRow[]>(
      `SELECT qcn.fleet_id, qcn.fleet_type, qcn.fleet_size,
              qcn.comprehensive_insured,
              fleet.id AS register_fleet_id, fleet.status AS register_status
         FROM quotation_cover_notes qcn
         LEFT JOIN motor_fleets fleet
           ON fleet.quotation_id = qcn.quotation_id AND fleet.deleted_at IS NULL
        WHERE qcn.quotation_id = $1
        LIMIT 1`,
      [quotationId],
    );

    const rows = await this.dataSource.query<RawRow[]>(
      `SELECT entry.id AS entry_id,
              entry.entry_number,
              entry.cover_note_number AS entry_cover_note_number,
              detail.registration_number,
              detail.chassis_number,
              detail.make,
              detail.model,
              detail.body_type,
              detail.year_of_manufacture,
              risk_totals.risk_codes,
              risk_totals.sum_insured,
              risk_totals.premium_excluding_tax,
              risk_totals.premium_including_tax,
              cover_note.cover_note_number,
              cover_note.cover_note_reference_number,
              cover_note.sticker_number,
              cover_note.status AS cover_note_status,
              fleet_item.id AS fleet_item_id,
              fleet_item.motor_vehicle_id,
              policy_risks.statuses AS policy_risk_statuses
         FROM quotation_cover_notes qcn
         JOIN quotation_cover_note_entries entry
           ON entry.cover_note_id = qcn.id
         LEFT JOIN quotation_motor_details detail
           ON detail.entry_id = entry.id
         LEFT JOIN LATERAL (
           SELECT array_agg(risk.risk_code ORDER BY risk.sequence_no) AS risk_codes,
                  COALESCE(SUM(risk.sum_insured), 0) AS sum_insured,
                  COALESCE(SUM(risk.premium_excluding_tax_equivalent), 0)
                    AS premium_excluding_tax,
                  COALESCE(SUM(risk.premium_including_tax), 0)
                    AS premium_including_tax,
                  array_agg(risk.id) AS risk_ids
             FROM quotation_entry_risks risk
            WHERE risk.entry_id = entry.id
         ) risk_totals ON true
         LEFT JOIN cover_notes cover_note
           ON cover_note.quotation_entry_id = entry.id
          AND cover_note.deleted_at IS NULL
         LEFT JOIN LATERAL (
           SELECT item.id, item.motor_vehicle_id
             FROM motor_fleet_items item
             JOIN motor_fleets fleet ON fleet.id = item.fleet_id
            WHERE fleet.quotation_id = qcn.quotation_id
              AND item.deleted_at IS NULL
              AND item.quotation_entry_risk_id = ANY(risk_totals.risk_ids)
            LIMIT 1
         ) fleet_item ON true
         LEFT JOIN LATERAL (
           SELECT array_agg(DISTINCT policy_risk.status) AS statuses
             FROM policy_risks policy_risk
            WHERE $2::uuid IS NOT NULL
              AND policy_risk.policy_id = $2::uuid
              AND policy_risk.deleted_at IS NULL
              AND policy_risk.quotation_entry_risk_id = ANY(risk_totals.risk_ids)
         ) policy_risks ON true
        WHERE qcn.quotation_id = $1
          AND entry.entry_type = 'FLEET_ITEM'
        ORDER BY entry.entry_number`,
      [quotationId, policyId],
    );

    const vehicles: FleetVehicleRow[] = rows.map((row) => ({
      entry_id: String(row.entry_id),
      entry_number: num(row.entry_number),
      registration_number: str(row.registration_number),
      chassis_number: str(row.chassis_number),
      make: str(row.make),
      model: str(row.model),
      body_type: str(row.body_type),
      year_of_manufacture:
        row.year_of_manufacture == null ? null : num(row.year_of_manufacture),
      risk_codes: ((row.risk_codes as string[] | null) ?? []).filter(Boolean),
      sum_insured: num(row.sum_insured),
      premium_excluding_tax: num(row.premium_excluding_tax),
      premium_including_tax: num(row.premium_including_tax),
      cover_note_number:
        str(row.cover_note_number) ?? str(row.entry_cover_note_number),
      cover_note_reference_number: str(row.cover_note_reference_number),
      sticker_number: str(row.sticker_number),
      cover_note_status: str(row.cover_note_status),
      motor_vehicle_id: str(row.motor_vehicle_id),
      fleet_item_id: str(row.fleet_item_id),
      policy_risk_statuses: (
        (row.policy_risk_statuses as string[] | null) ?? []
      ).filter(Boolean),
    }));

    return {
      fleet_id: str(header?.fleet_id),
      fleet_reference: str(header?.fleet_id),
      fleet_type: header?.fleet_type == null ? null : num(header.fleet_type),
      fleet_size: header?.fleet_size == null ? null : num(header.fleet_size),
      comprehensive_insured:
        header?.comprehensive_insured == null
          ? null
          : num(header.comprehensive_insured),
      register_fleet_id: str(header?.register_fleet_id),
      register_status: str(header?.register_status),
      vehicles,
      totals: {
        vehicles: vehicles.length,
        sum_insured: vehicles.reduce((sum, v) => sum + v.sum_insured, 0),
        premium_excluding_tax: vehicles.reduce(
          (sum, v) => sum + v.premium_excluding_tax,
          0,
        ),
        premium_including_tax: vehicles.reduce(
          (sum, v) => sum + v.premium_including_tax,
          0,
        ),
        issued_cover_notes: vehicles.filter(
          (v) => v.cover_note_reference_number,
        ).length,
      },
    };
  }

  private empty(): FleetSummary {
    return {
      fleet_id: null,
      fleet_reference: null,
      fleet_type: null,
      fleet_size: null,
      comprehensive_insured: null,
      register_fleet_id: null,
      register_status: null,
      vehicles: [],
      totals: {
        vehicles: 0,
        sum_insured: 0,
        premium_excluding_tax: 0,
        premium_including_tax: 0,
        issued_cover_notes: 0,
      },
    };
  }
}

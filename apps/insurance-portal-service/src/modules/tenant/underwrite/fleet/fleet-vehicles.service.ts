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
  /** TIRA FleetEntry (policies: from the snapshot, else the entry number). */
  fleet_entry: number;
  /** Policies: ADDED = added mid-term; REMOVED = pending removal. */
  vehicle_status: FleetVehicleStatus;
  /** Effective date the vehicle was added mid-term, else null. */
  added_at: string | null;
  /** Date the vehicle went off cover, else null. */
  removed_at: string | null;
}

export type FleetVehicleStatus = 'ACTIVE' | 'ADDED' | 'REMOVED' | 'CANCELLED';

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
const asObject = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
const asArray = (value: unknown): Array<Record<string, unknown>> =>
  Array.isArray(value)
    ? value
        .map((item) => asObject(item))
        .filter((item): item is Record<string, unknown> => !!item)
    : [];
/** Same rule as MotorService: letters and digits only, upper case. */
const normalizeId = (value: unknown) =>
  typeof value === 'string'
    ? value.replace(/[^A-Za-z0-9]/g, '').toUpperCase() || null
    : null;
const sameId = (left: unknown, right: unknown) => {
  const a = normalizeId(left);
  return !!a && a === normalizeId(right);
};
const dateOnly = (value: unknown): string | null => {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date) {
    // node-postgres parses DATE columns as local midnight.
    if (Number.isNaN(value.getTime())) return null;
    const pad = (part: number) => String(part).padStart(2, '0');
    return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
  }
  return String(value).slice(0, 10);
};
/** Same rule as the fleet endorsement services. */
const fleetEntryOf = (entry: Record<string, unknown>, index: number) => {
  const value = Number(entry['fleetEntry'] ?? entry['entryNumber']);
  return Number.isInteger(value) && value > 0 ? value : index + 1;
};

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

  /**
   * The policy's vehicles as they stand on its current version: the issued
   * fleet items, plus vehicles added mid-term (which have no quotation
   * entry), with each vehicle's cover status. Removed vehicles stay listed as
   * CANCELLED but are left out of the totals.
   */
  async forPolicy(policyId: string): Promise<FleetSummary> {
    const [policy] = await this.dataSource.query<
      Array<{ quotation_id: string | null; active_version_id: string | null }>
    >(`SELECT quotation_id, active_version_id FROM policies WHERE id = $1`, [
      policyId,
    ]);
    const base = await this.build(policy?.quotation_id ?? null, policyId);

    const [version] = await this.dataSource.query<
      Array<{ policy_snapshot: unknown }>
    >(
      `SELECT policy_snapshot
         FROM policy_versions
        WHERE policy_id = $1
        ORDER BY (id = $2::uuid) DESC NULLS LAST, is_current DESC,
                 version_number DESC
        LIMIT 1`,
      [policyId, policy?.active_version_id ?? null],
    );
    const snapshot = asObject(version?.policy_snapshot) ?? {};
    const entries = asArray(snapshot['entries']);
    const snapshotNotes = asArray(snapshot['coverNotes']);
    const vehicleRisks = await this.policyVehicleRisks(policyId);

    if (!entries.length) {
      const vehicles = base.vehicles.map((row) =>
        this.withCoverStatus(row, null, this.riskFor(vehicleRisks, row)),
      );
      return { ...base, vehicles, totals: this.totals(vehicles) };
    }

    const addedNotes = await this.addedCoverNotes(policyId);
    const unmatched = new Set(base.vehicles);
    const vehicles = entries.map((entry, index) => {
      const fleetEntry = fleetEntryOf(entry, index);
      const motor = asObject(entry['motor']) ?? {};
      const row =
        base.vehicles.find(
          (vehicle) =>
            entry['entryId'] && vehicle.entry_id === entry['entryId'],
        ) ??
        base.vehicles.find(
          (vehicle) =>
            unmatched.has(vehicle) &&
            sameId(vehicle.chassis_number, motor['chassisNumber']),
        );
      const note = this.snapshotNoteFor(snapshotNotes, entry, fleetEntry);

      if (row) {
        unmatched.delete(row);
        return this.withCoverStatus(
          {
            ...row,
            fleet_entry: fleetEntry,
            cover_note_number:
              str(note?.['coverNoteNumber']) ?? row.cover_note_number,
            cover_note_reference_number:
              str(note?.['coverNoteReferenceNumber']) ??
              row.cover_note_reference_number,
            sticker_number: str(note?.['stickerNumber']) ?? row.sticker_number,
          },
          entry,
          this.riskFor(vehicleRisks, row, motor),
        );
      }

      // Added mid-term: no quotation entry; its own cover note carries the
      // TIRA reference, sticker and remaining-period premium.
      const coverNote = addedNotes.find(
        (candidate) => num(candidate.fleet_entry) === fleetEntry,
      );
      const risk = this.riskFor(vehicleRisks, null, motor);
      const entryRisks = asArray(entry['risks']);
      return this.withCoverStatus(
        {
          entry_id: str(entry['entryId']) ?? `policy-entry-${fleetEntry}`,
          entry_number: fleetEntry,
          registration_number: str(motor['registrationNumber']),
          chassis_number: str(motor['chassisNumber']),
          make: str(motor['make']),
          model: str(motor['model']),
          body_type: str(motor['bodyType']),
          year_of_manufacture:
            motor['yearOfManufacture'] == null
              ? null
              : num(motor['yearOfManufacture']),
          risk_codes: entryRisks
            .map((item) => str(item['riskCode']))
            .filter((code): code is string => !!code),
          sum_insured: coverNote
            ? num(coverNote.sum_insured)
            : entryRisks.reduce(
                (sum, item) => sum + num(item['sumInsured']),
                0,
              ),
          premium_excluding_tax: num(coverNote?.premium_excluding_tax),
          premium_including_tax: num(coverNote?.premium_including_tax),
          cover_note_number:
            str(note?.['coverNoteNumber']) ??
            str(coverNote?.cover_note_number) ??
            str(entry['coverNoteNumber']),
          cover_note_reference_number:
            str(note?.['coverNoteReferenceNumber']) ??
            str(coverNote?.cover_note_reference_number),
          sticker_number:
            str(note?.['stickerNumber']) ?? str(coverNote?.sticker_number),
          cover_note_status: str(coverNote?.status),
          motor_vehicle_id: str(risk?.motor_vehicle_id),
          fleet_item_id: str(risk?.fleet_item_id),
          policy_risk_statuses: risk?.statuses ?? [],
          fleet_entry: fleetEntry,
          vehicle_status: 'ACTIVE',
          added_at: null,
          removed_at: null,
        },
        entry,
        risk,
      );
    });

    // Issued items missing from the snapshot (should not happen) stay visible.
    for (const row of unmatched) {
      vehicles.push(
        this.withCoverStatus(row, null, this.riskFor(vehicleRisks, row)),
      );
    }

    return { ...base, vehicles, totals: this.totals(vehicles) };
  }

  /** Policy risks grouped by motor vehicle, with their cover status. */
  private async policyVehicleRisks(policyId: string) {
    const rows = await this.dataSource.query<RawRow[]>(
      `WITH vehicle_risks AS (
         SELECT risk.motor_vehicle_id,
                array_agg(DISTINCT risk.status) AS statuses,
                MAX(risk.cancelled_at) AS cancelled_at,
                array_agg(risk.id) AS risk_ids
           FROM policy_risks risk
          WHERE risk.policy_id = $1
            AND risk.deleted_at IS NULL
            AND risk.motor_vehicle_id IS NOT NULL
          GROUP BY risk.motor_vehicle_id
       )
       SELECT vehicle_risks.motor_vehicle_id,
              vehicle_risks.statuses,
              vehicle_risks.cancelled_at,
              vehicle.chassis_no_normalized,
              vehicle.registration_no_normalized,
              fleet_item.id AS fleet_item_id
         FROM vehicle_risks
         JOIN motor_vehicles vehicle
           ON vehicle.id = vehicle_risks.motor_vehicle_id
         LEFT JOIN LATERAL (
           SELECT item.id
             FROM motor_fleet_items item
            WHERE item.policy_risk_id = ANY(vehicle_risks.risk_ids)
              AND item.deleted_at IS NULL
            LIMIT 1
         ) fleet_item ON true`,
      [policyId],
    );
    return rows.map((row) => ({
      motor_vehicle_id: String(row.motor_vehicle_id),
      statuses: ((row.statuses as string[] | null) ?? []).filter(Boolean),
      cancelled_at: dateOnly(row.cancelled_at),
      chassis: str(row.chassis_no_normalized),
      registration: str(row.registration_no_normalized),
      fleet_item_id: str(row.fleet_item_id),
    }));
  }

  /** Cover notes of vehicles added mid-term (no quotation entry). */
  private addedCoverNotes(policyId: string) {
    return this.dataSource.query<RawRow[]>(
      `SELECT fleet_entry, cover_note_number, cover_note_reference_number,
              sticker_number, status, sum_insured, premium_excluding_tax,
              premium_including_tax
         FROM cover_notes
        WHERE policy_id = $1
          AND quotation_entry_id IS NULL
          AND deleted_at IS NULL
        ORDER BY created_at`,
      [policyId],
    );
  }

  private riskFor(
    risks: Awaited<ReturnType<FleetVehiclesService['policyVehicleRisks']>>,
    row: FleetVehicleRow | null,
    motor: Record<string, unknown> = {},
  ) {
    return (
      risks.find(
        (risk) =>
          row?.motor_vehicle_id &&
          risk.motor_vehicle_id === row.motor_vehicle_id,
      ) ??
      risks.find(
        (risk) =>
          sameId(risk.chassis, motor['chassisNumber'] ?? row?.chassis_number) ||
          sameId(
            risk.registration,
            motor['registrationNumber'] ?? row?.registration_number,
          ),
      ) ??
      null
    );
  }

  private snapshotNoteFor(
    notes: Array<Record<string, unknown>>,
    entry: Record<string, unknown>,
    fleetEntry: number,
  ) {
    return (
      notes.find(
        (note) =>
          note['fleetEntry'] != null && num(note['fleetEntry']) === fleetEntry,
      ) ??
      notes.find(
        (note) =>
          entry['coverNoteNumber'] != null &&
          note['coverNoteNumber'] === entry['coverNoteNumber'],
      ) ??
      null
    );
  }

  private withCoverStatus(
    row: FleetVehicleRow,
    entry: Record<string, unknown> | null,
    risk: { statuses: string[]; cancelled_at: string | null } | null,
  ): FleetVehicleRow {
    const statuses = row.policy_risk_statuses.length
      ? row.policy_risk_statuses
      : (risk?.statuses ?? []);
    const entryStatus = str(entry?.['status']);
    const addedAt = dateOnly(entry?.['addedEffectiveDate']);
    const riskCancelled =
      statuses.length > 0 && statuses.every((status) => status === 'CANCELLED');

    let vehicleStatus: FleetVehicleStatus = 'ACTIVE';
    if (entryStatus === 'CANCELLED' || riskCancelled) {
      vehicleStatus = 'CANCELLED';
    } else if (entryStatus === 'REMOVED') {
      vehicleStatus = 'REMOVED';
    } else if (addedAt || entryStatus === 'ADDED') {
      vehicleStatus = 'ADDED';
    }

    const offCover =
      vehicleStatus === 'CANCELLED' || vehicleStatus === 'REMOVED';
    return {
      ...row,
      policy_risk_statuses: statuses,
      vehicle_status: vehicleStatus,
      added_at: addedAt,
      removed_at: offCover
        ? (dateOnly(entry?.['removedEffectiveDate']) ??
          risk?.cancelled_at ??
          null)
        : null,
    };
  }

  private totals(vehicles: FleetVehicleRow[]): FleetSummary['totals'] {
    const onCover = vehicles.filter(
      (vehicle) =>
        vehicle.vehicle_status !== 'CANCELLED' &&
        vehicle.vehicle_status !== 'REMOVED',
    );
    return {
      vehicles: onCover.length,
      sum_insured: onCover.reduce((sum, v) => sum + v.sum_insured, 0),
      premium_excluding_tax: onCover.reduce(
        (sum, v) => sum + v.premium_excluding_tax,
        0,
      ),
      premium_including_tax: onCover.reduce(
        (sum, v) => sum + v.premium_including_tax,
        0,
      ),
      issued_cover_notes: onCover.filter((v) => v.cover_note_reference_number)
        .length,
    };
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
              entry.fleet_entry,
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
      fleet_entry:
        row.fleet_entry == null ? num(row.entry_number) : num(row.fleet_entry),
      vehicle_status: 'ACTIVE',
      added_at: null,
      removed_at: null,
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
      totals: this.totals(vehicles),
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

import { Injectable, Logger } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import { Policy } from '../../policies/entities/policy.entity';
import { returningRows } from '../../../../database/returning-rows.util';
import { PolicyEndorsement } from '../entities/policy-endorsement.entity';
import { PolicyTransaction } from '../entities/policy-transaction.entity';
import {
  FLEET_ENTRY_ADDED,
  FLEET_ENTRY_CANCELLED,
  FLEET_ENTRY_REMOVED,
  FLEET_VEHICLE_ENDORSEMENT_CODES,
} from '../constants/fleet-vehicle-endorsement.constants';

type SnapshotRecord = Record<string, unknown>;

interface ResponseCoverNote {
  fleetEntry: number | null;
  sourceCoverNoteNumber: string | null;
  coverNoteReferenceNumber: string | null;
  stickerNumber: string | null;
}

/** Same rule as MotorService: letters and digits only, upper case. */
function normalizeIdentifier(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  return value.replace(/[^A-Za-z0-9]/g, '').toUpperCase() || null;
}

/**
 * Applies a TIRA-accepted "Fleet - Add/Remove Vehicle" endorsement to the
 * policy's records, inside PolicyTransactionApplyService's transaction:
 *
 * - the applied snapshot: an added vehicle becomes a normal entry and gets
 *   its TIRA cover-note reference in `coverNotes`; a removed one stays in
 *   `entries` as CANCELLED, so later endorsements keep stable indices;
 * - added vehicle: insured asset + motor vehicle (matched or created),
 *   policy risks from the endorsement pricing, a cover note (cloned from
 *   the template vehicle's) linked to the policy, and a fleet register item;
 * - removed vehicle: its policy risks CANCELLED with `cancelled_at`, its
 *   fleet register item retired, fleet totals refreshed.
 */
@Injectable()
export class FleetVehicleApplyService {
  private readonly logger = new Logger(FleetVehicleApplyService.name);

  isFleetVehicleEndorsement(endorsement: PolicyEndorsement) {
    return FLEET_VEHICLE_ENDORSEMENT_CODES.includes(
      endorsement.endorsement_type_code,
    );
  }

  /** Mutates the applied snapshot (a copy of the proposed one). */
  normalizeSnapshot(snapshot: SnapshotRecord, transaction: PolicyTransaction) {
    const responseNotes = this.responseCoverNotes(transaction);
    const coverNotes = Array.isArray(snapshot['coverNotes'])
      ? (snapshot['coverNotes'] as unknown[])
      : [];

    this.entries(snapshot).forEach((entry, index) => {
      if (entry['status'] === FLEET_ENTRY_ADDED) {
        const fleetEntry = this.fleetEntryOf(entry, index);
        const note = this.noteFor(responseNotes, fleetEntry);
        delete entry['status'];
        entry['addedEffectiveDate'] = transaction.effective_date;
        entry['addedByTransactionId'] = transaction.id;
        // The risks TIRA issued the vehicle's own cover note with; a later
        // whole-fleet cancellation sends them back for this vehicle.
        entry['issuedRiskPricing'] = this.entries({
          entries: transaction.pricing_snapshot?.['proposedRiskPricing'],
        }).filter((row) => Number(row['entryIndex']) === index);
        entry['coverNoteNumber'] =
          note?.sourceCoverNoteNumber ?? entry['coverNoteNumber'] ?? null;
        coverNotes.push({
          fleetEntry,
          coverNoteNumber: entry['coverNoteNumber'],
          coverNoteReferenceNumber: note?.coverNoteReferenceNumber ?? null,
          stickerNumber: note?.stickerNumber ?? null,
        });
      } else if (entry['status'] === FLEET_ENTRY_REMOVED) {
        entry['status'] = FLEET_ENTRY_CANCELLED;
        entry['removedEffectiveDate'] = transaction.effective_date;
        entry['removedByTransactionId'] = transaction.id;
      }
    });

    snapshot['coverNotes'] = coverNotes;
  }

  async applyRecords(
    manager: EntityManager,
    transaction: PolicyTransaction,
    policy: Policy,
  ) {
    const snapshot = transaction.proposed_policy_snapshot ?? {};
    const pricingRows = this.entries({
      entries: transaction.pricing_snapshot?.['proposedRiskPricing'],
    });
    const responseNotes = this.responseCoverNotes(transaction);
    const fleetId = await this.fleetIdFor(manager, policy);
    const entries = this.entries(snapshot);

    for (const [index, entry] of entries.entries()) {
      if (entry['status'] === FLEET_ENTRY_ADDED) {
        await this.applyAddition(manager, transaction, policy, fleetId, {
          entry,
          index,
          pricing: pricingRows.filter(
            (row) => Number(row['entryIndex']) === index,
          ),
          note: this.noteFor(responseNotes, this.fleetEntryOf(entry, index)),
        });
      } else if (entry['status'] === FLEET_ENTRY_REMOVED) {
        await this.applyRemoval(manager, transaction, policy, fleetId, entry);
      }
    }

    if (fleetId) {
      await this.refreshFleetTotals(manager, fleetId);
    }
  }

  private async applyAddition(
    manager: EntityManager,
    transaction: PolicyTransaction,
    policy: Policy,
    fleetId: string | null,
    added: {
      entry: SnapshotRecord;
      index: number;
      pricing: SnapshotRecord[];
      note: ResponseCoverNote | null;
    },
  ) {
    const motor = this.asObject(added.entry['motor']) ?? {};
    const fleetEntry = this.fleetEntryOf(added.entry, added.index);
    const vehicleId = await this.upsertMotorVehicle(
      manager,
      policy,
      motor,
      fleetEntry,
    );

    const riskIds: string[] = [];
    for (const row of added.pricing) {
      const discount = this.asArray(row['discounts']).reduce(
        (total, item) => total + Number(item['discountAmount'] ?? 0),
        0,
      );
      const [risk] = await manager.query<Array<{ id: string }>>(
        `INSERT INTO policy_risks
           (policy_id, quotation_entry_risk_id, risk_id, subject_matter_id,
            motor_vehicle_id, sum_insured, rate, basic_premium,
            discount_amount, tax_amount, charges_amount, commission_amount,
            total_premium, net_premium, reinsurance_required,
            retention_amount, ceded_sum_insured, ceded_premium,
            reinsurance_status, status)
         VALUES ($1, NULL, $2, NULL, $3, $4, $5, $6, $7, $8, $9, 0, $10, $10,
                 false, 0, 0, 0, 'NOT_REQUIRED', 'ACTIVE')
         RETURNING id`,
        [
          policy.id,
          row['insuranceRiskId'],
          vehicleId,
          row['sumInsured'] ?? 0,
          row['premiumRate'] ?? 0,
          row['premiumBeforeDiscount'] ?? 0,
          discount,
          row['taxAmount'] ?? 0,
          row['chargeAmount'] ?? 0,
          row['premiumIncludingTax'] ?? 0,
        ],
      );
      riskIds.push(risk.id);
    }

    await this.cloneCoverNote(manager, transaction, policy, {
      templateFleetEntry: Number(added.entry['addedFromFleetEntry'] ?? 0),
      fleetEntry,
      vehicleId,
      motor,
      note: added.note,
      pricing: added.pricing,
    });

    if (fleetId && riskIds.length) {
      await manager.query(
        `INSERT INTO motor_fleet_items
           (fleet_id, motor_vehicle_id, quotation_entry_risk_id,
            policy_risk_id, risk_client_ref, sum_insured, premium, status)
         VALUES ($1, $2, NULL, $3, $4, $5, $6, 'ACTIVE')`,
        [
          fleetId,
          vehicleId,
          riskIds[0],
          `ENTRY-${fleetEntry}`,
          this.sum(added.pricing, 'sumInsured'),
          this.sum(added.pricing, 'premiumIncludingTax'),
        ],
      );
    }
  }

  private async applyRemoval(
    manager: EntityManager,
    transaction: PolicyTransaction,
    policy: Policy,
    fleetId: string | null,
    entry: SnapshotRecord,
  ) {
    const motor = this.asObject(entry['motor']) ?? {};
    const vehicleId = await this.findMotorVehicle(manager, policy, motor);
    // An entry added by an earlier endorsement carries its template's
    // quotation risk ids, so it is matched by vehicle only.
    const quotationRiskIds = entry['addedFromFleetEntry']
      ? []
      : this.asArray(this.asObject(entry['pricing'])?.['risks'])
          .map((risk) => risk['id'])
          .filter((id): id is string => typeof id === 'string');

    const cancelledResult: unknown = await manager.query(
      `UPDATE policy_risks
          SET status = 'CANCELLED',
              cancelled_at = $2,
              updated_at = now()
        WHERE policy_id = $1
          AND deleted_at IS NULL
          AND status <> 'CANCELLED'
          AND (quotation_entry_risk_id = ANY($3::uuid[])
               OR ($4::uuid IS NOT NULL AND motor_vehicle_id = $4))
        RETURNING id`,
      [policy.id, transaction.effective_date, quotationRiskIds, vehicleId],
    );
    const cancelled = returningRows<{ id: string }>(cancelledResult);

    if (!cancelled.length) {
      this.logger.warn(
        `Fleet removal ${transaction.transaction_no}: no policy risk matched vehicle ${String(motor['chassisNumber'] ?? '')}`,
      );
    }

    if (fleetId) {
      await manager.query(
        `UPDATE motor_fleet_items
            SET status = 'REMOVED', deleted_at = now(), updated_at = now()
          WHERE fleet_id = $1
            AND deleted_at IS NULL
            AND (policy_risk_id = ANY($2::uuid[])
                 OR quotation_entry_risk_id = ANY($3::uuid[])
                 OR ($4::uuid IS NOT NULL AND motor_vehicle_id = $4))`,
        [fleetId, cancelled.map((row) => row.id), quotationRiskIds, vehicleId],
      );
    }
  }

  private async upsertMotorVehicle(
    manager: EntityManager,
    policy: Policy,
    motor: SnapshotRecord,
    fleetEntry: number,
  ): Promise<string> {
    const existing = await this.findMotorVehicle(manager, policy, motor);
    const assetId = await this.upsertInsuredAsset(
      manager,
      policy,
      motor,
      fleetEntry,
      existing,
    );

    if (existing) {
      await manager.query(
        `UPDATE motor_vehicles
            SET insured_asset_id = COALESCE(insured_asset_id, $2),
                updated_at = now()
          WHERE id = $1`,
        [existing, assetId],
      );
      return existing;
    }

    const [created] = await manager.query<Array<{ id: string }>>(
      `INSERT INTO motor_vehicles
         (company_id, customer_id, insured_asset_id, registration_no,
          registration_no_normalized, chassis_no, chassis_no_normalized,
          engine_no, make, model, body_type, color, manufacture_year,
          seating_capacity, cubic_capacity, fuel_type, model_no,
          number_of_axles, tare_weight, gross_weight, motor_category,
          motor_type, motor_usage, owner_name, owner_category, owner_address)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
               $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26)
       RETURNING id`,
      [
        policy.company_id,
        policy.customer_id,
        assetId,
        motor['registrationNumber'] ?? null,
        normalizeIdentifier(motor['registrationNumber']),
        motor['chassisNumber'] ?? null,
        normalizeIdentifier(motor['chassisNumber']),
        motor['engineNumber'] ?? null,
        motor['make'] ?? null,
        motor['model'] ?? null,
        motor['bodyType'] ?? null,
        motor['color'] ?? null,
        this.intOrNull(motor['yearOfManufacture']),
        this.intOrNull(motor['sittingCapacity']),
        this.intOrNull(motor['engineCapacity']),
        motor['fuelUsed'] ?? null,
        motor['modelNumber'] ?? null,
        this.intOrNull(motor['numberOfAxles']),
        motor['tareWeight'] ?? null,
        motor['grossWeight'] ?? null,
        this.intOrNull(motor['motorCategory']),
        this.intOrNull(motor['motorType']),
        this.intOrNull(motor['motorUsage']),
        motor['ownerName'] ?? null,
        this.intOrNull(motor['ownerCategory']),
        motor['ownerAddress'] ?? null,
      ],
    );
    return created.id;
  }

  private async upsertInsuredAsset(
    manager: EntityManager,
    policy: Policy,
    motor: SnapshotRecord,
    fleetEntry: number,
    vehicleId: string | null,
  ): Promise<string> {
    if (vehicleId) {
      const [linked] = await manager.query<
        Array<{ insured_asset_id: string | null }>
      >(`SELECT insured_asset_id FROM motor_vehicles WHERE id = $1`, [
        vehicleId,
      ]);
      if (linked?.insured_asset_id) return linked.insured_asset_id;
    }

    const displayName =
      [motor['registrationNumber'], motor['make'], motor['model']]
        .filter(Boolean)
        .join(' ') || String(motor['chassisNumber'] ?? 'Vehicle');
    const [asset] = await manager.query<Array<{ id: string }>>(
      `INSERT INTO insured_assets
         (company_id, asset_number, asset_type, customer_id,
          owner_customer_id, display_name)
       VALUES ($1, $2, 'MOTOR_VEHICLE', $3, $3, $4)
       RETURNING id`,
      [
        policy.company_id,
        // Policy numbers can be long and repeat across insurers. Keep the
        // vehicle suffix intact and use the immutable policy identity.
        `P-${policy.id.replace(/-/g, '')}-V${String(fleetEntry).padStart(3, '0')}`,
        policy.customer_id,
        displayName.slice(0, 255),
      ],
    );
    return asset.id;
  }

  private async findMotorVehicle(
    manager: EntityManager,
    policy: Policy,
    motor: SnapshotRecord,
  ): Promise<string | null> {
    const chassis = normalizeIdentifier(motor['chassisNumber']);
    const registration = normalizeIdentifier(motor['registrationNumber']);
    // Engine numbers are unique per company too (IDX_motor_vehicles_company_engine_no).
    const engine =
      typeof motor['engineNumber'] === 'string'
        ? motor['engineNumber'].trim() || null
        : null;
    if (!chassis && !registration && !engine) return null;
    const [row] = await manager.query<Array<{ id: string }>>(
      `SELECT id FROM motor_vehicles
        WHERE company_id = $1
          AND deleted_at IS NULL
          AND (($2::text IS NOT NULL AND chassis_no_normalized = $2)
               OR ($3::text IS NOT NULL AND registration_no_normalized = $3)
               OR ($4::text IS NOT NULL AND engine_no = $4))
        ORDER BY (chassis_no_normalized = $2) DESC NULLS LAST
        LIMIT 1`,
      [policy.company_id, chassis, registration, engine],
    );
    return row?.id ?? null;
  }

  /**
   * Cover note for the added vehicle, cloned from the template vehicle's on
   * this policy (same product, customer and TIRA identifiers), so claims
   * resolve the vehicle's own reference through its insured asset.
   */
  private async cloneCoverNote(
    manager: EntityManager,
    transaction: PolicyTransaction,
    policy: Policy,
    input: {
      templateFleetEntry: number;
      fleetEntry: number;
      vehicleId: string;
      motor: SnapshotRecord;
      note: ResponseCoverNote | null;
      pricing: SnapshotRecord[];
    },
  ) {
    if (!input.note?.coverNoteReferenceNumber) {
      this.logger.warn(
        `Fleet addition ${transaction.transaction_no}: TIRA returned no reference for entry ${input.fleetEntry}`,
      );
    }

    const [{ insured_asset_id: assetId }] = await manager.query<
      Array<{ insured_asset_id: string | null }>
    >(`SELECT insured_asset_id FROM motor_vehicles WHERE id = $1`, [
      input.vehicleId,
    ]);

    const [created] = await manager.query<Array<{ id: string }>>(
      `INSERT INTO cover_notes
         (company_id, insurer_company_id, intermediary_company_id, branch_id,
          sale_point_id, customer_id, quotation_id, quotation_entry_id,
          policy_id, insured_asset_id, tiramis_tracking_id,
          tiramis_transaction_id, tiramis_request_id, response_id,
          cover_note_number, cover_note_reference_number, sticker_number,
          entry_type, fleet_entry, status, regulatory_sync_status,
          product_id, product_version_id, product_code,
          product_definition_hash, customer_snapshot, customer_snapshot_hash,
          asset_snapshot, asset_snapshot_hash, pricing_snapshot,
          pricing_result_hash, distribution_snapshot,
          distribution_snapshot_hash, start_date, end_date, currency_code,
          sum_insured, premium_excluding_tax, premium_including_tax,
          commission_amount, commission_rate, final_response_status_code,
          final_response_status_desc, signature_verified, issued_at,
          expires_at, created_by)
       SELECT template.company_id, template.insurer_company_id,
              template.intermediary_company_id, template.branch_id,
              template.sale_point_id, template.customer_id,
              template.quotation_id, NULL,
              $1, $2,
              COALESCE($3::uuid, template.tiramis_tracking_id),
              COALESCE($4::text, template.tiramis_transaction_id),
              COALESCE($5::text, template.tiramis_request_id),
              $6, $7, $8, $9,
              template.entry_type, $10, template.status,
              'IN_SYNC', template.product_id, template.product_version_id,
              template.product_code, template.product_definition_hash,
              template.customer_snapshot, template.customer_snapshot_hash,
              $11::jsonb, $12, $13::jsonb, $12,
              template.distribution_snapshot,
              template.distribution_snapshot_hash, $14, template.end_date,
              template.currency_code, $15, $16, $17,
              template.commission_amount * 0, template.commission_rate,
              template.final_response_status_code,
              template.final_response_status_desc,
              template.signature_verified, now(), template.expires_at, NULL
         FROM cover_notes template
        WHERE template.policy_id = $1
          AND template.deleted_at IS NULL
        ORDER BY (template.fleet_entry = $18) DESC, template.created_at
        LIMIT 1
       RETURNING id`,
      [
        policy.id,
        assetId,
        transaction.tiramis_tracking_id,
        transaction.tiramis_transaction_id,
        transaction.tiramis_request_id,
        String(transaction.regulatory_response?.['responseId'] ?? '') || null,
        input.note?.sourceCoverNoteNumber ??
          `${transaction.transaction_no}-${String(input.fleetEntry).padStart(3, '0')}`,
        input.note?.coverNoteReferenceNumber ?? null,
        input.note?.stickerNumber ?? null,
        input.fleetEntry,
        JSON.stringify(input.motor),
        `fleet-addition:${transaction.id}:${input.fleetEntry}`,
        JSON.stringify({ risks: input.pricing }),
        transaction.effective_date,
        this.sum(input.pricing, 'sumInsured'),
        this.sum(input.pricing, 'premiumExcludingTaxEquivalent'),
        this.sum(input.pricing, 'premiumIncludingTax'),
        input.templateFleetEntry,
      ],
    );

    if (!created) {
      this.logger.warn(
        `Fleet addition ${transaction.transaction_no}: policy has no cover note to clone`,
      );
      return;
    }

    await manager.query(
      `INSERT INTO policy_cover_notes
         (company_id, policy_id, cover_note_id, sequence_number)
       SELECT $1, $2, $3, COALESCE(MAX(sequence_number), 0) + 1
         FROM policy_cover_notes WHERE policy_id = $2`,
      [policy.company_id, policy.id, created.id],
    );
  }

  private async fleetIdFor(manager: EntityManager, policy: Policy) {
    const [row] = await manager.query<Array<{ id: string }>>(
      `SELECT id FROM motor_fleets
        WHERE company_id = $1
          AND deleted_at IS NULL
          AND (policy_id = $2 OR quotation_id = $3)
        ORDER BY (policy_id = $2) DESC
        LIMIT 1`,
      [policy.company_id, policy.id, policy.quotation_id],
    );
    return row?.id ?? null;
  }

  private async refreshFleetTotals(manager: EntityManager, fleetId: string) {
    await manager.query(
      `UPDATE motor_fleets fleet
          SET total_vehicles = totals.vehicles,
              derived_vehicle_count = totals.vehicles,
              total_sum_insured = totals.sum_insured,
              total_premium = totals.premium,
              updated_at = now()
         FROM (
           SELECT COUNT(*)::int AS vehicles,
                  COALESCE(SUM(sum_insured), 0) AS sum_insured,
                  COALESCE(SUM(premium), 0) AS premium
             FROM motor_fleet_items
            WHERE fleet_id = $1 AND deleted_at IS NULL
         ) totals
        WHERE fleet.id = $1`,
      [fleetId],
    );
  }

  private responseCoverNotes(
    transaction: PolicyTransaction,
  ): ResponseCoverNote[] {
    const response = this.asObject(transaction.regulatory_response);
    return this.asArray(response?.['coverNotes']).map((note) => ({
      fleetEntry:
        note['fleetEntry'] == null ? null : Number(note['fleetEntry']),
      sourceCoverNoteNumber: this.stringOrNull(note['sourceCoverNoteNumber']),
      coverNoteReferenceNumber: this.stringOrNull(
        note['coverNoteReferenceNumber'],
      ),
      stickerNumber: this.stringOrNull(note['stickerNumber']),
    }));
  }

  private noteFor(notes: ResponseCoverNote[], fleetEntry: number) {
    return notes.find((note) => note.fleetEntry === fleetEntry) ?? null;
  }

  private entries(snapshot: SnapshotRecord): SnapshotRecord[] {
    return this.asArray(snapshot['entries']);
  }

  private fleetEntryOf(entry: SnapshotRecord, index: number) {
    const value = Number(entry['fleetEntry'] ?? entry['entryNumber']);
    return Number.isInteger(value) && value > 0 ? value : index + 1;
  }

  private sum(rows: SnapshotRecord[], field: string) {
    return rows
      .reduce((total, row) => total + Number(row[field] ?? 0), 0)
      .toFixed(4);
  }

  private intOrNull(value: unknown) {
    const number = Number(value);
    return value === undefined ||
      value === null ||
      value === '' ||
      !Number.isFinite(number)
      ? null
      : Math.trunc(number);
  }

  private stringOrNull(value: unknown) {
    return typeof value === 'string' && value ? value : null;
  }

  private asObject(value: unknown): SnapshotRecord | null {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as SnapshotRecord)
      : null;
  }

  private asArray(value: unknown): SnapshotRecord[] {
    return Array.isArray(value)
      ? value.filter(
          (item): item is SnapshotRecord =>
            !!item && typeof item === 'object' && !Array.isArray(item),
        )
      : [];
  }
}

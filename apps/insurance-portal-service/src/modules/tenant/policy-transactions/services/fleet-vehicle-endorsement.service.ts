import {
  BadRequestException,
  Injectable,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';
import { ProductDefinitionHashService } from '@insurance-max/shared-kernel';
import {
  PolicyChangeCategory,
  PolicyTransactionChangeType,
  PolicyTransactionEventType,
} from '@insurance-max/contracts';
import { PolicyTransaction } from '../entities/policy-transaction.entity';
import { PolicyTransactionChange } from '../entities/policy-transaction-change.entity';
import { PolicyTransactionEvent } from '../entities/policy-transaction-event.entity';
import { PolicyEndorsement } from '../entities/policy-endorsement.entity';
import {
  FLEET_ADD_VEHICLE_CODE,
  FLEET_ENTRY_ADDED,
  FLEET_ENTRY_REMOVED,
  FLEET_OFF_COVER_STATUSES,
  FLEET_MAXIMUM_ENTRY,
  FLEET_MINIMUM_ACTIVE_VEHICLES,
  FLEET_REMOVE_VEHICLE_CODE,
} from '../constants/fleet-vehicle-endorsement.constants';
import { EndorsementService } from './endorsement.service';
import { ProposedPolicySnapshotService } from './proposed-policy-snapshot.service';

type SnapshotRecord = Record<string, unknown>;

/** Motor fields TIRAMIS marks Mandatory in MotorDtl (API v1.3 §6.1). */
const REQUIRED_MOTOR_FIELDS = [
  'motorCategory',
  'motorType',
  'chassisNumber',
  'make',
  'model',
  'modelNumber',
  'bodyType',
  'color',
  'engineNumber',
  'engineCapacity',
  'fuelUsed',
  'yearOfManufacture',
  'tareWeight',
  'grossWeight',
  'ownerName',
  'ownerCategory',
] as const;

const MOTOR_FIELDS = [
  ...REQUIRED_MOTOR_FIELDS,
  'registrationNumber',
  'numberOfAxles',
  'axleDistance',
  'sittingCapacity',
  'motorUsage',
  'ownerAddress',
] as const;

export interface AddFleetVehicleInput {
  motor: Record<string, unknown>;
  /** Sum insured per risk; defaults to the template vehicle's. */
  sum_insured?: number | null;
  /** Vehicle whose cover and pricing inputs the new one is priced like. */
  template_fleet_entry?: number | null;
}

export interface FleetVehicleView {
  index: number;
  fleetEntry: number;
  registrationNumber: string | null;
  chassisNumber: string | null;
  /** CANCELLED: removed by an earlier, applied endorsement. */
  status: 'ACTIVE' | 'ADDED' | 'REMOVED' | 'CANCELLED';
}

/**
 * Adds or removes whole vehicles on a fleet policy through an endorsement
 * (see docs/fleet-vehicle-endorsement-design.md). Entries are never spliced:
 * a removal sets `entries.N.status = REMOVED`, an addition appends
 * `entries.<length>`. An added vehicle reuses a template vehicle's original
 * pricing quote, and repricing overrides sum insured and motor factors from
 * the new entry, so it is priced for the remaining period like any other.
 */
@Injectable()
export class FleetVehicleEndorsementService {
  constructor(
    private readonly endorsementService: EndorsementService,
    private readonly snapshotService: ProposedPolicySnapshotService,
    private readonly hashService: ProductDefinitionHashService,
  ) {}

  async addVehicle(
    user: AuthenticatedUser,
    transactionId: string,
    input: AddFleetVehicleInput,
  ) {
    return this.endorsementService.applyWithinDraft(
      user,
      transactionId,
      async (manager, transaction, endorsement) => {
        this.requireType(endorsement, FLEET_ADD_VEHICLE_CODE);
        const entries = await this.currentEntries(manager, transaction);
        const motor = this.normalizeMotor(input.motor);

        this.assertUniqueInFleet(entries, motor);
        await this.assertNotInsuredElsewhere(
          manager,
          transaction.company_id,
          transaction.source_policy_id,
          motor,
        );

        const template = this.resolveTemplate(
          entries,
          input.template_fleet_entry ?? null,
        );
        const fleetEntry = this.nextFleetEntry(entries);
        const entry = this.buildAddedEntry(
          template,
          motor,
          fleetEntry,
          input.sum_insured ?? null,
        );

        await this.saveChange(manager, user, transaction, {
          operation: PolicyTransactionChangeType.ADD,
          fieldPath: `entries.${entries.length}`,
          oldValue: null,
          newValue: entry,
          action: 'FLEET_VEHICLE_ADDED',
          fleetEntry,
        });
      },
    );
  }

  async removeVehicle(
    user: AuthenticatedUser,
    transactionId: string,
    fleetEntry: number,
  ) {
    return this.endorsementService.applyWithinDraft(
      user,
      transactionId,
      async (manager, transaction, endorsement) => {
        this.requireType(endorsement, FLEET_REMOVE_VEHICLE_CODE);
        const entries = await this.currentEntries(manager, transaction);
        const index = this.findEntryIndex(entries, fleetEntry);
        const entry = entries[index];

        if (this.isOffCover(entry)) {
          throw new UnprocessableEntityException(
            `Vehicle ${fleetEntry} is already removed from the fleet.`,
          );
        }

        const remaining = entries.filter(
          (item, itemIndex) => itemIndex !== index && !this.isOffCover(item),
        ).length;
        if (remaining < FLEET_MINIMUM_ACTIVE_VEHICLES) {
          throw new UnprocessableEntityException(
            `A fleet must keep at least ${FLEET_MINIMUM_ACTIVE_VEHICLES} vehicles.`,
          );
        }

        await this.saveChange(manager, user, transaction, {
          operation: PolicyTransactionChangeType.MODIFY,
          fieldPath: `entries.${index}.status`,
          oldValue: entry['status'] ?? null,
          newValue: FLEET_ENTRY_REMOVED,
          action: 'FLEET_VEHICLE_REMOVED',
          fleetEntry,
        });
      },
    );
  }

  /**
   * Undoes a pending addition or removal. Remaining additions are
   * renumbered so `entries` stays contiguous (appends must replay in order).
   */
  async revertVehicle(
    user: AuthenticatedUser,
    transactionId: string,
    fleetEntry: number,
  ) {
    return this.endorsementService.applyWithinDraft(
      user,
      transactionId,
      async (manager, transaction) => {
        const repository = manager.getRepository(PolicyTransactionChange);
        const changes = await repository.find({
          where: { policy_transaction_id: transaction.id },
        });
        const sourceLength = this.asArray(
          transaction.source_policy_snapshot['entries'],
        ).length;

        const additions = changes
          .filter((change) => /^entries\.\d+$/.test(change.field_path))
          .sort(
            (a, b) => this.indexOf(a.field_path) - this.indexOf(b.field_path),
          );
        const addition = additions.find(
          (change) =>
            Number(this.asObject(change.new_value)?.['fleetEntry']) ===
            fleetEntry,
        );

        if (addition) {
          await repository.remove(addition);
          const kept = additions.filter((change) => change !== addition);
          for (const [offset, change] of kept.entries()) {
            const path = `entries.${sourceLength + offset}`;
            if (change.field_path !== path) {
              change.field_path = path;
              await repository.save(change);
            }
          }
          return;
        }

        const entries = this.asArray(
          transaction.source_policy_snapshot['entries'],
        );
        const index = this.findEntryIndex(entries, fleetEntry);
        const removal = changes.find(
          (change) => change.field_path === `entries.${index}.status`,
        );
        if (!removal) {
          throw new BadRequestException(
            `Vehicle ${fleetEntry} has no pending change on this endorsement.`,
          );
        }
        await repository.remove(removal);
      },
    );
  }

  /** Vehicles on the endorsement's proposed fleet, with their status. */
  listVehicles(transaction: PolicyTransaction): FleetVehicleView[] {
    const snapshot =
      transaction.proposed_policy_snapshot ??
      transaction.source_policy_snapshot;
    return this.asArray(snapshot['entries']).map((entry, index) => {
      const motor = this.asObject(entry['motor']) ?? {};
      const status = String(entry['status'] ?? '');
      return {
        index,
        fleetEntry: this.fleetEntryOf(entry, index),
        registrationNumber: this.stringOrNull(motor['registrationNumber']),
        chassisNumber: this.stringOrNull(motor['chassisNumber']),
        status: ([FLEET_ENTRY_ADDED, FLEET_ENTRY_REMOVED, 'CANCELLED'].includes(
          status,
        )
          ? status
          : 'ACTIVE') as FleetVehicleView['status'],
      };
    });
  }

  private isOffCover(entry: SnapshotRecord) {
    return FLEET_OFF_COVER_STATUSES.includes(String(entry['status'] ?? ''));
  }

  private requireType(endorsement: PolicyEndorsement, code: string) {
    if (endorsement.endorsement_type_code !== code) {
      throw new UnprocessableEntityException(
        code === FLEET_ADD_VEHICLE_CODE
          ? 'Vehicles can only be added on a "Fleet - Add Vehicle" endorsement.'
          : 'Vehicles can only be removed on a "Fleet - Remove Vehicle" endorsement.',
      );
    }
  }

  /** The fleet as it stands with the changes already on this endorsement. */
  private async currentEntries(
    manager: EntityManager,
    transaction: PolicyTransaction,
  ): Promise<SnapshotRecord[]> {
    if (!this.asObject(transaction.source_policy_snapshot['cover'])) {
      throw new UnprocessableEntityException(
        'The policy snapshot has no cover details.',
      );
    }
    const changes = await manager
      .getRepository(PolicyTransactionChange)
      .find({ where: { policy_transaction_id: transaction.id } });
    const { snapshot } = this.snapshotService.build(
      transaction.source_policy_snapshot,
      changes.map((change) => ({
        fieldPath: change.field_path,
        operation: change.operation,
        newValue: change.new_value,
      })),
    );
    const entries = this.asArray(snapshot['entries']);
    if (!entries.some((entry) => this.asObject(entry['motor']))) {
      throw new UnprocessableEntityException(
        'Vehicles can only be added to or removed from a motor fleet policy.',
      );
    }
    return entries;
  }

  private normalizeMotor(raw: Record<string, unknown>) {
    const motor: SnapshotRecord = {};
    for (const field of MOTOR_FIELDS) {
      const value = raw?.[field];
      if (value === undefined || value === null || value === '') continue;
      motor[field] = typeof value === 'string' ? value.trim() : value;
    }

    const missing = REQUIRED_MOTOR_FIELDS.filter(
      (field) => motor[field] === undefined,
    );
    if (Number(motor['motorType']) === 1 && !motor['registrationNumber']) {
      // A registered vehicle (MotorType 1) needs its registration number.
      missing.push('registrationNumber' as never);
    }
    if (missing.length) {
      throw new BadRequestException({
        code: 'FLEET_VEHICLE_INCOMPLETE',
        message: `Missing vehicle details: ${missing.join(', ')}`,
        details: { missing },
      });
    }

    if (motor['registrationNumber']) {
      motor['registrationNumber'] = String(
        motor['registrationNumber'],
      ).toUpperCase();
    }
    motor['chassisNumber'] = String(motor['chassisNumber']).toUpperCase();
    return motor;
  }

  private assertUniqueInFleet(
    entries: SnapshotRecord[],
    motor: SnapshotRecord,
  ) {
    const clash = entries.find((entry) => {
      if (this.isOffCover(entry)) return false;
      const existing = this.asObject(entry['motor']) ?? {};
      return (
        this.sameId(existing['chassisNumber'], motor['chassisNumber']) ||
        this.sameId(
          existing['registrationNumber'],
          motor['registrationNumber'],
        ) ||
        this.sameId(existing['engineNumber'], motor['engineNumber'])
      );
    });
    if (clash) {
      throw new UnprocessableEntityException(
        'This vehicle is already on the fleet.',
      );
    }
  }

  /**
   * Refuses a vehicle already quoted on another active policy (TIRA would
   * reject it with TIRA090/TIRA220). Vehicles added mid-term elsewhere live
   * only in policy snapshots, so TIRA remains the final check for those.
   */
  private async assertNotInsuredElsewhere(
    manager: EntityManager,
    companyId: string,
    policyId: string,
    motor: SnapshotRecord,
  ) {
    const rows = await manager.query<Array<{ policy_no: string }>>(
      `SELECT policy.policy_no
         FROM policies policy
         JOIN quotation_cover_notes qcn ON qcn.quotation_id = policy.quotation_id
         JOIN quotation_cover_note_entries entry ON entry.cover_note_id = qcn.id
         JOIN quotation_motor_details detail ON detail.entry_id = entry.id
        WHERE policy.company_id = $1
          AND policy.id <> $2
          AND policy.deleted_at IS NULL
          AND policy.policy_status = 'ACTIVE'
          AND policy.end_date >= CURRENT_DATE
          AND (UPPER(TRIM(detail.chassis_number)) = $3
               OR ($4::text IS NOT NULL
                   AND UPPER(TRIM(detail.registration_number)) = $4))
        LIMIT 1`,
      [
        companyId,
        policyId,
        motor['chassisNumber'],
        motor['registrationNumber'] ?? null,
      ],
    );
    if (rows.length) {
      throw new UnprocessableEntityException(
        `This vehicle is already insured on policy ${rows[0].policy_no}.`,
      );
    }
  }

  private resolveTemplate(
    entries: SnapshotRecord[],
    templateFleetEntry: number | null,
  ): SnapshotRecord {
    const candidates = entries.filter(
      (entry) =>
        entry['status'] !== FLEET_ENTRY_ADDED &&
        this.asObject(entry['motor']) &&
        this.asArray(this.asObject(entry['pricing'])?.['risks']).length,
    );
    const template =
      templateFleetEntry === null
        ? candidates.find((entry) => !this.isOffCover(entry))
        : candidates.find(
            (entry) =>
              this.fleetEntryOf(entry, entries.indexOf(entry)) ===
              templateFleetEntry,
          );
    if (!template) {
      throw new UnprocessableEntityException(
        'No priced vehicle on this fleet can be used to price the new vehicle.',
      );
    }
    return template;
  }

  private nextFleetEntry(entries: SnapshotRecord[]) {
    const next =
      Math.max(
        0,
        ...entries.map((entry, index) => this.fleetEntryOf(entry, index)),
      ) + 1;
    if (next > FLEET_MAXIMUM_ENTRY) {
      throw new UnprocessableEntityException(
        `A fleet cannot have more than ${FLEET_MAXIMUM_ENTRY} entries.`,
      );
    }
    return next;
  }

  private buildAddedEntry(
    template: SnapshotRecord,
    motor: SnapshotRecord,
    fleetEntry: number,
    sumInsured: number | null,
  ): SnapshotRecord {
    const copy = JSON.parse(JSON.stringify(template)) as SnapshotRecord;
    const templateFleetEntry = copy['fleetEntry'] ?? copy['entryNumber'];
    const sum = sumInsured === null ? null : sumInsured.toFixed(4);

    const risks = this.asArray(copy['risks']).map((risk) => {
      const asset = this.asObject(risk['insuredAsset']);
      const assetSnapshot = this.asObject(asset?.['snapshot']);
      return {
        ...risk,
        ...(sum !== null ? { sumInsured: sum } : {}),
        ...(asset
          ? {
              insuredAsset: {
                ...asset,
                snapshot: { ...(assetSnapshot ?? {}), ...motor },
              },
            }
          : {}),
      };
    });

    return {
      ...copy,
      entryId: null,
      entryNumber: fleetEntry,
      fleetEntry,
      coverNoteNumber: null,
      previousCoverNoteReferenceNumber: null,
      endorsement: null,
      motor,
      risks,
      status: FLEET_ENTRY_ADDED,
      addedFromFleetEntry: templateFleetEntry ?? null,
    };
  }

  private async saveChange(
    manager: EntityManager,
    user: AuthenticatedUser,
    transaction: PolicyTransaction,
    change: {
      operation: PolicyTransactionChangeType;
      fieldPath: string;
      oldValue: unknown;
      newValue: unknown;
      action: string;
      fleetEntry: number;
    },
  ) {
    const saved = await manager.getRepository(PolicyTransactionChange).save({
      company_id: transaction.company_id,
      policy_transaction_id: transaction.id,
      category: PolicyChangeCategory.ASSET,
      operation: change.operation,
      field_path: change.fieldPath,
      resource_id: null,
      old_value: change.oldValue,
      new_value: change.newValue,
      is_material: true,
      requires_repricing: true,
      requires_regulatory_submission: true,
      change_hash: this.hashService.hashDefinition({
        category: PolicyChangeCategory.ASSET,
        operation: change.operation,
        fieldPath: change.fieldPath,
        oldValue: change.oldValue,
        newValue: change.newValue,
      }),
      created_by: user.id,
    });

    await manager.getRepository(PolicyTransactionEvent).save({
      company_id: transaction.company_id,
      policy_transaction_id: transaction.id,
      event_type: PolicyTransactionEventType.CHANGE_ADDED,
      actor_type: 'USER',
      actor_id: user.id,
      from_stage: transaction.stage,
      to_stage: transaction.stage,
      metadata: {
        action: change.action,
        changeId: saved.id,
        fieldPath: change.fieldPath,
        fleetEntry: change.fleetEntry,
        category: PolicyChangeCategory.ASSET,
      },
    });
  }

  private findEntryIndex(entries: SnapshotRecord[], fleetEntry: number) {
    const index = entries.findIndex(
      (entry, entryIndex) =>
        this.fleetEntryOf(entry, entryIndex) === fleetEntry,
    );
    if (index < 0) {
      throw new BadRequestException(
        `Vehicle ${fleetEntry} is not on this fleet.`,
      );
    }
    return index;
  }

  private fleetEntryOf(entry: SnapshotRecord, index: number) {
    const value = Number(entry['fleetEntry'] ?? entry['entryNumber']);
    return Number.isInteger(value) && value > 0 ? value : index + 1;
  }

  private indexOf(fieldPath: string) {
    return Number(fieldPath.split('.')[1]);
  }

  private sameId(left: unknown, right: unknown) {
    const a = this.stringOrNull(left)?.trim().toUpperCase();
    const b = this.stringOrNull(right)?.trim().toUpperCase();
    return Boolean(a && b && a === b);
  }

  private stringOrNull(value: unknown): string | null {
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

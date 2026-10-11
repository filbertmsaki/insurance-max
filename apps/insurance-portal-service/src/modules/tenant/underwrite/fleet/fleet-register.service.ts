import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, IsNull } from 'typeorm';
import { MotorFleet } from '../../motor/entities/motor-fleet.entity';
import { MotorFleetItem } from '../../motor/entities/motor-fleet-item.entity';
import { MotorVehicle } from '../../motor/entities/motor-vehicle.entity';
import { QuotationEntryType } from '../../quotations/enums/quotation-entry-type.enum';
import { QuotationFlow } from '../../quotations/enums/quotation-flow.enum';
import { Quotation } from '../../quotations/entities/quotation.entity';

const QUOTED_STATUS = 'QUOTED';
const ACTIVE_ITEM_STATUS = 'ACTIVE';
const REMOVED_ITEM_STATUS = 'REMOVED';

export interface FleetRegisterSyncResult {
  fleetId: string | null;
  vehicles: number;
  linkedVehicles: number;
  skippedReason?: string;
}

function toMoney(value: number): string {
  return (Math.round(value * 100) / 100).toFixed(2);
}

function normalize(value: string | null | undefined): string {
  return (value ?? '').trim().toUpperCase();
}

/**
 * Keeps the master fleet register (`motor_fleets` / `motor_fleet_items`) in
 * step with a MOTOR_FLEET quotation, so every quoted vehicle is traceable as
 * a fleet member: quotation entry risk → fleet item → motor vehicle.
 *
 * The quotation remains the source of truth. This service only projects it
 * into the register: it never changes the quotation, pricing or TIRA data,
 * and it is idempotent (re-finalizing re-projects the same fleet).
 */
@Injectable()
export class FleetRegisterService {
  private readonly logger = new Logger(FleetRegisterService.name);

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async syncFromQuotation(
    companyId: string,
    quotationId: string,
  ): Promise<FleetRegisterSyncResult> {
    return this.dataSource.transaction((manager) =>
      this.syncInTransaction(manager, companyId, quotationId),
    );
  }

  private async syncInTransaction(
    manager: EntityManager,
    companyId: string,
    quotationId: string,
  ): Promise<FleetRegisterSyncResult> {
    const quotation = await manager.getRepository(Quotation).findOne({
      where: { id: quotationId, company_id: companyId },
      relations: {
        cover_note: { entries: { motor_detail: true, risks: true } },
      },
    });

    if (!quotation || quotation.quotation_flow !== QuotationFlow.MOTOR_FLEET) {
      return this.skip('not a fleet quotation');
    }
    if (!quotation.customer_id) {
      return this.skip('quotation has no customer');
    }

    const coverNote = quotation.cover_note;
    const entries = (coverNote?.entries ?? [])
      .filter((entry) => entry.entry_type === QuotationEntryType.FLEET_ITEM)
      .sort((a, b) => a.entry_number - b.entry_number);
    const fleetNo = (coverNote?.fleet_id ?? quotation.quotation_no).trim();

    const fleetRepository = manager.getRepository(MotorFleet);
    let fleet =
      (await fleetRepository.findOne({
        where: {
          company_id: companyId,
          quotation_id: quotation.id,
          deleted_at: IsNull(),
        },
      })) ??
      (await fleetRepository.findOne({
        where: {
          company_id: companyId,
          fleet_no: fleetNo,
          deleted_at: IsNull(),
        },
      }));

    if (fleet && fleet.customer_id !== quotation.customer_id) {
      // Fleet numbers are unique per company; never re-home another
      // customer's fleet onto this quotation.
      return this.skip(
        `fleet number ${fleetNo} already belongs to another customer`,
      );
    }

    const vehicles = await this.matchVehicles(
      manager,
      companyId,
      quotation.customer_id,
      entries.map((entry) => entry.motor_detail),
    );

    const totalSumInsured = entries
      .flatMap((entry) => entry.risks ?? [])
      .reduce((sum, risk) => sum + Number(risk.sum_insured ?? 0), 0);

    fleet = await fleetRepository.save(
      fleetRepository.create({
        ...(fleet ?? {}),
        company_id: companyId,
        customer_id: quotation.customer_id,
        quotation_id: quotation.id,
        fleet_no: fleetNo,
        total_vehicles: entries.length,
        derived_vehicle_count: vehicles.filter(Boolean).length,
        total_sum_insured: toMoney(totalSumInsured),
        total_premium: toMoney(
          Number(coverNote?.total_premium_including_tax ?? 0),
        ),
        status:
          fleet?.status && fleet.status !== 'DRAFT'
            ? fleet.status
            : QUOTED_STATUS,
      }),
    );

    const linked = await this.syncItems(manager, fleet.id, entries, vehicles);

    return {
      fleetId: fleet.id,
      vehicles: entries.length,
      linkedVehicles: linked,
    };
  }

  private async matchVehicles(
    manager: EntityManager,
    companyId: string,
    customerId: string,
    details: Array<{
      registration_number: string | null;
      chassis_number: string;
    } | null>,
  ): Promise<Array<MotorVehicle | null>> {
    const registrations = details
      .map((detail) => normalize(detail?.registration_number))
      .filter(Boolean);
    const chassis = details
      .map((detail) => normalize(detail?.chassis_number))
      .filter(Boolean);
    if (!registrations.length && !chassis.length) {
      return details.map(() => null);
    }

    const candidates = await manager
      .getRepository(MotorVehicle)
      .createQueryBuilder('vehicle')
      .where('vehicle.company_id = :companyId', { companyId })
      .andWhere('vehicle.customer_id = :customerId', { customerId })
      .andWhere('vehicle.deleted_at IS NULL')
      .andWhere(
        `(UPPER(TRIM(vehicle.registration_no)) IN (:...registrations)
          OR UPPER(TRIM(vehicle.chassis_no)) IN (:...chassis))`,
        {
          registrations: registrations.length ? registrations : [''],
          chassis: chassis.length ? chassis : [''],
        },
      )
      .getMany();

    return details.map(
      (detail) =>
        candidates.find(
          (vehicle) =>
            (detail?.registration_number &&
              normalize(vehicle.registration_no) ===
                normalize(detail.registration_number)) ||
            (detail?.chassis_number &&
              normalize(vehicle.chassis_no) ===
                normalize(detail.chassis_number)),
        ) ?? null,
    );
  }

  private async syncItems(
    manager: EntityManager,
    fleetId: string,
    entries: Quotation['cover_note']['entries'],
    vehicles: Array<MotorVehicle | null>,
  ): Promise<number> {
    const itemRepository = manager.getRepository(MotorFleetItem);
    const existing = await itemRepository.find({
      where: { fleet_id: fleetId, deleted_at: IsNull() },
    });

    const keptIds = new Set<string>();
    let linked = 0;

    for (const [index, entry] of entries.entries()) {
      const vehicle = vehicles[index];
      const risk = [...(entry.risks ?? [])].sort(
        (a, b) => a.sequence_no - b.sequence_no,
      )[0];
      if (!vehicle || !risk) continue;

      const current =
        existing.find((item) => item.quotation_entry_risk_id === risk.id) ??
        existing.find(
          (item) =>
            item.motor_vehicle_id === vehicle.id && !keptIds.has(item.id),
        );

      const saved = await itemRepository.save(
        itemRepository.create({
          ...(current ?? {}),
          fleet_id: fleetId,
          motor_vehicle_id: vehicle.id,
          quotation_entry_risk_id: risk.id,
          risk_client_ref: risk.risk_code,
          sum_insured: toMoney(
            (entry.risks ?? []).reduce(
              (sum, item) => sum + Number(item.sum_insured ?? 0),
              0,
            ),
          ),
          premium: toMoney(
            (entry.risks ?? []).reduce(
              (sum, item) => sum + Number(item.premium_including_tax ?? 0),
              0,
            ),
          ),
          status: ACTIVE_ITEM_STATUS,
        }),
      );
      keptIds.add(saved.id);
      linked += 1;
    }

    // Vehicles removed from the quotation are retired, not deleted, so the
    // register keeps their history.
    const removed = existing
      .filter((item) => !keptIds.has(item.id))
      .map((item) => item.id);
    if (removed.length) {
      await itemRepository.update(
        { id: In(removed) },
        { status: REMOVED_ITEM_STATUS },
      );
      await itemRepository.softDelete({ id: In(removed) });
    }

    return linked;
  }

  private skip(reason: string): FleetRegisterSyncResult {
    this.logger.warn(`Fleet register sync skipped: ${reason}`);
    return {
      fleetId: null,
      vehicles: 0,
      linkedVehicles: 0,
      skippedReason: reason,
    };
  }
}

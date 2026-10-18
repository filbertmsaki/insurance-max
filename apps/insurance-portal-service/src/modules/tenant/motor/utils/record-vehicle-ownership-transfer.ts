import { AssetOwnershipType } from '@insurance-max/contracts';
import { EntityManager, IsNull } from 'typeorm';
import { MotorVehicleAuditLog } from '../entities/motor-vehicle-audit-log.entity';
import { MotorVehicleOwnership } from '../entities/motor-vehicle-ownership.entity';
import { MotorVehicle } from '../entities/motor-vehicle.entity';

function dateOnly(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

/**
 * Records a change of policyholder for a vehicle that has already been saved
 * under its new `customer_id` and insured asset: closes the open ownership
 * period, opens one for the new owner and writes an OWNERSHIP_CHANGED audit
 * entry. Runs inside the caller's transaction.
 */
export async function recordVehicleOwnershipTransfer(
  manager: EntityManager,
  input: {
    vehicle: MotorVehicle;
    previousCustomerId: string;
    userId: string;
    reason: string;
    source: string;
    relatedRecord?: { type: string; id: string };
  },
): Promise<void> {
  const { vehicle, previousCustomerId, userId } = input;
  if (!vehicle.insured_asset_id) return;

  const today = new Date().toISOString().slice(0, 10);
  const ownerships = manager.getRepository(MotorVehicleOwnership);
  const open = await ownerships.find({
    where: { motor_vehicle_id: vehicle.id, effective_to: IsNull() },
  });

  if (open.length > 0) {
    open.forEach((ownership) => {
      ownership.effective_to = today;
    });
    await ownerships.save(open);
  } else {
    // Vehicles first saved through a quotation have no ownership history;
    // keep the previous owner's period on record before handing over.
    await ownerships.save(
      ownerships.create({
        company_id: vehicle.company_id,
        motor_vehicle_id: vehicle.id,
        insured_asset_id: vehicle.insured_asset_id,
        owner_customer_id: previousCustomerId,
        ownership_type: AssetOwnershipType.OWNED,
        effective_from: dateOnly(vehicle.created_at) ?? today,
        effective_to: today,
        change_reason: null,
        created_by: userId,
      }),
    );
  }

  await ownerships.save(
    ownerships.create({
      company_id: vehicle.company_id,
      motor_vehicle_id: vehicle.id,
      insured_asset_id: vehicle.insured_asset_id,
      owner_customer_id: vehicle.customer_id,
      ownership_type: AssetOwnershipType.OWNED,
      effective_from: today,
      effective_to: null,
      change_reason: input.reason,
      created_by: userId,
    }),
  );

  const audit = manager.getRepository(MotorVehicleAuditLog);
  await audit.save(
    audit.create({
      company_id: vehicle.company_id,
      motor_vehicle_id: vehicle.id,
      motor_vehicle_version_id: null,
      customer_id: vehicle.customer_id,
      action: 'OWNERSHIP_CHANGED',
      old_values: { customerId: previousCustomerId },
      new_values: { customerId: vehicle.customer_id },
      fields_changed: ['customerId'],
      user_id: userId,
      source: input.source,
      related_record_type: input.relatedRecord?.type ?? null,
      related_record_id: input.relatedRecord?.id ?? null,
    }),
  );
}

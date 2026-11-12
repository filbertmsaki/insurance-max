import { Copy, Pencil, Plus, Trash2 } from 'lucide-react';
import { FLEET_MINIMUM_VEHICLES } from '@/modules/tenant/quotations/schemas';
import {
  getVehicleIssues,
  MotorFleetDetailsStep,
} from '@/modules/tenant/quotations/wizard/steps/MotorFleetDetailsStep';
import type { UnderwriteQuotationWizard } from '@/modules/tenant/underwrite/wizard/useUnderwriteQuotationWizard';
import { useFleetVehicleActions } from '../FleetQuotationWizard';
import { StatusBadge } from './MobileUi';

/** Vehicles that count towards the fleet (the untouched starter row does not). */
// eslint-disable-next-line react-refresh/only-export-components
export function fleetVehicleState(wizard: UnderwriteQuotationWizard) {
  const items = wizard.form.watch('fleet.items') ?? [];
  const entered = items.filter(
    (item) =>
      item.motor_dtl.registration_number.trim() ||
      item.motor_dtl.chassis_number.trim() ||
      item.motor_dtl.make.trim() ||
      item.motor_dtl.model.trim(),
  );
  const complete = entered.every((item) => getVehicleIssues(item).length === 0);
  return {
    count: entered.length,
    enough: entered.length >= FLEET_MINIMUM_VEHICLES,
    complete,
    ready: entered.length >= FLEET_MINIMUM_VEHICLES && complete,
  };
}

export function MobileFleetVehicles({
  wizard,
  hideVehicleLookup = false,
}: {
  wizard: UnderwriteQuotationWizard;
  hideVehicleLookup?: boolean;
}) {
  const { form } = wizard;
  const actions = useFleetVehicleActions(wizard);

  return (
    <MotorFleetDetailsStep
      form={form}
      customerOptions={wizard.customerOptions}
      riskOptions={wizard.riskOptions}
      vehicleOptions={wizard.vehicleOptions}
      productOptions={wizard.productOptions}
      fieldArray={wizard.fleetFieldArray}
      onAddVehicle={actions.add}
      onRemoveVehicle={actions.remove}
      onDuplicateVehicle={actions.duplicate}
      onImportVehicles={actions.importRows}
      factorContext={wizard.factorContext}
      hideVehicleLookup={hideVehicleLookup}
      shortTermVehicleDefaults={hideVehicleLookup}
      mobileList={({ rows, openNewVehicle, openVehicle, duplicateVehicle, removeVehicle }) => (
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-[17px] font-bold text-[#1B1F2E]">Vehicles</h2>
            <span className="text-[13px] text-[#5B6275]">
              {rows.length} vehicle{rows.length === 1 ? '' : 's'}
            </span>
          </div>

          {rows.length > 0 && (
            <ul className="divide-y divide-[#E6E8EF] overflow-hidden rounded-2xl border border-[#E6E8EF] bg-white">
              {rows.map(({ key, index, item }) => {
                const motor = item.motor_dtl;
                const complete = getVehicleIssues(item).length === 0;
                const name =
                  [motor.make, motor.model, motor.year_of_manufacture]
                    .filter(Boolean)
                    .join(' ') || 'New vehicle';
                const identifier =
                  motor.registration_number || motor.chassis_number || '—';
                return (
                  <li key={key}>
                    <div className="flex items-center">
                    <button
                      type="button"
                      onClick={() => openVehicle(index)}
                      aria-label={`Vehicle ${index + 1}: ${name}, ${identifier}, ${complete ? 'complete' : 'details needed'}`}
                      className="mq-raw flex min-h-[68px] min-w-0 flex-1 items-center gap-3 px-4 text-left focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#3B4A8C]"
                    >
                      <span
                        aria-hidden="true"
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#ECEEF5] text-[13px] font-semibold text-[#3B4A8C]"
                      >
                        {index + 1}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[15px] font-semibold text-[#1B1F2E]">
                          {name}
                        </span>
                        <span className="block truncate text-[13px] text-[#5B6275]">
                          {identifier}
                        </span>
                      </span>
                      {!complete && <StatusBadge complete={false} />}
                    </button>
                    <button type="button" aria-label={`Edit vehicle ${index + 1}`} className="flex h-11 w-11 shrink-0 items-center justify-center text-[#5B6275]" onClick={() => openVehicle(index)}><Pencil className="h-5 w-5" aria-hidden="true" /></button>
                    <button type="button" aria-label={`Duplicate vehicle ${index + 1}`} className="flex h-11 w-11 shrink-0 items-center justify-center text-[#5B6275]" onClick={() => duplicateVehicle(index)}><Copy className="h-5 w-5" aria-hidden="true" /></button>
                    <button type="button" aria-label={`Remove vehicle ${index + 1}`} className="flex h-11 w-11 shrink-0 items-center justify-center text-[#B42318]" onClick={() => removeVehicle(index)}><Trash2 className="h-5 w-5" aria-hidden="true" /></button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          <button
            type="button"
            onClick={openNewVehicle}
            className="mq-raw flex h-[52px] w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-[#3B4A8C] bg-white text-[15px] font-semibold text-[#3B4A8C] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3B4A8C]"
          >
            <Plus className="h-5 w-5" aria-hidden="true" />
            Add vehicle
          </button>

          {rows.length < FLEET_MINIMUM_VEHICLES && (
            <p
              role="status"
              data-mq-error
              className="rounded-xl bg-[#FDEFD9] px-3 py-2 text-[13px] text-[#8A4B08]"
            >
              A fleet needs at least {FLEET_MINIMUM_VEHICLES} vehicles
            </p>
          )}
        </div>
      )}
    />
  );
}

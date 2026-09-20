import { useCallback, useState } from 'react';
import { useWatch, type UseFormReturn } from 'react-hook-form';
import type { MotorVehicleRecord } from '@/modules/tenant/motor/types';
import {
  createEmptyMotorDetails,
  type QuotationFormSchemaValues,
} from '../../schemas';
import { normalizeMotorTextInput } from '../../utils/motorText';
import {
  getMotorCategoryCodeFromVehicleCategory,
  getMotorUsageCodeFromLabel,
} from '../utils/motorOptions';
import { mergeVerifiedMotor } from '../utils/motorFields';
import { StepSection } from '../components/StepSection';
import { VehicleLookup } from '../components/VehicleLookup';
import { VehicleDetailsFields } from '../components/VehicleDetailsFields';
interface Props {
  form: UseFormReturn<QuotationFormSchemaValues>;
  vehicleOptions: MotorVehicleRecord[];
}
const getUsageCodeFromLabel = getMotorUsageCodeFromLabel;
export function MotorDetailsStep({ form, vehicleOptions }: Props) {
  const [revision, setRevision] = useState(0);
  const motor = useWatch({ control: form.control, name: 'motor' });
  function resolveMotorCategoryCode(vehicle: MotorVehicleRecord) {
    const metadata = vehicle.metadata ?? {};
    const metadataCode = metadata.motor_category_code;

    if (
      metadataCode !== null &&
      metadataCode !== undefined &&
      metadataCode !== ''
    ) {
      return String(
        metadataCode,
      ) as QuotationFormSchemaValues['motor']['motor_category_code'];
    }

    const resolvedCode = getMotorCategoryCodeFromVehicleCategory(
      vehicle.motor_category ?? vehicle.vehicle_category,
    );

    return resolvedCode;
  }

  const fillFromExisting = useCallback(
    (vehicle: MotorVehicleRecord) => {
      const metadata = vehicle.metadata ?? {};
      form.setValue('motor.vehicle_id', vehicle.id, {
        shouldDirty: true,
        shouldTouch: true,
        shouldValidate: true,
      });
      form.setValue(
        'motor.motor_category_code',
        resolveMotorCategoryCode(vehicle),
        {
          shouldDirty: true,
          shouldTouch: true,
          shouldValidate: true,
        },
      );
      form.setValue(
        'motor.motor_type_code',
        String(
          metadata.motor_type_code ?? vehicle.motor_type ?? '1',
        ) as QuotationFormSchemaValues['motor']['motor_type_code'],
        {
          shouldDirty: true,
          shouldTouch: true,
          shouldValidate: true,
        },
      );
      form.setValue(
        'motor.registration_no',
        normalizeMotorTextInput(vehicle.registration_no),
        {
          shouldDirty: true,
          shouldTouch: true,
          shouldValidate: true,
        },
      );
      form.setValue(
        'motor.chassis_no',
        normalizeMotorTextInput(vehicle.chassis_no),
        {
          shouldDirty: true,
          shouldTouch: true,
          shouldValidate: true,
        },
      );
      form.setValue(
        'motor.engine_no',
        normalizeMotorTextInput(vehicle.engine_no),
        {
          shouldDirty: true,
          shouldTouch: true,
          shouldValidate: true,
        },
      );
      form.setValue('motor.make', normalizeMotorTextInput(vehicle.make), {
        shouldDirty: true,
        shouldTouch: true,
        shouldValidate: true,
      });
      form.setValue('motor.model', normalizeMotorTextInput(vehicle.model), {
        shouldDirty: true,
        shouldTouch: true,
        shouldValidate: true,
      });
      form.setValue(
        'motor.model_no',
        normalizeMotorTextInput(vehicle.model_no),
        {
          shouldDirty: true,
          shouldTouch: true,
          shouldValidate: true,
        },
      );
      form.setValue('motor.body_type', vehicle.body_type ?? '', {
        shouldDirty: true,
        shouldTouch: true,
        shouldValidate: true,
      });
      form.setValue('motor.color', vehicle.color ?? '', {
        shouldDirty: true,
        shouldTouch: true,
        shouldValidate: true,
      });
      form.setValue(
        'motor.manufacture_year',
        vehicle.manufacture_year != null
          ? String(vehicle.manufacture_year)
          : '',
        {
          shouldDirty: true,
          shouldTouch: true,
          shouldValidate: true,
        },
      );
      form.setValue('motor.usage_type', vehicle.usage_type ?? '', {
        shouldDirty: true,
        shouldTouch: true,
        shouldValidate: true,
      });
      form.setValue(
        'motor.motor_usage_code',
        (vehicle.motor_usage != null
          ? String(vehicle.motor_usage)
          : getUsageCodeFromLabel(
              vehicle.usage_type,
            )) as QuotationFormSchemaValues['motor']['motor_usage_code'],
        {
          shouldDirty: true,
          shouldTouch: true,
          shouldValidate: true,
        },
      );
      form.setValue('motor.vehicle_category', vehicle.vehicle_category ?? '', {
        shouldDirty: true,
        shouldTouch: true,
        shouldValidate: true,
      });
      form.setValue(
        'motor.seating_capacity',
        vehicle.seating_capacity != null
          ? String(vehicle.seating_capacity)
          : '',
        {
          shouldDirty: true,
          shouldTouch: true,
          shouldValidate: true,
        },
      );
      form.setValue('motor.tonnage', vehicle.tonnage ?? '', {
        shouldDirty: true,
        shouldTouch: true,
        shouldValidate: true,
      });
      form.setValue(
        'motor.cubic_capacity',
        vehicle.cubic_capacity != null ? String(vehicle.cubic_capacity) : '',
        {
          shouldDirty: true,
          shouldTouch: true,
          shouldValidate: true,
        },
      );
      form.setValue('motor.fuel_type', vehicle.fuel_type ?? '', {
        shouldDirty: true,
        shouldTouch: true,
        shouldValidate: true,
      });
      form.setValue(
        'motor.number_of_axles',
        vehicle.number_of_axles != null ? String(vehicle.number_of_axles) : '',
        {
          shouldDirty: true,
          shouldTouch: true,
          shouldValidate: true,
        },
      );
      form.setValue('motor.axle_distance', vehicle.axle_distance ?? '', {
        shouldDirty: true,
        shouldTouch: true,
        shouldValidate: true,
      });
      form.setValue('motor.tare_weight', vehicle.tare_weight ?? '', {
        shouldDirty: true,
        shouldTouch: true,
        shouldValidate: true,
      });
      form.setValue('motor.gross_weight', vehicle.gross_weight ?? '', {
        shouldDirty: true,
        shouldTouch: true,
        shouldValidate: true,
      });
      form.setValue('motor.owner_name', vehicle.owner_name ?? '', {
        shouldDirty: true,
        shouldTouch: true,
        shouldValidate: true,
      });
      form.setValue(
        'motor.owner_category',
        (vehicle.owner_category != null
          ? String(vehicle.owner_category)
          : '') as QuotationFormSchemaValues['motor']['owner_category'],
        {
          shouldDirty: true,
          shouldTouch: true,
          shouldValidate: true,
        },
      );
      form.setValue('motor.owner_address', vehicle.owner_address ?? '', {
        shouldDirty: true,
        shouldTouch: true,
        shouldValidate: true,
      });
      form.setValue('motor.vehicle_value', vehicle.vehicle_value ?? '', {
        shouldDirty: true,
        shouldTouch: true,
        shouldValidate: true,
      });
    },
    [form],
  );

  return (
    <StepSection title="Vehicle" first>
      <VehicleLookup
        initialCategory={motor.motor_category_code}
        onFound={(details) => {
          form.setValue(
            'motor',
            mergeVerifiedMotor(
              form.getValues('motor'),
              details,
              createEmptyMotorDetails(),
            ),
            { shouldDirty: true, shouldValidate: true },
          );
          form.setValue('motor_mode', 'new');
          setRevision((value) => value + 1);
        }}
      />
      {vehicleOptions.length > 0 && (
        <div className="space-y-2">
          <label htmlFor="saved-vehicle" className="text-sm font-medium">
            Use a saved vehicle
          </label>
          <select
            id="saved-vehicle"
            className="h-10 w-full rounded-md border px-3 text-sm"
            value={motor.vehicle_id}
            onChange={(event) => {
              const vehicle = vehicleOptions.find(
                (item) => item.id === event.target.value,
              );
              if (vehicle) {
                fillFromExisting(vehicle);
                form.setValue('motor_mode', 'existing');
                setRevision((value) => value + 1);
              }
            }}
          >
            <option value="">Select vehicle</option>
            {vehicleOptions.map((vehicle) => (
              <option key={vehicle.id} value={vehicle.id}>
                {vehicle.registration_no || vehicle.chassis_no || 'Vehicle'} ?{' '}
                {vehicle.make} {vehicle.model}
              </option>
            ))}
          </select>
        </div>
      )}
      <VehicleDetailsFields key={revision} form={form} />
    </StepSection>
  );
}

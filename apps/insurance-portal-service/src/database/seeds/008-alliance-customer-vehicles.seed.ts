import { DataSource } from 'typeorm';
import { Seeder, SeederFactoryManager } from 'typeorm-extension';
import { ALLIANCE_TENANT } from './data/alliance.seed-data';
import { requireColumns, withSeedTransaction } from './shared/seed-utils';

const DEMO_CUSTOMERS = [
  {
    customerNo: 'AICL-CUST-001',
    customerType: 'INDIVIDUAL',
    policyHolderType: 1,
    firstName: 'Amani',
    middleName: 'Juma',
    lastName: 'Mashauri',
    gender: 'M',
    dateOfBirth: '1988-04-12',
    companyName: null,
    tin: null,
    phone: '0711000001',
    email: 'amani.mashauri@example.test',
    idNumber: '19900412123456789001',
    registrationNo: 'T 101 AAM',
    vehicle: {
      registrationNo: 'T 101 AAM',
      chassisNo: 'AICLCHASSIS000001',
      engineNo: 'AICLENGINE000001',
      make: 'Toyota',
      model: 'Corolla',
      bodyType: 'Saloon',
      color: 'White',
      manufactureYear: 2020,
      usageType: 'PRIVATE',
      vehicleCategory: 'PRIVATE_CAR',
      seatingCapacity: 5,
      tonnage: null,
      cubicCapacity: 1794,
      fuelType: 'PETROL',
      modelNo: 'ZRE172R-GEXEP',
      numberOfAxles: 2,
      axleDistance: '2.60',
      tareWeight: '1280.00',
      grossWeight: '1680.00',
      motorCategory: 1,
      motorType: 1,
      motorUsage: 1,
      ownerName: 'Amani Juma Mashauri',
      ownerCategory: 1,
      ownerAddress: 'Plot 12, Upanga, Dar es Salaam',
      vehicleValue: '28000000.00',
    },
  },
  {
    customerNo: 'AICL-CUST-002',
    customerType: 'INDIVIDUAL',
    policyHolderType: 1,
    firstName: 'Neema',
    middleName: 'Salim',
    lastName: 'Mhando',
    gender: 'F',
    dateOfBirth: '1992-09-27',
    companyName: null,
    tin: null,
    phone: '0711000002',
    email: 'neema.mhando@example.test',
    idNumber: '19920927123456789002',
    registrationNo: 'T 202 BBN',
    vehicle: {
      registrationNo: 'T 202 BBN',
      chassisNo: 'AICLCHASSIS000002',
      engineNo: 'AICLENGINE000002',
      make: 'Honda',
      model: 'Fit',
      bodyType: 'Hatchback',
      color: 'Blue',
      manufactureYear: 2019,
      usageType: 'PRIVATE',
      vehicleCategory: 'PRIVATE_CAR',
      seatingCapacity: 5,
      tonnage: null,
      cubicCapacity: 1498,
      fuelType: 'PETROL',
      modelNo: 'GK5-EXL',
      numberOfAxles: 2,
      axleDistance: '2.53',
      tareWeight: '1110.00',
      grossWeight: '1500.00',
      motorCategory: 1,
      motorType: 1,
      motorUsage: 1,
      ownerName: 'Neema Salim Mhando',
      ownerCategory: 1,
      ownerAddress: 'House 45, Mikocheni, Dar es Salaam',
      vehicleValue: '22000000.00',
    },
  },
  {
    customerNo: 'AICL-CUST-003',
    customerType: 'CORPORATE',
    policyHolderType: 2,
    firstName: null,
    middleName: null,
    lastName: null,
    gender: null,
    dateOfBirth: null,
    idNumber: null,
    companyName: 'Alliance A Logistics Limited',
    registrationNo: 'T 303 CCL',
    phone: '0711000003',
    email: 'fleet@example.test',
    tin: '120-456-789',
    vehicle: {
      registrationNo: 'T 303 CCL',
      chassisNo: 'AICLCHASSIS000003',
      engineNo: 'AICLENGINE000003',
      make: 'Toyota',
      model: 'Hiace',
      bodyType: 'Minibus',
      color: 'Silver',
      manufactureYear: 2021,
      usageType: 'COMMERCIAL',
      vehicleCategory: 'COMMERCIAL_VEHICLE',
      seatingCapacity: 14,
      tonnage: '2.50',
      cubicCapacity: 2694,
      fuelType: 'DIESEL',
      modelNo: 'GDH322L-LEMDY',
      numberOfAxles: 2,
      axleDistance: '2.98',
      tareWeight: '1980.00',
      grossWeight: '2800.00',
      motorCategory: 2,
      motorType: 2,
      motorUsage: 2,
      ownerName: 'Alliance A Logistics Limited',
      ownerCategory: 2,
      ownerAddress: 'Plot 88, Nyerere Road, Dar es Salaam',
      vehicleValue: '78000000.00',
    },
  },
] as const;

export default class AllianceCustomerVehiclesSeeder implements Seeder {
  public async run(
    dataSource: DataSource,
    _factoryManager: SeederFactoryManager,
  ): Promise<void> {
    if (process.env.ENABLE_DEMO_SEED !== 'true') {
      console.log(
        '[alliance-customer-vehicles-seed] Skipped. ENABLE_DEMO_SEED is not true.',
      );
      return;
    }

    await withSeedTransaction(
      dataSource,
      'seed:alliance-customer-vehicles',
      async (queryRunner) => {
        await requireColumns(queryRunner, 'customers', [
          'company_id',
          'customer_no',
          'customer_type',
          'policy_holder_type',
          'phone',
          'country_code',
          'region',
          'district',
          'status',
        ]);
        await requireColumns(queryRunner, 'motor_vehicles', [
          'company_id',
          'customer_id',
          'registration_no',
          'chassis_no',
          'engine_no',
          'make',
          'model',
          'body_type',
          'color',
          'manufacture_year',
          'usage_type',
          'vehicle_category',
          'seating_capacity',
          'tonnage',
          'cubic_capacity',
          'fuel_type',
          'model_no',
          'number_of_axles',
          'axle_distance',
          'tare_weight',
          'gross_weight',
          'motor_category',
          'motor_type',
          'motor_usage',
          'owner_name',
          'owner_category',
          'owner_address',
          'vehicle_value',
          'currency',
          'status',
        ]);

        const companyRows = await queryRunner.query(
          `
            SELECT id
            FROM companies
            WHERE deleted_at IS NULL AND slug = $1
            LIMIT 1
          `,
          [ALLIANCE_TENANT.slug],
        );
        const companyId = companyRows[0]?.id as string | undefined;

        if (!companyId) {
          throw new Error(
            `[alliance-customer-vehicles-seed] Alliance company ${ALLIANCE_TENANT.slug} was not found`,
          );
        }

        for (const customer of DEMO_CUSTOMERS) {
          const customerRows = await queryRunner.query(
            `
              INSERT INTO customers (
                company_id, customer_no, customer_type, first_name,
                middle_name, last_name, gender, date_of_birth,
                company_name, tin, policy_holder_type, id_number, phone,
                email, country, country_code, region, district, status,
                metadata, created_at, updated_at
              )
              VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
                $13, $14, 'Tanzania', 'TZA', 'Dar es Salaam', 'Ilala',
                'ACTIVE', $15::jsonb, now(), now()
              )
              ON CONFLICT (company_id, customer_no)
              WHERE deleted_at IS NULL
              DO UPDATE SET
                customer_type = EXCLUDED.customer_type,
                first_name = EXCLUDED.first_name,
                middle_name = EXCLUDED.middle_name,
                last_name = EXCLUDED.last_name,
                gender = EXCLUDED.gender,
                date_of_birth = EXCLUDED.date_of_birth,
                company_name = EXCLUDED.company_name,
                tin = EXCLUDED.tin,
                policy_holder_type = EXCLUDED.policy_holder_type,
                id_number = EXCLUDED.id_number,
                phone = EXCLUDED.phone,
                email = EXCLUDED.email,
                status = 'ACTIVE',
                metadata = EXCLUDED.metadata,
                updated_at = now()
              RETURNING id
            `,
            [
              companyId,
              customer.customerNo,
              customer.customerType,
              customer.firstName ?? null,
              customer.middleName ?? null,
              customer.lastName ?? null,
              customer.gender ?? null,
              customer.dateOfBirth ?? null,
              customer.companyName ?? null,
              customer.tin ?? null,
              customer.policyHolderType,
              customer.idNumber ?? null,
              customer.phone,
              customer.email,
              JSON.stringify({ seedSource: '008-alliance-customer-vehicles.seed' }),
            ],
          );

          const customerId = customerRows[0]?.id as string | undefined;
          if (!customerId) throw new Error(`Could not seed ${customer.customerNo}`);

          const vehicle = customer.vehicle;
          await queryRunner.query(
            `
              INSERT INTO motor_vehicles (
                company_id, customer_id, registration_no, chassis_no,
                engine_no, make, model, body_type, color, manufacture_year,
                usage_type, vehicle_category, seating_capacity,
                tonnage, cubic_capacity, fuel_type, model_no, number_of_axles,
                axle_distance, tare_weight, gross_weight, motor_category,
                motor_type, motor_usage, owner_name, owner_category,
                owner_address, vehicle_value, currency, status,
                metadata, created_at, updated_at
              )
              VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
                $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24,
                $25, $26, $27, $28, 'TZS', 'ACTIVE', $29::jsonb, now(), now()
              )
              ON CONFLICT (company_id, registration_no)
              WHERE deleted_at IS NULL AND registration_no IS NOT NULL
              DO UPDATE SET
                customer_id = EXCLUDED.customer_id,
                chassis_no = EXCLUDED.chassis_no,
                engine_no = EXCLUDED.engine_no,
                make = EXCLUDED.make,
                model = EXCLUDED.model,
                body_type = EXCLUDED.body_type,
                color = EXCLUDED.color,
                manufacture_year = EXCLUDED.manufacture_year,
                usage_type = EXCLUDED.usage_type,
                vehicle_category = EXCLUDED.vehicle_category,
                seating_capacity = EXCLUDED.seating_capacity,
                tonnage = EXCLUDED.tonnage,
                cubic_capacity = EXCLUDED.cubic_capacity,
                fuel_type = EXCLUDED.fuel_type,
                model_no = EXCLUDED.model_no,
                number_of_axles = EXCLUDED.number_of_axles,
                axle_distance = EXCLUDED.axle_distance,
                tare_weight = EXCLUDED.tare_weight,
                gross_weight = EXCLUDED.gross_weight,
                motor_category = EXCLUDED.motor_category,
                motor_type = EXCLUDED.motor_type,
                motor_usage = EXCLUDED.motor_usage,
                owner_name = EXCLUDED.owner_name,
                owner_category = EXCLUDED.owner_category,
                owner_address = EXCLUDED.owner_address,
                vehicle_value = EXCLUDED.vehicle_value,
                status = 'ACTIVE',
                metadata = EXCLUDED.metadata,
                updated_at = now()
            `,
            [
              companyId,
              customerId,
              vehicle.registrationNo,
              vehicle.chassisNo,
              vehicle.engineNo,
              vehicle.make,
              vehicle.model,
              vehicle.bodyType,
              vehicle.color,
              vehicle.manufactureYear,
              vehicle.usageType,
              vehicle.vehicleCategory,
              vehicle.seatingCapacity,
              vehicle.tonnage,
              vehicle.cubicCapacity,
              vehicle.fuelType,
              vehicle.modelNo,
              vehicle.numberOfAxles,
              vehicle.axleDistance,
              vehicle.tareWeight,
              vehicle.grossWeight,
              vehicle.motorCategory,
              vehicle.motorType,
              vehicle.motorUsage,
              vehicle.ownerName,
              vehicle.ownerCategory,
              vehicle.ownerAddress,
              vehicle.vehicleValue,
              JSON.stringify({ seedSource: '008-alliance-customer-vehicles.seed' }),
            ],
          );
        }
      },
    );

    console.log(
      '[alliance-customer-vehicles-seed] Seeded 3 customers and 3 vehicles for Alliance',
    );
  }
}

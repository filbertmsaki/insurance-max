import { createHash } from 'node:crypto';
import { environment } from '@insurance-max/shared-config';
import { DataSource } from 'typeorm';
import { Seeder, SeederFactoryManager } from 'typeorm-extension';
import { ALLIANCE_TENANT } from './data/alliance.seed-data';
import { requireColumns, withSeedTransaction } from './shared/seed-utils';

const SEED_SOURCE = '008-alliance-customer-vehicles.seed';

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
    idType: 1,
    phone: '0711000001',
    email: 'amani.mashauri@example.test',
    idNumber: '19900412123456789001',
    metadata: {
      seedSource: SEED_SOURCE,
      demoProfile: 'individual-motor-showcase',
      intendedVehicleCount: 2,
    },
    vehicles: [
      {
        productCode: 'SP014001000000',
        productName: 'MOTOR PRIVATE VEHICLE',
        registrationNo: 'T101AAM',
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
        metadata: {
          seedSource: SEED_SOURCE,
          intendedProductCode: 'SP014001000000',
          intendedProductName: 'MOTOR PRIVATE VEHICLE',
          demoScenario: 'individual-private-vehicle',
        },
      },
      {
        productCode: 'SP014002000000',
        productName: 'MOTOR MOTOR CYCLE',
        registrationNo: 'MC808AIC',
        chassisNo: 'AICLCHASSIS000004',
        engineNo: 'AICLENGINE000004',
        make: 'Yamaha',
        model: 'FZ-S FI',
        bodyType: 'Motorcycle',
        color: 'Black',
        manufactureYear: 2022,
        usageType: 'PRIVATE',
        vehicleCategory: 'MOTOR_CYCLE',
        seatingCapacity: 2,
        tonnage: null,
        cubicCapacity: 149,
        fuelType: 'PETROL',
        modelNo: 'FZS150-V3',
        numberOfAxles: 2,
        axleDistance: '1.33',
        tareWeight: '137.00',
        grossWeight: '267.00',
        motorCategory: 1,
        motorType: 1,
        motorUsage: 1,
        ownerName: 'Amani Juma Mashauri',
        ownerCategory: 1,
        ownerAddress: 'Plot 12, Upanga, Dar es Salaam',
        vehicleValue: '6500000.00',
        metadata: {
          seedSource: SEED_SOURCE,
          intendedProductCode: 'SP014002000000',
          intendedProductName: 'MOTOR MOTOR CYCLE',
          demoScenario: 'individual-motor-cycle',
        },
      },
    ],
  },
  {
    customerNo: 'AICL-CUST-002',
    customerType: 'INDIVIDUAL',
    policyHolderType: 1,
    firstName: 'Neema',
    middleName: 'Peter',
    lastName: 'Kileo',
    gender: 'F',
    dateOfBirth: '1992-09-03',
    companyName: null,
    tin: null,
    idType: 1,
    phone: '0711000003',
    email: 'neema.kileo@example.test',
    idNumber: '19920903123456789002',
    metadata: {
      seedSource: SEED_SOURCE,
      demoProfile: 'individual-motor-showcase',
      intendedVehicleCount: 2,
    },
    vehicles: [
      {
        productCode: 'SP014001000000',
        productName: 'MOTOR PRIVATE VEHICLE',
        registrationNo: 'T202ANK',
        chassisNo: 'AICLCHASSIS000002',
        engineNo: 'AICLENGINE000002',
        make: 'Toyota',
        model: 'RAV4',
        bodyType: 'SUV',
        color: 'Grey',
        manufactureYear: 2022,
        usageType: 'PRIVATE',
        vehicleCategory: 'PRIVATE_CAR',
        seatingCapacity: 5,
        tonnage: null,
        cubicCapacity: 1998,
        fuelType: 'PETROL',
        modelNo: 'MXAA54-AEXNKW',
        numberOfAxles: 2,
        axleDistance: '2.69',
        tareWeight: '1650.00',
        grossWeight: '2110.00',
        motorCategory: 1,
        motorType: 1,
        motorUsage: 1,
        ownerName: 'Neema Peter Kileo',
        ownerCategory: 1,
        ownerAddress: 'Plot 45, Mikocheni, Dar es Salaam',
        vehicleValue: '55000000.00',
        metadata: {
          seedSource: SEED_SOURCE,
          intendedProductCode: 'SP014001000000',
          intendedProductName: 'MOTOR PRIVATE VEHICLE',
          demoScenario: 'individual-private-vehicle',
        },
      },
      {
        productCode: 'SP014002000000',
        productName: 'MOTOR MOTOR CYCLE',
        registrationNo: 'MC909ANK',
        chassisNo: 'AICLCHASSIS000006',
        engineNo: 'AICLENGINE000006',
        make: 'Honda',
        model: 'CB150R Streetfire',
        bodyType: 'Motorcycle',
        color: 'Red',
        manufactureYear: 2023,
        usageType: 'PRIVATE',
        vehicleCategory: 'MOTOR_CYCLE',
        seatingCapacity: 2,
        tonnage: null,
        cubicCapacity: 149,
        fuelType: 'PETROL',
        modelNo: 'KC26-1300123',
        numberOfAxles: 2,
        axleDistance: '1.28',
        tareWeight: '131.00',
        grossWeight: '256.00',
        motorCategory: 1,
        motorType: 1,
        motorUsage: 1,
        ownerName: 'Neema Peter Kileo',
        ownerCategory: 1,
        ownerAddress: 'Plot 45, Mikocheni, Dar es Salaam',
        vehicleValue: '5800000.00',
        metadata: {
          seedSource: SEED_SOURCE,
          intendedProductCode: 'SP014002000000',
          intendedProductName: 'MOTOR MOTOR CYCLE',
          demoScenario: 'individual-motor-cycle',
        },
      },
    ],
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
    companyName: 'Alliance Fleet Services Limited',
    phone: '0711000002',
    email: 'fleet.operations@example.test',
    tin: '120-456-789',
    metadata: {
      seedSource: SEED_SOURCE,
      demoProfile: 'corporate-motor-showcase',
      intendedVehicleCount: 3,
    },
    vehicles: [
      {
        productCode: 'SP014003000000',
        productName: 'MOTOR Commercial Vehicle',
        registrationNo: 'T303CCL',
        chassisNo: 'AICLCHASSIS000003',
        engineNo: 'AICLENGINE000003',
        make: 'Isuzu',
        model: 'NPR 75L',
        bodyType: 'Box Truck',
        color: 'Silver',
        manufactureYear: 2021,
        usageType: 'COMMERCIAL',
        vehicleCategory: 'COMMERCIAL_VEHICLE',
        seatingCapacity: 3,
        tonnage: '4.80',
        cubicCapacity: 5193,
        fuelType: 'DIESEL',
        modelNo: 'NPR75L-K',
        numberOfAxles: 2,
        axleDistance: '3.82',
        tareWeight: '3180.00',
        grossWeight: '6500.00',
        motorCategory: 2,
        motorType: 1,
        motorUsage: 2,
        ownerName: 'Alliance Fleet Services Limited',
        ownerCategory: 2,
        ownerAddress: 'Plot 88, Nyerere Road, Dar es Salaam',
        vehicleValue: '78000000.00',
        metadata: {
          seedSource: SEED_SOURCE,
          intendedProductCode: 'SP014003000000',
          intendedProductName: 'MOTOR Commercial Vehicle',
          demoScenario: 'corporate-commercial-vehicle',
        },
      },
      {
        productCode: 'SP014004000000',
        productName: 'MOTOR PASSENGER CARRYING',
        registrationNo: 'T404DPC',
        chassisNo: 'AICLCHASSIS000005',
        engineNo: 'AICLENGINE000005',
        make: 'Toyota',
        model: 'Coaster',
        bodyType: 'Bus',
        color: 'Blue',
        manufactureYear: 2023,
        usageType: 'COMMERCIAL',
        vehicleCategory: 'PASSENGER_CARRYING',
        seatingCapacity: 29,
        tonnage: '5.90',
        cubicCapacity: 4009,
        fuelType: 'DIESEL',
        modelNo: 'XZB70L-ZGMRS',
        numberOfAxles: 2,
        axleDistance: '3.94',
        tareWeight: '3300.00',
        grossWeight: '5670.00',
        motorCategory: 2,
        motorType: 1,
        motorUsage: 2,
        ownerName: 'Alliance Fleet Services Limited',
        ownerCategory: 2,
        ownerAddress: 'Plot 88, Nyerere Road, Dar es Salaam',
        vehicleValue: '125000000.00',
        metadata: {
          seedSource: SEED_SOURCE,
          intendedProductCode: 'SP014004000000',
          intendedProductName: 'MOTOR PASSENGER CARRYING',
          demoScenario: 'corporate-passenger-carrying',
        },
      },
      {
        productCode: 'SP014005000000',
        productName: 'MOTOR SPECIAL TYPE VEHICLES',
        registrationNo: 'T505SPT',
        chassisNo: 'AICLCHASSIS000007',
        engineNo: 'AICLENGINE000007',
        make: 'Isuzu',
        model: 'FRR Water Bowser',
        bodyType: 'Tanker',
        color: 'White',
        manufactureYear: 2020,
        usageType: 'COMMERCIAL',
        vehicleCategory: 'SPECIAL_TYPE_VEHICLE',
        seatingCapacity: 2,
        tonnage: '8.00',
        cubicCapacity: 5193,
        fuelType: 'DIESEL',
        modelNo: 'FRR90N-KEXQFY',
        numberOfAxles: 2,
        axleDistance: '4.18',
        tareWeight: '4200.00',
        grossWeight: '10000.00',
        motorCategory: 2,
        motorType: 1,
        motorUsage: 2,
        ownerName: 'Alliance Fleet Services Limited',
        ownerCategory: 2,
        ownerAddress: 'Plot 88, Nyerere Road, Dar es Salaam',
        vehicleValue: '145000000.00',
        metadata: {
          seedSource: SEED_SOURCE,
          intendedProductCode: 'SP014005000000',
          intendedProductName: 'MOTOR SPECIAL TYPE VEHICLES',
          demoScenario: 'corporate-special-type-vehicle',
        },
      },
    ],
  },
  {
    customerNo: 'AICL-CUST-004',
    customerType: 'CORPORATE',
    policyHolderType: 2,
    firstName: null,
    middleName: null,
    lastName: null,
    gender: null,
    dateOfBirth: null,
    idNumber: null,
    companyName: 'Serengeti Logistics Company Limited',
    phone: '0711000004',
    email: 'logistics@example.test',
    tin: '120-456-999',
    metadata: {
      seedSource: SEED_SOURCE,
      demoProfile: 'corporate-motor-showcase',
      intendedVehicleCount: 3,
    },
    vehicles: [
      {
        productCode: 'SP014003000000',
        productName: 'MOTOR Commercial Vehicle',
        registrationNo: 'T606SLC',
        chassisNo: 'AICLCHASSIS000008',
        engineNo: 'AICLENGINE000008',
        make: 'Mitsubishi',
        model: 'Fuso Canter',
        bodyType: 'Flatbed Truck',
        color: 'Yellow',
        manufactureYear: 2022,
        usageType: 'COMMERCIAL',
        vehicleCategory: 'COMMERCIAL_VEHICLE',
        seatingCapacity: 3,
        tonnage: '3.50',
        cubicCapacity: 3908,
        fuelType: 'DIESEL',
        modelNo: 'FE71-DGDGE',
        numberOfAxles: 2,
        axleDistance: '3.35',
        tareWeight: '2450.00',
        grossWeight: '5000.00',
        motorCategory: 2,
        motorType: 1,
        motorUsage: 2,
        ownerName: 'Serengeti Logistics Company Limited',
        ownerCategory: 2,
        ownerAddress: 'Plot 21, Nyerere Road, Dar es Salaam',
        vehicleValue: '62000000.00',
        metadata: {
          seedSource: SEED_SOURCE,
          intendedProductCode: 'SP014003000000',
          intendedProductName: 'MOTOR Commercial Vehicle',
          demoScenario: 'corporate-commercial-vehicle',
        },
      },
      {
        productCode: 'SP014004000000',
        productName: 'MOTOR PASSENGER CARRYING',
        registrationNo: 'T707SLC',
        chassisNo: 'AICLCHASSIS000009',
        engineNo: 'AICLENGINE000009',
        make: 'Toyota',
        model: 'Hiace',
        bodyType: 'Commuter Van',
        color: 'White',
        manufactureYear: 2022,
        usageType: 'COMMERCIAL',
        vehicleCategory: 'PASSENGER_CARRYING',
        seatingCapacity: 14,
        tonnage: '2.80',
        cubicCapacity: 2982,
        fuelType: 'DIESEL',
        modelNo: 'KDH201-BEMDY4',
        numberOfAxles: 2,
        axleDistance: '2.87',
        tareWeight: '2050.00',
        grossWeight: '3200.00',
        motorCategory: 2,
        motorType: 1,
        motorUsage: 2,
        ownerName: 'Serengeti Logistics Company Limited',
        ownerCategory: 2,
        ownerAddress: 'Plot 21, Nyerere Road, Dar es Salaam',
        vehicleValue: '68000000.00',
        metadata: {
          seedSource: SEED_SOURCE,
          intendedProductCode: 'SP014004000000',
          intendedProductName: 'MOTOR PASSENGER CARRYING',
          demoScenario: 'corporate-passenger-carrying',
        },
      },
      {
        productCode: 'SP014005000000',
        productName: 'MOTOR SPECIAL TYPE VEHICLES',
        registrationNo: 'T808SLC',
        chassisNo: 'AICLCHASSIS000010',
        engineNo: 'AICLENGINE000010',
        make: 'Tadano',
        model: 'GR-250N Mobile Crane',
        bodyType: 'Mobile Crane',
        color: 'Orange',
        manufactureYear: 2019,
        usageType: 'COMMERCIAL',
        vehicleCategory: 'SPECIAL_TYPE_VEHICLE',
        seatingCapacity: 2,
        tonnage: '12.50',
        cubicCapacity: 6913,
        fuelType: 'DIESEL',
        modelNo: 'GR250N-1-00101',
        numberOfAxles: 3,
        axleDistance: '5.40',
        tareWeight: '9800.00',
        grossWeight: '16500.00',
        motorCategory: 2,
        motorType: 1,
        motorUsage: 2,
        ownerName: 'Serengeti Logistics Company Limited',
        ownerCategory: 2,
        ownerAddress: 'Plot 21, Nyerere Road, Dar es Salaam',
        vehicleValue: '210000000.00',
        metadata: {
          seedSource: SEED_SOURCE,
          intendedProductCode: 'SP014005000000',
          intendedProductName: 'MOTOR SPECIAL TYPE VEHICLES',
          demoScenario: 'corporate-special-type-vehicle',
        },
      },
    ],
  },
] as const;

const DEMO_CUSTOMER_NOS = DEMO_CUSTOMERS.map((customer) => customer.customerNo);
const DEMO_VEHICLE_REGISTRATION_NOS = DEMO_CUSTOMERS.flatMap((customer) =>
  customer.vehicles.map((vehicle) => vehicle.registrationNo),
);
const DEMO_VEHICLE_COUNT = DEMO_CUSTOMERS.reduce(
  (count, customer) => count + customer.vehicles.length,
  0,
);

export default class AllianceCustomerVehiclesSeeder implements Seeder {
  public async run(
    dataSource: DataSource,
    _factoryManager: SeederFactoryManager,
  ): Promise<void> {
    if (environment.ENABLE_DEMO_SEED !== 'true') {
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
          'id_type',
          'status',
        ]);
        await requireColumns(queryRunner, 'customer_identifiers', [
          'company_id',
          'customer_id',
          'identifier_type',
          'identifier_value',
          'normalized_value',
          'fingerprint',
          'country_code',
          'is_primary',
          'metadata',
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

        await queryRunner.query(
          `
            DELETE FROM motor_vehicles
            WHERE company_id = $1
              AND COALESCE(metadata->>'seedSource', '') = $2
              AND registration_no IS NOT NULL
              AND registration_no <> ALL($3::text[])
          `,
          [companyId, SEED_SOURCE, DEMO_VEHICLE_REGISTRATION_NOS],
        );

        await queryRunner.query(
          `
            DELETE FROM customers
            WHERE company_id = $1
              AND COALESCE(metadata->>'seedSource', '') = $2
              AND customer_no <> ALL($3::text[])
          `,
          [companyId, SEED_SOURCE, DEMO_CUSTOMER_NOS],
        );

        for (const customer of DEMO_CUSTOMERS) {
          const customerRows = await queryRunner.query(
            `
              INSERT INTO customers (
                company_id, customer_no, customer_type, first_name,
                middle_name, last_name, gender, date_of_birth,
                company_name, tin, policy_holder_type, id_type, id_number, phone,
                email, country, country_code, region, district, status,
                metadata, created_at, updated_at
              )
              VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
                $14, $15, 'Tanzania', 'TZA', 'Dar es Salaam', 'Ilala',
                'ACTIVE', $16::jsonb, now(), now()
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
                id_type = EXCLUDED.id_type,
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
              customer.idType ?? null,
              customer.idNumber ?? null,
              customer.phone,
              customer.email,
              JSON.stringify(customer.metadata),
            ],
          );

          const customerId = customerRows[0]?.id as string | undefined;
          if (!customerId)
            throw new Error(`Could not seed ${customer.customerNo}`);

          await queryRunner.query(
            `
              DELETE FROM customer_identifiers
              WHERE company_id = $1
                AND customer_id = $2
                AND metadata->>'seedSource' = $3
            `,
            [companyId, customerId, SEED_SOURCE],
          );

          if (customer.idType && customer.idNumber) {
            const normalizedId = customer.idNumber
              .replace(/[^A-Za-z0-9]/g, '')
              .toUpperCase();
            const identifierType = customer.idType === 1 ? 'NIN' : 'OTHER';
            const fingerprint = createHash('sha256')
              .update(normalizedId, 'utf8')
              .digest('hex');

            await queryRunner.query(
              `
                INSERT INTO customer_identifiers (
                  company_id, customer_id, identifier_type,
                  identifier_value, normalized_value, fingerprint,
                  country_code, is_primary, is_verified, source, metadata,
                  created_at, updated_at
                )
                VALUES ($1, $2, $3, $4, $5, $6, 'TZA', true, false,
                  'SEED', $7::jsonb, now(), now())
              `,
              [
                companyId,
                customerId,
                identifierType,
                customer.idNumber,
                normalizedId,
                fingerprint,
                JSON.stringify({ seedSource: SEED_SOURCE }),
              ],
            );
          }

          for (const vehicle of customer.vehicles) {
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
                JSON.stringify({
                  ...vehicle.metadata,
                  productCode: vehicle.productCode,
                  productName: vehicle.productName,
                  customerNo: customer.customerNo,
                }),
              ],
            );
          }
        }
      },
    );

    console.log(
      `[alliance-customer-vehicles-seed] Seeded ${DEMO_CUSTOMERS.length} customers and ${DEMO_VEHICLE_COUNT} vehicles for Alliance`,
    );
  }
}

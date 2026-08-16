import { environment } from '@insurance-max/shared-config';
import { DataSource } from 'typeorm';
import { runSeeders } from 'typeorm-extension';
import PlatformIdpSeeder from './000-platform-idp.seed';
import InitialRbacSeeder from './001-initial-rbac.seed';
import ProductEngineSeeder from './002-product-engine.seed';
import RatingFactorsSeeder from './003-rating-factors.seed';
import RiskFactorLinkSeeder from './004-risk-factor-link.seed';
import TiramisCompanySetupSeeder from './005-tiramis-company-setup.seed';
import TiramisBusinessRecordsSeeder from './006-tiramis-business-records.seed';
import TiramisLookupsSeeder from './007-tiramis-lookups.seed';
import AllianceCustomerVehiclesSeeder from './008-alliance-customer-vehicles.seed';
import MotorPricingSeeder from './009-motor-pricing.seed';
import AnalyticsDefinitionsSeeder from './010-analytics.seed';
import ReferenceDataSeeder from './011-reference-data.seed';
import EndorsementTypesSeeder from './012-endorsement-types.seed';

const productionSeeders = [
  PlatformIdpSeeder,
  InitialRbacSeeder,
  TiramisCompanySetupSeeder,
  TiramisLookupsSeeder,
  ReferenceDataSeeder,
  ProductEngineSeeder,
  RatingFactorsSeeder,
  RiskFactorLinkSeeder,
  MotorPricingSeeder,
  AllianceCustomerVehiclesSeeder,
  AnalyticsDefinitionsSeeder,
  EndorsementTypesSeeder,
];

export async function runAllSeeders(dataSource: DataSource): Promise<void> {
  const seeds =
    environment.ENABLE_DEMO_SEED === 'true'
      ? [...productionSeeders, TiramisBusinessRecordsSeeder]
      : productionSeeders;

  console.log('Starting database seeding');

  try {
    await runSeeders(dataSource, { seeds });
    console.log('Database seeding completed successfully');
  } catch (error) {
    console.error('Seeding failed:', error);
    throw error;
  }
}

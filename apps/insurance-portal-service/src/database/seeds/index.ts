import { DataSource } from 'typeorm';
import { runSeeders } from 'typeorm-extension';
import InitialRbacSeeder from './001-initial-rbac.seed';
import ProductEngineSeeder from './002-product-engine.seed';
import RatingFactorsSeeder from './003-rating-factors.seed';
import RiskFactorLinkSeeder from './004-risk-factor-link.seed';
import TiramisCompanySetupSeeder from './005-tiramis-company-setup.seed';
import TiramisBusinessRecordsSeeder from './006-tiramis-business-records.seed';
import TiramisPermissionsSeeder from './007-tiramis-permissions.seed';

const seeders = [
  InitialRbacSeeder,
  ProductEngineSeeder,
  RatingFactorsSeeder,
  RiskFactorLinkSeeder,
  TiramisCompanySetupSeeder,
  TiramisBusinessRecordsSeeder,
  TiramisPermissionsSeeder,
];

export async function runAllSeeders(dataSource: DataSource): Promise<void> {
  console.log('┌────────────────────────────────────────────┐');
  console.log('│          Starting database seeding         │');
  console.log('└────────────────────────────────────────────┘');

  try {
    await runSeeders(dataSource, {
      seeds: seeders,
    });

    console.log('\n┌────────────────────────────────────────────┐');
    console.log('│     ✓ Database seeding completed successfully     │');
    console.log('└────────────────────────────────────────────┘');
  } catch (error) {
    console.error('Seeding failed:', error);
    throw error;
  }
}

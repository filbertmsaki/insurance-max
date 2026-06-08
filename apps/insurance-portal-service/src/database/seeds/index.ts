import { DataSource } from 'typeorm';
import { runSeeders } from 'typeorm-extension';
import InitialRbacSeeder from './001-initial-rbac.seed';
import ProductEngineSeeder from './002-product-engine.seed';
import RatingFactorsSeeder from './003-rating-factors.seed';
import RiskFactorLinkSeeder from './004-risk-factor-link.seed';
// ... import other seeders here

const seeders = [
  InitialRbacSeeder,
  ProductEngineSeeder,
  RatingFactorsSeeder,
  RiskFactorLinkSeeder,
  // Add new seeders here ↑
  // They will run in this exact order
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

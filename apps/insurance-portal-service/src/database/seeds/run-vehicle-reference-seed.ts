import { runSeeders } from 'typeorm-extension';
import AppDataSource from '../data-source';
import VehicleMakesModelsSeeder from './016-vehicle-makes-models.seed';
import VehicleFuelTypesSeeder from './017-vehicle-fuel-types.seed';
import VehicleBodyTypesSeeder from './018-vehicle-body-types.seed';
import VehicleColoursSeeder from './019-vehicle-colours.seed';

async function bootstrap() {
  await AppDataSource.initialize();
  try {
    await runSeeders(AppDataSource, {
      seeds: [
        VehicleMakesModelsSeeder,
        VehicleFuelTypesSeeder,
        VehicleBodyTypesSeeder,
        VehicleColoursSeeder,
      ],
    });
  } finally {
    await AppDataSource.destroy();
  }
}

void bootstrap().catch((error: unknown) => {
  console.error('[vehicle-reference-seed] Failed', error);
  process.exitCode = 1;
});

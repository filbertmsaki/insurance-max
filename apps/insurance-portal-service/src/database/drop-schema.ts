import AppDataSource from './data-source';

async function bootstrap() {
  await AppDataSource.initialize();
  await AppDataSource.query('DROP SCHEMA public CASCADE');
  await AppDataSource.query('CREATE SCHEMA public');
  await AppDataSource.destroy();
  console.log('public schema dropped and recreated.');
}
bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});

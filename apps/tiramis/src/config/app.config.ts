import { registerAs } from '@nestjs/config';

export default registerAs('tiramisService', () => ({
  name: 'tiramis',
  description: 'First standalone microservice in the platform',
  envFilePath: 'apps/tiramis/.env',
}));

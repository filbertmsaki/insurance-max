import { registerAs } from '@nestjs/config';

export default registerAs('queue', () => ({
  enabled: process.env.QUEUE_ENABLED === 'true',
}));

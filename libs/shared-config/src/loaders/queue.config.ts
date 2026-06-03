import { registerAs } from '@nestjs/config';

export default registerAs('queue', () => ({
  enabled: process.env.QUEUE_ENABLED === 'true',
  prefix: process.env.QUEUE_PREFIX || 'insurance-max',
  defaultJobOptions: {
    attempts: Number(process.env.QUEUE_DEFAULT_JOB_ATTEMPTS || 3),
    delay: Number(process.env.QUEUE_DEFAULT_JOB_DELAY || 0),
    removeOnComplete: process.env.QUEUE_REMOVE_ON_COMPLETE === 'true',
    removeOnFail: process.env.QUEUE_REMOVE_ON_FAIL === 'true',
  },
}));

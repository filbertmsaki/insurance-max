import { LogLevel } from '@nestjs/common';
import { registerAs } from '@nestjs/config';

export function readLoggerEnv() {
  return {
    enabled: process.env.LOGGER_ENABLED !== 'false',
    levels: (process.env.LOGGER_LEVEL || 'log,error,warn')
      .split(',')
      .map((level) => level.trim()) as LogLevel[],
    pretty: process.env.LOGGER_PRETTY !== 'false',
  };
}

export default registerAs('logger', readLoggerEnv);

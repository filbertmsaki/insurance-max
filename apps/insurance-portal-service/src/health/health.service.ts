import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';

import type {
  HealthCheckResult,
  HealthState,
  ServiceHealthResponse,
} from '@insurance-max/contracts';

import { RedisService } from '../modules/shared/redis/redis.service';

@Injectable()
export class HealthService {
  constructor(
    private readonly configService: ConfigService,
    private readonly dataSource: DataSource,
    private readonly redisService: RedisService,
  ) {}

  live(): ServiceHealthResponse {
    return this.createResponse('UP');
  }

  async ready(): Promise<ServiceHealthResponse> {
    const [database, redis] = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
    ]);

    const appEnvironment =
      this.configService.get<string>('app.env') || 'development';

    const redisRequired =
      appEnvironment === 'production' ||
      this.configService.get<boolean>('queue.enabled') === true ||
      this.configService.get<string>('cache.store') === 'redis';

    let status: HealthState = 'UP';

    if (database.status === 'DOWN') {
      status = 'DOWN';
    } else if (redis.status === 'DOWN' || redis.status === 'DEGRADED') {
      status = redisRequired ? 'DOWN' : 'DEGRADED';
    }

    return this.createResponse(status, {
      database,
      redis,
    });
  }

  private async checkDatabase(): Promise<HealthCheckResult> {
    const startedAt = Date.now();

    try {
      await this.dataSource.query('SELECT 1');

      const pendingMigrations = await this.dataSource.showMigrations();

      if (pendingMigrations) {
        return {
          status: 'DOWN',
          latencyMs: Date.now() - startedAt,
          message: 'Database has pending migrations.',
          details: {
            initialized: this.dataSource.isInitialized,
            pendingMigrations: true,
          },
        };
      }

      return {
        status: 'UP',
        latencyMs: Date.now() - startedAt,
        details: {
          initialized: this.dataSource.isInitialized,
          pendingMigrations: false,
        },
      };
    } catch (error) {
      return {
        status: 'DOWN',
        latencyMs: Date.now() - startedAt,
        message:
          error instanceof Error
            ? error.message
            : 'Database health check failed.',
      };
    }
  }

  private async checkRedis(): Promise<HealthCheckResult> {
    const result = await this.redisService.healthCheck();

    return {
      status: result.available ? 'UP' : 'DEGRADED',
      latencyMs: result.latencyMs,
      message: result.message,
      details: {
        mode: result.mode,
        fallbackActive: result.mode === 'memory',
      },
    };
  }

  private createResponse(
    status: HealthState,
    checks?: Record<string, HealthCheckResult>,
  ): ServiceHealthResponse {
    return {
      status,
      service:
        this.configService.get<string>('app.name') ||
        'Insurance Portal Service',
      version: this.configService.get<string>('app.version') || 'v1',
      environment: this.configService.get<string>('app.env') || 'development',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      checks,
    };
  }
}

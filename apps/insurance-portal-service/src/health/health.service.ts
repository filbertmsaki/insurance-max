import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { access } from 'node:fs/promises';

import type {
  HealthCheckResult,
  HealthState,
  ServiceHealthResponse,
} from '@insurance-max/contracts';
import {
  observabilityMetrics,
  sanitizeHealthResponse,
} from '@insurance-max/observability';

import { RedisService } from '../modules/shared/redis/redis.service';

@Injectable()
export class HealthService {
  constructor(
    private readonly configService: ConfigService,
    private readonly dataSource: DataSource,
    private readonly redisService: RedisService,
  ) {}

  live(): ServiceHealthResponse {
    return sanitizeHealthResponse(
      this.createResponse('UP'),
      this.includeHealthDetails(),
    );
  }

  async ready(): Promise<ServiceHealthResponse> {
    const [database, redis, storage, queue] = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
      this.checkStorage(),
      this.checkQueue(),
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
    } else if (
      redis.status === 'DOWN' ||
      redis.status === 'DEGRADED' ||
      storage.status === 'DOWN' ||
      queue.status === 'DOWN'
    ) {
      status = redisRequired ? 'DOWN' : 'DEGRADED';
    }

    const response = this.createResponse(status, {
      database,
      redis,
      storage,
      queue,
    });

    for (const [name, check] of Object.entries(response.checks ?? {})) {
      observabilityMetrics.setGauge(
        'service_health_status',
        { check: name },
        check.status === 'UP' ? 1 : 0,
      );
    }

    return sanitizeHealthResponse(response, this.includeHealthDetails());
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

  private async checkStorage(): Promise<HealthCheckResult> {
    const startedAt = Date.now();
    const root =
      this.configService.get<string>('DOCUMENT_STORAGE_ROOT') ??
      './uploads/documents';

    try {
      await access(root);
      return {
        status: 'UP',
        latencyMs: Date.now() - startedAt,
        details: { root },
      };
    } catch (error) {
      return {
        status: 'DOWN',
        latencyMs: Date.now() - startedAt,
        message:
          error instanceof Error
            ? error.message
            : 'Document storage root is unavailable.',
      };
    }
  }

  private async checkQueue(): Promise<HealthCheckResult> {
    const startedAt = Date.now();
    const queueEnabled =
      this.configService.get<boolean>('QUEUE_ENABLED') ?? true;

    if (!queueEnabled) {
      return {
        status: 'DEGRADED',
        latencyMs: Date.now() - startedAt,
        message: 'Queues are disabled.',
      };
    }

    const redis = await this.redisService.healthCheck();

    return {
      status: redis.available ? 'UP' : 'DOWN',
      latencyMs: Date.now() - startedAt,
      message: redis.available
        ? 'Queue broker reachable through Redis.'
        : redis.message,
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

  private includeHealthDetails(): boolean {
    return this.configService.get<boolean>('HEALTH_DETAILS_PUBLIC') ?? false;
  }
}

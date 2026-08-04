import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';

import type {
  HealthCheckResult,
  ServiceHealthResponse,
} from '@insurance-max/contracts';

@Injectable()
export class HealthService {
  constructor(
    private readonly configService: ConfigService,
    private readonly dataSource: DataSource,
  ) {}

  live(): ServiceHealthResponse {
    return this.createResponse('UP');
  }

  async ready(): Promise<ServiceHealthResponse> {
    const database = await this.checkDatabase();

    return this.createResponse(database.status === 'UP' ? 'UP' : 'DOWN', {
      database,
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

  private createResponse(
    status: 'UP' | 'DOWN',
    checks?: Record<string, HealthCheckResult>,
  ): ServiceHealthResponse {
    return {
      status,
      service: this.configService.get<string>('app.name') || 'TIRAMIS Service',
      version: this.configService.get<string>('app.version') || 'v1',
      environment: this.configService.get<string>('app.env') || 'development',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      checks,
    };
  }
}

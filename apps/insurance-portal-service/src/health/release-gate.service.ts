import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import {
  isProductionReady,
  type ProductionReleaseGate,
} from '@insurance-max/observability';

@Injectable()
export class ReleaseGateService {
  constructor(private readonly configService: ConfigService) {}

  getGate() {
    const gate: ProductionReleaseGate = {
      build: {
        lintPassed: this.readBoolean('RELEASE_BUILD_LINT_PASSED'),
        unitTestsPassed: this.readBoolean('RELEASE_BUILD_UNIT_TESTS_PASSED'),
        integrationTestsPassed: this.readBoolean(
          'RELEASE_BUILD_INTEGRATION_TESTS_PASSED',
        ),
        e2eTestsPassed: this.readBoolean('RELEASE_BUILD_E2E_TESTS_PASSED'),
      },
      security: {
        criticalFindings: this.readNumber(
          'RELEASE_SECURITY_CRITICAL_FINDINGS',
          0,
        ),
        tenantIsolationPassed: this.readBoolean(
          'RELEASE_SECURITY_TENANT_ISOLATION_PASSED',
        ),
        secretsScanPassed: this.readBoolean(
          'RELEASE_SECURITY_SECRETS_SCAN_PASSED',
        ),
        authorizationPassed: this.readBoolean(
          'RELEASE_SECURITY_AUTHORIZATION_PASSED',
        ),
      },
      financial: {
        reconciliationPassed: this.readBoolean(
          'RELEASE_FINANCIAL_RECONCILIATION_PASSED',
        ),
      },
      regulatory: {
        tiramisPassed: this.readBoolean('RELEASE_REGULATORY_TIRAMIS_PASSED'),
        returnsPassed: this.readBoolean('RELEASE_REGULATORY_RETURNS_PASSED'),
      },
      operations: {
        backupVerified: this.readBoolean('RELEASE_OPERATIONS_BACKUP_VERIFIED'),
        restoreVerified: this.readBoolean(
          'RELEASE_OPERATIONS_RESTORE_VERIFIED',
        ),
        monitoringReady: this.readBoolean(
          'RELEASE_OPERATIONS_MONITORING_READY',
        ),
        rollbackVerified: this.readBoolean(
          'RELEASE_OPERATIONS_ROLLBACK_VERIFIED',
        ),
      },
      approvals: {
        uatApproved: this.readBoolean('RELEASE_APPROVALS_UAT_APPROVED'),
        technicalApproved: this.readBoolean(
          'RELEASE_APPROVALS_TECHNICAL_APPROVED',
        ),
        businessApproved: this.readBoolean(
          'RELEASE_APPROVALS_BUSINESS_APPROVED',
        ),
      },
    };

    return {
      gate,
      productionReady: isProductionReady(gate),
      release: {
        sha: this.configService.get<string>('APP_RELEASE_SHA') ?? null,
        version: this.configService.get<string>('APP_RELEASE_VERSION') ?? null,
        builtAt: this.configService.get<string>('APP_BUILT_AT') ?? null,
      },
    };
  }

  private readBoolean(key: string): boolean {
    const value = this.configService.get<string | boolean>(key);
    if (typeof value === 'boolean') {
      return value;
    }

    return typeof value === 'string' && value.trim().toLowerCase() === 'true';
  }

  private readNumber(key: string, fallback: number): number {
    const value = this.configService.get<string | number>(key);
    if (typeof value === 'number') {
      return value;
    }

    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
}

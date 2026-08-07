import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { ReleaseGateService } from './release-gate.service';

describe('ReleaseGateService', () => {
  const originalNow = Date.now;

  beforeAll(() => {
    Date.now = jest.fn(() => new Date('2026-08-07T12:30:00.000Z').getTime());
  });

  afterAll(() => {
    Date.now = originalNow;
  });

  it('merges artifact, runtime, and database evidence into the release gate', async () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'release-gate-'));
    const artifactPath = join(tempDir, 'release-gate.json');

    writeFileSync(
      artifactPath,
      JSON.stringify(
        {
          generatedAt: '2026-08-07T12:00:00.000Z',
          release: {
            sha: 'abc123def456',
            version: '2026.08.07',
            builtAt: '2026-08-07T11:45:00.000Z',
          },
          gate: {
            build: {
              lintPassed: true,
              unitTestsPassed: true,
              integrationTestsPassed: true,
              e2eTestsPassed: true,
            },
            security: {
              criticalFindings: 0,
              tenantIsolationPassed: true,
              secretsScanPassed: true,
              authorizationPassed: true,
            },
            operations: {
              backupVerified: true,
              restoreVerified: true,
              rollbackVerified: true,
            },
            approvals: {
              uatApproved: true,
              technicalApproved: true,
              businessApproved: true,
            },
          },
        },
        null,
        2,
      ),
      'utf8',
    );

    const configValues: Record<string, unknown> = {
      RELEASE_EVIDENCE_FILE: artifactPath,
      RELEASE_EVIDENCE_MAX_AGE_HOURS: 168,
      OBSERVABILITY_ENABLED: true,
      METRICS_ENABLED: true,
      TRACING_ENABLED: true,
      TIRAMIS_TARGET_ENV: 'test',
      APP_RELEASE_SHA: '',
      APP_RELEASE_VERSION: '',
      APP_BUILT_AT: '',
    };

    const configService = {
      get: jest.fn((key: string) => configValues[key]),
    };

    const dataSource = {
      query: jest.fn(async (sql: string, params?: unknown[]) => {
        if (sql.includes('finance_reconciliation_batches')) {
          return [
            {
              posted_batches: 1,
              open_batches: 0,
              last_posted_at: '2026-08-07T10:00:00.000Z',
            },
          ];
        }

        if (sql.includes('tiramis_company_configurations')) {
          expect(params).toEqual(['test']);
          return [
            {
              enabled_companies: 1,
              ready_companies: 1,
            },
          ];
        }

        if (sql.includes('tiramis_submission_tracking')) {
          return [{ blocking_submissions: 0 }];
        }

        if (sql.includes('regulatory_obligation_instances')) {
          return [{ overdue_obligations: 0 }];
        }

        if (sql.includes('regulatory_returns')) {
          return [{ blocking_returns: 0 }];
        }

        throw new Error(`Unexpected query: ${sql}`);
      }),
    };

    const healthService = {
      ready: jest.fn().mockResolvedValue({
        status: 'UP',
        checks: {
          database: { status: 'UP' },
          redis: { status: 'UP' },
        },
      }),
    };

    const service = new ReleaseGateService(
      configService as never,
      dataSource as never,
      healthService as never,
    );

    try {
      const result = await service.getGate();

      expect(result.release).toEqual({
        sha: 'abc123def456',
        version: '2026.08.07',
        builtAt: '2026-08-07T11:45:00.000Z',
      });
      expect(result.gate.build.lintPassed).toBe(true);
      expect(result.gate.security.authorizationPassed).toBe(true);
      expect(result.gate.financial.reconciliationPassed).toBe(true);
      expect(result.gate.regulatory.tiramisPassed).toBe(true);
      expect(result.gate.regulatory.returnsPassed).toBe(true);
      expect(result.gate.operations.monitoringReady).toBe(true);
      expect(result.productionReady).toBe(true);
      expect(result.evidence.build.lintPassed.source).toBe('artifact');
      expect(result.evidence.financial.reconciliationPassed.source).toBe(
        'database',
      );
      expect(result.evidence.operations.monitoringReady.source).toBe('runtime');
      expect(result.evidenceContext.artifact.loaded).toBe(true);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { access, readFile } from 'node:fs/promises';
import { resolve as resolvePath } from 'node:path';
import { DataSource } from 'typeorm';

import {
  isProductionReady,
  type ProductionReleaseGate,
} from '@insurance-max/observability';

import { HealthService } from './health.service';

type ReleaseGateSection =
  | 'build'
  | 'security'
  | 'financial'
  | 'regulatory'
  | 'operations'
  | 'approvals';

type ReleaseEvidenceSource = 'artifact' | 'database' | 'runtime' | 'env';

type ReleaseEvidenceValue = boolean | number;

interface ReleaseCheckEvidence<T extends ReleaseEvidenceValue> {
  value: T;
  source: ReleaseEvidenceSource;
  checkedAt: string | null;
  stale: boolean;
  reason: string | null;
  details: Record<string, unknown> | null;
}

interface ReleaseEvidenceContext {
  path: string | null;
  loaded: boolean;
  generatedAt: string | null;
  stale: boolean;
  error: string | null;
}

interface ReleaseArtifactCheck<T extends ReleaseEvidenceValue> {
  value: T;
  checkedAt?: string | null;
  source?: string | null;
  reason?: string | null;
  details?: Record<string, unknown> | null;
}

interface ReleaseArtifactPayload {
  generatedAt?: string;
  release?: {
    sha?: string | null;
    version?: string | null;
    builtAt?: string | null;
  };
  gate?: Partial<Record<ReleaseGateSection, Record<string, unknown>>>;
  build?: Record<string, unknown>;
  security?: Record<string, unknown>;
  financial?: Record<string, unknown>;
  regulatory?: Record<string, unknown>;
  operations?: Record<string, unknown>;
  approvals?: Record<string, unknown>;
}

interface ReleaseArtifactState {
  path: string | null;
  payload: ReleaseArtifactPayload | null;
  generatedAt: string | null;
  stale: boolean;
  error: string | null;
}

@Injectable()
export class ReleaseGateService {
  private readonly logger = new Logger(ReleaseGateService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly dataSource: DataSource,
    private readonly healthService: HealthService,
  ) {}

  async getGate() {
    const artifact = await this.loadEvidenceArtifact();

    const [
      monitoringReady,
      reconciliationPassed,
      tiramisPassed,
      returnsPassed,
    ] = await Promise.all([
      this.loadMonitoringEvidence(),
      this.loadFinancialEvidence(),
      this.loadTiramisEvidence(),
      this.loadReturnsEvidence(),
    ]);

    const evidence = {
      build: {
        lintPassed: this.resolveBooleanEvidence(
          artifact,
          'build',
          'lintPassed',
          'RELEASE_BUILD_LINT_PASSED',
        ),
        unitTestsPassed: this.resolveBooleanEvidence(
          artifact,
          'build',
          'unitTestsPassed',
          'RELEASE_BUILD_UNIT_TESTS_PASSED',
        ),
        integrationTestsPassed: this.resolveBooleanEvidence(
          artifact,
          'build',
          'integrationTestsPassed',
          'RELEASE_BUILD_INTEGRATION_TESTS_PASSED',
        ),
        e2eTestsPassed: this.resolveBooleanEvidence(
          artifact,
          'build',
          'e2eTestsPassed',
          'RELEASE_BUILD_E2E_TESTS_PASSED',
        ),
      },
      security: {
        criticalFindings: this.resolveNumberEvidence(
          artifact,
          'security',
          'criticalFindings',
          'RELEASE_SECURITY_CRITICAL_FINDINGS',
          0,
        ),
        tenantIsolationPassed: this.resolveBooleanEvidence(
          artifact,
          'security',
          'tenantIsolationPassed',
          'RELEASE_SECURITY_TENANT_ISOLATION_PASSED',
        ),
        secretsScanPassed: this.resolveBooleanEvidence(
          artifact,
          'security',
          'secretsScanPassed',
          'RELEASE_SECURITY_SECRETS_SCAN_PASSED',
        ),
        authorizationPassed: this.resolveBooleanEvidence(
          artifact,
          'security',
          'authorizationPassed',
          'RELEASE_SECURITY_AUTHORIZATION_PASSED',
        ),
      },
      financial: {
        reconciliationPassed,
      },
      regulatory: {
        tiramisPassed,
        returnsPassed,
      },
      operations: {
        backupVerified: this.resolveBooleanEvidence(
          artifact,
          'operations',
          'backupVerified',
          'RELEASE_OPERATIONS_BACKUP_VERIFIED',
        ),
        restoreVerified: this.resolveBooleanEvidence(
          artifact,
          'operations',
          'restoreVerified',
          'RELEASE_OPERATIONS_RESTORE_VERIFIED',
        ),
        monitoringReady,
        rollbackVerified: this.resolveBooleanEvidence(
          artifact,
          'operations',
          'rollbackVerified',
          'RELEASE_OPERATIONS_ROLLBACK_VERIFIED',
        ),
      },
      approvals: {
        uatApproved: this.resolveBooleanEvidence(
          artifact,
          'approvals',
          'uatApproved',
          'RELEASE_APPROVALS_UAT_APPROVED',
        ),
        technicalApproved: this.resolveBooleanEvidence(
          artifact,
          'approvals',
          'technicalApproved',
          'RELEASE_APPROVALS_TECHNICAL_APPROVED',
        ),
        businessApproved: this.resolveBooleanEvidence(
          artifact,
          'approvals',
          'businessApproved',
          'RELEASE_APPROVALS_BUSINESS_APPROVED',
        ),
      },
    };

    const gate: ProductionReleaseGate = {
      build: {
        lintPassed: evidence.build.lintPassed.value,
        unitTestsPassed: evidence.build.unitTestsPassed.value,
        integrationTestsPassed: evidence.build.integrationTestsPassed.value,
        e2eTestsPassed: evidence.build.e2eTestsPassed.value,
      },
      security: {
        criticalFindings: evidence.security.criticalFindings.value,
        tenantIsolationPassed: evidence.security.tenantIsolationPassed.value,
        secretsScanPassed: evidence.security.secretsScanPassed.value,
        authorizationPassed: evidence.security.authorizationPassed.value,
      },
      financial: {
        reconciliationPassed: evidence.financial.reconciliationPassed.value,
      },
      regulatory: {
        tiramisPassed: evidence.regulatory.tiramisPassed.value,
        returnsPassed: evidence.regulatory.returnsPassed.value,
      },
      operations: {
        backupVerified: evidence.operations.backupVerified.value,
        restoreVerified: evidence.operations.restoreVerified.value,
        monitoringReady: evidence.operations.monitoringReady.value,
        rollbackVerified: evidence.operations.rollbackVerified.value,
      },
      approvals: {
        uatApproved: evidence.approvals.uatApproved.value,
        technicalApproved: evidence.approvals.technicalApproved.value,
        businessApproved: evidence.approvals.businessApproved.value,
      },
    };

    return {
      gate,
      productionReady: isProductionReady(gate),
      release: {
        sha:
          artifact.payload?.release?.sha?.trim() ||
          this.nullableString('APP_RELEASE_SHA'),
        version:
          artifact.payload?.release?.version?.trim() ||
          this.nullableString('APP_RELEASE_VERSION'),
        builtAt:
          artifact.payload?.release?.builtAt?.trim() ||
          this.nullableString('APP_BUILT_AT'),
      },
      evidence,
      evidenceContext: {
        artifact: {
          path: artifact.path,
          loaded: artifact.payload !== null,
          generatedAt: artifact.generatedAt,
          stale: artifact.stale,
          error: artifact.error,
        } satisfies ReleaseEvidenceContext,
      },
    };
  }

  private async loadEvidenceArtifact(): Promise<ReleaseArtifactState> {
    const configuredPath =
      this.nullableString('RELEASE_EVIDENCE_FILE') ??
      '.release/release-gate.json';
    const artifactPath = resolvePath(process.cwd(), configuredPath);

    try {
      await access(artifactPath);
    } catch {
      return {
        path: artifactPath,
        payload: null,
        generatedAt: null,
        stale: false,
        error: null,
      };
    }

    try {
      const content = await readFile(artifactPath, 'utf8');
      const payload = JSON.parse(content) as ReleaseArtifactPayload;
      const generatedAt = this.normalizeTimestamp(payload.generatedAt ?? null);
      const stale = this.isStale(generatedAt);

      return {
        path: artifactPath,
        payload,
        generatedAt,
        stale,
        error: null,
      };
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Release evidence artifact could not be parsed.';
      this.logger.warn(`Release evidence artifact error: ${message}`);

      return {
        path: artifactPath,
        payload: null,
        generatedAt: null,
        stale: false,
        error: message,
      };
    }
  }

  private async loadMonitoringEvidence(): Promise<
    ReleaseCheckEvidence<boolean>
  > {
    const checkedAt = new Date().toISOString();
    const observabilityEnabled =
      this.configService.get<boolean>('OBSERVABILITY_ENABLED') ?? true;
    const metricsEnabled =
      this.configService.get<boolean>('METRICS_ENABLED') ?? true;
    const tracingEnabled =
      this.configService.get<boolean>('TRACING_ENABLED') ?? true;

    try {
      const readiness = await this.healthService.ready();
      const value =
        observabilityEnabled &&
        metricsEnabled &&
        tracingEnabled &&
        readiness.status !== 'DOWN';

      return {
        value,
        source: 'runtime',
        checkedAt,
        stale: false,
        reason: value
          ? null
          : 'Observability controls or readiness checks are not healthy.',
        details: {
          serviceStatus: readiness.status,
          observabilityEnabled,
          metricsEnabled,
          tracingEnabled,
          checks: readiness.checks ?? {},
        },
      };
    } catch (error) {
      return {
        value: false,
        source: 'runtime',
        checkedAt,
        stale: false,
        reason:
          error instanceof Error
            ? error.message
            : 'Monitoring readiness could not be evaluated.',
        details: {
          observabilityEnabled,
          metricsEnabled,
          tracingEnabled,
        },
      };
    }
  }

  private async loadFinancialEvidence(): Promise<
    ReleaseCheckEvidence<boolean>
  > {
    const checkedAt = new Date().toISOString();

    try {
      const [row] = await this.dataSource.query(`
        SELECT
          COUNT(*) FILTER (WHERE "status" = 'POSTED')::int AS posted_batches,
          COUNT(*) FILTER (WHERE "status" <> 'POSTED')::int AS open_batches,
          MAX(CASE WHEN "status" = 'POSTED' THEN "updated_at" END) AS last_posted_at
        FROM "finance_reconciliation_batches"
      `);

      const postedBatches = Number(row?.posted_batches ?? 0);
      const openBatches = Number(row?.open_batches ?? 0);
      const lastPostedAt = this.normalizeTimestamp(row?.last_posted_at ?? null);
      const value = postedBatches > 0 && openBatches === 0;

      return {
        value,
        source: 'database',
        checkedAt,
        stale: false,
        reason:
          postedBatches === 0
            ? 'No posted finance reconciliation batch exists yet.'
            : openBatches > 0
              ? 'There are reconciliation batches that are not fully posted.'
              : null,
        details: {
          postedBatches,
          openBatches,
          lastPostedAt,
        },
      };
    } catch (error) {
      return {
        value: false,
        source: 'database',
        checkedAt,
        stale: false,
        reason:
          error instanceof Error
            ? error.message
            : 'Financial reconciliation evidence could not be queried.',
        details: null,
      };
    }
  }

  private async loadTiramisEvidence(): Promise<ReleaseCheckEvidence<boolean>> {
    const checkedAt = new Date().toISOString();
    const environment =
      this.configService.get<string>('TIRAMIS_TARGET_ENV') === 'live'
        ? 'live'
        : 'test';

    try {
      const [configRow] = await this.dataSource.query(
        `
          SELECT
            COUNT(*) FILTER (
              WHERE company."tira_integration_enabled" = true
                AND company."deleted_at" IS NULL
            )::int AS enabled_companies,
            COUNT(*) FILTER (
              WHERE company."tira_integration_enabled" = true
                AND company."deleted_at" IS NULL
                AND config."id" IS NOT NULL
                AND config."is_active" = true
                AND config."validation_status" = 'VALID'
            )::int AS ready_companies
          FROM "companies" company
          LEFT JOIN "tiramis_company_configurations" config
            ON config."company_id" = company."id"
           AND config."environment" = $1
        `,
        [environment],
      );

      const [submissionRow] = await this.dataSource.query(`
        SELECT
          COUNT(*) FILTER (
            WHERE "status" IN (
              'FAILED',
              'FINAL_FAILED',
              'RETRY_EXHAUSTED',
              'CALLBACK_OVERDUE'
            )
          )::int AS blocking_submissions
        FROM "tiramis_submission_tracking"
      `);

      const [endorsementIntegrityRow] = await this.dataSource.query(`
        SELECT
          COUNT(*) FILTER (
            WHERE pt."transaction_type" = 'ENDORSEMENT'
              AND pt."submission_status" = 'ACCEPTED'
              AND pt."stage" <> 'APPLIED'
          )::int AS accepted_not_applied,
          COUNT(*) FILTER (
            WHERE pt."transaction_type" = 'ENDORSEMENT'
              AND pt."stage" = 'APPLIED'
              AND pt."target_policy_version_id" IS NULL
          )::int AS applied_without_version,
          COUNT(*) FILTER (
            WHERE pt."transaction_type" = 'ENDORSEMENT'
              AND pt."stage" = 'APPLIED'
              AND p."active_version_id" IS DISTINCT FROM pt."target_policy_version_id"
          )::int AS active_version_mismatch,
          COUNT(*) FILTER (
            WHERE pt."transaction_type" = 'ENDORSEMENT'
              AND pt."stage" = 'APPLIED'
              AND pe."requires_new_cover_note" = true
              AND pe."replacement_cover_note_reference" IS NULL
          )::int AS missing_replacement_cover_notes
        FROM "policy_transactions" pt
        LEFT JOIN "policies" p
          ON p."id" = pt."source_policy_id"
        LEFT JOIN "policy_endorsements" pe
          ON pe."policy_transaction_id" = pt."id"
      `);

      const [policyVersionRow] = await this.dataSource.query(`
        SELECT
          COUNT(*) FILTER (
            WHERE p."issued_by_system" = true
              AND p."active_version_id" IS NULL
          )::int AS issued_without_active_version,
          COUNT(*) FILTER (
            WHERE current_versions."current_count" > 1
          )::int AS multiple_current_versions
        FROM "policies" p
        LEFT JOIN (
          SELECT
            "policy_id",
            COUNT(*) FILTER (WHERE "is_current" = true)::int AS current_count
          FROM "policy_versions"
          GROUP BY "policy_id"
        ) current_versions
          ON current_versions."policy_id" = p."id"
        WHERE p."deleted_at" IS NULL
      `);

      const enabledCompanies = Number(configRow?.enabled_companies ?? 0);
      const readyCompanies = Number(configRow?.ready_companies ?? 0);
      const blockingSubmissions = Number(
        submissionRow?.blocking_submissions ?? 0,
      );
      const acceptedNotApplied = Number(
        endorsementIntegrityRow?.accepted_not_applied ?? 0,
      );
      const appliedWithoutVersion = Number(
        endorsementIntegrityRow?.applied_without_version ?? 0,
      );
      const activeVersionMismatch = Number(
        endorsementIntegrityRow?.active_version_mismatch ?? 0,
      );
      const missingReplacementCoverNotes = Number(
        endorsementIntegrityRow?.missing_replacement_cover_notes ?? 0,
      );
      const issuedWithoutActiveVersion = Number(
        policyVersionRow?.issued_without_active_version ?? 0,
      );
      const multipleCurrentVersions = Number(
        policyVersionRow?.multiple_current_versions ?? 0,
      );
      const policyIntegrityPassed =
        acceptedNotApplied === 0 &&
        appliedWithoutVersion === 0 &&
        activeVersionMismatch === 0 &&
        missingReplacementCoverNotes === 0 &&
        issuedWithoutActiveVersion === 0 &&
        multipleCurrentVersions === 0;
      const value =
        (enabledCompanies === 0 || enabledCompanies === readyCompanies) &&
        blockingSubmissions === 0 &&
        policyIntegrityPassed;

      return {
        value,
        source: 'database',
        checkedAt,
        stale: false,
        reason:
          enabledCompanies > 0 && readyCompanies !== enabledCompanies
            ? 'Some TIRAMIS-enabled companies are not fully validated.'
            : blockingSubmissions > 0
              ? 'There are blocking TIRAMIS submission failures.'
              : !policyIntegrityPassed
                ? 'Policy or endorsement integrity checks are failing.'
                : enabledCompanies === 0
                  ? 'No company currently requires TIRAMIS release evidence.'
                  : null,
        details: {
          environment,
          enabledCompanies,
          readyCompanies,
          blockingSubmissions,
          policyIntegrity: {
            acceptedNotApplied,
            appliedWithoutVersion,
            activeVersionMismatch,
            missingReplacementCoverNotes,
            issuedWithoutActiveVersion,
            multipleCurrentVersions,
          },
        },
      };
    } catch (error) {
      return {
        value: false,
        source: 'database',
        checkedAt,
        stale: false,
        reason:
          error instanceof Error
            ? error.message
            : 'TIRAMIS evidence could not be queried.',
        details: {
          environment,
        },
      };
    }
  }

  private async loadReturnsEvidence(): Promise<ReleaseCheckEvidence<boolean>> {
    const checkedAt = new Date().toISOString();

    try {
      const [obligationRow] = await this.dataSource.query(`
        SELECT COUNT(*)::int AS overdue_obligations
        FROM "regulatory_obligation_instances"
        WHERE "status" = 'OVERDUE'
      `);

      const [returnRow] = await this.dataSource.query(`
        SELECT COUNT(*)::int AS blocking_returns
        FROM "regulatory_returns"
        WHERE "status" IN (
          'APPROVED',
          'SUBMISSION_PROCESSING',
          'SUBMITTED',
          'ACKNOWLEDGED',
          'ACCEPTED'
        )
          AND COALESCE("reconciliation_status", 'NOT_CHECKED') <> 'IN_BALANCE'
      `);

      const overdueObligations = Number(
        obligationRow?.overdue_obligations ?? 0,
      );
      const blockingReturns = Number(returnRow?.blocking_returns ?? 0);
      const value = overdueObligations === 0 && blockingReturns === 0;

      return {
        value,
        source: 'database',
        checkedAt,
        stale: false,
        reason:
          overdueObligations > 0
            ? 'There are overdue regulatory obligations.'
            : blockingReturns > 0
              ? 'Some regulatory returns are not reconciled in balance.'
              : null,
        details: {
          overdueObligations,
          blockingReturns,
        },
      };
    } catch (error) {
      return {
        value: false,
        source: 'database',
        checkedAt,
        stale: false,
        reason:
          error instanceof Error
            ? error.message
            : 'Regulatory return evidence could not be queried.',
        details: null,
      };
    }
  }

  private resolveBooleanEvidence(
    artifact: ReleaseArtifactState,
    section: ReleaseGateSection,
    key: string,
    envKey: string,
  ): ReleaseCheckEvidence<boolean> {
    const artifactEvidence = this.readArtifactEvidence<boolean>(
      artifact,
      section,
      key,
      'boolean',
    );

    if (artifactEvidence) {
      return artifactEvidence;
    }

    return {
      value: this.readBoolean(envKey),
      source: 'env',
      checkedAt: null,
      stale: false,
      reason: null,
      details: null,
    };
  }

  private resolveNumberEvidence(
    artifact: ReleaseArtifactState,
    section: ReleaseGateSection,
    key: string,
    envKey: string,
    fallback: number,
  ): ReleaseCheckEvidence<number> {
    const artifactEvidence = this.readArtifactEvidence<number>(
      artifact,
      section,
      key,
      'number',
    );

    if (artifactEvidence) {
      return artifactEvidence;
    }

    return {
      value: this.readNumber(envKey, fallback),
      source: 'env',
      checkedAt: null,
      stale: false,
      reason: null,
      details: null,
    };
  }

  private readArtifactEvidence<T extends ReleaseEvidenceValue>(
    artifact: ReleaseArtifactState,
    section: ReleaseGateSection,
    key: string,
    type: 'boolean' | 'number',
  ): ReleaseCheckEvidence<T> | null {
    if (!artifact.payload) {
      return null;
    }

    const sectionData =
      artifact.payload.gate?.[section] ??
      artifact.payload[section as keyof ReleaseArtifactPayload];

    if (!sectionData || typeof sectionData !== 'object') {
      return null;
    }

    const rawValue = (sectionData as Record<string, unknown>)[key];

    if (rawValue === undefined) {
      return null;
    }

    let evidence: ReleaseArtifactCheck<T>;

    if (
      rawValue !== null &&
      typeof rawValue === 'object' &&
      'value' in (rawValue as Record<string, unknown>)
    ) {
      evidence = rawValue as ReleaseArtifactCheck<T>;
    } else {
      evidence = {
        value: rawValue as T,
        checkedAt: artifact.generatedAt,
      };
    }

    const value =
      type === 'boolean'
        ? typeof evidence.value === 'boolean'
          ? evidence.value
          : null
        : typeof evidence.value === 'number'
          ? evidence.value
          : null;

    if (value === null) {
      return null;
    }

    const checkedAt = this.normalizeTimestamp(
      evidence.checkedAt ?? artifact.generatedAt ?? null,
    );
    const stale = this.isStale(checkedAt);

    if (stale) {
      return null;
    }

    return {
      value,
      source: 'artifact',
      checkedAt,
      stale: false,
      reason: evidence.reason ?? null,
      details: evidence.details ?? null,
    };
  }

  private nullableString(key: string): string | null {
    const value = this.configService.get<string>(key);
    if (typeof value !== 'string') {
      return null;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
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

  private normalizeTimestamp(value: unknown): string | null {
    if (typeof value !== 'string' || value.trim().length === 0) {
      return null;
    }

    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }

  private isStale(timestamp: string | null): boolean {
    if (!timestamp) {
      return false;
    }

    const maxAgeHours = this.readNumber('RELEASE_EVIDENCE_MAX_AGE_HOURS', 168);
    const ageMs = Date.now() - new Date(timestamp).getTime();
    return ageMs > maxAgeHours * 60 * 60 * 1000;
  }
}

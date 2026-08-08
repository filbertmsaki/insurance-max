import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';

import { DataSource, IsNull, Repository } from 'typeorm';

import {
  DataRetentionAction,
  DataRetentionStatus,
} from '@insurance-max/contracts';

import { DataRetentionPolicy } from './entities/data-retention-policy.entity';
import { LegalHold } from './entities/legal-hold.entity';

@Injectable()
export class RetentionService {
  constructor(
    @InjectRepository(DataRetentionPolicy)
    private readonly policyRepository: Repository<DataRetentionPolicy>,
    @InjectRepository(LegalHold)
    private readonly legalHoldRepository: Repository<LegalHold>,
    private readonly configService: ConfigService,
    private readonly dataSource: DataSource,
  ) {}

  listPolicies(companyId?: string | null) {
    return this.policyRepository.find({
      where: companyId
        ? [{ company_id: companyId }, { company_id: IsNull() }]
        : undefined,
      order: {
        resource_type: 'ASC',
        version_number: 'DESC',
        created_at: 'DESC',
      },
    });
  }

  listLegalHolds(companyId?: string | null) {
    return this.legalHoldRepository.find({
      where: companyId
        ? [{ company_id: companyId }, { company_id: IsNull() }]
        : undefined,
      order: { active: 'DESC', created_at: 'DESC' },
    });
  }

  async isUnderLegalHold(
    resourceType: string,
    resourceId: string,
    companyId?: string | null,
  ): Promise<boolean> {
    const hold = await this.legalHoldRepository.findOne({
      where: companyId
        ? [
            {
              resource_type: resourceType,
              resource_id: resourceId,
              active: true,
              company_id: companyId,
            },
            {
              resource_type: resourceType,
              resource_id: resourceId,
              active: true,
              company_id: IsNull(),
            },
          ]
        : {
            resource_type: resourceType,
            resource_id: resourceId,
            active: true,
            company_id: IsNull(),
          },
    });

    return Boolean(hold);
  }

  dryRun(companyId?: string | null) {
    return this.enforce(companyId, { dryRun: true });
  }

  async enforce(
    companyId?: string | null,
    options: { dryRun?: boolean; limit?: number } = {},
  ) {
    const policies = await this.policyRepository.find({
      where: companyId
        ? [
            { company_id: companyId, status: DataRetentionStatus.ACTIVE },
            { company_id: IsNull(), status: DataRetentionStatus.ACTIVE },
          ]
        : { status: DataRetentionStatus.ACTIVE },
      order: { resource_type: 'ASC', version_number: 'DESC' },
    });
    const enabled =
      this.configService.get<boolean>('DATA_RETENTION_ENABLED') ?? true;
    const dryRun =
      options.dryRun ??
      this.configService.get<boolean>('DATA_RETENTION_DRY_RUN_DEFAULT') ??
      true;
    const limit =
      options.limit ??
      Number(
        this.configService.get<string>('DATA_RETENTION_ENFORCEMENT_LIMIT') ??
          500,
      );
    let itemsMatched = 0;
    let itemsBlockedByHold = 0;
    let itemsArchived = 0;
    let itemsAnonymized = 0;
    let itemsDeleted = 0;
    const actions: Awaited<ReturnType<typeof this.evaluatePolicy>>[] = [];

    for (const policy of policies) {
      const evaluation = await this.evaluatePolicy(policy, {
        companyId: companyId ?? policy.company_id,
        dryRun,
        enabled,
        limit,
      });

      itemsMatched += evaluation.itemsMatched;
      itemsBlockedByHold += evaluation.itemsBlockedByHold;
      itemsArchived += evaluation.itemsArchived;
      itemsAnonymized += evaluation.itemsAnonymized;
      itemsDeleted += evaluation.itemsDeleted;
      actions.push(evaluation);
    }

    return {
      enabled,
      dryRun,
      policiesEvaluated: policies.length,
      legalHoldsChecked: await this.legalHoldRepository.count({
        where: companyId
          ? [{ company_id: companyId }, { company_id: IsNull() }]
          : undefined,
      }),
      itemsMatched,
      itemsBlockedByHold,
      itemsArchived,
      itemsAnonymized,
      itemsDeleted,
      actions,
    };
  }

  private async evaluatePolicy(
    policy: DataRetentionPolicy,
    context: {
      companyId?: string | null;
      dryRun: boolean;
      enabled: boolean;
      limit: number;
    },
  ) {
    const table = this.parseResourceTable(policy.resource_type);
    const columns = await this.getTableColumns(table.schema, table.name);
    const cutoff = new Date(
      Date.now() - policy.retention_days * 24 * 60 * 60 * 1000,
    );
    const ids = await this.findExpiredIds({
      table,
      columns,
      cutoff,
      companyId: context.companyId ?? null,
      limit: context.limit,
    });
    let itemsBlockedByHold = 0;
    let itemsArchived = 0;
    let itemsAnonymized = 0;
    let itemsDeleted = 0;
    const eligibleIds: string[] = [];

    for (const id of ids) {
      if (
        await this.isUnderLegalHold(policy.resource_type, id, context.companyId)
      ) {
        itemsBlockedByHold += 1;
      } else {
        eligibleIds.push(id);
      }
    }

    if (!context.dryRun && context.enabled && eligibleIds.length) {
      if (
        policy.action === DataRetentionAction.ARCHIVE ||
        policy.archive_before_delete
      ) {
        itemsArchived = await this.archiveRows(table, columns, eligibleIds);
      }

      if (policy.action === DataRetentionAction.ANONYMIZE) {
        itemsAnonymized = await this.anonymizeRows(table, columns, eligibleIds);
      }

      if (policy.action === DataRetentionAction.DELETE) {
        itemsDeleted = await this.deleteRows(table, columns, eligibleIds);
      }
    }

    return {
      policyCode: policy.policy_code,
      resourceType: policy.resource_type,
      action: policy.action,
      retentionDays: policy.retention_days,
      archiveBeforeDelete: policy.archive_before_delete,
      cutoff: cutoff.toISOString(),
      itemsMatched: ids.length,
      itemsBlockedByHold,
      itemsEligible: eligibleIds.length,
      itemsArchived,
      itemsAnonymized,
      itemsDeleted,
    };
  }

  private parseResourceTable(resourceType: string) {
    if (
      !/^[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z_][A-Za-z0-9_]*)?$/.test(resourceType)
    ) {
      throw new BadRequestException(
        `Retention resource type is not a valid table identifier: ${resourceType}`,
      );
    }

    const [schema, name] = resourceType.includes('.')
      ? resourceType.split('.')
      : ['public', resourceType];

    return { schema, name };
  }

  private async getTableColumns(schema: string, table: string) {
    const rows = await this.dataSource.query<Array<{ column_name: string }>>(
      `
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = $1 AND table_name = $2
      `,
      [schema, table],
    );
    const columns = new Set(rows.map((row) => row.column_name));

    if (!columns.has('id') || !columns.has('created_at')) {
      throw new BadRequestException(
        `Retention resource ${schema}.${table} must expose id and created_at columns`,
      );
    }

    return columns;
  }

  private async findExpiredIds(params: {
    table: { schema: string; name: string };
    columns: Set<string>;
    cutoff: Date;
    companyId: string | null;
    limit: number;
  }) {
    const where = ['created_at < $1'];
    const values: unknown[] = [params.cutoff, params.limit];

    if (params.companyId && params.columns.has('company_id')) {
      values.push(params.companyId);
      where.push(`company_id = $${values.length}`);
    }

    if (params.columns.has('deleted_at')) {
      where.push('deleted_at IS NULL');
    }

    const rows = await this.dataSource.query<Array<{ id: string }>>(
      `
        SELECT id
        FROM ${this.quotedTable(params.table)}
        WHERE ${where.join(' AND ')}
        ORDER BY created_at ASC
        LIMIT $2
      `,
      values,
    );

    return rows.map((row) => row.id);
  }

  private archiveRows(
    table: { schema: string; name: string },
    columns: Set<string>,
    ids: string[],
  ) {
    if (!columns.has('archived_at')) {
      return 0;
    }

    return this.updateRows(table, ids, 'archived_at = NOW()');
  }

  private anonymizeRows(
    table: { schema: string; name: string },
    columns: Set<string>,
    ids: string[],
  ) {
    const assignments = [
      'email',
      'phone',
      'mobile',
      'name',
      'first_name',
      'last_name',
      'address',
    ]
      .filter((column) => columns.has(column))
      .map((column) => `${this.quoteIdentifier(column)} = NULL`);

    if (!assignments.length) {
      return 0;
    }

    return this.updateRows(table, ids, assignments.join(', '));
  }

  private deleteRows(
    table: { schema: string; name: string },
    columns: Set<string>,
    ids: string[],
  ) {
    if (columns.has('deleted_at')) {
      return this.updateRows(table, ids, 'deleted_at = NOW()');
    }

    return this.dataSource
      .query(
        `DELETE FROM ${this.quotedTable(table)} WHERE id = ANY($1::uuid[])`,
        [ids],
      )
      .then((result) => result?.[1] ?? ids.length);
  }

  private async updateRows(
    table: { schema: string; name: string },
    ids: string[],
    assignment: string,
  ) {
    const result = await this.dataSource.query(
      `
        UPDATE ${this.quotedTable(table)}
        SET ${assignment}
        WHERE id = ANY($1::uuid[])
      `,
      [ids],
    );

    return result?.[1] ?? ids.length;
  }

  private quotedTable(table: { schema: string; name: string }) {
    return `${this.quoteIdentifier(table.schema)}.${this.quoteIdentifier(table.name)}`;
  }

  private quoteIdentifier(identifier: string) {
    return `"${identifier.replace(/"/g, '""')}"`;
  }
}

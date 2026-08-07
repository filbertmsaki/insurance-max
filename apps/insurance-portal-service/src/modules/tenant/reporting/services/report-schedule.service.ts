import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';
import { ReportCategory, ReportSensitivity } from '@insurance-max/contracts';
import { CronExpressionParser } from 'cron-parser';
import { createHash } from 'crypto';
import { DateTime } from 'luxon';
import { IsNull, Repository } from 'typeorm';

import { UsageMeteringService } from '../../../platform/saas-billing/services/usage-metering.service';
import { MailService } from '../../../shared/mail/mail.service';
import { ReportAccessAuditEvent } from '../entities/report-access-audit-event.entity';
import { ReportArtifact } from '../entities/report-artifact.entity';
import { ReportDeliveryAttempt } from '../entities/report-delivery-attempt.entity';
import { ReportDefinition } from '../entities/report-definition.entity';
import { ReportJob } from '../entities/report-job.entity';
import { ReportSchedule } from '../entities/report-schedule.entity';
import {
  ReportDeliveryStatus,
  ReportFormat,
  ReportJobStatus,
  ReportScheduleStatus,
} from '../enums/reporting.enums';
import { ReportGeneratorContext } from '../interfaces/report-generator.interface';
import { ExcelReportWriterService } from './excel-report-writer.service';
import { ReportParameterValidationService } from './report-parameter-validation.service';
import { ReportRegistryService } from './report-registry.service';

@Injectable()
export class ReportScheduleService {
  constructor(
    @InjectRepository(ReportDefinition)
    private readonly definitionRepository: Repository<ReportDefinition>,
    @InjectRepository(ReportSchedule)
    private readonly scheduleRepository: Repository<ReportSchedule>,
    @InjectRepository(ReportJob)
    private readonly jobRepository: Repository<ReportJob>,
    @InjectRepository(ReportArtifact)
    private readonly artifactRepository: Repository<ReportArtifact>,
    @InjectRepository(ReportDeliveryAttempt)
    private readonly deliveryAttemptRepository: Repository<ReportDeliveryAttempt>,
    @InjectRepository(ReportAccessAuditEvent)
    private readonly accessAuditRepository: Repository<ReportAccessAuditEvent>,
    private readonly registryService: ReportRegistryService,
    private readonly parameterValidationService: ReportParameterValidationService,
    private readonly excelWriterService: ExcelReportWriterService,
    private readonly usageMeteringService: UsageMeteringService,
    private readonly mailService: MailService,
    private readonly configService: ConfigService,
  ) {}

  async listDefinitions() {
    await this.ensureDefaultDefinitions();
    const definitions = await this.definitionRepository.find({
      where: { enabled: true, active: true },
      order: { code: 'ASC' },
    });
    return definitions.map((definition) =>
      this.registryService.serializeDefinition(definition),
    );
  }

  listSchedules(companyId: string) {
    return this.scheduleRepository.find({
      where: { company_id: companyId, deleted_at: IsNull() },
      order: { created_at: 'DESC' },
    });
  }

  listJobs(companyId: string) {
    return this.jobRepository.find({
      where: { company_id: companyId },
      order: { created_at: 'DESC' },
      take: 200,
    });
  }

  async getJob(companyId: string, id: string) {
    const job = await this.jobRepository.findOne({
      where: { id, company_id: companyId },
    });

    if (!job) {
      throw new NotFoundException('Report job was not found');
    }

    return job;
  }

  async create(
    user: AuthenticatedUser,
    dto: {
      definition_id: string;
      name: string;
      cron_expression: string;
      timezone?: string;
      format: ReportFormat;
      recipient_emails?: string[];
      parameters?: Record<string, unknown>;
      filters?: Record<string, unknown>;
      status?: ReportScheduleStatus;
    },
  ) {
    await this.ensureDefaultDefinitions();
    const definition = await this.requireDefinition(dto.definition_id);
    this.registryService.getGenerator(definition);
    this.ensureSupportedFormat(definition, dto.format);
    const validated = this.parameterValidationService.validate(
      definition,
      dto.parameters ?? dto.filters,
    );

    const timezone = dto.timezone ?? this.defaultTimezone();
    const nextRunAt = this.resolveNextRunAt(dto.cron_expression, timezone);
    await this.assertMailReady(dto.recipient_emails ?? []);

    return this.scheduleRepository.save(
      this.scheduleRepository.create({
        company_id: user.companyId!,
        definition_id: definition.id,
        created_by: user.id,
        name: dto.name.trim(),
        status: dto.status ?? ReportScheduleStatus.ACTIVE,
        cron_expression: dto.cron_expression.trim(),
        timezone,
        format: dto.format,
        recipient_emails: dto.recipient_emails ?? [],
        filters: validated.parameters,
        parameter_payload: validated.parameters,
        parameter_hash: validated.parameterHash,
        report_code: definition.code,
        next_run_at: nextRunAt,
      }),
    );
  }

  async update(
    user: AuthenticatedUser,
    id: string,
    dto: Partial<{
      name: string;
      cron_expression: string;
      timezone: string;
      format: ReportFormat;
      recipient_emails: string[];
      parameters: Record<string, unknown>;
      filters: Record<string, unknown>;
      status: ReportScheduleStatus;
    }>,
  ) {
    const schedule = await this.requireSchedule(user.companyId!, id);
    const definition = await this.requireDefinition(schedule.definition_id);
    const timezone = dto.timezone ?? schedule.timezone;
    const cronExpression = dto.cron_expression ?? schedule.cron_expression;

    if (dto.format) {
      this.ensureSupportedFormat(definition, dto.format);
    }

    if (dto.recipient_emails) {
      await this.assertMailReady(dto.recipient_emails);
    }

    const validatedParameters =
      dto.parameters || dto.filters
        ? this.parameterValidationService.validate(
            definition,
            dto.parameters ?? dto.filters,
          )
        : null;

    Object.assign(schedule, {
      name: dto.name?.trim() ?? schedule.name,
      cron_expression: cronExpression,
      timezone,
      format: dto.format ?? schedule.format,
      recipient_emails: dto.recipient_emails ?? schedule.recipient_emails,
      filters: validatedParameters?.parameters ?? schedule.filters,
      parameter_payload:
        validatedParameters?.parameters ?? schedule.parameter_payload,
      parameter_hash:
        validatedParameters?.parameterHash ?? schedule.parameter_hash,
      status: dto.status ?? schedule.status,
      next_run_at: this.resolveNextRunAt(cronExpression, timezone),
    });

    return this.scheduleRepository.save(schedule);
  }

  async remove(companyId: string, id: string) {
    const schedule = await this.requireSchedule(companyId, id);
    schedule.deleted_at = new Date();
    schedule.status = ReportScheduleStatus.DISABLED;
    return this.scheduleRepository.save(schedule);
  }

  async runNow(
    user: AuthenticatedUser,
    dto: {
      definition_id: string;
      format?: ReportFormat;
      parameters?: Record<string, unknown>;
      filters?: Record<string, unknown>;
      branch_id?: string | null;
    },
  ) {
    await this.ensureDefaultDefinitions();
    const definition = await this.requireDefinition(dto.definition_id);
    await this.assertReportAccess(user, definition, 'REPORT_EXECUTION');
    this.registryService.getGenerator(definition);

    const format = dto.format ?? definition.default_format;
    this.ensureSupportedFormat(definition, format);
    const validated = this.parameterValidationService.validate(definition, {
      ...(dto.parameters ?? dto.filters ?? {}),
      branch_id: dto.branch_id ?? null,
    });

    return this.jobRepository.save(
      this.jobRepository.create({
        company_id: user.companyId!,
        definition_id: definition.id,
        requested_by: user.id,
        status: ReportJobStatus.PENDING,
        format,
        execution_key: this.buildExecutionKey(
          user.companyId!,
          definition.id,
          validated.parameters,
        ),
        report_code: definition.code,
        parameter_payload: validated.parameters,
        parameter_hash: validated.parameterHash,
        filters: validated.parameters,
        job_no: this.buildJobNumber(),
        execution_context: this.buildExecutionContext(user),
        delivery_status: ReportDeliveryStatus.SKIPPED,
      }),
    );
  }

  async createJobsForDueSchedules() {
    await this.ensureDefaultDefinitions();
    const now = new Date();
    const schedules = await this.scheduleRepository.find({
      where: { status: ReportScheduleStatus.ACTIVE },
      take: 100,
    });

    const createdJobs: ReportJob[] = [];
    for (const schedule of schedules) {
      if (
        schedule.deleted_at ||
        !schedule.next_run_at ||
        schedule.next_run_at > now
      ) {
        continue;
      }

      const definition = await this.requireDefinition(schedule.definition_id);
      const executionKey = `${schedule.id}:${schedule.next_run_at.toISOString()}`;
      const existing = await this.jobRepository.findOne({
        where: { execution_key: executionKey },
      });

      if (!existing) {
        createdJobs.push(
          await this.jobRepository.save(
            this.jobRepository.create({
              company_id: schedule.company_id,
              schedule_id: schedule.id,
              definition_id: definition.id,
              requested_by: schedule.created_by,
              status: ReportJobStatus.PENDING,
              format: schedule.format,
              job_no: this.buildJobNumber(),
              report_code: definition.code,
              execution_key: executionKey,
              parameter_payload: schedule.parameter_payload ?? schedule.filters,
              parameter_hash:
                schedule.parameter_hash ??
                this.parameterValidationService.validate(
                  definition,
                  schedule.parameter_payload ?? schedule.filters,
                ).parameterHash,
              filters: schedule.filters,
              execution_context: {
                companyId: schedule.company_id,
                userId: schedule.created_by,
                branchIds: [],
                departmentIds: [],
                permissions: [],
                timezone: schedule.timezone,
                locale: 'en',
                requestedAt: now.toISOString(),
              },
              delivery_status:
                schedule.recipient_emails.length > 0
                  ? ReportDeliveryStatus.PENDING
                  : ReportDeliveryStatus.SKIPPED,
            }),
          ),
        );
      }

      schedule.last_run_at = now;
      schedule.next_run_at = this.resolveNextRunAt(
        schedule.cron_expression,
        schedule.timezone,
        DateTime.fromJSDate(now, { zone: schedule.timezone }),
      );
      await this.scheduleRepository.save(schedule);
    }

    return createdJobs;
  }

  async claimNextPendingJob(workerName = 'default-worker') {
    const job = await this.jobRepository.findOne({
      where: { status: ReportJobStatus.PENDING },
      order: { created_at: 'ASC' },
    });

    if (!job) {
      return null;
    }

    job.status = ReportJobStatus.RUNNING;
    job.claimed_at = new Date();
    job.claimed_by = workerName;
    job.started_at = new Date();
    job.attempts += 1;
    return this.jobRepository.save(job);
  }

  async executeJob(jobId: string) {
    const job = await this.jobRepository.findOneBy({ id: jobId });
    if (!job) {
      throw new NotFoundException('Report job was not found');
    }

    const definition = await this.requireDefinition(job.definition_id);
    const generator = this.registryService.getGenerator(definition);
    const context: ReportGeneratorContext = {
      companyId: job.company_id,
      requestedBy: job.requested_by,
      filters: job.filters ?? undefined,
      parameters: job.parameter_payload ?? job.filters ?? undefined,
      format: job.format,
      definition,
      requestedAt: new Date().toISOString(),
    };

    try {
      job.source_cutoff_at = new Date();
      job.progress_percent = 10;
      await this.jobRepository.save(job);

      const generated = await generator.generate(context);
      this.ensureMaxRows(
        generated.rows.length,
        definition.maximum_rows ?? definition.max_rows ?? undefined,
      );
      job.status = ReportJobStatus.GENERATING_ARTIFACT;
      job.progress_percent = 80;
      job.row_count = String(generated.rows.length);
      await this.jobRepository.save(job);
      const artifact = await this.saveArtifact(job, definition, generated);

      if (job.schedule_id) {
        const schedule = await this.scheduleRepository.findOneBy({
          id: job.schedule_id,
        });
        if (schedule?.recipient_emails.length) {
          const deliveryResult = await this.deliverArtifact(
            job,
            schedule,
            artifact,
          );
          job.delivery_status = deliveryResult.status;
        } else {
          job.delivery_status = ReportDeliveryStatus.SKIPPED;
        }
      } else {
        job.delivery_status = ReportDeliveryStatus.SKIPPED;
      }

      job.artifact_id = artifact.id;
      job.status = ReportJobStatus.COMPLETED;
      job.progress_percent = 100;
      job.completed_at = new Date();
      await this.jobRepository.save(job);

      if (definition.usage_metric_code) {
        await this.usageMeteringService.recordEvent({
          company_id: job.company_id,
          metric_code: definition.usage_metric_code,
          quantity: 1,
          idempotency_key: `report-job:${job.id}`,
          resource_type: 'report_job',
          resource_id: job.id,
        });
      }

      return artifact;
    } catch (error) {
      job.status = ReportJobStatus.FAILED;
      job.failed_at = new Date();
      job.error_message =
        error instanceof Error ? error.message : 'Unknown report failure';
      job.safe_error_message = job.error_message;
      job.failure_code = 'REPORT_EXECUTION_FAILED';
      await this.jobRepository.save(job);
      throw error;
    }
  }

  async downloadArtifact(user: AuthenticatedUser, artifactId: string) {
    const artifact = await this.artifactRepository.findOne({
      where: { id: artifactId, company_id: user.companyId! },
    });

    if (!artifact) {
      throw new NotFoundException('Report artifact was not found');
    }

    const definition = await this.requireDefinition(artifact.definition_id);
    await this.assertReportAccess(user, definition, 'REPORT_DOWNLOAD', {
      artifactId: artifact.id,
      reportCode: artifact.report_code ?? definition.code,
    });

    if (artifact.expires_at && artifact.expires_at < new Date()) {
      await this.recordAccessAudit({
        companyId: user.companyId!,
        userId: user.id,
        reportCode: artifact.report_code ?? definition.code,
        artifactId: artifact.id,
        accessType: 'REPORT_DOWNLOAD',
        result: 'DENIED',
      });
      throw new BadRequestException('Report artifact has expired');
    }

    artifact.download_count = String(
      Number(artifact.download_count ?? '0') + 1,
    );
    artifact.last_downloaded_at = new Date();
    await this.artifactRepository.save(artifact);

    if (this.isRestrictedDefinition(definition)) {
      await this.recordAccessAudit({
        companyId: user.companyId!,
        userId: user.id,
        reportCode: artifact.report_code ?? definition.code,
        artifactId: artifact.id,
        accessType: 'REPORT_DOWNLOAD',
        result: 'ALLOWED',
      });
    }

    return artifact;
  }

  private async ensureDefaultDefinitions() {
    const defaults: Array<Partial<ReportDefinition>> = [
      {
        code: 'PRODUCT_PERFORMANCE',
        name: 'Product performance snapshot',
        description:
          'Product-level performance report based on stored performance snapshots',
        generator_key: 'product-performance',
        default_format: ReportFormat.XLSX,
        supported_formats: [
          ReportFormat.CSV,
          ReportFormat.XLSX,
          ReportFormat.JSON,
        ],
        enabled: true,
        active: true,
        feature_code: 'reports.product-performance',
        usage_metric_code: 'reports_generated',
        max_rows: 200000,
        maximum_rows: 200000,
        category: ReportCategory.MANAGEMENT,
        version: 1,
        sensitivity: ReportSensitivity.INTERNAL,
        permission: 'reports:run',
        asynchronous_only: true,
        parameters: [
          {
            key: 'period_start',
            label: 'Period start',
            dataType: 'DATE',
            required: false,
          },
          {
            key: 'period_end',
            label: 'Period end',
            dataType: 'DATE',
            required: false,
          },
          {
            key: 'branch_id',
            label: 'Branch',
            dataType: 'UUID',
            required: false,
          },
        ],
      },
    ];

    for (const definition of defaults) {
      let existing = await this.definitionRepository.findOne({
        where: { code: definition.code },
      });

      if (!existing) {
        existing = this.definitionRepository.create(definition);
      } else {
        Object.assign(existing, definition);
      }

      existing.definition_hash =
        this.parameterValidationService.computeDefinitionHash(existing);

      await this.definitionRepository.save(existing);
    }
  }

  private async requireDefinition(id: string) {
    const definition = await this.definitionRepository.findOneBy({ id });
    if (!definition) {
      throw new NotFoundException('Report definition was not found');
    }
    return definition;
  }

  private async requireSchedule(companyId: string, id: string) {
    const schedule = await this.scheduleRepository.findOne({
      where: { id, company_id: companyId, deleted_at: IsNull() },
    });
    if (!schedule) {
      throw new NotFoundException('Report schedule was not found');
    }
    return schedule;
  }

  private ensureSupportedFormat(
    definition: ReportDefinition,
    format: ReportFormat,
  ) {
    if (!definition.supported_formats.includes(format)) {
      throw new BadRequestException(
        `Report format "${format}" is not supported for ${definition.code}`,
      );
    }
  }

  private resolveNextRunAt(
    cronExpression: string,
    timezone: string,
    currentDate = DateTime.now().setZone(timezone),
  ) {
    try {
      const iterator = CronExpressionParser.parse(cronExpression, {
        currentDate: currentDate.toJSDate(),
        tz: timezone,
      });
      return iterator.next().toDate();
    } catch {
      throw new BadRequestException('Invalid cron expression');
    }
  }

  private defaultTimezone() {
    return (
      this.configService.get<string>('REPORTING_DEFAULT_TIMEZONE') ??
      this.configService.get<string>('REPORTS_DEFAULT_TIMEZONE') ??
      'Africa/Dar_es_Salaam'
    );
  }

  private async assertMailReady(recipients: string[]) {
    if (recipients.length === 0) {
      return;
    }

    const requireMailVerification =
      String(
        this.configService.get<string>('REPORTING_REQUIRE_MAIL_VERIFICATION') ??
          this.configService.get<string>('REPORTS_REQUIRE_MAIL_VERIFICATION') ??
          'true',
      ) === 'true';

    if (requireMailVerification) {
      const mailEnabled =
        String(this.configService.get<string>('MAIL_ENABLED') ?? 'true') ===
        'true';
      if (!mailEnabled) {
        throw new BadRequestException(
          'Mail delivery must be enabled before activating report schedules',
        );
      }
    }
  }

  private buildExecutionKey(
    companyId: string,
    definitionId: string,
    filters: Record<string, unknown> | null,
  ) {
    const digest = createHash('sha256')
      .update(JSON.stringify(filters ?? {}))
      .digest('hex')
      .slice(0, 16);

    return `${companyId}:${definitionId}:${digest}:${DateTime.utc().toFormat('yyyyLLddHHmmss')}`;
  }

  private ensureMaxRows(rowCount: number, definitionMaxRows?: number) {
    const configuredMaxRows = Number(
      this.configService.get<string>('REPORTING_DEFAULT_MAX_ROWS') ??
        this.configService.get<string>('REPORTS_MAX_ROWS') ??
        '200000',
    );
    const maxRows = definitionMaxRows
      ? Math.min(definitionMaxRows, configuredMaxRows)
      : configuredMaxRows;

    if (rowCount > maxRows) {
      throw new BadRequestException(
        `Report row limit exceeded. Maximum allowed rows: ${maxRows}`,
      );
    }
  }

  private async saveArtifact(
    job: ReportJob,
    definition: ReportDefinition,
    generated: {
      columns: string[];
      rows: Array<Record<string, unknown>>;
      metadata?: Record<string, unknown>;
      fileName?: string;
    },
  ) {
    const fileStem = generated.fileName ?? definition.code.toLowerCase();
    let contentBuffer: Buffer;
    let mimeType: string;
    let extension: string;

    if (job.format === ReportFormat.XLSX) {
      contentBuffer = await this.excelWriterService.write(generated);
      mimeType =
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      extension = 'xlsx';
    } else if (job.format === ReportFormat.JSON) {
      contentBuffer = Buffer.from(
        JSON.stringify(
          {
            columns: generated.columns,
            rows: generated.rows,
            metadata: generated.metadata ?? {},
          },
          null,
          2,
        ),
      );
      mimeType = 'application/json';
      extension = 'json';
    } else {
      const csv = [
        generated.columns.join(','),
        ...generated.rows.map((row) =>
          generated.columns
            .map((column) =>
              JSON.stringify(
                row[column] === undefined || row[column] === null
                  ? ''
                  : row[column],
              ),
            )
            .join(','),
        ),
      ].join('\n');
      contentBuffer = Buffer.from(csv);
      mimeType = 'text/csv';
      extension = 'csv';
    }

    const checksum = createHash('sha256').update(contentBuffer).digest('hex');
    return this.artifactRepository.save(
      this.artifactRepository.create({
        company_id: job.company_id,
        job_id: job.id,
        definition_id: definition.id,
        report_code: definition.code,
        format: job.format,
        file_name: `${fileStem}.${extension}`,
        mime_type: mimeType,
        content: contentBuffer.toString('base64'),
        size_bytes: String(contentBuffer.byteLength),
        checksum,
        file_hash: checksum,
        expires_at: DateTime.utc()
          .plus({
            day: Number(
              this.configService.get<string>(
                'REPORTING_DEFAULT_RETENTION_DAYS',
              ) ??
                this.configService.get<string>(
                  'REPORTS_ARTIFACT_RETENTION_DAYS',
                ) ??
                '30',
            ),
          })
          .toJSDate(),
        retention_until: DateTime.utc()
          .plus({
            day: Number(
              this.configService.get<string>(
                'REPORTING_DEFAULT_RETENTION_DAYS',
              ) ??
                this.configService.get<string>(
                  'REPORTS_ARTIFACT_RETENTION_DAYS',
                ) ??
                '30',
            ),
          })
          .toJSDate(),
        metadata: generated.metadata ?? null,
      }),
    );
  }

  private async deliverArtifact(
    job: ReportJob,
    schedule: ReportSchedule,
    artifact: ReportArtifact,
  ) {
    let deliveredCount = 0;
    let failedCount = 0;

    for (const recipient of schedule.recipient_emails) {
      const attemptNo =
        (await this.deliveryAttemptRepository.count({
          where: {
            report_job_id: job.id,
            recipient,
            channel: 'EMAIL',
          },
        })) + 1;

      try {
        await this.mailService.sendMail({
          to: recipient,
          subject: `Scheduled report ${artifact.file_name}`,
          text: `A scheduled report was generated: ${artifact.file_name}`,
          html: `<p>A scheduled report was generated: <strong>${artifact.file_name}</strong></p>`,
        });

        await this.deliveryAttemptRepository.save(
          this.deliveryAttemptRepository.create({
            report_job_id: job.id,
            artifact_id: artifact.id,
            channel: 'EMAIL',
            recipient,
            attempt_no: attemptNo,
            status: 'DELIVERED',
            completed_at: new Date(),
            metadata: {
              schedule_id: schedule.id,
            },
          }),
        );
        deliveredCount += 1;
      } catch (error) {
        const failureMessage =
          error instanceof Error ? error.message : 'Unknown delivery failure';
        await this.deliveryAttemptRepository.save(
          this.deliveryAttemptRepository.create({
            report_job_id: job.id,
            artifact_id: artifact.id,
            channel: 'EMAIL',
            recipient,
            attempt_no: attemptNo,
            status: 'FAILED',
            failure_code: 'MAIL_DELIVERY_FAILED',
            failure_message: failureMessage,
            completed_at: new Date(),
            metadata: {
              schedule_id: schedule.id,
            },
          }),
        );
        failedCount += 1;
        job.delivery_error = failureMessage;
      }
    }

    schedule.last_delivery_attempt_at = new Date();
    if (failedCount > 0) {
      schedule.failure_count += 1;
      schedule.last_failure_at = new Date();
      schedule.last_failure_reason =
        job.delivery_error ?? 'Report delivery failed';
    } else {
      schedule.failure_count = 0;
      schedule.last_failure_at = null;
      schedule.last_failure_reason = null;
    }
    await this.scheduleRepository.save(schedule);

    if (failedCount === 0) {
      return { status: ReportDeliveryStatus.DELIVERED };
    }

    if (deliveredCount > 0) {
      return { status: ReportDeliveryStatus.PENDING };
    }

    return { status: ReportDeliveryStatus.FAILED };
  }

  private buildExecutionContext(user: AuthenticatedUser) {
    return {
      companyId: user.companyId ?? null,
      userId: user.id,
      branchIds: user.assignedBranchIds ?? [],
      departmentIds: user.assignedDepartmentIds ?? [],
      permissions: user.permissions ?? [],
      timezone: this.defaultTimezone(),
      locale: 'en',
      requestedAt: new Date().toISOString(),
    };
  }

  private buildJobNumber() {
    return `JOB-${DateTime.utc().toFormat('yyyyLLddHHmmssSSS')}`;
  }

  private async assertReportAccess(
    user: AuthenticatedUser,
    definition: ReportDefinition,
    accessType: string,
    context?: {
      artifactId?: string | null;
      reportCode?: string | null;
    },
  ) {
    const permissions = user.permissions ?? [];
    const reportCode = context?.reportCode ?? definition.code;

    if (definition.permission && !permissions.includes(definition.permission)) {
      await this.recordAccessAudit({
        companyId: user.companyId!,
        userId: user.id,
        reportCode,
        artifactId: context?.artifactId ?? null,
        accessType,
        result: 'DENIED',
      });
      throw new ForbiddenException('You do not have access to this report');
    }

    if (
      this.isRestrictedDefinition(definition) &&
      !permissions.includes('reports:restricted:read')
    ) {
      await this.recordAccessAudit({
        companyId: user.companyId!,
        userId: user.id,
        reportCode,
        artifactId: context?.artifactId ?? null,
        accessType,
        result: 'DENIED',
      });
      throw new ForbiddenException('Restricted report permission is required');
    }

    if (this.isRestrictedDefinition(definition)) {
      await this.recordAccessAudit({
        companyId: user.companyId!,
        userId: user.id,
        reportCode,
        artifactId: context?.artifactId ?? null,
        accessType,
        result: 'ALLOWED',
      });
    }
  }

  private isRestrictedDefinition(definition: ReportDefinition) {
    return ([
      ReportSensitivity.CONFIDENTIAL,
      ReportSensitivity.RESTRICTED,
    ] as ReportSensitivity[]).includes(definition.sensitivity);
  }

  private async recordAccessAudit(input: {
    companyId: string;
    userId?: string | null;
    reportCode?: string | null;
    artifactId?: string | null;
    accessType: string;
    result: string;
    purpose?: string | null;
  }) {
    return this.accessAuditRepository.save(
      this.accessAuditRepository.create({
        company_id: input.companyId,
        user_id: input.userId ?? null,
        report_code: input.reportCode ?? null,
        artifact_id: input.artifactId ?? null,
        access_type: input.accessType,
        purpose: input.purpose ?? null,
        ip_address: null,
        user_agent: null,
        result: input.result,
      }),
    );
  }
}

import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentUser } from '@insurance-max/portal-shared/decorators/current-user.decorator';
import { Permissions } from '@insurance-max/portal-shared/decorators/permissions.decorator';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';

import { ReportListQueryDto } from './dto/report-list-query.dto';
import { ReportFormat, ReportScheduleStatus } from './enums/reporting.enums';
import { ReportingPermissions } from './reporting.permissions';
import { ReportMailHealthService } from './services/report-mail-health.service';
import { ReportScheduleService } from './services/report-schedule.service';
import { TenantScoped } from '@insurance-max/portal-shared';

@Controller('tenant/reports')
@TenantScoped()
export class ReportingController {
  constructor(
    private readonly scheduleService: ReportScheduleService,
    private readonly mailHealthService: ReportMailHealthService,
  ) {}

  @Get('definitions')
  @Permissions(ReportingPermissions.DEFINITION_READ)
  listDefinitions() {
    return this.scheduleService.listDefinitions();
  }

  @Post('mail/test')
  @Permissions(ReportingPermissions.MAIL_TEST)
  testMail(@Body() dto: { recipient: string }) {
    return this.mailHealthService.test(dto.recipient);
  }

  @Get('schedules')
  @Permissions(ReportingPermissions.SCHEDULE_READ)
  listSchedules(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ReportListQueryDto,
  ) {
    return this.scheduleService.listSchedules(user.companyId!, query);
  }

  @Post('schedules')
  @Permissions(ReportingPermissions.SCHEDULE_CREATE)
  createSchedule(
    @CurrentUser() user: AuthenticatedUser,
    @Body()
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
    return this.scheduleService.create(user, dto);
  }

  @Patch('schedules/:id')
  @Permissions(ReportingPermissions.SCHEDULE_UPDATE)
  updateSchedule(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: Record<string, unknown>,
  ) {
    return this.scheduleService.update(user, id, dto);
  }

  @Delete('schedules/:id')
  @Permissions(ReportingPermissions.SCHEDULE_DELETE)
  removeSchedule(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.scheduleService.remove(user.companyId!, id);
  }

  @Post('run')
  @Permissions(ReportingPermissions.RUN)
  runReport(
    @CurrentUser() user: AuthenticatedUser,
    @Body()
    dto: {
      definition_id: string;
      format?: ReportFormat;
      parameters?: Record<string, unknown>;
      filters?: Record<string, unknown>;
      branch_id?: string | null;
    },
  ) {
    return this.scheduleService.runNow(user, dto);
  }

  @Get('jobs')
  @Permissions(ReportingPermissions.JOB_READ)
  listJobs(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ReportListQueryDto,
  ) {
    return this.scheduleService.listJobs(user.companyId!, query);
  }

  @Get('jobs/:id')
  @Permissions(ReportingPermissions.JOB_READ)
  getJob(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.scheduleService.getJob(user.companyId!, id);
  }

  @Get('artifacts/:id/download')
  @Permissions(ReportingPermissions.DOWNLOAD)
  downloadArtifact(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.scheduleService.downloadArtifact(user, id);
  }
}

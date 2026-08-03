import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CurrentUser } from '@insurance-max/portal-shared/decorators/current-user.decorator';
import { Permissions } from '@insurance-max/portal-shared/decorators/permissions.decorator';
import { TenantGuard } from '@insurance-max/portal-shared/guards/tenant.guard';
import { PermissionsGuard } from '@insurance-max/portal-shared/guards/permissions.guard';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';

import { ReportFormat, ReportScheduleStatus } from './enums/reporting.enums';
import { ReportingPermissions } from './reporting.permissions';
import { ReportMailHealthService } from './services/report-mail-health.service';
import { ReportScheduleService } from './services/report-schedule.service';

@Controller('tenant/reports')
@UseGuards(AuthGuard('jwt'), TenantGuard)
export class ReportingController {
  constructor(
    private readonly scheduleService: ReportScheduleService,
    private readonly mailHealthService: ReportMailHealthService,
  ) {}

  @Get('definitions')
  @UseGuards(PermissionsGuard)
  @Permissions(ReportingPermissions.DEFINITION_READ)
  listDefinitions() {
    return this.scheduleService.listDefinitions();
  }

  @Post('mail/test')
  @UseGuards(PermissionsGuard)
  @Permissions(ReportingPermissions.MAIL_TEST)
  testMail(@Body() dto: { recipient: string }) {
    return this.mailHealthService.test(dto.recipient);
  }

  @Get('schedules')
  @UseGuards(PermissionsGuard)
  @Permissions(ReportingPermissions.SCHEDULE_READ)
  listSchedules(@CurrentUser() user: AuthenticatedUser) {
    return this.scheduleService.listSchedules(user.companyId!);
  }

  @Post('schedules')
  @UseGuards(PermissionsGuard)
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
      filters?: Record<string, unknown>;
      status?: ReportScheduleStatus;
    },
  ) {
    return this.scheduleService.create(user, dto);
  }

  @Patch('schedules/:id')
  @UseGuards(PermissionsGuard)
  @Permissions(ReportingPermissions.SCHEDULE_UPDATE)
  updateSchedule(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: Record<string, unknown>,
  ) {
    return this.scheduleService.update(user, id, dto);
  }

  @Delete('schedules/:id')
  @UseGuards(PermissionsGuard)
  @Permissions(ReportingPermissions.SCHEDULE_DELETE)
  removeSchedule(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.scheduleService.remove(user.companyId!, id);
  }

  @Post('run')
  @UseGuards(PermissionsGuard)
  @Permissions(ReportingPermissions.RUN)
  runReport(
    @CurrentUser() user: AuthenticatedUser,
    @Body()
    dto: {
      definition_id: string;
      format?: ReportFormat;
      filters?: Record<string, unknown>;
      branch_id?: string | null;
    },
  ) {
    return this.scheduleService.runNow(user, dto);
  }

  @Get('jobs')
  @UseGuards(PermissionsGuard)
  @Permissions(ReportingPermissions.JOB_READ)
  listJobs(@CurrentUser() user: AuthenticatedUser) {
    return this.scheduleService.listJobs(user.companyId!);
  }

  @Get('jobs/:id')
  @UseGuards(PermissionsGuard)
  @Permissions(ReportingPermissions.JOB_READ)
  getJob(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.scheduleService.getJob(user.companyId!, id);
  }

  @Get('artifacts/:id/download')
  @UseGuards(PermissionsGuard)
  @Permissions(ReportingPermissions.DOWNLOAD)
  downloadArtifact(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.scheduleService.downloadArtifact(user.companyId!, id);
  }
}

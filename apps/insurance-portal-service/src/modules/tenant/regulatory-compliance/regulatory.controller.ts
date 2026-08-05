import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { CurrentUser } from '@insurance-max/portal-shared/decorators/current-user.decorator';
import { Permissions } from '@insurance-max/portal-shared/decorators/permissions.decorator';
import { TenantScoped } from '@insurance-max/portal-shared';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';

import { RegulatoryPermissions } from './regulatory.permissions';
import { PremiumLevyReturnService } from './services/premium-levy-return.service';
import { RegulatoryCalendarService } from './services/regulatory-calendar.service';

@Controller('tenant/regulatory')
@TenantScoped()
export class RegulatoryController {
  constructor(
    private readonly calendarService: RegulatoryCalendarService,
    private readonly levyService: PremiumLevyReturnService,
  ) {}

  @Get('profile')
  @Permissions(RegulatoryPermissions.PROFILE_READ)
  getProfile(@CurrentUser() user: AuthenticatedUser) {
    return this.calendarService.getProfile(user.companyId!);
  }

  @Patch('profile')
  @Permissions(RegulatoryPermissions.PROFILE_UPDATE)
  updateProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: Record<string, unknown>,
  ) {
    return this.calendarService.updateProfile(user.companyId!, dto, user.id);
  }

  @Get('calendar')
  @Permissions(RegulatoryPermissions.CALENDAR_READ)
  listCalendar(@CurrentUser() user: AuthenticatedUser) {
    return this.calendarService.listCalendar(user.companyId!);
  }

  @Post('calendar/generate/:year')
  @Permissions(RegulatoryPermissions.CALENDAR_MANAGE)
  generate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('year', ParseIntPipe) year: number,
  ) {
    return this.calendarService.generateForCompany(user.companyId!, year);
  }

  @Get('returns')
  @Permissions(RegulatoryPermissions.RETURN_READ)
  listReturns(@CurrentUser() user: AuthenticatedUser) {
    return this.calendarService.listReturns(user.companyId!);
  }

  @Get('returns/:id')
  @Permissions(RegulatoryPermissions.RETURN_READ)
  getReturn(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.calendarService.getReturn(user.companyId!, id);
  }

  @Post('returns/:id/premium-levy/calculate')
  @Permissions(RegulatoryPermissions.LEVY_CALCULATE)
  calculateLevy(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: { levy_rate?: string | number },
  ) {
    return this.levyService.calculate(user, id, dto);
  }

  @Post('premium-levy/:id/adjustments')
  @Permissions(RegulatoryPermissions.LEVY_ADJUST)
  addLevyAdjustment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body()
    dto: {
      amount: string | number;
      description: string;
      evidence_reference?: string;
    },
  ) {
    return this.levyService.addAdjustment(user, id, dto);
  }
}

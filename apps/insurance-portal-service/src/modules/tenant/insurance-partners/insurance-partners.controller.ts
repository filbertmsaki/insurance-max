import {
  Body,
  Controller,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { CurrentUser } from '@insurance-max/portal-shared/decorators/current-user.decorator';
import { Permissions } from '@insurance-max/portal-shared/decorators/permissions.decorator';
import { CompanyTypes } from '@insurance-max/portal-shared/decorators/company-types.decorator';
import { TenantGuard } from '@insurance-max/portal-shared/guards/tenant.guard';
import { PermissionsGuard } from '@insurance-max/portal-shared/guards/permissions.guard';
import { CompanyTypeGuard } from '@insurance-max/portal-shared/guards/company-type.guard';
import { CompanyType } from '@insurance-max/portal-shared/enums/company-type.enum';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';
import { CreateInsurancePartnerDto } from './dto/create-insurance-partner.dto';
import { PartnerStatusReasonDto } from './dto/partner-status-reason.dto';
import { InsurancePartnersService } from './insurance-partners.service';

@ApiTags('Insurance Partners')
@ApiBearerAuth()
@Controller('insurance-partners')
@UseGuards(AuthGuard('jwt'), TenantGuard, PermissionsGuard, CompanyTypeGuard)
@CompanyTypes(CompanyType.INSURANCE_COMPANY)
export class InsurancePartnersController {
  constructor(private readonly service: InsurancePartnersService) {}

  @Post()
  @Permissions('insurance-partners:create')
  @ApiOperation({ summary: 'Link a partner company to the insurance company' })
  create(
    @Body() dto: CreateInsurancePartnerDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.create(dto, user.id);
  }

  @Patch(':id/approve')
  @Permissions('insurance-partners:approve')
  @ApiOperation({ summary: 'Approve a pending partner relationship' })
  approve(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.approve(id, user.id);
  }

  @Patch(':id/suspend')
  @Permissions('insurance-partners:suspend')
  @ApiOperation({ summary: 'Suspend an active partner relationship' })
  suspend(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PartnerStatusReasonDto,
  ) {
    return this.service.suspend(id, dto.reason);
  }

  @Patch(':id/terminate')
  @Permissions('insurance-partners:terminate')
  @ApiOperation({ summary: 'Terminate a partner relationship' })
  terminate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PartnerStatusReasonDto,
  ) {
    return this.service.terminate(id, dto.reason);
  }
}

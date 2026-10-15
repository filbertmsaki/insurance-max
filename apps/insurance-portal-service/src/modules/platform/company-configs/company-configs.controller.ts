import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Put,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Permissions } from '@insurance-max/portal-shared/decorators/permissions.decorator';
import { Roles } from '@insurance-max/portal-shared/decorators/roles.decorator';
import { CurrentUser } from '@insurance-max/portal-shared/decorators/current-user.decorator';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';
import { PlatformScoped } from '@insurance-max/portal-shared';
import { UpdatePolicyNumberingCodeDto } from './dtos/update-policy-numbering-code.dto';

import { CompanyConfigsService } from './company-configs.service';
import { UpsertCompanyConfigDto } from './dtos/upsert-company-config.dto';

/**
 * Platform-operator-managed per-company runtime settings (e.g. renewal
 * notice windows, default cancellation method) — distinct from
 * `tenant/company-features` self-service feature toggles. Lives under
 * `platform/` because it's intended for platform staff administering a
 * specific tenant, not for the tenant's own admins.
 */
@ApiTags('Company Configs')
@ApiBearerAuth('access-token')
@Controller('platform/companies/:companyId/configs')
@PlatformScoped()
export class CompanyConfigsController {
  constructor(private readonly service: CompanyConfigsService) {}

  @Get('policy-numbering/status')
  @Permissions('company-configs:read')
  numberingStatus(@Param('companyId', ParseUUIDPipe) companyId: string) {
    return this.service.numberingStatus(companyId);
  }

  @Put('policy-numbering/codes/:kind/:id')
  @Roles('OWNER')
  updateNumberingCode(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('kind') kind: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePolicyNumberingCodeDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.updateNumberingCode(
      companyId,
      kind,
      id,
      dto.code,
      user.id,
    );
  }

  @Get()
  @Permissions('company-configs:read')
  @ApiOperation({ summary: "List a company's runtime config entries" })
  findAll(@Param('companyId', ParseUUIDPipe) companyId: string) {
    return this.service.findAll(companyId);
  }

  @Get(':key')
  @Permissions('company-configs:read')
  @ApiOperation({ summary: 'Get a single company config entry by key' })
  findOne(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('key') key: string,
  ) {
    return this.service.findOne(companyId, key);
  }

  @Put(':key')
  @Roles('OWNER')
  @ApiOperation({ summary: 'Create or update a company config entry' })
  upsert(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('key') key: string,
    @Body() dto: UpsertCompanyConfigDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.upsert(companyId, key, dto, user.id);
  }

  @Delete(':key')
  @Roles('OWNER')
  @ApiOperation({ summary: 'Delete a company config entry' })
  remove(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('key') key: string,
  ) {
    return this.service.remove(companyId, key);
  }
}

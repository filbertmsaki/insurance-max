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
export class CompanyConfigsController {
  constructor(private readonly service: CompanyConfigsService) {}

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
  ) {
    return this.service.upsert(companyId, key, dto);
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

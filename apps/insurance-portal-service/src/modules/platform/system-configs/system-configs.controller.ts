import { Body, Controller, Delete, Get, Param, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Permissions } from '@insurance-max/portal-shared/decorators/permissions.decorator';
import { Roles } from '@insurance-max/portal-shared/decorators/roles.decorator';

import { SystemConfigsService } from './system-configs.service';
import { UpsertSystemConfigDto } from './dtos/upsert-system-config.dto';

/**
 * Platform-wide runtime settings, editable without a redeploy. Distinct
 * from `company-configs` (per-tenant) — a system config applies to every
 * company on the platform.
 */
@ApiTags('System Configs')
@ApiBearerAuth('access-token')
@Controller('platform/system-configs')
export class SystemConfigsController {
  constructor(private readonly service: SystemConfigsService) {}

  @Get()
  @Permissions('system-configs:read')
  @ApiOperation({ summary: 'List all platform-wide config entries' })
  findAll() {
    return this.service.findAll();
  }

  @Get(':key')
  @Permissions('system-configs:read')
  @ApiOperation({ summary: 'Get a single system config entry by key' })
  findOne(@Param('key') key: string) {
    return this.service.findOne(key);
  }

  @Put(':key')
  @Roles('OWNER')
  @ApiOperation({ summary: 'Create or update a system config entry' })
  upsert(@Param('key') key: string, @Body() dto: UpsertSystemConfigDto) {
    return this.service.upsert(key, dto);
  }

  @Delete(':key')
  @Roles('OWNER')
  @ApiOperation({ summary: 'Delete a system config entry' })
  remove(@Param('key') key: string) {
    return this.service.remove(key);
  }
}

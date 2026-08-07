import {
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { CurrentUser, Permissions } from '@insurance-max/portal-shared';
import type { AuthenticatedUser } from '@insurance-max/portal-shared';

import { AuditService } from './audit.service';
import { FilterAuditLogDto } from './dto/filter-audit-log.dto';

@ApiTags('Audit logs')
@ApiBearerAuth('access-token')
@Controller({ path: 'audit-logs', version: '1' })
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @Permissions('audit:read')
  search(
    @CurrentUser() user: AuthenticatedUser,
    @Query() filters: FilterAuditLogDto,
  ) {
    return this.auditService.search(
      {
        id: user.id,
        scope: user.scope,
        companyId: user.companyId ?? null,
        permissions: user.permissions,
      },
      filters,
    );
  }

  @Get(':id')
  @Permissions('audit:read')
  async findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const result = await this.auditService.search(
      {
        id: user.id,
        scope: user.scope,
        companyId: user.companyId ?? null,
        permissions: user.permissions,
      },
      { page: 1, limit: 200 },
    );

    const record = result.data.find((item) => item.id === id);

    if (!record) {
      throw new NotFoundException('Audit log not found.');
    }

    return record;
  }

  @Get('verify-chain/status')
  @Permissions('audit:verify-chain')
  verifyChain() {
    return this.auditService.verifyChain();
  }
}

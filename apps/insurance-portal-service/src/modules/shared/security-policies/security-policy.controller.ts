import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@insurance-max/portal-shared/decorators/current-user.decorator';
import { Permissions } from '@insurance-max/portal-shared/decorators/permissions.decorator';
import { TenantScoped } from '@insurance-max/portal-shared';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';

import { CreateSecurityPolicyDraftDto } from './dto/security-policy.dto';
import { SecurityPolicyAdminService } from './security-policy-admin.service';

@ApiTags('security-policy')
@ApiBearerAuth()
@Controller('tenant/security-policy')
@TenantScoped()
export class SecurityPolicyController {
  constructor(private readonly adminService: SecurityPolicyAdminService) {}

  @Get()
  @Permissions('security-policies:read')
  @ApiOperation({
    summary: "The company's effective security policy, baseline and versions",
  })
  overview(@CurrentUser() user: AuthenticatedUser) {
    return this.adminService.overview(user);
  }

  @Post('drafts')
  @Permissions('security-policies:update')
  @ApiOperation({ summary: 'Draft a new company security policy version' })
  createDraft(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateSecurityPolicyDraftDto,
  ) {
    return this.adminService.createDraft(user, dto);
  }

  @Post(':id/activate')
  @Permissions('security-policies:activate')
  @ApiOperation({
    summary:
      'Activate a draft drafted by someone else (supersedes the active one)',
  })
  activate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.adminService.activate(user, id);
  }

  @Post(':id/retire')
  @Permissions('security-policies:activate')
  @ApiOperation({
    summary: 'Retire the active company policy (the platform baseline applies)',
  })
  retire(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.adminService.retire(user, id);
  }
}

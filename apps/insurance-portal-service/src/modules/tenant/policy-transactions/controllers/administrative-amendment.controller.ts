import { Body, Controller, Param, ParseUUIDPipe, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@insurance-max/portal-shared/decorators/current-user.decorator';
import { Permissions } from '@insurance-max/portal-shared/decorators/permissions.decorator';
import { TenantScoped } from '@insurance-max/portal-shared';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';

import { AdministrativeAmendmentDto } from '../dto/administrative-amendment.dto';
import { AdministrativeAmendmentService } from '../services/administrative-amendment.service';

@ApiTags('policies')
@ApiBearerAuth()
@Controller()
@TenantScoped()
export class AdministrativeAmendmentController {
  constructor(private readonly service: AdministrativeAmendmentService) {}

  @Patch('tenant/policies/:id/administrative-details')
  @Permissions('policies:update')
  @ApiOperation({
    summary:
      'Update internal, non-contractual policy fields (servicing officer, notes, preferences)',
  })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdministrativeAmendmentDto,
  ) {
    return this.service.update(
      user.companyId!,
      id,
      dto as unknown as Record<string, unknown>,
    );
  }
}

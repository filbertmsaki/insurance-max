import { Body, Controller, Get, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@insurance-max/portal-shared/decorators/current-user.decorator';
import { Permissions } from '@insurance-max/portal-shared/decorators/permissions.decorator';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';
import { TenantScoped } from '@insurance-max/portal-shared';
import { QUOTATION_APPROVAL_POLICY_MANAGE_PERMISSION } from './quotation-approval-policy';
import { QuotationApprovalPolicyService } from './quotation-approval-policy.service';

@ApiTags('quotations')
@ApiBearerAuth()
@Controller('tenant/quotation-approval-policy')
@TenantScoped()
export class QuotationApprovalPolicyController {
  constructor(private readonly service: QuotationApprovalPolicyService) {}

  @Get()
  @Permissions(QUOTATION_APPROVAL_POLICY_MANAGE_PERMISSION)
  @ApiOperation({ summary: 'Get the quotation approval policy' })
  async get(@CurrentUser() user: AuthenticatedUser) {
    const [policy, selfEditAllowed] = await Promise.all([
      this.service.getPolicy(user.companyId!),
      this.service.selfEditAllowed(user.companyId!),
    ]);
    // Lets the page unlock the caller's own entry when they are the only
    // policy administrator (the save re-checks this).
    return { ...policy, self_edit_allowed: selfEditAllowed };
  }

  @Put()
  @Permissions(QUOTATION_APPROVAL_POLICY_MANAGE_PERMISSION)
  @ApiOperation({
    summary: 'Update the quotation approval policy',
    description:
      'Automatic approval rules and per-user direct approval limits. Editors cannot change their own direct approval entry.',
  })
  async update(@CurrentUser() user: AuthenticatedUser, @Body() body: unknown) {
    const policy = await this.service.updatePolicy(user.companyId!, body, user);
    return {
      ...policy,
      self_edit_allowed: await this.service.selfEditAllowed(user.companyId!),
    };
  }
}

import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@insurance-max/portal-shared/decorators/current-user.decorator';
import { Permissions } from '@insurance-max/portal-shared/decorators/permissions.decorator';
import { TenantScoped } from '@insurance-max/portal-shared';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';
import { RiskRuleConditionsService } from './risk-rule-conditions.service';
import { CreateRiskRuleConditionDto } from './dto/create-risk-rule-condition.dto';
import { UpdateRiskRuleConditionDto } from './dto/update-risk-rule-condition.dto';

@ApiTags('Risk Rule Conditions')
@ApiBearerAuth()
@Controller('risk-rule-conditions')
@TenantScoped()
export class RiskRuleConditionsController {
  constructor(private readonly service: RiskRuleConditionsService) {}

  @Get('by-rule/:ruleId')
  @Permissions('pricing.manage_rules')
  @ApiOperation({ summary: 'List all conditions for a rating rule' })
  async findByRule(
    @CurrentUser() user: AuthenticatedUser,
    @Param('ruleId', ParseUUIDPipe) ruleId: string,
  ) {
    return this.service.findByRule(user.companyId!, ruleId);
  }

  @Post()
  @Permissions('pricing.manage_rules')
  @ApiOperation({ summary: 'Add a condition to a rating rule' })
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateRiskRuleConditionDto,
  ) {
    return this.service.create(user.companyId!, dto, user.id);
  }

  @Get(':conditionId')
  @Permissions('pricing.manage_rules')
  @ApiOperation({ summary: 'Get a rule condition by ID' })
  async findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('conditionId', ParseUUIDPipe) conditionId: string,
  ) {
    return this.service.findOne(user.companyId!, conditionId);
  }

  @Patch(':conditionId')
  @Permissions('pricing.manage_rules')
  @ApiOperation({ summary: 'Update a rule condition' })
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('conditionId', ParseUUIDPipe) conditionId: string,
    @Body() dto: UpdateRiskRuleConditionDto,
  ) {
    return this.service.update(user.companyId!, conditionId, dto, user.id);
  }

  @Delete(':conditionId')
  @Permissions('pricing.manage_rules')
  @ApiOperation({ summary: 'Delete a rule condition' })
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('conditionId', ParseUUIDPipe) conditionId: string,
  ) {
    await this.service.remove(user.companyId!, conditionId);
    return { message: 'Condition removed successfully' };
  }
}

import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { CurrentUser } from '@insurance-max/portal-shared/decorators/current-user.decorator';
import { Permissions } from '@insurance-max/portal-shared/decorators/permissions.decorator';
import { PermissionsGuard } from '@insurance-max/portal-shared/guards/permissions.guard';
import { TenantGuard } from '@insurance-max/portal-shared/guards/tenant.guard';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';
import { RiskRatingRulesService } from './risk-rating-rules.service';
import { CreateRiskRatingRuleDto } from './dto/create-risk-rating-rule.dto';
import { UpdateRiskRatingRuleDto } from './dto/update-risk-rating-rule.dto';
import { FilterRiskRatingRuleDto } from './dto/filter-risk-rating-rule.dto';

@ApiTags('Risk Rating Rules')
@ApiBearerAuth()
@Controller('risk-rating-rules')
@UseGuards(AuthGuard('jwt'), TenantGuard)
export class RiskRatingRulesController {
  constructor(private readonly service: RiskRatingRulesService) {}

  @Get()
  @UseGuards(PermissionsGuard)
  @Permissions('pricing.manage_rules')
  @ApiOperation({
    summary: 'List all rating rules (filter by risk_id, rate_type, is_active)',
  })
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: FilterRiskRatingRuleDto,
  ) {
    return this.service.findAll(user.companyId!, query);
  }

  @Post()
  @UseGuards(PermissionsGuard)
  @Permissions('pricing.manage_rules')
  @ApiOperation({ summary: 'Create a new rating rule for a risk' })
  @ApiBody({
    type: CreateRiskRatingRuleDto,
    description: 'Structured rating rule payload',
    examples: {
      percentageOnly: {
        summary: 'Percentage only',
        value: {
          risk_id: 'f724d42f-7f6e-4ad7-bf10-0fde2ef84f93',
          rule_name: 'Motor Private - Base Rate',
          rate_type: 'PERCENTAGE',
          percentage_rate: 0.035,
          minimum_amount: 350000,
          priority: 1,
        },
      },
      percentagePlusFixed: {
        summary: 'Percentage plus fixed',
        value: {
          risk_id: 'f724d42f-7f6e-4ad7-bf10-0fde2ef84f93',
          rule_name: 'Commercial TPFT 5-10 Tonnes',
          rate_type: 'PERCENTAGE_PLUS_FIXED',
          percentage_rate: 0.025,
          fixed_amount: 250000,
          priority: 1,
        },
      },
      percentagePlusPerUnit: {
        summary: 'Percentage plus per unit',
        value: {
          risk_id: 'f724d42f-7f6e-4ad7-bf10-0fde2ef84f93',
          rule_name: 'Passenger Carrying No Claim',
          rate_type: 'PERCENTAGE_PLUS_PER_UNIT',
          percentage_rate: 0.055,
          per_unit_amount: 15000,
          per_unit_factor_code: 'seat_capacity',
          minimum_amount: 500000,
          priority: 1,
        },
      },
      fixedOnly: {
        summary: 'Fixed only',
        value: {
          risk_id: 'f724d42f-7f6e-4ad7-bf10-0fde2ef84f93',
          rule_name: 'Trailer Third Party Premium',
          rate_type: 'FIXED',
          fixed_amount: 250000,
          priority: 1,
        },
      },
      perUnitOnly: {
        summary: 'Per unit only',
        value: {
          risk_id: 'f724d42f-7f6e-4ad7-bf10-0fde2ef84f93',
          rule_name: 'Passenger Third Party Per Seat',
          rate_type: 'PER_UNIT',
          per_unit_amount: 15000,
          per_unit_factor_code: 'seat_capacity',
          minimum_amount: 150000,
          priority: 1,
        },
      },
    },
  })
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateRiskRatingRuleDto,
  ) {
    return this.service.create(user.companyId!, dto, user.id);
  }

  @Get(':ruleId')
  @UseGuards(PermissionsGuard)
  @Permissions('pricing.manage_rules')
  @ApiOperation({ summary: 'Get a rating rule with its conditions' })
  async findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('ruleId', ParseUUIDPipe) ruleId: string,
  ) {
    return this.service.findOne(user.companyId!, ruleId);
  }

  @Patch(':ruleId')
  @UseGuards(PermissionsGuard)
  @Permissions('pricing.manage_rules')
  @ApiOperation({ summary: 'Update a rating rule' })
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('ruleId', ParseUUIDPipe) ruleId: string,
    @Body() dto: UpdateRiskRatingRuleDto,
  ) {
    return this.service.update(user.companyId!, ruleId, dto, user.id);
  }

  @Delete(':ruleId')
  @UseGuards(PermissionsGuard)
  @Permissions('pricing.manage_rules')
  @ApiOperation({ summary: 'Soft-delete a rating rule' })
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('ruleId', ParseUUIDPipe) ruleId: string,
  ) {
    await this.service.remove(user.companyId!, ruleId);
    return { message: 'Rating rule deleted successfully' };
  }
}

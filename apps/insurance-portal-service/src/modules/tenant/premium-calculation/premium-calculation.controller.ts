import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { CurrentUser } from '@insurance-max/portal-shared/decorators/current-user.decorator';
import { Permissions } from '@insurance-max/portal-shared/decorators/permissions.decorator';
import { PermissionsGuard } from '@insurance-max/portal-shared/guards/permissions.guard';
import { TenantGuard } from '@insurance-max/portal-shared/guards/tenant.guard';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';
import { PremiumCalculationService } from './premium-calculation.service';
import {
  CalculateMultiRiskPremiumDto,
  CalculateSingleRiskPremiumDto,
} from './dto/calculate-premium.dto';

@ApiTags('Premium Calculation')
@ApiBearerAuth()
@Controller('premium-calculation')
@UseGuards(AuthGuard('jwt'), TenantGuard)
export class PremiumCalculationController {
  constructor(private readonly service: PremiumCalculationService) {}

  @Post('single')
  @UseGuards(PermissionsGuard)
  @Permissions('premium-calculation:calculate')
  @ApiOperation({
    summary: 'Calculate premium for a single risk',
    description:
      'Finds the first active matching rating rule by priority and returns a full premium breakdown.',
  })
  @ApiBody({
    type: CalculateSingleRiskPremiumDto,
    examples: {
      percentagePlusPerUnit: {
        summary: 'Motor passenger carrying',
        value: {
          risk_id: 'f724d42f-7f6e-4ad7-bf10-0fde2ef84f93',
          sum_insured: 10000000,
          factors: {
            seat_capacity: 10,
            vehicle_weight: 7,
            claim_record: 'NO_CLAIM',
          },
        },
      },
    },
  })
  async calculateSingle(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CalculateSingleRiskPremiumDto,
  ) {
    return this.service.calculateSingleRisk(user.companyId!, dto, user.id, user);
  }

  @Post('multi')
  @UseGuards(PermissionsGuard)
  @Permissions('premium-calculation:calculate')
  @ApiOperation({
    summary: 'Calculate premium for multiple risks at once',
    description:
      'Useful for products with multiple risk components (e.g. motor comprehensive + third party). Returns per-risk breakdown and grand total.',
  })
  async calculateMulti(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CalculateMultiRiskPremiumDto,
  ) {
    return this.service.calculateMultiRisk(user.companyId!, dto, user.id, user);
  }

  @Get('explain/:risk_id')
  @UseGuards(PermissionsGuard)
  @Permissions('premium-calculation:calculate')
  @ApiOperation({
    summary: "Explain a risk's resolved rating rule without calculating",
    description:
      'Returns the highest-priority active rating rule for a risk (rate_type, percentage_rate, fixed_amount, per_unit_amount/factor, minimum_amount, and its active conditions) without requiring sum_insured or factor values. Used to populate a minimum-amount reference the moment a risk is selected, and as a QA tool to inspect why a risk prices the way it does.',
  })
  async explain(
    @CurrentUser() user: AuthenticatedUser,
    @Param('risk_id', new ParseUUIDPipe()) riskId: string,
  ) {
    return this.service.explainRisk(user.companyId!, riskId);
  }

  @Get('quotes/:pricingQuoteId')
  @UseGuards(PermissionsGuard)
  @Permissions('premium-calculation:calculate')
  @ApiOperation({
    summary: 'Fetch an immutable stored pricing quote snapshot',
  })
  async findStoredQuote(
    @CurrentUser() user: AuthenticatedUser,
    @Param('pricingQuoteId') pricingQuoteId: string,
  ) {
    return this.service.findStoredQuote(user.companyId!, pricingQuoteId);
  }
}

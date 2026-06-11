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
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { CurrentUser } from '@insurance-max/portal-shared/decorators/current-user.decorator';
import { Permissions } from '@insurance-max/portal-shared/decorators/permissions.decorator';
import { PermissionsGuard } from '@insurance-max/portal-shared/guards/permissions.guard';
import { TenantGuard } from '@insurance-max/portal-shared/guards/tenant.guard';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';
import { RiskRequiredFactorsService } from './risk-required-factors.service';
import { CreateRiskRequiredFactorDto } from './dto/create-risk-required-factor.dto';
import { UpdateRiskRequiredFactorDto } from './dto/update-risk-required-factor.dto';

@ApiTags('Risk Required Factors')
@ApiBearerAuth()
@Controller('risk-required-factors')
@UseGuards(AuthGuard('jwt'), TenantGuard)
export class RiskRequiredFactorsController {
  constructor(private readonly service: RiskRequiredFactorsService) {}

  @Get('by-risk/:riskId')
  @UseGuards(PermissionsGuard)
  @Permissions('rating-factors:read')
  @ApiOperation({
    summary: 'List all required factors for a risk (ordered by sort_order)',
  })
  async findByRisk(
    @CurrentUser() user: AuthenticatedUser,
    @Param('riskId', ParseUUIDPipe) riskId: string,
  ) {
    return this.service.findByRisk(user.companyId!, riskId);
  }

  @Post()
  @UseGuards(PermissionsGuard)
  @Permissions('rating-factors:create')
  @ApiOperation({ summary: 'Assign a rating factor as required for a risk' })
  async assign(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateRiskRequiredFactorDto,
  ) {
    return this.service.assign(user.companyId!, dto, user.id);
  }

  @Patch(':id')
  @UseGuards(PermissionsGuard)
  @Permissions('rating-factors:update')
  @ApiOperation({
    summary: 'Update a required factor assignment (sort_order, is_required)',
  })
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRiskRequiredFactorDto,
  ) {
    return this.service.update(user.companyId!, id, dto, user.id);
  }

  @Delete(':id')
  @UseGuards(PermissionsGuard)
  @Permissions('rating-factors:delete')
  @ApiOperation({ summary: 'Remove a required factor from a risk' })
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.service.remove(user.companyId!, id);
    return { message: 'Required factor removed from risk successfully' };
  }
}

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
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@insurance-max/portal-shared/decorators/current-user.decorator';
import { Permissions } from '@insurance-max/portal-shared/decorators/permissions.decorator';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';
import { InsuranceRisksService } from './insurance-risks.service';
import { CreateInsuranceRiskDto } from './dto/create-insurance-risk.dto';
import { UpdateInsuranceRiskDto } from './dto/update-insurance-risk.dto';
import { FilterInsuranceRiskDto } from './dto/filter-insurance-risk.dto';
import { TenantScoped } from '@insurance-max/portal-shared';

@ApiTags('Insurance Risks')
@ApiBearerAuth()
@Controller('insurance-risks')
@TenantScoped()
export class InsuranceRisksController {
  constructor(private readonly service: InsuranceRisksService) {}

  @Get()
  @Permissions('insurance-risks:read')
  @ApiOperation({
    summary:
      'List all insurance risks for the current company (supports category_id + product_id filters)',
  })
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: FilterInsuranceRiskDto,
  ) {
    return this.service.findAll(user.companyId!, query);
  }

  @Post()
  @Permissions('insurance-risks:create')
  @ApiOperation({ summary: 'Create a new insurance risk' })
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateInsuranceRiskDto,
  ) {
    return this.service.create(user.companyId!, dto, user.id);
  }

  @Get(':riskId/rating-requirements')
  @Permissions('insurance-risks:read')
  @ApiOperation({
    summary:
      'Get pricing rating requirements for a risk, including currently required factors',
  })
  async getRatingRequirements(
    @CurrentUser() user: AuthenticatedUser,
    @Param('riskId', ParseUUIDPipe) riskId: string,
  ) {
    return this.service.getRatingRequirements(user.companyId!, riskId);
  }

  @Get(':riskId')
  @Permissions('insurance-risks:read')
  @ApiOperation({ summary: 'Get an insurance risk by ID' })
  async findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('riskId', ParseUUIDPipe) riskId: string,
  ) {
    return this.service.findOne(user.companyId!, riskId);
  }

  @Patch(':riskId')
  @Permissions('insurance-risks:update')
  @ApiOperation({ summary: 'Update an insurance risk' })
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('riskId', ParseUUIDPipe) riskId: string,
    @Body() dto: UpdateInsuranceRiskDto,
  ) {
    return this.service.update(user.companyId!, riskId, dto, user.id);
  }

  @Delete(':riskId')
  @Permissions('insurance-risks:delete')
  @ApiOperation({ summary: 'Soft-delete an insurance risk' })
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('riskId', ParseUUIDPipe) riskId: string,
  ) {
    await this.service.remove(user.companyId!, riskId);
    return { message: 'Insurance risk deleted successfully' };
  }
}

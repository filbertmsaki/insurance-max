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
import { InsuranceRisksService } from './insurance-risks.service';
import { CreateInsuranceRiskDto } from './dto/create-insurance-risk.dto';
import { UpdateInsuranceRiskDto } from './dto/update-insurance-risk.dto';
import { FilterInsuranceRiskDto } from './dto/filter-insurance-risk.dto';

@ApiTags('Insurance Risks')
@ApiBearerAuth()
@Controller('insurance-risks')
@UseGuards(AuthGuard('jwt'), TenantGuard)
export class InsuranceRisksController {
  constructor(private readonly service: InsuranceRisksService) {}

  @Get()
  @UseGuards(PermissionsGuard)
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
  @UseGuards(PermissionsGuard)
  @Permissions('insurance-risks:create')
  @ApiOperation({ summary: 'Create a new insurance risk' })
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateInsuranceRiskDto,
  ) {
    return this.service.create(user.companyId!, dto, user.id);
  }

  @Get(':riskId')
  @UseGuards(PermissionsGuard)
  @Permissions('insurance-risks:read')
  @ApiOperation({ summary: 'Get an insurance risk by ID' })
  async findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('riskId', ParseUUIDPipe) riskId: string,
  ) {
    return this.service.findOne(user.companyId!, riskId);
  }

  @Patch(':riskId')
  @UseGuards(PermissionsGuard)
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
  @UseGuards(PermissionsGuard)
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

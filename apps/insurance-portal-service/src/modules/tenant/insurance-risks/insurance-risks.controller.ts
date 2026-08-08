import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
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
import { CategoryAccessService } from '../category-access/category-access.service';
import { ProductAccessService } from '../product-access/product-access.service';
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
  constructor(
    private readonly service: InsuranceRisksService,
    private readonly productAccessService: ProductAccessService,
    private readonly categoryAccessService: CategoryAccessService,
  ) {}

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
    const accessibleProducts =
      await this.productAccessService.getAccessibleProducts(
        user.companyId!,
        user.companyMembershipId!,
        user.activeBranchId ?? undefined,
        user.activeDepartmentId ?? undefined,
        query.category_id,
      );
    const accessibleCategories =
      await this.categoryAccessService.getAccessibleCategories(
        user.companyId!,
        user.companyMembershipId!,
        user.activeBranchId ?? undefined,
        user.activeDepartmentId ?? undefined,
      );

    return this.service.findAll(
      user.companyId!,
      query,
      accessibleProducts.map((product) => product.id),
      accessibleCategories.map((category) => category.id),
    );
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
    await this.assertRiskProductCanView(user, riskId);
    return this.service.getRatingRequirements(user.companyId!, riskId);
  }

  @Get(':riskId')
  @Permissions('insurance-risks:read')
  @ApiOperation({ summary: 'Get an insurance risk by ID' })
  async findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('riskId', ParseUUIDPipe) riskId: string,
  ) {
    await this.assertRiskProductCanView(user, riskId);
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

  private async assertRiskProductCanView(
    user: AuthenticatedUser,
    riskId: string,
  ): Promise<void> {
    const risk = await this.service.findOne(user.companyId!, riskId);
    const access = await this.productAccessService.resolveAccess(
      user.companyId!,
      {
        product_id: risk.product_id,
        company_user_id: user.companyMembershipId!,
        branch_id: user.activeBranchId ?? undefined,
        department_id: user.activeDepartmentId ?? undefined,
      },
    );

    if (!access.can_view) {
      throw new NotFoundException('Insurance risk not found');
    }

    const categoryAccess = await this.categoryAccessService.resolveAccess(
      user.companyId!,
      {
        category_id: risk.product.category_id,
        company_user_id: user.companyMembershipId!,
        branch_id: user.activeBranchId ?? undefined,
        department_id: user.activeDepartmentId ?? undefined,
      },
    );

    if (!categoryAccess.can_view) {
      throw new NotFoundException('Insurance risk not found');
    }
  }
}

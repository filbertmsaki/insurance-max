import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@insurance-max/portal-shared/decorators/current-user.decorator';
import { Permissions } from '@insurance-max/portal-shared/decorators/permissions.decorator';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';
import { ProductAccessService } from './product-access.service';
import { TenantScoped } from '@insurance-max/portal-shared';
import {
  ResolveProductAccessDto,
  UpsertBranchProductAccessDto,
  UpsertDepartmentProductAccessDto,
  UpsertUserProductAccessDto,
} from './dto/upsert-product-access.dto';

@ApiTags('Product Access')
@ApiBearerAuth()
@Controller('product-access')
@TenantScoped()
export class ProductAccessController {
  constructor(private readonly service: ProductAccessService) {}

  // ─── Branch ───────────────────────────────────────────────────────────────────

  @Post('branch')
  @Permissions('product-access:manage')
  @ApiOperation({ summary: 'Set or update product access for a branch' })
  async upsertBranchAccess(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpsertBranchProductAccessDto,
  ) {
    return this.service.upsertBranchAccess(user.companyId!, dto, user.id);
  }

  @Get('branch/:branchId')
  @Permissions('product-access:read')
  @ApiOperation({ summary: 'Get all product access rules for a branch' })
  async getBranchAccess(
    @CurrentUser() user: AuthenticatedUser,
    @Param('branchId', ParseUUIDPipe) branchId: string,
  ) {
    return this.service.getBranchAccess(user.companyId!, branchId);
  }

  @Delete('branch/:id')
  @Permissions('product-access:manage')
  @ApiOperation({ summary: 'Remove a branch product access rule' })
  async deleteBranchAccess(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.service.deleteBranchAccess(user.companyId!, id);
    return { message: 'Branch product access rule removed' };
  }

  // ─── Department ───────────────────────────────────────────────────────────────

  @Post('department')
  @Permissions('product-access:manage')
  @ApiOperation({ summary: 'Set or update product access for a department' })
  async upsertDepartmentAccess(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpsertDepartmentProductAccessDto,
  ) {
    return this.service.upsertDepartmentAccess(user.companyId!, dto, user.id);
  }

  @Get('department/:departmentId')
  @Permissions('product-access:read')
  @ApiOperation({ summary: 'Get all product access rules for a department' })
  async getDepartmentAccess(
    @CurrentUser() user: AuthenticatedUser,
    @Param('departmentId', ParseUUIDPipe) departmentId: string,
  ) {
    return this.service.getDepartmentAccess(user.companyId!, departmentId);
  }

  @Delete('department/:id')
  @Permissions('product-access:manage')
  @ApiOperation({ summary: 'Remove a department product access rule' })
  async deleteDepartmentAccess(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.service.deleteDepartmentAccess(user.companyId!, id);
    return { message: 'Department product access rule removed' };
  }

  // ─── User ─────────────────────────────────────────────────────────────────────

  @Post('user')
  @Permissions('product-access:manage')
  @ApiOperation({ summary: 'Set or update product access for a company user' })
  async upsertUserAccess(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpsertUserProductAccessDto,
  ) {
    return this.service.upsertUserAccess(user.companyId!, dto, user.id);
  }

  @Get('user/:companyUserId')
  @Permissions('product-access:read')
  @ApiOperation({ summary: 'Get all product access rules for a company user' })
  async getUserAccess(
    @CurrentUser() user: AuthenticatedUser,
    @Param('companyUserId', ParseUUIDPipe) companyUserId: string,
  ) {
    return this.service.getUserAccess(user.companyId!, companyUserId);
  }

  @Delete('user/:id')
  @Permissions('product-access:manage')
  @ApiOperation({ summary: 'Remove a user product access rule' })
  async deleteUserAccess(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.service.deleteUserAccess(user.companyId!, id);
    return { message: 'User product access rule removed' };
  }

  // ─── Resolve / Accessible ─────────────────────────────────────────────────────

  @Post('resolve')
  @Permissions('product-access:read')
  @ApiOperation({
    summary:
      'Resolve effective access to a product for a user in a given context',
  })
  async resolveAccess(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ResolveProductAccessDto,
  ) {
    return this.service.resolveAccess(user.companyId!, dto);
  }

  @Get('accessible')
  @Permissions('product-access:read')
  @ApiOperation({
    summary: 'Get all products a user can view in their context',
  })
  async getAccessibleProducts(
    @CurrentUser() user: AuthenticatedUser,
    @Query('company_user_id') companyUserId: string,
    @Query('branch_id') branchId?: string,
    @Query('department_id') departmentId?: string,
    @Query('category_id') categoryId?: string,
  ) {
    return this.service.getAccessibleProducts(
      user.companyId!,
      companyUserId,
      branchId,
      departmentId,
      categoryId,
    );
  }
}

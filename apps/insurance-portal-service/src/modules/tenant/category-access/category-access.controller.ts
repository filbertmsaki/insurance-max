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
import { CategoryAccessService } from './category-access.service';
import { TenantScoped } from '@insurance-max/portal-shared';
import {
  ResolveAccessDto,
  UpsertBranchCategoryAccessDto,
  UpsertDepartmentCategoryAccessDto,
  UpsertUserCategoryAccessDto,
} from './dto/upsert-category-access.dto';

@ApiTags('Category Access')
@ApiBearerAuth()
@Controller('category-access')
@TenantScoped()
export class CategoryAccessController {
  constructor(private readonly service: CategoryAccessService) {}

  // ─── Branch ───────────────────────────────────────────────────────────────────

  @Post('branch')
  @Permissions('category-access:manage')
  @ApiOperation({ summary: 'Set or update category access for a branch' })
  async upsertBranchAccess(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpsertBranchCategoryAccessDto,
  ) {
    return this.service.upsertBranchAccess(user.companyId!, dto, user.id);
  }

  @Get('branch/:branchId')
  @Permissions('category-access:read')
  @ApiOperation({ summary: 'Get all category access rules for a branch' })
  async getBranchAccess(
    @CurrentUser() user: AuthenticatedUser,
    @Param('branchId', ParseUUIDPipe) branchId: string,
  ) {
    return this.service.getBranchAccess(user.companyId!, branchId);
  }

  @Delete('branch/:id')
  @Permissions('category-access:manage')
  @ApiOperation({ summary: 'Remove a branch category access rule' })
  async deleteBranchAccess(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.service.deleteBranchAccess(user.companyId!, id);
    return { message: 'Branch category access rule removed' };
  }

  // ─── Department ───────────────────────────────────────────────────────────────

  @Post('department')
  @Permissions('category-access:manage')
  @ApiOperation({ summary: 'Set or update category access for a department' })
  async upsertDepartmentAccess(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpsertDepartmentCategoryAccessDto,
  ) {
    return this.service.upsertDepartmentAccess(user.companyId!, dto, user.id);
  }

  @Get('department/:departmentId')
  @Permissions('category-access:read')
  @ApiOperation({ summary: 'Get all category access rules for a department' })
  async getDepartmentAccess(
    @CurrentUser() user: AuthenticatedUser,
    @Param('departmentId', ParseUUIDPipe) departmentId: string,
  ) {
    return this.service.getDepartmentAccess(user.companyId!, departmentId);
  }

  @Delete('department/:id')
  @Permissions('category-access:manage')
  @ApiOperation({ summary: 'Remove a department category access rule' })
  async deleteDepartmentAccess(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.service.deleteDepartmentAccess(user.companyId!, id);
    return { message: 'Department category access rule removed' };
  }

  // ─── User ─────────────────────────────────────────────────────────────────────

  @Post('user')
  @Permissions('category-access:manage')
  @ApiOperation({ summary: 'Set or update category access for a company user' })
  async upsertUserAccess(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpsertUserCategoryAccessDto,
  ) {
    return this.service.upsertUserAccess(user.companyId!, dto, user.id);
  }

  @Get('user/:companyUserId')
  @Permissions('category-access:read')
  @ApiOperation({ summary: 'Get all category access rules for a company user' })
  async getUserAccess(
    @CurrentUser() user: AuthenticatedUser,
    @Param('companyUserId', ParseUUIDPipe) companyUserId: string,
  ) {
    return this.service.getUserAccess(user.companyId!, companyUserId);
  }

  @Delete('user/:id')
  @Permissions('category-access:manage')
  @ApiOperation({ summary: 'Remove a user category access rule' })
  async deleteUserAccess(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.service.deleteUserAccess(user.companyId!, id);
    return { message: 'User category access rule removed' };
  }

  // ─── Resolve / Accessible ─────────────────────────────────────────────────────

  @Post('resolve')
  @Permissions('category-access:read')
  @ApiOperation({
    summary:
      'Resolve effective access to a category for a user in a given context',
  })
  async resolveAccess(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ResolveAccessDto,
  ) {
    return this.service.resolveAccess(user.companyId!, dto);
  }

  @Get('accessible')
  @Permissions('category-access:read')
  @ApiOperation({
    summary: 'Get all categories a user can view in their context',
  })
  async getAccessibleCategories(
    @CurrentUser() user: AuthenticatedUser,
    @Query('company_user_id') companyUserId: string,
    @Query('branch_id') branchId?: string,
    @Query('department_id') departmentId?: string,
  ) {
    return this.service.getAccessibleCategories(
      user.companyId!,
      companyUserId,
      branchId,
      departmentId,
    );
  }
}

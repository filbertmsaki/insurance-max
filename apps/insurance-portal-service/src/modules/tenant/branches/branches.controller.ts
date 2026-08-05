import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@insurance-max/portal-shared/decorators/current-user.decorator';
import { Permissions } from '@insurance-max/portal-shared/decorators/permissions.decorator';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';
import { PaginationDto } from '@insurance-max/portal-shared/dto/pagination.dto';
import { BranchesService } from './branches.service';
import { CreateBranchDto } from './dto/create-branch.dto';
import {
  UpdateBranchDto,
  UpdateBranchStatusDto,
} from './dto/update-branch.dto';
import { AssignBranchUserDto } from './dto/assign-branch-user.dto';
import { RemoveBranchUsersDto } from './dto/remove-branch-users.dto';
import { TenantScoped } from '@insurance-max/portal-shared';
import {
  SetBranchFeatureDto,
  UpsertCompanyFeatureDto,
} from './dto/branch-feature.dto';

@ApiTags('Branches')
@ApiBearerAuth()
@Controller('branches')
@TenantScoped()
export class BranchesController {
  constructor(private readonly branchesService: BranchesService) {}

  // ─── Branch CRUD ─────────────────────────────────────────────────────────────

  @Get()
  @Permissions('branches:read')
  @ApiOperation({ summary: 'List all branches for the current company' })
  async listBranches(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PaginationDto,
  ) {
    return this.branchesService.findAllBranches(user.companyId!, query);
  }

  @Post()
  @Permissions('branches:create')
  @ApiOperation({ summary: 'Create a new branch for the current company' })
  async createBranch(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateBranchDto,
  ) {
    return this.branchesService.createBranch(user.companyId!, dto);
  }

  @Get(':branchId')
  @Permissions('branches:read')
  @ApiOperation({ summary: 'Get a branch by ID (tenant-scoped)' })
  async getBranch(
    @CurrentUser() user: AuthenticatedUser,
    @Param('branchId', ParseUUIDPipe) branchId: string,
  ) {
    return this.branchesService.findBranchById(user.companyId!, branchId);
  }

  @Patch(':branchId')
  @Permissions('branches:update')
  @ApiOperation({ summary: 'Update a branch' })
  async updateBranch(
    @CurrentUser() user: AuthenticatedUser,
    @Param('branchId', ParseUUIDPipe) branchId: string,
    @Body() dto: UpdateBranchDto,
  ) {
    return this.branchesService.updateBranch(user.companyId!, branchId, dto);
  }

  @Patch(':branchId/status')
  @Permissions('branches:update')
  @ApiOperation({ summary: 'Activate or deactivate a branch' })
  async setBranchStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('branchId', ParseUUIDPipe) branchId: string,
    @Body() dto: UpdateBranchStatusDto,
  ) {
    return this.branchesService.setBranchStatus(
      user.companyId!,
      branchId,
      dto,
      user.id,
    );
  }

  @Delete(':branchId')
  @Permissions('branches:delete')
  @ApiOperation({ summary: 'Soft-delete a branch' })
  async deleteBranch(
    @CurrentUser() user: AuthenticatedUser,
    @Param('branchId', ParseUUIDPipe) branchId: string,
  ) {
    await this.branchesService.deleteBranch(user.companyId!, branchId);
    return { message: 'Branch deleted successfully' };
  }

  // ─── Branch User Management ──────────────────────────────────────────────────

  @Get(':branchId/users')
  @Permissions('branches:read')
  @ApiOperation({ summary: 'List users assigned to a branch' })
  async getBranchUsers(
    @CurrentUser() user: AuthenticatedUser,
    @Param('branchId', ParseUUIDPipe) branchId: string,
  ) {
    return this.branchesService.getBranchUsers(user.companyId!, branchId);
  }

  @Get(':branchId/eligible-users')
  @Permissions('branches:read')
  async getEligibleUsers(
    @CurrentUser() user: AuthenticatedUser,
    @Param('branchId', ParseUUIDPipe) branchId: string,
    @Query('search') search?: string,
  ) {
    return this.branchesService.getEligibleBranchUsers(
      user.companyId!,
      branchId,
      search,
    );
  }

  @Post(':branchId/users')
  @Permissions('branches:manage-access')
  @ApiOperation({ summary: 'Assign a company user to a branch' })
  async assignUser(
    @CurrentUser() user: AuthenticatedUser,
    @Param('branchId', ParseUUIDPipe) branchId: string,
    @Body() dto: AssignBranchUserDto,
  ) {
    return this.branchesService.assignUsersToBranch(
      user.companyId!,
      branchId,
      dto,
      user.id,
    );
  }

  @Delete(':branchId/users')
  @Permissions('branches:manage-access')
  async removeUsers(
    @CurrentUser() user: AuthenticatedUser,
    @Param('branchId', ParseUUIDPipe) branchId: string,
    @Body() dto: RemoveBranchUsersDto,
  ) {
    return this.branchesService.removeUsersFromBranch(
      user.companyId!,
      branchId,
      dto.company_user_ids,
      dto.replacement_branch_id,
      user.id,
    );
  }

  @Delete(':branchId/users/:companyUserId')
  @Permissions('branches:manage-access')
  @ApiOperation({ summary: 'Remove a user from a branch' })
  async removeUser(
    @CurrentUser() user: AuthenticatedUser,
    @Param('branchId', ParseUUIDPipe) branchId: string,
    @Param('companyUserId', ParseUUIDPipe) companyUserId: string,
  ) {
    return this.branchesService.removeUserFromBranch(
      user.companyId!,
      branchId,
      companyUserId,
    );
  }

  @Patch('users/:companyUserId/active-branch')
  @Permissions('branches:manage-access')
  async setUserActiveBranch(
    @CurrentUser() user: AuthenticatedUser,
    @Param('companyUserId', ParseUUIDPipe) companyUserId: string,
    @Body('branch_id', ParseUUIDPipe) branchId: string,
  ) {
    return this.branchesService.setUserActiveBranch(
      user.companyId!,
      companyUserId,
      branchId,
      user.id,
    );
  }

  @Patch('me/active-branch')
  @Permissions('branches:read')
  async setMyActiveBranch(
    @CurrentUser() user: AuthenticatedUser,
    @Body('branch_id', ParseUUIDPipe) branchId: string,
  ) {
    if (!user.companyMembershipId) {
      throw new Error('Company membership is required');
    }
    return this.branchesService.setUserActiveBranch(
      user.companyId!,
      user.companyMembershipId,
      branchId,
      user.id,
    );
  }

  // ─── Branch Feature Management ───────────────────────────────────────────────

  @Get(':branchId/features')
  @Permissions('branches:read')
  @ApiOperation({
    summary:
      'Get effective feature access for a branch (company defaults + branch overrides)',
  })
  async getBranchFeatures(
    @CurrentUser() user: AuthenticatedUser,
    @Param('branchId', ParseUUIDPipe) branchId: string,
  ) {
    return this.branchesService.getEffectiveBranchFeatures(
      user.companyId!,
      branchId,
    );
  }

  @Put(':branchId/features/:companyFeatureId')
  @Permissions('branches:manage-access')
  @ApiOperation({
    summary:
      'Set a branch-level feature override (can only restrict, not exceed company settings)',
  })
  async setBranchFeature(
    @CurrentUser() user: AuthenticatedUser,
    @Param('branchId', ParseUUIDPipe) branchId: string,
    @Param('companyFeatureId', ParseUUIDPipe) companyFeatureId: string,
    @Body() dto: SetBranchFeatureDto,
  ) {
    return this.branchesService.setBranchFeature(
      user.companyId!,
      branchId,
      companyFeatureId,
      dto,
    );
  }

  @Delete(':branchId/features/:companyFeatureId')
  @Permissions('branches:manage-access')
  @ApiOperation({
    summary:
      'Remove a branch-level feature override (reverts to company default)',
  })
  async resetBranchFeature(
    @CurrentUser() user: AuthenticatedUser,
    @Param('branchId', ParseUUIDPipe) branchId: string,
    @Param('companyFeatureId', ParseUUIDPipe) companyFeatureId: string,
  ) {
    await this.branchesService.deleteBranchFeatureOverride(
      user.companyId!,
      branchId,
      companyFeatureId,
    );
    return {
      message: 'Branch feature override removed; reverted to company default',
    };
  }
}

// ─── Company Features Controller ───────────────────────────────────────────────

@ApiTags('Company Features')
@ApiBearerAuth()
@Controller('company-features')
export class CompanyFeaturesController {
  constructor(private readonly branchesService: BranchesService) {}

  @Get()
  @Permissions('branches:read')
  @ApiOperation({ summary: 'List all features enabled at the company level' })
  async listFeatures(@CurrentUser() user: AuthenticatedUser) {
    return this.branchesService.getCompanyFeatures(user.companyId!);
  }

  @Post()
  @Permissions('branches:manage-access')
  @ApiOperation({ summary: 'Create or update a company-level feature' })
  async upsertFeature(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpsertCompanyFeatureDto,
  ) {
    return this.branchesService.upsertCompanyFeature(user.companyId!, dto);
  }

  @Delete(':featureId')
  @Permissions('branches:manage-access')
  @ApiOperation({
    summary: 'Delete a company feature (also removes all branch overrides)',
  })
  async deleteFeature(
    @CurrentUser() user: AuthenticatedUser,
    @Param('featureId', ParseUUIDPipe) featureId: string,
  ) {
    await this.branchesService.deleteCompanyFeature(user.companyId!, featureId);
    return { message: 'Company feature deleted successfully' };
  }

  @Get(':companyUserId/branches')
  @Permissions('branches:read')
  @ApiOperation({ summary: 'List branches a company user is assigned to' })
  async getUserBranches(
    @CurrentUser() user: AuthenticatedUser,
    @Param('companyUserId', ParseUUIDPipe) companyUserId: string,
  ) {
    return this.branchesService.getUserBranches(user.companyId!, companyUserId);
  }
}

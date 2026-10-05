import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
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
import { Roles } from '@insurance-max/portal-shared/decorators/roles.decorator';
import { PaginationDto } from '@insurance-max/portal-shared/dto/pagination.dto';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';
import { PlatformScoped, TenantScoped } from '@insurance-max/portal-shared';
import { CreateCompanyDto } from './dtos/create-company.dto';
import { SetCompanyPrimaryUserDto } from './dtos/set-company-primary-user.dto';
import {
  UpdateCompanyDto,
  UpdateCompanyStatusDto,
} from './dtos/update-company.dto';
import { UpdateNumberFormatSettingsDto } from './dtos/update-number-format-settings.dto';
import { GrantCompanyUserPermissionDto } from './dtos/grant-company-user-permission.dto';
import { CompaniesService } from './companies.service';

@ApiTags('Companies')
@ApiBearerAuth()
@Controller('companies')
@PlatformScoped()
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  @Get()
  @Roles('OWNER')
  @Permissions('companies:read')
  @ApiOperation({ summary: 'List all companies (Owner only)' })
  async listCompanies() {
    return this.companiesService.findAllCompanies();
  }

  @Post()
  @Roles('OWNER')
  @Permissions('companies:create')
  @ApiOperation({
    summary: 'Create a company with its first administrator (Owner only)',
  })
  async createCompany(@Body() createCompanyDto: CreateCompanyDto) {
    return this.companiesService.createCompanyWithAdministrator(
      createCompanyDto,
    );
  }

  @Get('my')
  @TenantScoped()
  @ApiOperation({ summary: "Get the current user's active company profile" })
  async getMyCompany(@CurrentUser() user: AuthenticatedUser) {
    return this.companiesService.findCompanyById(user.companyId!);
  }

  @Post(':id/users/:userId/permissions')
  @TenantScoped()
  @Permissions('users:assign-role')
  @ApiOperation({ summary: 'Grant a scoped permission to a company member' })
  async grantMemberPermission(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: GrantCompanyUserPermissionDto,
  ) {
    if (id !== actor.companyId) {
      throw new ForbiddenException(
        'A company administrator may only manage members in the active company.',
      );
    }
    return this.companiesService.grantPermission(
      id,
      userId,
      dto.permission_id,
      {
        dataScope: dto.data_scope,
        branchId: dto.scope_branch_id,
        departmentId: dto.scope_department_id,
      },
      actor,
    );
  }

  @Delete(':id/users/:userId/permissions/:permissionId')
  @TenantScoped()
  @Permissions('users:assign-role')
  @ApiOperation({ summary: 'Revoke a direct permission from a company member' })
  async revokeMemberPermission(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Param('permissionId', ParseUUIDPipe) permissionId: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    if (id !== actor.companyId) {
      throw new ForbiddenException(
        'A company administrator may only manage members in the active company.',
      );
    }
    return this.companiesService.revokePermission(
      id,
      userId,
      permissionId,
      actor,
    );
  }

  @Patch('my')
  @TenantScoped()
  @Permissions('update_company_data')
  @ApiOperation({ summary: "Update the current user's company profile" })
  async updateMyCompany(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateCompanyDto,
  ) {
    return this.companiesService.updateCompany(user.companyId!, dto);
  }

  @Get('my/number-format')
  @TenantScoped()
  @ApiOperation({
    summary: "Get the current company's number and currency format settings",
  })
  async getMyNumberFormat(@CurrentUser() user: AuthenticatedUser) {
    return this.companiesService.getNumberFormatSettings(user.companyId!);
  }

  @Patch('my/number-format')
  @TenantScoped()
  @Permissions('company-configs:update')
  @ApiOperation({
    summary: "Update the current company's number and currency format settings",
  })
  async updateMyNumberFormat(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateNumberFormatSettingsDto,
  ) {
    return this.companiesService.updateNumberFormatSettings(user, dto);
  }

  @Get(':id/users')
  @Roles('OWNER')
  @Permissions('companies:read')
  @ApiOperation({ summary: 'List users that belong to a company (Owner only)' })
  async listCompanyUsers(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: PaginationDto,
  ) {
    return this.companiesService.findCompanyUsersPaginated(id, query);
  }

  @Patch(':id/primary-user')
  @Roles('OWNER')
  @Permissions('companies:update')
  @ApiOperation({ summary: 'Set the primary user for a company (Owner only)' })
  async setPrimaryUser(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetCompanyPrimaryUserDto,
  ) {
    return this.companiesService.setPrimaryUser(id, dto.user_id);
  }

  @Get(':id')
  @Roles('OWNER')
  @Permissions('companies:read')
  @ApiOperation({ summary: 'Get any company by ID (Owner only)' })
  async getCompanyById(@Param('id', ParseUUIDPipe) id: string) {
    return this.companiesService.findCompanyById(id);
  }

  @Patch(':id')
  @Roles('OWNER')
  @Permissions('companies:update')
  @ApiOperation({ summary: 'Update any company (Owner only)' })
  async updateCompany(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCompanyDto,
  ) {
    return this.companiesService.updateCompany(id, dto);
  }

  @Patch(':id/status')
  @Roles('OWNER')
  @Permissions('companies:update')
  @ApiOperation({ summary: 'Activate or deactivate a company (Owner only)' })
  async setCompanyStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCompanyStatusDto,
  ) {
    return this.companiesService.setCompanyStatus(id, dto.status);
  }

  @Delete(':id')
  @Roles('OWNER')
  @Permissions('companies:delete')
  @ApiOperation({ summary: 'Delete a company permanently (Owner only)' })
  async deleteCompany(@Param('id', ParseUUIDPipe) id: string) {
    await this.companiesService.deleteCompany(id);
    return { message: 'Company deleted successfully' };
  }
}

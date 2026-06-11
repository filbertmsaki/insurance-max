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
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@insurance-max/portal-shared/decorators/current-user.decorator';
import { Permissions } from '@insurance-max/portal-shared/decorators/permissions.decorator';
import { Roles } from '@insurance-max/portal-shared/decorators/roles.decorator';
import { PaginationDto } from '@insurance-max/portal-shared/dto/pagination.dto';
import { PermissionsGuard } from '@insurance-max/portal-shared/guards/permissions.guard';
import { RolesGuard } from '@insurance-max/portal-shared/guards/roles.guard';
import { TenantGuard } from '@insurance-max/portal-shared/guards/tenant.guard';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';
import { CreateCompanyDto } from './dtos/create-company.dto';
import { SetCompanyPrimaryUserDto } from './dtos/set-company-primary-user.dto';
import {
  UpdateCompanyDto,
  UpdateCompanyStatusDto,
} from './dtos/update-company.dto';
import { CompaniesService } from './companies.service';

@ApiTags('Companies')
@ApiBearerAuth()
@Controller('companies')
@UseGuards(AuthGuard('jwt'))
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  @Get()
  @UseGuards(RolesGuard, PermissionsGuard)
  @Roles('OWNER')
  @Permissions('companies:read')
  @ApiOperation({ summary: 'List all companies (Owner only)' })
  async listCompanies() {
    return this.companiesService.findAllCompanies();
  }

  @Post()
  @UseGuards(RolesGuard, PermissionsGuard)
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
  @UseGuards(TenantGuard)
  @ApiOperation({ summary: "Get the current user's active company profile" })
  async getMyCompany(@CurrentUser() user: AuthenticatedUser) {
    return this.companiesService.findCompanyById(user.companyId!);
  }

  @Patch('my')
  @UseGuards(TenantGuard, PermissionsGuard)
  @Permissions('update_company_data')
  @ApiOperation({ summary: "Update the current user's company profile" })
  async updateMyCompany(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateCompanyDto,
  ) {
    return this.companiesService.updateCompany(user.companyId!, dto);
  }

  @Get(':id/users')
  @UseGuards(RolesGuard, PermissionsGuard)
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
  @UseGuards(RolesGuard, PermissionsGuard)
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
  @UseGuards(RolesGuard, PermissionsGuard)
  @Roles('OWNER')
  @Permissions('companies:read')
  @ApiOperation({ summary: 'Get any company by ID (Owner only)' })
  async getCompanyById(@Param('id', ParseUUIDPipe) id: string) {
    return this.companiesService.findCompanyById(id);
  }

  @Patch(':id')
  @UseGuards(RolesGuard, PermissionsGuard)
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
  @UseGuards(RolesGuard, PermissionsGuard)
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
  @UseGuards(RolesGuard, PermissionsGuard)
  @Roles('OWNER')
  @Permissions('companies:delete')
  @ApiOperation({ summary: 'Delete a company permanently (Owner only)' })
  async deleteCompany(@Param('id', ParseUUIDPipe) id: string) {
    await this.companiesService.deleteCompany(id);
    return { message: 'Company deleted successfully' };
  }
}

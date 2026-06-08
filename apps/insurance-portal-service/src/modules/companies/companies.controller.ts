import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { CurrentUser } from '@insurance-max/portal-shared/decorators/current-user.decorator';
import { Permissions } from '@insurance-max/portal-shared/decorators/permissions.decorator';
import { Roles } from '@insurance-max/portal-shared/decorators/roles.decorator';
import { PermissionsGuard } from '@insurance-max/portal-shared/guards/permissions.guard';
import { RolesGuard } from '@insurance-max/portal-shared/guards/roles.guard';
import { TenantGuard } from '@insurance-max/portal-shared/guards/tenant.guard';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';
import { CreateCompanyDto } from './dtos/create-company.dto';
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

  // ─── Owner: list all companies ────────────────────────────────────────────────

  @Get()
  @UseGuards(RolesGuard, PermissionsGuard)
  @Roles('OWNER')
  @Permissions('companies:read')
  @ApiOperation({ summary: 'List all companies (Owner only)' })
  async listCompanies() {
    return this.companiesService.findAllCompanies();
  }

  // ─── Owner: create company ────────────────────────────────────────────────────

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

  // ─── Company-scoped: get own company ─────────────────────────────────────────
  // Declared before /:id so NestJS does not swallow 'my' as a UUID param.

  @Get('my')
  @UseGuards(TenantGuard)
  @ApiOperation({ summary: "Get the current user's active company profile" })
  async getMyCompany(@CurrentUser() user: AuthenticatedUser) {
    return this.companiesService.findCompanyById(user.companyId!);
  }

  // ─── Company-scoped: update own company ──────────────────────────────────────

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

  // ─── Owner: get any company by ID ────────────────────────────────────────────

  @Get(':id')
  @UseGuards(RolesGuard, PermissionsGuard)
  @Roles('OWNER')
  @Permissions('companies:read')
  @ApiOperation({ summary: 'Get any company by ID (Owner only)' })
  async getCompanyById(@Param('id', ParseUUIDPipe) id: string) {
    return this.companiesService.findCompanyById(id);
  }

  // ─── Owner: update any company ────────────────────────────────────────────────

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

  // ─── Owner: set company status ────────────────────────────────────────────────

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

  // ─── Owner: delete company ────────────────────────────────────────────────────

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

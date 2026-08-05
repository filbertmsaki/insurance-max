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
import { PaginationDto } from '@insurance-max/portal-shared/dto/pagination.dto';
import { DepartmentsService } from './departments.service';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { TenantScoped } from '@insurance-max/portal-shared';
import {
  UpdateDepartmentDto,
  UpdateDepartmentStatusDto,
} from './dto/update-department.dto';

@ApiTags('Departments')
@ApiBearerAuth()
@Controller('departments')
@TenantScoped()
export class DepartmentsController {
  constructor(private readonly departmentsService: DepartmentsService) {}

  @Get()
  @Permissions('departments:read')
  @ApiOperation({ summary: 'List all departments for the current company' })
  async listDepartments(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PaginationDto,
  ) {
    return this.departmentsService.findAll(user.companyId!, query);
  }

  @Post()
  @Permissions('departments:create')
  @ApiOperation({ summary: 'Create a new department' })
  async createDepartment(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateDepartmentDto,
  ) {
    return this.departmentsService.create(user.companyId!, dto, user.id);
  }

  @Get(':departmentId')
  @Permissions('departments:read')
  @ApiOperation({ summary: 'Get a department by ID' })
  async getDepartment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('departmentId', ParseUUIDPipe) departmentId: string,
  ) {
    return this.departmentsService.findOne(user.companyId!, departmentId);
  }

  @Patch(':departmentId')
  @Permissions('departments:update')
  @ApiOperation({ summary: 'Update a department' })
  async updateDepartment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('departmentId', ParseUUIDPipe) departmentId: string,
    @Body() dto: UpdateDepartmentDto,
  ) {
    return this.departmentsService.update(
      user.companyId!,
      departmentId,
      dto,
      user.id,
    );
  }

  @Patch(':departmentId/status')
  @Permissions('departments:update')
  @ApiOperation({ summary: 'Activate or deactivate a department' })
  async setDepartmentStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('departmentId', ParseUUIDPipe) departmentId: string,
    @Body() dto: UpdateDepartmentStatusDto,
  ) {
    return this.departmentsService.setStatus(
      user.companyId!,
      departmentId,
      dto,
      user.id,
    );
  }

  @Delete(':departmentId')
  @Permissions('departments:delete')
  @ApiOperation({ summary: 'Soft-delete a department' })
  async deleteDepartment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('departmentId', ParseUUIDPipe) departmentId: string,
  ) {
    await this.departmentsService.remove(user.companyId!, departmentId);
    return { message: 'Department deleted successfully' };
  }
}

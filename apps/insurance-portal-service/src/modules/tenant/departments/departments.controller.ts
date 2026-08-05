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
import { AssignDepartmentUsersDto } from './dto/assign-department-users.dto';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { SetActiveDepartmentDto } from './dto/set-active-department.dto';
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

  // ─── User assignment ─────────────────────────────────────────────────────────

  @Post(':departmentId/users')
  @Permissions('departments:manage-users')
  @ApiOperation({ summary: 'Assign one or more users to a department' })
  async assignUsers(
    @CurrentUser() user: AuthenticatedUser,
    @Param('departmentId', ParseUUIDPipe) departmentId: string,
    @Body() dto: AssignDepartmentUsersDto,
  ) {
    return this.departmentsService.assignUsers(
      user.companyId!,
      departmentId,
      dto,
      user.id,
    );
  }

  @Get(':departmentId/users')
  @Permissions('departments:read')
  @ApiOperation({ summary: 'List users assigned to a department' })
  async getDepartmentUsers(
    @CurrentUser() user: AuthenticatedUser,
    @Param('departmentId', ParseUUIDPipe) departmentId: string,
  ) {
    return this.departmentsService.getDepartmentUsers(
      user.companyId!,
      departmentId,
    );
  }

  @Delete(':departmentId/users/:companyUserId')
  @Permissions('departments:manage-users')
  @ApiOperation({ summary: 'Remove a user from a department' })
  async removeUser(
    @CurrentUser() user: AuthenticatedUser,
    @Param('departmentId', ParseUUIDPipe) departmentId: string,
    @Param('companyUserId', ParseUUIDPipe) companyUserId: string,
  ) {
    return this.departmentsService.removeUser(
      user.companyId!,
      departmentId,
      companyUserId,
    );
  }

  @Get('users/:companyUserId/departments')
  @Permissions('departments:read')
  @ApiOperation({ summary: "Get a user's department assignments" })
  async getUserDepartments(
    @CurrentUser() user: AuthenticatedUser,
    @Param('companyUserId', ParseUUIDPipe) companyUserId: string,
  ) {
    return this.departmentsService.getUserDepartments(
      user.companyId!,
      companyUserId,
    );
  }

  @Patch('users/:companyUserId/active-department')
  @Permissions('departments:manage-users')
  @ApiOperation({
    summary: "Administratively set a user's active department",
  })
  async setActiveDepartment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('companyUserId', ParseUUIDPipe) companyUserId: string,
    @Body() dto: SetActiveDepartmentDto,
  ) {
    return this.departmentsService.setActiveDepartment(
      user.companyId!,
      companyUserId,
      dto.department_id,
      user.id,
    );
  }

  @Patch('me/active-department')
  @Permissions('departments:read')
  @ApiOperation({ summary: 'Set my own active department' })
  async setMyActiveDepartment(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SetActiveDepartmentDto,
  ) {
    if (!user.companyMembershipId) {
      throw new Error('Company membership is required');
    }
    return this.departmentsService.setActiveDepartment(
      user.companyId!,
      user.companyMembershipId,
      dto.department_id,
      user.id,
    );
  }
}

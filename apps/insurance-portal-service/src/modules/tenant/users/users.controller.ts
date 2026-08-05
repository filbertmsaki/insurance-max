import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Req,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';

import { UsersService } from './users.service';
import { CreateUserDto } from './dtos/create-user.dto';
import { UpdateUserDto } from './dtos/update-user.dto';

import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';
import type { Request as ExpressRequest } from 'express';

import { Roles } from '@insurance-max/portal-shared/decorators/roles.decorator';
import { Permissions } from '@insurance-max/portal-shared/decorators/permissions.decorator';
import { TwoFaService } from '../../shared/auth/2fa/2fa.service';
import { Verify2FaDto } from '../../shared/auth/2fa/dto/verify-2fa.dto';
import { ChangePasswordDto } from './dtos/change-password.dto';
import { PaginationDto } from '@insurance-max/portal-shared/dto/pagination.dto';
import { TenantScoped } from '@insurance-max/portal-shared';
import { AuthenticatedAccess } from '@insurance-max/portal-shared/decorators/authorization.decorator';

@ApiTags('Users')
@ApiBearerAuth('access-token')
@Controller('users')
@TenantScoped()
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly twoFaService: TwoFaService,
  ) {}

  @Get('me')
  @ApiOperation({ summary: 'Get current authenticated user profile' })
  @ApiResponse({ status: 200, description: 'User profile retrieved' })
  async getMe(@Req() req: ExpressRequest & { user: AuthenticatedUser }) {
    return this.usersService.findMyProfileById(req.user.id, req.user.companyId);
  }

  @Patch('me')
  @AuthenticatedAccess()
  @ApiOperation({ summary: 'Update current authenticated user profile' })
  @ApiResponse({ status: 200, description: 'Profile updated successfully' })
  async updateMe(
    @Req() req: ExpressRequest & { user: AuthenticatedUser },
    @Body() updateUserDto: UpdateUserDto,
  ) {
    return this.usersService.update(req.user.id, updateUserDto);
  }

  @Post('me/change-password')
  @AuthenticatedAccess()
  @ApiOperation({ summary: 'Change current user password' })
  @ApiResponse({ status: 200, description: 'Password changed successfully' })
  @ApiResponse({ status: 401, description: 'Current password incorrect' })
  async changeMyPassword(
    @Req() req: ExpressRequest & { user: AuthenticatedUser },
    @Body() dto: ChangePasswordDto,
  ) {
    return this.usersService.changePassword(
      req.user.id,
      dto.old_password,
      dto.new_password,
    );
  }

  @Post()
  @Permissions('users:create')
  @ApiOperation({ summary: 'Create a new user' })
  @ApiResponse({ status: 201, description: 'User created successfully' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - insufficient permissions',
  })
  create(
    @Req() req: ExpressRequest & { user: AuthenticatedUser },
    @Body() createUserDto: CreateUserDto,
  ) {
    return this.usersService.createForCompany(
      req.user.companyId!,
      createUserDto,
    );
  }

  @Get()
  @Permissions('users:read')
  @ApiOperation({ summary: 'Get all users' })
  async findAll(
    @Req() req: ExpressRequest & { user: AuthenticatedUser },
    @Query() query: PaginationDto,
  ) {
    return this.usersService.findAllPaginatedInCompany(
      req.user.companyId!,
      query,
    );
  }

  @Get(':id')
  @Permissions('users:read')
  @ApiOperation({ summary: 'Get user by ID' })
  findOne(
    @Req() req: ExpressRequest & { user: AuthenticatedUser },
    @Param('id') id: string,
  ) {
    return this.usersService.findAdminDetailInCompany(id, req.user.companyId!);
  }

  @Patch(':id')
  @Permissions('users:update')
  @ApiOperation({ summary: 'Update user information' })
  update(
    @Req() req: ExpressRequest & { user: AuthenticatedUser },
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    return this.usersService.updateInCompany(
      req.user.companyId!,
      id,
      updateUserDto,
    );
  }

  @Delete(':id')
  @Roles('ADMINISTRATOR')
  @Permissions('users:delete')
  @ApiOperation({ summary: 'Delete a user (company administrator only)' })
  remove(
    @Req() req: ExpressRequest & { user: AuthenticatedUser },
    @Param('id') id: string,
  ) {
    return this.usersService.removeFromCompany(
      req.user.companyId!,
      id,
      req.user,
    );
  }

  @Post(':userId/roles/:roleId')
  @Roles('ADMINISTRATOR')
  @Permissions('users:assign-role')
  @ApiOperation({
    summary: 'Assign a role to a user (company administrator only)',
  })
  assignRole(
    @Req() req: ExpressRequest & { user: AuthenticatedUser },
    @Param('userId') userId: string,
    @Param('roleId') roleId: string,
  ) {
    return this.usersService.assignRoleInCompany(
      req.user.companyId!,
      userId,
      roleId,
      req.user,
    );
  }

  @Delete(':userId/roles/:roleId')
  @Roles('ADMINISTRATOR')
  @Permissions('users:revoke-role')
  @ApiOperation({
    summary: 'Revoke a role from a user (company administrator only)',
  })
  revokeRole(
    @Req() req: ExpressRequest & { user: AuthenticatedUser },
    @Param('userId') userId: string,
    @Param('roleId') roleId: string,
  ) {
    return this.usersService.revokeRoleInCompany(
      req.user.companyId!,
      userId,
      roleId,
      req.user,
    );
  }

  @Post('2fa/setup')
  @AuthenticatedAccess()
  async setup2FA(@Req() req: ExpressRequest & { user: AuthenticatedUser }) {
    return this.twoFaService.generate2FASetup(req.user.id);
  }

  @Post('2fa/verify')
  @AuthenticatedAccess()
  async verify2FA(
    @Req() req: ExpressRequest & { user: AuthenticatedUser },
    @Body() dto: Verify2FaDto,
  ) {
    return this.twoFaService.verifyAndActivate2FA(req.user.id, dto.code);
  }

  @Post('2fa/disable')
  @AuthenticatedAccess()
  async disable2FA(
    @Req() req: ExpressRequest & { user: AuthenticatedUser },
    @Body() dto: Verify2FaDto,
  ) {
    return this.twoFaService.disable2FA(req.user.id, dto.code);
  }

  @Post('2fa/backup-codes/regenerate')
  @AuthenticatedAccess()
  async regenerateBackupCodes(
    @Req() req: ExpressRequest & { user: AuthenticatedUser },
    @Body() dto: Verify2FaDto,
  ) {
    return this.twoFaService.regenerateBackupCodes(req.user.id, dto.code);
  }
}

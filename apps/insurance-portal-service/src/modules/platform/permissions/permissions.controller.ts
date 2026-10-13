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
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request as ExpressRequest } from 'express';
import { Permissions } from '@insurance-max/portal-shared/decorators/permissions.decorator';
import { Roles } from '@insurance-max/portal-shared/decorators/roles.decorator';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';
import { CreatePermissionDto } from './dtos/create-permission.dto';
import { isPagedRequest } from '@insurance-max/portal-shared/dto/table-query.dto';
import { FindPermissionsQueryDto } from './dtos/find-permissions-query.dto';
import { UpdatePermissionDto } from './dtos/update-permission.dto';
import { PermissionsService } from './permissions.service';

@ApiTags('Permissions')
@ApiBearerAuth('access-token')
@Controller('permissions')
export class PermissionsController {
  constructor(private readonly permissionsService: PermissionsService) {}

  @Post()
  @Roles('OWNER')
  @ApiOperation({ summary: 'Create a new permission' })
  @ApiResponse({ status: 201, description: 'Permission created' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - only OWNER users can create permissions',
  })
  create(
    @Req() req: ExpressRequest & { user: AuthenticatedUser },
    @Body() createPermissionDto: CreatePermissionDto,
  ) {
    return this.permissionsService.create(createPermissionDto, req.user);
  }

  @Get()
  @Permissions('permissions:read')
  @ApiOperation({ summary: 'Get permissions visible to the current actor' })
  findAll(
    @Req() req: ExpressRequest & { user: AuthenticatedUser },
    @Query() query: FindPermissionsQueryDto,
  ) {
    return isPagedRequest(query)
      ? this.permissionsService.findPage(req.user, query)
      : this.permissionsService.findAll(req.user);
  }

  @Get('categories')
  @Permissions('permissions:read')
  @ApiOperation({ summary: 'Count visible permissions per category' })
  categories(@Req() req: ExpressRequest & { user: AuthenticatedUser }) {
    return this.permissionsService.countByCategory(req.user);
  }

  @Get(':id')
  @Permissions('permissions:read')
  @ApiOperation({ summary: 'Get permission by ID' })
  findOne(
    @Req() req: ExpressRequest & { user: AuthenticatedUser },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.permissionsService.findOne(id, req.user);
  }

  @Patch(':id')
  @Roles('OWNER')
  @ApiOperation({ summary: 'Update a permission' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - only OWNER users can update permissions',
  })
  update(
    @Req() req: ExpressRequest & { user: AuthenticatedUser },
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updatePermissionDto: UpdatePermissionDto,
  ) {
    return this.permissionsService.update(id, updatePermissionDto, req.user);
  }

  @Delete(':id')
  @Roles('OWNER')
  @ApiOperation({ summary: 'Delete a permission' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - only OWNER users can delete permissions',
  })
  remove(
    @Req() req: ExpressRequest & { user: AuthenticatedUser },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.permissionsService.remove(id, req.user);
  }
}

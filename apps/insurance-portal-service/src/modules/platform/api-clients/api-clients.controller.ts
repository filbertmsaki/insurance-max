import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { CurrentUser } from '@insurance-max/portal-shared/decorators/current-user.decorator';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';
import { Roles } from '@insurance-max/portal-shared/decorators/roles.decorator';
import { RolesGuard } from '@insurance-max/portal-shared/guards/roles.guard';

import { CreateApiClientDto } from './dto/create-api-client.dto';
import { ApiClientsService } from './api-clients.service';

@ApiTags('api-clients')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller({ path: 'api-clients', version: '1' })
export class ApiClientsController {
  constructor(private readonly apiClientsService: ApiClientsService) {}

  @Post()
  @Roles('SUPER_ADMIN', 'OWNER')
  @ApiOperation({
    summary: 'Create an API client — returns secret once, store it securely',
  })
  create(
    @Body() dto: CreateApiClientDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.apiClientsService.create({
      name: dto.name,
      companyId: user.companyId,
      ownerUserId: user.id,
      scopes: dto.scopes,
      description: dto.description,
      clientType: dto.client_type,
      environment: dto.environment,
      ipWhitelist: dto.ip_whitelist,
      rateLimitPerMinute: dto.rate_limit_per_minute,
    });
  }

  @Get()
  @Roles('SUPER_ADMIN', 'OWNER')
  @ApiOperation({ summary: 'List API clients' })
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.apiClientsService.findAll(user.companyId);
  }

  @Get(':id')
  @Roles('SUPER_ADMIN', 'OWNER')
  @ApiOperation({ summary: 'Get API client details' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.apiClientsService.findById(id, user.companyId);
  }

  @Get(':id/audit')
  @Roles('SUPER_ADMIN', 'OWNER')
  @ApiOperation({ summary: 'List API client usage audit events' })
  findAudit(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.apiClientsService.listUsageEvents(id, user.companyId);
  }

  @Post(':id/rotate-secret')
  @Roles('SUPER_ADMIN', 'OWNER')
  @ApiOperation({ summary: 'Rotate API client secret' })
  rotateSecret(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.apiClientsService.rotateSecret(id, user.id, user.companyId);
  }

  @Patch(':id')
  @Roles('SUPER_ADMIN', 'OWNER')
  @ApiOperation({ summary: 'Update API client security policy' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body()
    dto: {
      scopes?: string[];
      description?: string;
      ip_whitelist?: string[];
      rate_limit_per_minute?: number | null;
      status?: string;
    },
  ) {
    return this.apiClientsService.update(id, user.companyId, dto);
  }

  @Delete(':id')
  @Roles('SUPER_ADMIN', 'OWNER')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoke an API client' })
  revoke(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: { reason?: string },
  ) {
    return this.apiClientsService.revoke(id, user.companyId, dto.reason);
  }
}

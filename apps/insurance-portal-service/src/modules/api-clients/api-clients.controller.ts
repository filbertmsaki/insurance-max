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
  @Roles('SUPER_ADMIN', 'OWNER', 'COMPANY_ADMIN', 'ADMINISTRATOR')
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
      scopes: dto.scopes,
      description: dto.description,
    });
  }

  @Get()
  @Roles('SUPER_ADMIN', 'OWNER', 'COMPANY_ADMIN', 'ADMINISTRATOR')
  @ApiOperation({ summary: 'List API clients' })
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.apiClientsService.findAll(user.companyId);
  }

  @Get(':id')
  @Roles('SUPER_ADMIN', 'OWNER', 'COMPANY_ADMIN', 'ADMINISTRATOR')
  @ApiOperation({ summary: 'Get API client details' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.apiClientsService.findById(id);
  }

  @Post(':id/rotate-secret')
  @Roles('SUPER_ADMIN', 'OWNER', 'COMPANY_ADMIN', 'ADMINISTRATOR')
  @ApiOperation({ summary: 'Rotate API client secret' })
  rotateSecret(@Param('id', ParseUUIDPipe) id: string) {
    return this.apiClientsService.rotateSecret(id);
  }

  @Delete(':id')
  @Roles('SUPER_ADMIN', 'OWNER', 'COMPANY_ADMIN', 'ADMINISTRATOR')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoke an API client' })
  revoke(@Param('id', ParseUUIDPipe) id: string) {
    return this.apiClientsService.revoke(id);
  }
}

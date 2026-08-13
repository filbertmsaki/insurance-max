import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@insurance-max/portal-shared/decorators/current-user.decorator';
import { Permissions } from '@insurance-max/portal-shared/decorators/permissions.decorator';
import { TenantScoped } from '@insurance-max/portal-shared';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';

import {
  CreateEndorsementTypeDto,
  UpdateEndorsementTypeDto,
} from '../dto/upsert-endorsement-type.dto';
import { EndorsementTypesService } from '../services/endorsement-types.service';

@ApiTags('endorsement-types')
@ApiBearerAuth()
@Controller('tenant/endorsement-types')
@TenantScoped()
export class EndorsementTypesController {
  constructor(private readonly service: EndorsementTypesService) {}

  @Get()
  @Permissions('endorsements:create')
  @ApiOperation({ summary: 'List configured endorsement types' })
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.service.findAll(user.companyId!, false);
  }

  @Post()
  @Permissions('endorsements:create')
  @ApiOperation({
    summary: 'Create a governed endorsement type (with its TIRA numeric code)',
  })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateEndorsementTypeDto,
  ) {
    return this.service.create(user.companyId!, dto);
  }

  @Patch(':id')
  @Permissions('endorsements:create')
  @ApiOperation({ summary: 'Update a governed endorsement type' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEndorsementTypeDto,
  ) {
    return this.service.update(user.companyId!, id, dto);
  }
}

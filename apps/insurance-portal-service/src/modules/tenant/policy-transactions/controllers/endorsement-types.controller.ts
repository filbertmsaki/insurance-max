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
import { FLEET_VEHICLE_ENDORSEMENT_CODES } from '../constants/fleet-vehicle-endorsement.constants';
import { EndorsementTypesService } from '../services/endorsement-types.service';

@ApiTags('endorsement-types')
@ApiBearerAuth()
@Controller('tenant/endorsement-types')
@TenantScoped()
export class EndorsementTypesController {
  constructor(private readonly service: EndorsementTypesService) {}

  @Get()
  @Permissions('endorsements:create')
  @ApiOperation({
    summary:
      'List configured endorsement types (`is_fleet_only` marks the fleet add/remove vehicle types)',
  })
  async findAll(@CurrentUser() user: AuthenticatedUser) {
    const types = await this.service.findAll(user.companyId!, false);
    return types.map((type) => ({
      ...type,
      is_fleet_only: FLEET_VEHICLE_ENDORSEMENT_CODES.includes(type.code),
    }));
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

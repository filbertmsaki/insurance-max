import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { Public } from '@insurance-max/portal-shared';

import { ReferenceListQueryDto } from './dto/reference-data.dto';
import { ReferenceDataService } from './reference-data.service';

/**
 * Read-only vehicle pick lists (makes, models, body types, colours, fuel
 * types) for the customer portal and public website, which have no staff
 * login. Only active entries are returned; these are generic reference
 * lists and hold no customer data.
 */
@Public()
@ApiTags('Public reference data')
@Throttle({ default: { limit: 120, ttl: 60_000 } })
@Controller({ path: 'public/reference-data/vehicle', version: '1' })
export class PublicVehicleReferenceController {
  constructor(private readonly service: ReferenceDataService) {}

  @Get('makes')
  @ApiOperation({ summary: 'List active vehicle makes' })
  listMakes(@Query() query: ReferenceListQueryDto) {
    return this.service.listVehicleMakes({ ...query, is_active: true });
  }

  @Get('models')
  @ApiOperation({ summary: 'List active vehicle models' })
  listModels(@Query() query: ReferenceListQueryDto & { make_id?: string }) {
    return this.service.listVehicleModels({ ...query, is_active: true });
  }

  @Get('attributes/:kind')
  @ApiOperation({
    summary: 'List active body types, colours or fuel types',
  })
  listAttributes(
    @Param('kind') kind: string,
    @Query() query: ReferenceListQueryDto,
  ) {
    return this.service.listVehicleAttributes(kind, {
      ...query,
      is_active: true,
    });
  }
}

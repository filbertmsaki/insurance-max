import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { Public } from '@insurance-max/portal-shared';

import { CustomerMarketplaceService } from '../services/customer-marketplace.service';

@Public()
@ApiTags('Public catalogue')
@Controller({ path: 'public/catalogue', version: '1' })
export class PublicCatalogueController {
  constructor(
    private readonly marketplaceService: CustomerMarketplaceService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'List active public insurance categories and products',
  })
  catalogue() {
    return this.marketplaceService.listPublicCatalogue();
  }
}

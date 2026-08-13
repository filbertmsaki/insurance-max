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
import { Roles } from '@insurance-max/portal-shared/decorators/roles.decorator';
import {
  CreateCountryDto,
  CreateCurrencyDto,
  CreateDistrictDto,
  CreateRegionDto,
  ReferenceListQueryDto,
  UpdateCountryDto,
  UpdateCurrencyDto,
  UpdateDistrictDto,
  UpdateRegionDto,
} from './dto/reference-data.dto';
import { ReferenceDataService } from './reference-data.service';

@ApiTags('Reference Data')
@ApiBearerAuth('access-token')
@Controller('reference-data')
export class ReferenceDataController {
  constructor(private readonly service: ReferenceDataService) {}

  @Get('countries')
  @ApiOperation({ summary: 'List global countries' })
  listCountries(@Query() query: ReferenceListQueryDto) {
    return this.service.listCountries(query);
  }

  @Get('countries/:id')
  getCountry(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.getCountry(id);
  }

  @Post('countries')
  @Roles('OWNER', 'SUPER_ADMIN')
  createCountry(@Body() dto: CreateCountryDto) {
    return this.service.createCountry(dto);
  }

  @Patch('countries/:id')
  @Roles('OWNER', 'SUPER_ADMIN')
  updateCountry(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCountryDto,
  ) {
    return this.service.updateCountry(id, dto);
  }

  @Get('regions')
  listRegions(@Query() query: ReferenceListQueryDto) {
    return this.service.listRegions(query);
  }

  @Get('regions/:id')
  getRegion(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.getRegion(id);
  }

  @Post('regions')
  @Roles('OWNER', 'SUPER_ADMIN')
  createRegion(@Body() dto: CreateRegionDto) {
    return this.service.createRegion(dto);
  }

  @Patch('regions/:id')
  @Roles('OWNER', 'SUPER_ADMIN')
  updateRegion(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRegionDto,
  ) {
    return this.service.updateRegion(id, dto);
  }

  @Get('districts')
  listDistricts(@Query() query: ReferenceListQueryDto) {
    return this.service.listDistricts(query);
  }

  @Get('districts/:id')
  getDistrict(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.getDistrict(id);
  }

  @Post('districts')
  @Roles('OWNER', 'SUPER_ADMIN')
  createDistrict(@Body() dto: CreateDistrictDto) {
    return this.service.createDistrict(dto);
  }

  @Patch('districts/:id')
  @Roles('OWNER', 'SUPER_ADMIN')
  updateDistrict(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDistrictDto,
  ) {
    return this.service.updateDistrict(id, dto);
  }

  @Get('currencies')
  listCurrencies(@Query() query: ReferenceListQueryDto) {
    return this.service.listCurrencies(query);
  }

  @Get('currencies/:id')
  getCurrency(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.getCurrency(id);
  }

  @Post('currencies')
  @Roles('OWNER', 'SUPER_ADMIN')
  createCurrency(@Body() dto: CreateCurrencyDto) {
    return this.service.createCurrency(dto);
  }

  @Patch('currencies/:id')
  @Roles('OWNER', 'SUPER_ADMIN')
  updateCurrency(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCurrencyDto,
  ) {
    return this.service.updateCurrency(id, dto);
  }

  @Patch(':kind/:id/activate')
  @Roles('OWNER', 'SUPER_ADMIN')
  activate(
    @Param('kind') kind: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.setActive(kind, id, true);
  }

  @Patch(':kind/:id/deactivate')
  @Roles('OWNER', 'SUPER_ADMIN')
  deactivate(
    @Param('kind') kind: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.setActive(kind, id, false);
  }

  @Delete(':kind/:id')
  @Roles('OWNER', 'SUPER_ADMIN')
  remove(@Param('kind') kind: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.remove(kind, id);
  }
}

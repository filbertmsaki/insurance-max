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
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '@insurance-max/portal-shared/decorators/roles.decorator';
import { Permissions } from '@insurance-max/portal-shared/decorators/permissions.decorator';
import { PermissionsGuard } from '@insurance-max/portal-shared/guards/permissions.guard';
import { RolesGuard } from '@insurance-max/portal-shared/guards/roles.guard';
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
@UseGuards(AuthGuard('jwt'), RolesGuard, PermissionsGuard)
export class ReferenceDataController {
  constructor(private readonly service: ReferenceDataService) {}

  @Get('countries')
  @ApiOperation({ summary: 'List global countries' })
  listCountries(@Query() query: ReferenceListQueryDto) {
    return this.service.listCountries(query);
  }

  @Get('vehicle/makes')
  listVehicleMakes(@Query() query: ReferenceListQueryDto) {
    return this.service.listVehicleMakes(query);
  }

  @Post('vehicle/seed/:kind')
  @Roles('OWNER', 'SUPER_ADMIN')
  @Permissions('reference-data:create')
  seedVehicleDefaults(@Param('kind') kind: string) {
    return this.service.seedVehicleDefaults(kind);
  }

  @Get('vehicle/models')
  listVehicleModels(
    @Query() query: ReferenceListQueryDto & { make_id?: string },
  ) {
    return this.service.listVehicleModels(query);
  }

  @Get('vehicle/attributes/:kind')
  listVehicleAttributes(
    @Param('kind') kind: string,
    @Query() query: ReferenceListQueryDto,
  ) {
    return this.service.listVehicleAttributes(kind, query);
  }

  @Post('vehicle/makes')
  @Roles('OWNER', 'SUPER_ADMIN')
  @Permissions('reference-data:create')
  createVehicleMake(
    @Body() dto: { name: string; is_active?: boolean; models?: string },
  ) {
    return this.service.createVehicleMake(dto);
  }

  @Patch('vehicle/makes/:id')
  @Roles('OWNER', 'SUPER_ADMIN')
  @Permissions('reference-data:update')
  updateVehicleMake(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: { name?: string; is_active?: boolean; models?: string },
  ) {
    return this.service.updateVehicleMake(id, dto);
  }

  @Post('vehicle/models/bulk-preview')
  @Roles('OWNER', 'SUPER_ADMIN')
  @Permissions('reference-data:create')
  previewVehicleModels(@Body() dto: { make_id: string; models: string }) {
    return this.service.previewVehicleModels(dto.make_id, dto.models);
  }

  @Post('vehicle/models/bulk-save')
  @Roles('OWNER', 'SUPER_ADMIN')
  @Permissions('reference-data:create')
  saveVehicleModels(@Body() dto: { make_id: string; models: string }) {
    return this.service.saveVehicleModels(dto.make_id, dto.models);
  }

  @Patch('vehicle/models/:id')
  @Roles('OWNER', 'SUPER_ADMIN')
  @Permissions('reference-data:update')
  updateVehicleModel(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: { name?: string; is_active?: boolean },
  ) {
    return this.service.updateVehicleModel(id, dto);
  }

  @Post('vehicle/attributes/:kind')
  @Roles('OWNER', 'SUPER_ADMIN')
  @Permissions('reference-data:create')
  createVehicleAttribute(
    @Param('kind') kind: string,
    @Body() dto: { name: string; is_active?: boolean },
  ) {
    return this.service.createVehicleAttribute(kind, dto);
  }

  @Patch('vehicle/attributes/:kind/:id')
  @Roles('OWNER', 'SUPER_ADMIN')
  @Permissions('reference-data:update')
  updateVehicleAttribute(
    @Param('kind') kind: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: { name?: string; is_active?: boolean },
  ) {
    return this.service.updateVehicleAttribute(kind, id, dto);
  }

  @Patch('vehicle/attributes/:kind/:id/status')
  @Roles('OWNER', 'SUPER_ADMIN')
  @Permissions('reference-data:update')
  setVehicleAttributeStatus(
    @Param('kind') kind: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: { is_active: boolean },
  ) {
    return this.service.setVehicleAttributeStatus(kind, id, dto.is_active);
  }

  @Patch('vehicle/makes/:id/status')
  @Roles('OWNER', 'SUPER_ADMIN')
  @Permissions('reference-data:update')
  setVehicleMakeStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: { is_active: boolean },
  ) {
    return this.service.setVehicleMakeStatus(id, dto.is_active);
  }

  @Delete('vehicle/makes/:id')
  @Roles('OWNER', 'SUPER_ADMIN')
  @Permissions('reference-data:delete')
  deleteVehicleMake(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.deleteVehicleMake(id);
  }

  @Delete('vehicle/models/:id')
  @Roles('OWNER', 'SUPER_ADMIN')
  @Permissions('reference-data:delete')
  deleteVehicleModel(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.deleteVehicleModel(id);
  }

  @Delete('vehicle/attributes/:kind/:id')
  @Roles('OWNER', 'SUPER_ADMIN')
  @Permissions('reference-data:delete')
  deleteVehicleAttribute(
    @Param('kind') kind: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.deleteVehicleAttribute(kind, id);
  }

  @Get('countries/:id')
  getCountry(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.getCountry(id);
  }

  @Post('countries')
  @Roles('OWNER', 'SUPER_ADMIN')
  @Permissions('reference-data:create')
  createCountry(@Body() dto: CreateCountryDto) {
    return this.service.createCountry(dto);
  }

  @Patch('countries/:id')
  @Roles('OWNER', 'SUPER_ADMIN')
  @Permissions('reference-data:update')
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
  @Permissions('reference-data:create')
  createRegion(@Body() dto: CreateRegionDto) {
    return this.service.createRegion(dto);
  }

  @Patch('regions/:id')
  @Roles('OWNER', 'SUPER_ADMIN')
  @Permissions('reference-data:update')
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
  @Permissions('reference-data:create')
  createDistrict(@Body() dto: CreateDistrictDto) {
    return this.service.createDistrict(dto);
  }

  @Patch('districts/:id')
  @Roles('OWNER', 'SUPER_ADMIN')
  @Permissions('reference-data:update')
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
  @Permissions('reference-data:create')
  createCurrency(@Body() dto: CreateCurrencyDto) {
    return this.service.createCurrency(dto);
  }

  @Patch('currencies/:id')
  @Roles('OWNER', 'SUPER_ADMIN')
  @Permissions('reference-data:update')
  updateCurrency(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCurrencyDto,
  ) {
    return this.service.updateCurrency(id, dto);
  }

  @Patch(':kind/:id/activate')
  @Roles('OWNER', 'SUPER_ADMIN')
  @Permissions('reference-data:update')
  activate(
    @Param('kind') kind: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.setActive(kind, id, true);
  }

  @Patch(':kind/:id/deactivate')
  @Roles('OWNER', 'SUPER_ADMIN')
  @Permissions('reference-data:update')
  deactivate(
    @Param('kind') kind: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.setActive(kind, id, false);
  }

  @Delete(':kind/:id')
  @Roles('OWNER', 'SUPER_ADMIN')
  @Permissions('reference-data:delete')
  remove(@Param('kind') kind: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.remove(kind, id);
  }
}

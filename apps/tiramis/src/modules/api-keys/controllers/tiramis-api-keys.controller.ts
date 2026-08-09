import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';

import { ServiceScopes } from '@insurance-max/shared-kernel';

import { CreateTiramisApiKeyDto } from '../dto/create-tiramis-api-key.dto';
import { UpdateTiramisApiKeyDto } from '../dto/update-tiramis-api-key.dto';
import { TiramisApiKeyService } from '../services/tiramis-api-key.service';

@ApiTags('TIRAMIS API keys')
@ApiSecurity('api-key')
@Controller('tiramis/api-keys')
@ServiceScopes('tiramis:admin')
export class TiramisApiKeysController {
  constructor(private readonly apiKeyService: TiramisApiKeyService) {}

  @Post()
  @ApiOperation({ summary: 'Generate a TIRAMIS service API key' })
  create(@Body() dto: CreateTiramisApiKeyDto) {
    return this.apiKeyService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List TIRAMIS service API keys' })
  findAll() {
    return this.apiKeyService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'View one TIRAMIS service API key' })
  findById(@Param('id', ParseUUIDPipe) id: string) {
    return this.apiKeyService.findById(id);
  }

  @Get(':id/audit')
  @ApiOperation({ summary: 'List TIRAMIS service API key audit events' })
  listAudit(@Param('id', ParseUUIDPipe) id: string) {
    return this.apiKeyService.listAudit(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update TIRAMIS service API key metadata' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTiramisApiKeyDto,
  ) {
    return this.apiKeyService.update(id, dto);
  }

  @Post(':id/activate')
  activate(@Param('id', ParseUUIDPipe) id: string) {
    return this.apiKeyService.activate(id);
  }

  @Post(':id/disable')
  disable(@Param('id', ParseUUIDPipe) id: string) {
    return this.apiKeyService.disable(id);
  }

  @Post(':id/rotate')
  rotate(@Param('id', ParseUUIDPipe) id: string) {
    return this.apiKeyService.rotate(id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  revoke(@Param('id', ParseUUIDPipe) id: string) {
    return this.apiKeyService.revoke(id);
  }
}

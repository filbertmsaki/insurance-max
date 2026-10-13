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
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { PublicServiceEndpoint } from '@insurance-max/shared-kernel';

import { CreateTiramisApiKeyDto } from '../dto/create-tiramis-api-key.dto';
import { UpdateTiramisApiKeyDto } from '../dto/update-tiramis-api-key.dto';
import { TiramisApiKeyService } from '../services/tiramis-api-key.service';
import { TiramisAdministratorGuard } from '../guards/tiramis-administrator.guard';

@ApiTags('TIRAMIS API keys')
@ApiBearerAuth()
@Controller('tiramis/api-keys')
@PublicServiceEndpoint()
@UseGuards(TiramisAdministratorGuard)
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

  @Post('systems/:serviceName/rotate')
  @ApiOperation({ summary: 'Atomically rotate the active key for a system' })
  rotateSystem(
    @Param('serviceName') serviceName: string,
    @Body() dto?: UpdateTiramisApiKeyDto,
  ) {
    return this.apiKeyService.rotateSystem(
      serviceName,
      dto?.scopes,
      dto?.allowedIps,
    );
  }

  @Post(':id/rotate')
  rotate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto?: UpdateTiramisApiKeyDto,
  ) {
    return this.apiKeyService.rotate(id, dto?.scopes, dto?.allowedIps);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  revoke(@Param('id', ParseUUIDPipe) id: string) {
    return this.apiKeyService.revoke(id);
  }
}

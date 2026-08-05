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
  UseGuards,
} from '@nestjs/common';

import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { AuthGuard } from '@nestjs/passport';

import { DevicesService } from './devices.service';
import { TwoFaService } from '../auth/2fa/2fa.service';

import { Verify2FaDto } from '../auth/2fa/dto/verify-2fa.dto';

import { CurrentUser } from '@insurance-max/portal-shared/decorators/current-user.decorator';

import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';

@ApiTags('devices')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard('jwt'))
@Controller({ path: 'devices', version: '1' })
export class DevicesController {
  constructor(
    private readonly devicesService: DevicesService,

    private readonly twoFaService: TwoFaService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List my registered devices' })
  findMyDevices(@CurrentUser() user: AuthenticatedUser) {
    return this.devicesService.findUserDevices(user.id);
  }

  @Patch(':id/trust')
  @ApiOperation({ summary: 'Trust a device after 2FA reconfirmation' })
  async trustDevice(
    @Param('id', ParseUUIDPipe) id: string,

    @Body() dto: Verify2FaDto,

    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.twoFaService.verify2FALogin(user.id, dto.code);

    return this.devicesService.trustDevice(id, user.id);
  }

  @Patch(':id/untrust')
  @ApiOperation({ summary: 'Remove trusted status from a device' })
  untrustDevice(
    @Param('id', ParseUUIDPipe) id: string,

    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.devicesService.untrustDevice(id, user.id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a device and revoke its sessions' })
  remove(
    @Param('id', ParseUUIDPipe) id: string,

    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.devicesService.removeDevice(id, user.id);
  }
}

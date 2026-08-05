import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';

import {
  CompanyVerificationDto,
  CoverNoteVerificationDto,
  MotorVerificationDto,
  NinVerificationDto,
} from '../dto/create-verification.dto';
import { TiramisVerificationService } from '../services/tiramis-verification.service';

import { ServiceScopes } from '@insurance-max/shared-kernel';

import { TiramisTenantContextGuard } from '../../../common/guards/tiramis-tenant-context.guard';

@ApiTags('Tiramis Verifications')
@ApiConsumes('application/json')
@Controller('tiramis/verifications')
@UseGuards(TiramisTenantContextGuard)
export class TiramisVerificationsController {
  constructor(
    private readonly tiramisVerificationService: TiramisVerificationService,
  ) {}

  @ApiOperation({ summary: 'Verify a cover note reference' })
  @ApiBody({ type: CoverNoteVerificationDto })
  @ServiceScopes('tiramis:verify')
  @Post('cover-note')
  verifyCoverNote(@Body() dto: CoverNoteVerificationDto) {
    return this.tiramisVerificationService.verifyCoverNote(dto);
  }

  @ApiOperation({ summary: 'Verify a NIN' })
  @ApiBody({ type: NinVerificationDto })
  @ServiceScopes('tiramis:verify')
  @Post('nin')
  verifyNin(@Body() dto: NinVerificationDto) {
    return this.tiramisVerificationService.verifyNin(dto);
  }

  @ApiOperation({ summary: 'Verify a company registration' })
  @ApiBody({ type: CompanyVerificationDto })
  @ServiceScopes('tiramis:verify')
  @Post('company')
  verifyCompany(@Body() dto: CompanyVerificationDto) {
    return this.tiramisVerificationService.verifyCompany(dto);
  }

  @ApiOperation({ summary: 'Verify motor registration or chassis details' })
  @ApiBody({ type: MotorVerificationDto })
  @ServiceScopes('tiramis:verify')
  @Post('motor')
  verifyMotor(@Body() dto: MotorVerificationDto) {
    return this.tiramisVerificationService.verifyMotor(dto);
  }

  @ServiceScopes('tiramis:read')
  @Get('request/:requestId')
  findByRequestId(@Param('requestId') requestId: string) {
    return this.tiramisVerificationService.findByRequestId(requestId);
  }
}

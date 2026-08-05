import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';

import {
  CompanyVerificationDto,
  CoverNoteVerificationDto,
  MotorVerificationDto,
  NinVerificationDto,
} from '../dto/create-verification.dto';
import { TiramisVerificationService } from '../services/tiramis-verification.service';

import { ServiceScopes } from '@insurance-max/shared-kernel';

@ApiTags('Tiramis Verifications')
@ApiConsumes('application/json')
@Controller('tiramis/verifications')
@ServiceScopes('tiramis:invoke')
export class TiramisVerificationsController {
  constructor(
    private readonly tiramisVerificationService: TiramisVerificationService,
  ) {}

  @ApiOperation({ summary: 'Verify a cover note reference' })
  @ApiBody({ type: CoverNoteVerificationDto })
  @Post('cover-note')
  verifyCoverNote(@Body() dto: CoverNoteVerificationDto) {
    return this.tiramisVerificationService.verifyCoverNote(dto);
  }

  @ApiOperation({ summary: 'Verify a NIN' })
  @ApiBody({ type: NinVerificationDto })
  @Post('nin')
  verifyNin(@Body() dto: NinVerificationDto) {
    return this.tiramisVerificationService.verifyNin(dto);
  }

  @ApiOperation({ summary: 'Verify a company registration' })
  @ApiBody({ type: CompanyVerificationDto })
  @Post('company')
  verifyCompany(@Body() dto: CompanyVerificationDto) {
    return this.tiramisVerificationService.verifyCompany(dto);
  }

  @ApiOperation({ summary: 'Verify motor registration or chassis details' })
  @ApiBody({ type: MotorVerificationDto })
  @Post('motor')
  verifyMotor(@Body() dto: MotorVerificationDto) {
    return this.tiramisVerificationService.verifyMotor(dto);
  }

  @Get('request/:requestId')
  findByRequestId(@Param('requestId') requestId: string) {
    return this.tiramisVerificationService.findByRequestId(requestId);
  }
}

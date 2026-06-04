import { Body, Controller, Get, Param, Post } from '@nestjs/common';

import type {
  CompanyVerificationDto,
  CoverNoteVerificationDto,
  DetailsVerificationDto,
  MotorVerificationDto,
  NinVerificationDto,
} from '../dto/create-verification.dto';
import { TiramisVerificationService } from '../services/tiramis-verification.service';

@Controller('tiramis/verifications')
export class TiramisVerificationsController {
  constructor(
    private readonly tiramisVerificationService: TiramisVerificationService,
  ) {}

  @Post('cover-note')
  verifyCoverNote(@Body() dto: CoverNoteVerificationDto) {
    return this.tiramisVerificationService.verifyCoverNote(dto);
  }

  @Post('nin')
  verifyNin(@Body() dto: NinVerificationDto) {
    return this.tiramisVerificationService.verifyNin(dto);
  }

  @Post('company')
  verifyCompany(@Body() dto: CompanyVerificationDto) {
    return this.tiramisVerificationService.verifyCompany(dto);
  }

  @Post('motor')
  verifyMotor(@Body() dto: MotorVerificationDto) {
    return this.tiramisVerificationService.verifyMotor(dto);
  }

  @Post('details')
  verifyDetails(@Body() dto: DetailsVerificationDto) {
    return this.tiramisVerificationService.verifyDetails(dto);
  }

  @Get('request/:requestId')
  findByRequestId(@Param('requestId') requestId: string) {
    return this.tiramisVerificationService.findByRequestId(requestId);
  }
}

import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';

import type {
  CompanyVerificationDto,
  CoverNoteVerificationDto,
  DetailsVerificationDto,
  MotorVerificationDto,
  NinVerificationDto,
} from '../dto/create-verification.dto';
import { TiramisVerificationService } from '../services/tiramis-verification.service';
import {
  companyVerificationRequestBody,
  coverNoteVerificationRequestBody,
  detailsVerificationRequestBody,
  motorVerificationRequestBody,
  ninVerificationRequestBody,
} from '../swagger/create-verification.swagger';

@ApiTags('Tiramis Verifications')
@ApiConsumes('application/json')
@Controller('tiramis/verifications')
export class TiramisVerificationsController {
  constructor(
    private readonly tiramisVerificationService: TiramisVerificationService,
  ) {}

  @ApiOperation({ summary: 'Verify a cover note reference' })
  @ApiBody(coverNoteVerificationRequestBody)
  @Post('cover-note')
  verifyCoverNote(@Body() dto: CoverNoteVerificationDto) {
    return this.tiramisVerificationService.verifyCoverNote(dto);
  }

  @ApiOperation({ summary: 'Verify a NIN' })
  @ApiBody(ninVerificationRequestBody)
  @Post('nin')
  verifyNin(@Body() dto: NinVerificationDto) {
    return this.tiramisVerificationService.verifyNin(dto);
  }

  @ApiOperation({ summary: 'Verify a company registration' })
  @ApiBody(companyVerificationRequestBody)
  @Post('company')
  verifyCompany(@Body() dto: CompanyVerificationDto) {
    return this.tiramisVerificationService.verifyCompany(dto);
  }

  @ApiOperation({ summary: 'Verify motor registration or chassis details' })
  @ApiBody(motorVerificationRequestBody)
  @Post('motor')
  verifyMotor(@Body() dto: MotorVerificationDto) {
    return this.tiramisVerificationService.verifyMotor(dto);
  }

  @ApiOperation({ summary: 'Verify combined motor and cover note details' })
  @ApiBody(detailsVerificationRequestBody)
  @Post('details')
  verifyDetails(@Body() dto: DetailsVerificationDto) {
    return this.tiramisVerificationService.verifyDetails(dto);
  }

  @Get('request/:requestId')
  findByRequestId(@Param('requestId') requestId: string) {
    return this.tiramisVerificationService.findByRequestId(requestId);
  }
}

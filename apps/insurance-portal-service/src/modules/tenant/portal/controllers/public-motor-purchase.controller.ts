import { Body, Controller, Get, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { Public } from '@insurance-max/portal-shared';

import {
  PublicMotorQuoteDto,
  PublicMotorSubmitDto,
  PublicMotorVerifyDto,
} from '../dto/public-motor-purchase.dto';
import { PublicMotorPurchaseService } from '../services/public-motor-purchase.service';

@Public()
@ApiTags('Public motor purchase')
@Controller({ path: 'public/motor-purchase', version: '1' })
export class PublicMotorPurchaseController {
  constructor(private readonly service: PublicMotorPurchaseService) {}

  @Get('options')
  @ApiOperation({
    summary: 'List public motor purchase insurers, products, and covers',
  })
  options() {
    return this.service.options();
  }

  @Post('verify')
  @Throttle({ default: { limit: 8, ttl: 60_000 } })
  @ApiOperation({
    summary:
      'Check active cover and retrieve vehicle details for public motor purchase',
  })
  verify(@Body() dto: PublicMotorVerifyDto) {
    return this.service.verify(dto);
  }

  @Post('quote')
  @Throttle({ default: { limit: 12, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Calculate a public motor insurance quote',
  })
  quote(@Body() dto: PublicMotorQuoteDto) {
    return this.service.quote(dto);
  }

  @Post('submit')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Submit a public motor insurance purchase to TIRAMIS',
  })
  submit(@Body() dto: PublicMotorSubmitDto) {
    return this.service.submit(dto);
  }
}

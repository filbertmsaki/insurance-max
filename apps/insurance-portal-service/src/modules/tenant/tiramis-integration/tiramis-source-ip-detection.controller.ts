import {
  BadRequestException,
  Body,
  Controller,
  Post,
  Req,
} from '@nestjs/common';
import { IsString, Matches } from 'class-validator';
import { createHash } from 'node:crypto';
import type { Request } from 'express';

import { ServiceEndpoint } from '@insurance-max/portal-shared';
import { RedisService } from '../../shared/redis/redis.service';

class SourceIpProbeDto {
  @IsString()
  @Matches(/^[a-f0-9]{64}$/)
  challengeToken!: string;
}

/** One-time source-IP observation used only while bootstrapping the TIRAMIS allowlist. */
@ServiceEndpoint()
@Controller('webhooks/tiramis')
export class TiramisSourceIpDetectionController {
  constructor(private readonly redis: RedisService) {}

  @Post('source-ip-detection')
  async detectSourceIp(@Body() dto: SourceIpProbeDto, @Req() request: Request) {
    const tokenHash = createHash('sha256')
      .update(dto.challengeToken, 'utf8')
      .digest('hex');
    const key = `tiramis:connection-ip-probe:${tokenHash}`;
    const environment = await this.redis.getAndDelete(key);
    if (!environment) {
      throw new BadRequestException('Source-IP probe is invalid or expired.');
    }
    if (!request.ip) {
      throw new BadRequestException(
        'Could not determine the request source IP.',
      );
    }
    return { success: true, environment, observedIp: request.ip };
  }
}

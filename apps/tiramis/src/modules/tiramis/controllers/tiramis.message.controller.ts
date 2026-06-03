import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';

import { TIRAMIS_PATTERNS } from '@insurance-max/contracts';

import { TiramisService } from '../services/tiramis.service';

@Controller()
export class TiramisMessageController {
  constructor(private readonly tiramisService: TiramisService) {}

  @MessagePattern(TIRAMIS_PATTERNS.ping)
  ping(@Payload() payload: Record<string, unknown>) {
    return this.tiramisService.ping(payload);
  }

  @MessagePattern(TIRAMIS_PATTERNS.status)
  getStatus() {
    return this.tiramisService.getStatus();
  }
}

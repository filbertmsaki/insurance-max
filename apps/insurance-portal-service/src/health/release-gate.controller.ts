import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { Permissions } from '@insurance-max/portal-shared';

import { ReleaseGateService } from './release-gate.service';

@ApiTags('Operations')
@ApiBearerAuth('access-token')
@Controller({ path: 'operations', version: '1' })
export class ReleaseGateController {
  constructor(private readonly releaseGateService: ReleaseGateService) {}

  @Get('release-gate')
  @Permissions('operations:release-read')
  getReleaseGate() {
    return this.releaseGateService.getGate();
  }
}

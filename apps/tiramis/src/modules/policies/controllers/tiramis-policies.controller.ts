import { Body, Controller, Get, Param, Post } from '@nestjs/common';

import type { CreatePolicyDto } from '../dto/create-policy.dto';
import { TiramisPolicyService } from '../services/tiramis-policy.service';

@Controller('tiramis/policies')
export class TiramisPoliciesController {
  constructor(private readonly tiramisPolicyService: TiramisPolicyService) {}

  @Post('draft')
  createDraft(@Body() dto: CreatePolicyDto) {
    return this.tiramisPolicyService.createDraft(dto);
  }

  @Post('submit')
  submit(@Body() dto: CreatePolicyDto) {
    return this.tiramisPolicyService.submit(dto);
  }

  @Get(':id')
  findById(@Param('id') id: string) {
    return this.tiramisPolicyService.findById(id);
  }

  @Get('request/:requestId')
  findByRequestId(@Param('requestId') requestId: string) {
    return this.tiramisPolicyService.findByRequestId(requestId);
  }

  @Get('policy-number/:policyNumber')
  findByPolicyNumber(@Param('policyNumber') policyNumber: string) {
    return this.tiramisPolicyService.findByPolicyNumber(policyNumber);
  }

  @Get('cover-note/:coverNoteReferenceNumber')
  findByCoverNoteReferenceNumber(
    @Param('coverNoteReferenceNumber') coverNoteReferenceNumber: string,
  ) {
    return this.tiramisPolicyService.findByCoverNoteReferenceNumber(
      coverNoteReferenceNumber,
    );
  }
}

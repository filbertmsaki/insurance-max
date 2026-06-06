import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';

import type { CreatePolicyDto } from '../dto/create-policy.dto';
import { createPolicyRequestBody } from '../swagger/create-policy.swagger';
import { TiramisPolicyService } from '../services/tiramis-policy.service';

@ApiTags('Tiramis Policies')
@ApiConsumes('application/json')
@Controller('tiramis/policies')
export class TiramisPoliciesController {
  constructor(private readonly tiramisPolicyService: TiramisPolicyService) {}

  @ApiOperation({ summary: 'Create a policy draft' })
  @ApiBody(createPolicyRequestBody)
  @Post('draft')
  createDraft(@Body() dto: CreatePolicyDto) {
    return this.tiramisPolicyService.createDraft(dto);
  }

  @ApiOperation({ summary: 'Submit a policy' })
  @ApiBody(createPolicyRequestBody)
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

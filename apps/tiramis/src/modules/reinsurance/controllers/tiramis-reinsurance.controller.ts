import { Body, Controller, Get, Param, Post } from '@nestjs/common';

import type { CreateReinsuranceDto } from '../dto/create-reinsurance.dto';
import { TiramisReinsuranceService } from '../services/tiramis-reinsurance.service';

@Controller('tiramis/reinsurance')
export class TiramisReinsuranceController {
  constructor(
    private readonly tiramisReinsuranceService: TiramisReinsuranceService,
  ) {}

  @Post('draft')
  createDraft(@Body() dto: CreateReinsuranceDto) {
    return this.tiramisReinsuranceService.createDraft(dto);
  }

  @Post('submit')
  submit(@Body() dto: CreateReinsuranceDto) {
    return this.tiramisReinsuranceService.submit(dto);
  }

  @Get(':id')
  findById(@Param('id') id: string) {
    return this.tiramisReinsuranceService.findById(id);
  }

  @Get('request/:requestId')
  findByRequestId(@Param('requestId') requestId: string) {
    return this.tiramisReinsuranceService.findByRequestId(requestId);
  }

  @Get('cover-note/:coverNoteReferenceNumber')
  findByCoverNoteReferenceNumber(
    @Param('coverNoteReferenceNumber') coverNoteReferenceNumber: string,
  ) {
    return this.tiramisReinsuranceService.findByCoverNoteReferenceNumber(
      coverNoteReferenceNumber,
    );
  }
}

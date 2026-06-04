import { Body, Controller, Get, Param, Post } from '@nestjs/common';

import type { CreateCoverNoteDto } from '../dto/create-cover-note.dto';
import { TiramisCoverNoteService } from '../services/tiramis-cover-note.service';

@Controller('tiramis/cover-notes')
export class TiramisCoverNotesController {
  constructor(
    private readonly tiramisCoverNoteService: TiramisCoverNoteService,
  ) {}

  @Post('draft')
  createDraft(@Body() dto: CreateCoverNoteDto) {
    return this.tiramisCoverNoteService.createDraft(dto);
  }

  @Post('submit')
  submit(@Body() dto: CreateCoverNoteDto) {
    return this.tiramisCoverNoteService.submit(dto);
  }

  @Get(':id')
  findById(@Param('id') id: string) {
    return this.tiramisCoverNoteService.findById(id);
  }

  @Get('request/:requestId')
  findByRequestId(@Param('requestId') requestId: string) {
    return this.tiramisCoverNoteService.findByRequestId(requestId);
  }
}

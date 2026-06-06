import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';

import type { CreateCoverNoteDto } from '../dto/create-cover-note.dto';
import { TiramisCoverNoteService } from '../services/tiramis-cover-note.service';
import { createCoverNoteRequestBody } from '../swagger/create-cover-note.swagger';

@ApiTags('Tiramis Cover Notes')
@ApiConsumes('application/json')
@Controller('tiramis/cover-notes')
export class TiramisCoverNotesController {
  constructor(
    private readonly tiramisCoverNoteService: TiramisCoverNoteService,
  ) {}

  @ApiOperation({ summary: 'Create a cover note draft' })
  @ApiBody(createCoverNoteRequestBody)
  @Post('draft')
  createDraft(@Body() dto: CreateCoverNoteDto) {
    return this.tiramisCoverNoteService.createDraft(dto);
  }

  @ApiOperation({ summary: 'Submit a cover note' })
  @ApiBody(createCoverNoteRequestBody)
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

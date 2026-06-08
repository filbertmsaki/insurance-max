import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CreateCoverNoteDto } from '../dto/create-cover-note.dto';
import { TiramisCoverNoteService } from '../services/tiramis-cover-note.service';

@ApiTags('Tiramis Non-Motor Cover Notes')
@ApiConsumes('application/json')
@Controller('tiramis/non-motor/cover-notes')
export class TiramisCoverNotesController {
  constructor(
    private readonly tiramisCoverNoteService: TiramisCoverNoteService,
  ) {}

  @ApiOperation({ summary: 'Create a non-motor cover note draft' })
  @ApiBody({ type: CreateCoverNoteDto })
  @Post('draft')
  createDraft(@Body() dto: CreateCoverNoteDto) {
    return this.tiramisCoverNoteService.createDraft(dto);
  }

  @ApiOperation({ summary: 'Submit a non-motor cover note' })
  @ApiBody({ type: CreateCoverNoteDto })
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

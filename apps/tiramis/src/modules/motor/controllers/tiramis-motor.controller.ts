import { Body, Controller, Get, Param, Post } from '@nestjs/common';

import type { CreateMotorCoverNoteDto } from '../dto/create-motor-cover-note.dto';
import { TiramisMotorService } from '../services/tiramis-motor.service';

@Controller('tiramis/motor')
export class TiramisMotorController {
  constructor(private readonly tiramisMotorService: TiramisMotorService) {}

  @Post('draft')
  createDraft(@Body() dto: CreateMotorCoverNoteDto) {
    return this.tiramisMotorService.createDraft(dto);
  }

  @Post('submit')
  submit(@Body() dto: CreateMotorCoverNoteDto) {
    return this.tiramisMotorService.submit(dto);
  }

  @Get('cover-note/:coverNoteId/fleet')
  findFleetByCoverNoteId(@Param('coverNoteId') coverNoteId: string) {
    return this.tiramisMotorService.findFleetByCoverNoteId(coverNoteId);
  }

  @Get('cover-note/:coverNoteId/details')
  findMotorDetailsByCoverNoteId(@Param('coverNoteId') coverNoteId: string) {
    return this.tiramisMotorService.findMotorDetailsByCoverNoteId(coverNoteId);
  }
}

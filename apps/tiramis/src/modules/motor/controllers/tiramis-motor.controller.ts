import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CreateMotorCoverNoteDto } from '../dto/create-motor-cover-note.dto';
import { TiramisMotorService } from '../services/tiramis-motor.service';

@ApiTags('Tiramis Motor Cover Notes')
@ApiConsumes('application/json')
@Controller('tiramis/motor')
export class TiramisMotorController {
  constructor(private readonly tiramisMotorService: TiramisMotorService) {}

  @ApiOperation({ summary: 'Create a motor cover note draft' })
  @ApiBody({ type: CreateMotorCoverNoteDto })
  @Post('draft')
  createDraft(@Body() dto: CreateMotorCoverNoteDto) {
    return this.tiramisMotorService.createDraft(dto);
  }

  @ApiOperation({ summary: 'Submit a motor cover note' })
  @ApiBody({ type: CreateMotorCoverNoteDto })
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

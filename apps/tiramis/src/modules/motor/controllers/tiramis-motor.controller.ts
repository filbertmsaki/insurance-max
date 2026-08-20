import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';

import { ServiceScopes } from '@insurance-max/shared-kernel';

import { TiramisProductContextGuard } from '../../../common/guards/tiramis-product-context.guard';
import { TiramisPricingContextGuard } from '../../../common/guards/tiramis-pricing-context.guard';
import { TiramisInsuredDataContextGuard } from '../../../common/guards/tiramis-insured-data-context.guard';
import { TiramisFinanceContextGuard } from '../../../common/guards/tiramis-finance-context.guard';
import { TiramisQuotationGateGuard } from '../../../common/guards/tiramis-quotation-gate.guard';
import { CreateMotorCoverNoteDto } from '../dto/create-motor-cover-note.dto';
import { TiramisMotorService } from '../services/tiramis-motor.service';

@ApiTags('Tiramis Motor Cover Notes')
@ApiConsumes('application/json')
@Controller('tiramis/motor')
export class TiramisMotorController {
  constructor(private readonly tiramisMotorService: TiramisMotorService) {}

  @ApiOperation({ summary: 'Create a motor cover note draft' })
  @ApiBody({ type: CreateMotorCoverNoteDto })
  @ServiceScopes('tiramis:prepare')
  @Post('draft')
  createDraft(@Body() dto: CreateMotorCoverNoteDto) {
    return this.tiramisMotorService.createDraft(dto);
  }

  @ApiOperation({
    summary: 'Preview generated Motor XML without sending to TIRA',
  })
  @ApiBody({ type: CreateMotorCoverNoteDto })
  @ApiQuery({
    name: 'signed',
    required: false,
    example: 'true',
    description:
      'Set to false to preview XML without generating MsgSignature. Default is true.',
  })
  @ServiceScopes('tiramis:prepare')
  @Post('preview/xml')
  previewXml(
    @Body() dto: CreateMotorCoverNoteDto,
    @Query('signed') signed?: string,
  ) {
    return this.tiramisMotorService.previewXml(dto, signed !== 'false');
  }

  @ApiOperation({ summary: 'Submit a motor cover note' })
  @ApiBody({ type: CreateMotorCoverNoteDto })
  @ServiceScopes('tiramis:submit')
  @UseGuards(
    TiramisProductContextGuard,
    TiramisPricingContextGuard,
    TiramisInsuredDataContextGuard,
    TiramisQuotationGateGuard,
    TiramisFinanceContextGuard,
  )
  @Post('submit')
  submit(@Body() dto: CreateMotorCoverNoteDto) {
    return this.tiramisMotorService.submit(dto);
  }

  @ApiOperation({ summary: 'List motor cover notes submitted to TIRA' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 50 })
  @ServiceScopes('tiramis:read')
  @Get('cover-notes')
  listSubmittedCoverNotes(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.tiramisMotorService.listSubmittedCoverNotes(page, limit);
  }

  @ServiceScopes('tiramis:read')
  @ApiOperation({
    summary: 'Get the complete motor fleet submission snapshot',
  })
  @Get('cover-note/:coverNoteId/fleet')
  findFleetByCoverNoteId(@Param('coverNoteId') coverNoteId: string) {
    return this.tiramisMotorService.findFleetByCoverNoteId(coverNoteId);
  }

  @ServiceScopes('tiramis:read')
  @ApiOperation({
    summary: 'Get the complete motor cover-note submission snapshot',
  })
  @Get('cover-note/:coverNoteId/details')
  findMotorDetailsByCoverNoteId(@Param('coverNoteId') coverNoteId: string) {
    return this.tiramisMotorService.findMotorDetailsByCoverNoteId(coverNoteId);
  }
}

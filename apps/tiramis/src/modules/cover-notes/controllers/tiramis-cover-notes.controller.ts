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
  @ServiceScopes('tiramis:prepare')
  @Post('draft')
  createDraft(@Body() dto: CreateCoverNoteDto) {
    return this.tiramisCoverNoteService.createDraft(dto);
  }

  @ApiOperation({
    summary: 'Preview generated Non-Motor XML without sending to TIRA',
  })
  @ApiBody({ type: CreateCoverNoteDto })
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
    @Body() dto: CreateCoverNoteDto,
    @Query('signed') signed?: string,
  ) {
    return this.tiramisCoverNoteService.previewXml(dto, signed !== 'false');
  }

  @ApiOperation({ summary: 'Submit a non-motor cover note' })
  @ApiBody({ type: CreateCoverNoteDto })
  @ServiceScopes('tiramis:submit')
  @UseGuards(
    TiramisProductContextGuard,
    TiramisPricingContextGuard,
    TiramisInsuredDataContextGuard,
    TiramisQuotationGateGuard,
    TiramisFinanceContextGuard,
  )
  @Post('submit')
  submit(@Body() dto: CreateCoverNoteDto) {
    return this.tiramisCoverNoteService.submit(dto);
  }

  @ApiOperation({ summary: 'List non-motor cover notes submitted to TIRA' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 50 })
  @ServiceScopes('tiramis:read')
  @Get()
  listSubmittedCoverNotes(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.tiramisCoverNoteService.listSubmittedCoverNotes(page, limit);
  }

  @ServiceScopes('tiramis:read')
  @Get(':id')
  findById(@Param('id') id: string) {
    return this.tiramisCoverNoteService.findById(id);
  }

  @ServiceScopes('tiramis:read')
  @Get('request/:requestId')
  findByRequestId(@Param('requestId') requestId: string) {
    return this.tiramisCoverNoteService.findByRequestId(requestId);
  }
}

import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import {
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';

import { ServiceScopes } from '@insurance-max/shared-kernel';

import { CreateReinsuranceDto } from '../dto/create-reinsurance.dto';
import { TiramisReinsuranceService } from '../services/tiramis-reinsurance.service';

@ApiTags('Tiramis Reinsurance')
@ApiConsumes('application/json')
@Controller('tiramis/reinsurance')
@ServiceScopes('tiramis:invoke')
export class TiramisReinsuranceController {
  constructor(
    private readonly tiramisReinsuranceService: TiramisReinsuranceService,
  ) {}

  @ApiOperation({ summary: 'Create a reinsurance draft' })
  @ApiBody({ type: CreateReinsuranceDto })
  @Post('draft')
  createDraft(@Body() dto: CreateReinsuranceDto) {
    return this.tiramisReinsuranceService.createDraft(dto);
  }

  @ApiOperation({
    summary: 'Preview generated Reinsurance XML without sending to TIRA',
  })
  @ApiBody({ type: CreateReinsuranceDto })
  @ApiQuery({
    name: 'signed',
    required: false,
    example: 'false',
    description:
      'Set to false to preview XML without MsgSignature. Default is true.',
  })
  @Post('preview/xml')
  previewXml(
    @Body() dto: CreateReinsuranceDto,
    @Query('signed') signed?: string,
  ) {
    return this.tiramisReinsuranceService.previewXml(dto, signed !== 'false');
  }

  @ApiOperation({ summary: 'Submit reinsurance to TIRA' })
  @ApiBody({ type: CreateReinsuranceDto })
  @Post('submit')
  submit(@Body() dto: CreateReinsuranceDto) {
    return this.tiramisReinsuranceService.submit(dto);
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

  @Get(':id')
  findById(@Param('id') id: string) {
    return this.tiramisReinsuranceService.findById(id);
  }
}

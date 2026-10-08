import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';

import { ServiceScopes } from '@insurance-max/shared-kernel';

import { parseSourceMetadata } from '../../submissions/utils/parse-source-metadata';
import { CreateReinsuranceDto } from '../dto/create-reinsurance.dto';
import { TiramisReinsuranceService } from '../services/tiramis-reinsurance.service';

@ApiTags('Tiramis Reinsurance')
@ApiConsumes('application/json')
@Controller('tiramis/reinsurance')
export class TiramisReinsuranceController {
  constructor(
    private readonly tiramisReinsuranceService: TiramisReinsuranceService,
  ) {}

  @ApiOperation({ summary: 'Create a reinsurance draft' })
  @ApiBody({ type: CreateReinsuranceDto })
  @ServiceScopes('tiramis:prepare')
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
  @ServiceScopes('tiramis:prepare')
  @Post('preview/xml')
  previewXml(
    @Body() dto: CreateReinsuranceDto,
    @Query('signed') signed?: string,
  ) {
    return this.tiramisReinsuranceService.previewXml(dto, signed !== 'false');
  }

  @ApiOperation({ summary: 'Submit reinsurance to TIRA' })
  @ApiBody({ type: CreateReinsuranceDto })
  @ServiceScopes('tiramis:submit')
  @Post('submit')
  submit(
    @Body() dto: CreateReinsuranceDto,
    @Headers('x-tiramis-source-metadata') sourceMetadata?: string,
  ) {
    return this.tiramisReinsuranceService.submit(
      dto,
      parseSourceMetadata(sourceMetadata),
    );
  }

  @ServiceScopes('tiramis:read')
  @Get('request/:requestId')
  findByRequestId(@Param('requestId') requestId: string) {
    return this.tiramisReinsuranceService.findByRequestId(requestId);
  }

  @ServiceScopes('tiramis:read')
  @Get('cover-note/:coverNoteReferenceNumber')
  findByCoverNoteReferenceNumber(
    @Param('coverNoteReferenceNumber') coverNoteReferenceNumber: string,
  ) {
    return this.tiramisReinsuranceService.findByCoverNoteReferenceNumber(
      coverNoteReferenceNumber,
    );
  }

  @ServiceScopes('tiramis:read')
  @Get(':id')
  findById(@Param('id', ParseUUIDPipe) id: string) {
    return this.tiramisReinsuranceService.findById(id);
  }
}

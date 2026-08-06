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

import { TiramisTenantContextGuard } from '../../../common/guards/tiramis-tenant-context.guard';
import { TiramisProductContextGuard } from '../../../common/guards/tiramis-product-context.guard';
import { TiramisPricingContextGuard } from '../../../common/guards/tiramis-pricing-context.guard';
import { CreateMotorCoverNoteDto } from '../dto/create-motor-cover-note.dto';
import { TiramisMotorService } from '../services/tiramis-motor.service';

@ApiTags('Tiramis Motor Cover Notes')
@ApiConsumes('application/json')
@Controller('tiramis/motor')
@UseGuards(TiramisTenantContextGuard)
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
  @UseGuards(TiramisProductContextGuard, TiramisPricingContextGuard)
  @Post('submit')
  submit(@Body() dto: CreateMotorCoverNoteDto) {
    return this.tiramisMotorService.submit(dto);
  }

  @ServiceScopes('tiramis:read')
  @Get('cover-note/:coverNoteId/fleet')
  findFleetByCoverNoteId(@Param('coverNoteId') coverNoteId: string) {
    return this.tiramisMotorService.findFleetByCoverNoteId(coverNoteId);
  }

  @ServiceScopes('tiramis:read')
  @Get('cover-note/:coverNoteId/details')
  findMotorDetailsByCoverNoteId(@Param('coverNoteId') coverNoteId: string) {
    return this.tiramisMotorService.findMotorDetailsByCoverNoteId(coverNoteId);
  }
}

import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import {
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';

import { CreateDischargeVoucherDto } from '../dto/create-discharge-voucher.dto';
import { TiramisDischargeVoucherService } from '../services/tiramis-discharge-voucher.service';

@ApiTags('Tiramis Discharge Vouchers')
@ApiConsumes('application/json')
@Controller('tiramis/claims/discharge-voucher')
export class TiramisDischargeVoucherController {
  constructor(
    private readonly dischargeVoucherService: TiramisDischargeVoucherService,
  ) {}

  @ApiOperation({ summary: 'Create Discharge Voucher draft' })
  @ApiBody({ type: CreateDischargeVoucherDto })
  @Post('draft')
  createDischargeVoucherDraft(@Body() dto: CreateDischargeVoucherDto) {
    return this.dischargeVoucherService.createDischargeVoucherDraft(dto);
  }

  @ApiOperation({
    summary: 'Preview generated Discharge Voucher XML without sending to TIRA',
  })
  @ApiBody({ type: CreateDischargeVoucherDto })
  @ApiQuery({
    name: 'signed',
    required: false,
    example: 'false',
    description:
      'Set to false to preview XML without MsgSignature. Default is true.',
  })
  @Post('preview/xml')
  previewDischargeVoucherXml(
    @Body() dto: CreateDischargeVoucherDto,
    @Query('signed') signed?: string,
  ) {
    return this.dischargeVoucherService.previewDischargeVoucherXml(
      dto,
      signed !== 'false',
    );
  }

  @ApiOperation({ summary: 'Submit Discharge Voucher to TIRA' })
  @ApiBody({ type: CreateDischargeVoucherDto })
  @Post('submit')
  submitDischargeVoucher(@Body() dto: CreateDischargeVoucherDto) {
    return this.dischargeVoucherService.submitDischargeVoucher(dto);
  }

  @Get('request/:requestId')
  findByRequestId(@Param('requestId') requestId: string) {
    return this.dischargeVoucherService.findByRequestId(requestId);
  }

  @Get(':dischargeVoucherNumber')
  findByDischargeVoucherNumber(
    @Param('dischargeVoucherNumber') dischargeVoucherNumber: string,
  ) {
    return this.dischargeVoucherService.findByDischargeVoucherNumber(
      dischargeVoucherNumber,
    );
  }

  @Get('id/:id')
  findById(@Param('id') id: string) {
    return this.dischargeVoucherService.findById(id);
  }
}

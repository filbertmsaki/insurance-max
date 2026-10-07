import {
  Body,
  Controller,
  Get,
  Headers,
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
import { parseSourceMetadata } from '../../submissions/utils/parse-source-metadata';
import { CreatePolicyDto } from '../dto/create-policy.dto';
import { TiramisPolicyService } from '../services/tiramis-policy.service';

@ApiTags('Tiramis Policies')
@ApiConsumes('application/json')
@Controller('tiramis/policies')
export class TiramisPoliciesController {
  constructor(private readonly tiramisPolicyService: TiramisPolicyService) {}

  @ApiOperation({ summary: 'Create a policy draft' })
  @ApiBody({ type: CreatePolicyDto })
  @ServiceScopes('tiramis:prepare')
  @Post('draft')
  createDraft(@Body() dto: CreatePolicyDto) {
    return this.tiramisPolicyService.createDraft(dto);
  }

  @ApiOperation({
    summary: 'Preview generated Policy XML without sending to TIRA',
  })
  @ApiBody({ type: CreatePolicyDto })
  @ApiQuery({
    name: 'signed',
    required: false,
    example: 'false',
    description:
      'Set to false to preview XML without MsgSignature. Default is true.',
  })
  @ServiceScopes('tiramis:prepare')
  @Post('preview/xml')
  previewXml(@Body() dto: CreatePolicyDto, @Query('signed') signed?: string) {
    return this.tiramisPolicyService.previewXml(dto, signed !== 'false');
  }

  @ApiOperation({ summary: 'Submit policy data to TIRA' })
  @ApiBody({ type: CreatePolicyDto })
  @ServiceScopes('tiramis:submit')
  @UseGuards(
    TiramisProductContextGuard,
    TiramisPricingContextGuard,
    TiramisInsuredDataContextGuard,
    TiramisQuotationGateGuard,
    TiramisFinanceContextGuard,
  )
  @Post('submit')
  submit(
    @Body() dto: CreatePolicyDto,
    @Headers('x-tiramis-source-metadata') sourceMetadata?: string,
  ) {
    return this.tiramisPolicyService.submit(
      dto,
      parseSourceMetadata(sourceMetadata),
    );
  }

  @ServiceScopes('tiramis:read')
  @Get('request/:requestId')
  findByRequestId(@Param('requestId') requestId: string) {
    return this.tiramisPolicyService.findByRequestId(requestId);
  }

  @ServiceScopes('tiramis:read')
  @Get('number/:policyNumber')
  findByPolicyNumber(@Param('policyNumber') policyNumber: string) {
    return this.tiramisPolicyService.findByPolicyNumber(policyNumber);
  }

  @ServiceScopes('tiramis:read')
  @Get(':id')
  findById(@Param('id') id: string) {
    return this.tiramisPolicyService.findById(id);
  }
}

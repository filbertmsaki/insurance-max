import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';

import { TiramisSubmissionStatusQueryDto } from '../dto/tiramis-submission-status-query.dto';
import { TiramisSubmissionService } from '../services/tiramis-submission.service';

@ApiTags('TIRAMIS Submissions')
@Controller('tiramis/submissions')
export class TiramisSubmissionsController {
  constructor(
    private readonly tiramisSubmissionService: TiramisSubmissionService,
  ) {}

  @ApiOperation({
    summary:
      'Get current TIRAMIS submission status by transactionId, requestId, or businessReference',
  })
  @ApiQuery({ name: 'transactionId', required: false })
  @ApiQuery({ name: 'requestId', required: false })
  @ApiQuery({ name: 'businessReference', required: false })
  @ApiQuery({
    name: 'includePayload',
    required: false,
    example: 'false',
    description:
      'Set to true only for internal debugging because it exposes XML payloads',
  })
  @Get('status')
  getStatus(@Query() query: TiramisSubmissionStatusQueryDto) {
    return this.tiramisSubmissionService.getSubmissionStatus({
      transactionId: query.transactionId,
      requestId: query.requestId,
      businessReference: query.businessReference,
      includePayload: query.includePayload === 'true',
    });
  }

  @ApiOperation({
    summary:
      'Get full TIRAMIS submission timeline with attempts and events by transactionId, requestId, or businessReference',
  })
  @ApiQuery({ name: 'transactionId', required: false })
  @ApiQuery({ name: 'requestId', required: false })
  @ApiQuery({ name: 'businessReference', required: false })
  @ApiQuery({
    name: 'includePayload',
    required: false,
    example: 'false',
    description:
      'Set to true only for internal debugging because it exposes XML payloads',
  })
  @Get('trace')
  getTrace(@Query() query: TiramisSubmissionStatusQueryDto) {
    return this.tiramisSubmissionService.getSubmissionTrace({
      transactionId: query.transactionId,
      requestId: query.requestId,
      businessReference: query.businessReference,
      includePayload: query.includePayload === 'true',
    });
  }
}

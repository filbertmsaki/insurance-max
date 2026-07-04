import { ApiPropertyOptional } from '@nestjs/swagger';

export class TiramisSubmissionStatusQueryDto {
  @ApiPropertyOptional({
    example: 'b7f67c88-0b8a-4a94-a12f-6f2a0d62a222',
    description: 'TIRAMIS transaction ID',
  })
  transactionId?: string;

  @ApiPropertyOptional({
    example: 'AIC202607040001',
    description: 'TIRAMIS RequestId',
  })
  requestId?: string;

  @ApiPropertyOptional({
    example: 'AIC-CN-000001',
    description:
      'Business reference, usually cover note number, fleet id, policy number, or source record reference',
  })
  businessReference?: string;

  @ApiPropertyOptional({
    example: 'false',
    description:
      'Set to true only for debugging. When false, raw XML payloads are hidden.',
  })
  includePayload?: string;
}

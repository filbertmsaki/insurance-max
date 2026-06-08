import { PartialType } from '@nestjs/swagger';
import { CreateRiskRatingRuleDto } from './create-risk-rating-rule.dto';

export class UpdateRiskRatingRuleDto extends PartialType(
  CreateRiskRatingRuleDto,
) {}

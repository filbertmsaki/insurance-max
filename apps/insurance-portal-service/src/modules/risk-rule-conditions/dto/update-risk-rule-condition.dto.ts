import { PartialType } from '@nestjs/swagger';
import { CreateRiskRuleConditionDto } from './create-risk-rule-condition.dto';

export class UpdateRiskRuleConditionDto extends PartialType(
  CreateRiskRuleConditionDto,
) {}

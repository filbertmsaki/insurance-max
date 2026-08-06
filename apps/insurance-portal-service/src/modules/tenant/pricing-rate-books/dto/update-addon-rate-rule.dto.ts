import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateAddonRateRuleDto } from './create-addon-rate-rule.dto';

export class UpdateAddonRateRuleDto extends PartialType(
  OmitType(CreateAddonRateRuleDto, ['addon_definition_id'] as const),
) {}

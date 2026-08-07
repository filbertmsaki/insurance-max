import { BadRequestException, Injectable } from '@nestjs/common';

import { DecimalUtil } from '../../../shared/finance/decimal.util';
import { RegulatoryLevyRule } from '../entities/regulatory-levy-rule.entity';

@Injectable()
export class RegulatoryLevyCalculationService {
  calculate(rule: RegulatoryLevyRule, basisAmount: string | number) {
    const basisValue = DecimalUtil.value(basisAmount);
    let amount = DecimalUtil.value(0);

    switch (rule.rate_type) {
      case 'PERCENTAGE':
        amount = basisValue.mul(DecimalUtil.value(rule.rate_value)).div(100);
        break;
      case 'FIXED':
        amount = DecimalUtil.value(rule.rate_value);
        break;
      default:
        throw new BadRequestException('Unsupported levy rate type.');
    }

    if (rule.minimum_amount !== null) {
      amount = amount.greaterThan(rule.minimum_amount)
        ? amount
        : DecimalUtil.value(rule.minimum_amount);
    }

    if (rule.maximum_amount !== null) {
      amount = amount.lessThan(rule.maximum_amount)
        ? amount
        : DecimalUtil.value(rule.maximum_amount);
    }

    return amount.toFixed(4);
  }
}

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';
import { DateTime } from 'luxon';
import { Repository } from 'typeorm';

import { DecimalUtil } from '../../../shared/finance/decimal.util';
import { PremiumLevyReturnLine } from '../entities/premium-levy-return-line.entity';
import { PremiumLevyReturn } from '../entities/premium-levy-return.entity';
import { RegulatoryReturn } from '../entities/regulatory-return.entity';
import {
  PremiumLevyLineType,
  PremiumLevyReturnStatus,
  RegulatoryReturnStatus,
} from '../enums/regulatory.enums';
import { PremiumLedgerService } from './premium-ledger.service';

@Injectable()
export class PremiumLevyReturnService {
  constructor(
    @InjectRepository(RegulatoryReturn)
    private readonly returnRepository: Repository<RegulatoryReturn>,
    @InjectRepository(PremiumLevyReturn)
    private readonly levyRepository: Repository<PremiumLevyReturn>,
    @InjectRepository(PremiumLevyReturnLine)
    private readonly lineRepository: Repository<PremiumLevyReturnLine>,
    private readonly premiumLedgerService: PremiumLedgerService,
    private readonly configService: ConfigService,
  ) {}

  async calculate(
    user: AuthenticatedUser,
    regulatoryReturnId: string,
    dto: { levy_rate?: string | number },
  ) {
    const regulatoryReturn = await this.returnRepository.findOne({
      where: {
        id: regulatoryReturnId,
        company_id: user.companyId!,
      },
    });

    if (!regulatoryReturn) {
      throw new NotFoundException('Regulatory return was not found');
    }

    if (
      regulatoryReturn.status === RegulatoryReturnStatus.SUBMITTED ||
      regulatoryReturn.status === RegulatoryReturnStatus.ACCEPTED
    ) {
      throw new BadRequestException('Submitted returns cannot be recalculated');
    }

    const summary = await this.premiumLedgerService.summarizeGrossPremium(
      user.companyId!,
      regulatoryReturn.period_start,
      regulatoryReturn.period_end,
      regulatoryReturn.currency,
    );

    const levyRate = DecimalUtil.rate(
      dto.levy_rate ??
        this.configService.get<string>('PREMIUM_LEVY_DEFAULT_RATE') ??
        '1.5',
    );
    const adjustments = await this.sumAdjustments(regulatoryReturnId);
    const levyAmount = DecimalUtil.money(
      DecimalUtil.value(summary.gross_premium)
        .plus(DecimalUtil.value(adjustments))
        .mul(DecimalUtil.value(levyRate))
        .div(100),
    );

    let levyReturn = await this.levyRepository.findOne({
      where: {
        company_id: user.companyId!,
        regulatory_return_id: regulatoryReturn.id,
      },
    });

    if (!levyReturn) {
      levyReturn = this.levyRepository.create({
        company_id: user.companyId!,
        regulatory_return_id: regulatoryReturn.id,
        levy_no: `LEVY-${DateTime.utc().toFormat('yyyyLLddHHmmss')}-${user.companyId!.slice(0, 6).toUpperCase()}`,
        status: PremiumLevyReturnStatus.CALCULATED,
        period_start: regulatoryReturn.period_start,
        period_end: regulatoryReturn.period_end,
        currency: regulatoryReturn.currency,
        prepared_by: user.id,
      });
    }

    levyReturn.levy_rate = levyRate;
    levyReturn.gross_premium = summary.gross_premium;
    levyReturn.adjustments_amount = adjustments;
    levyReturn.levy_amount = levyAmount;
    levyReturn.billed_amount = levyAmount;
    levyReturn.status = PremiumLevyReturnStatus.CALCULATED;

    regulatoryReturn.status = RegulatoryReturnStatus.CALCULATED;
    regulatoryReturn.prepared_by = user.id;

    await this.returnRepository.save(regulatoryReturn);
    return this.levyRepository.save(levyReturn);
  }

  async addAdjustment(
    user: AuthenticatedUser,
    regulatoryReturnId: string,
    dto: {
      amount: string | number;
      description: string;
      evidence_reference?: string;
    },
  ) {
    if (!dto.description?.trim()) {
      throw new BadRequestException('Adjustment reason is required');
    }

    const requireEvidence =
      String(
        this.configService.get<string>(
          'PREMIUM_LEVY_REQUIRE_ADJUSTMENT_EVIDENCE',
        ) ?? 'true',
      ) === 'true';

    if (requireEvidence && !dto.evidence_reference?.trim()) {
      throw new BadRequestException(
        'Adjustment evidence is required by configuration',
      );
    }

    const levyReturn = await this.levyRepository.findOne({
      where: {
        regulatory_return_id: regulatoryReturnId,
        company_id: user.companyId!,
      },
    });

    if (!levyReturn) {
      throw new NotFoundException('Premium levy return was not found');
    }

    return this.lineRepository.save(
      this.lineRepository.create({
        levy_return_id: levyReturn.id,
        line_type: PremiumLevyLineType.ADJUSTMENT,
        description: dto.description.trim(),
        amount: DecimalUtil.money(dto.amount),
        evidence_reference: dto.evidence_reference?.trim() ?? null,
      }),
    );
  }

  private async sumAdjustments(regulatoryReturnId: string) {
    const levyReturn = await this.levyRepository.findOne({
      where: { regulatory_return_id: regulatoryReturnId },
    });

    if (!levyReturn) {
      return '0.00';
    }

    const rows = await this.lineRepository
      .createQueryBuilder('line')
      .select('COALESCE(SUM(line.amount), 0)', 'amount')
      .where('line.levy_return_id = :levyReturnId', {
        levyReturnId: levyReturn.id,
      })
      .andWhere('line.line_type = :lineType', {
        lineType: PremiumLevyLineType.ADJUSTMENT,
      })
      .getRawOne<{ amount: string }>();

    return DecimalUtil.money(rows?.amount ?? 0);
  }
}

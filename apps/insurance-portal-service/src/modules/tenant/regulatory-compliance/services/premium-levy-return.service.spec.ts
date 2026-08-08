import { BadRequestException } from '@nestjs/common';
import {
  LevyAssessmentStatus,
  RegulatoryObligationStatus,
  RegulatoryReconciliationStatus,
} from '@insurance-max/contracts';

import {
  PremiumLevyLineType,
  PremiumLevyReturnStatus,
  RegulatoryReturnStatus,
} from '../enums/regulatory.enums';
import { PremiumLevyReturnService } from './premium-levy-return.service';

function makeQueryBuilder(amount: string) {
  const qb: any = {};
  ['select', 'where', 'andWhere'].forEach((method) => {
    qb[method] = jest.fn().mockReturnValue(qb);
  });
  qb.getRawOne = jest.fn().mockResolvedValue({ amount });
  return qb;
}

function makeRepository<T extends Record<string, any>>() {
  return {
    create: jest.fn((value: Partial<T>) => value),
    save: jest.fn(async (value: T) => value),
    find: jest.fn(),
    findOne: jest.fn(),
    createQueryBuilder: jest.fn().mockReturnValue(makeQueryBuilder('0.00')),
  };
}

function makeService() {
  const returnRepository = makeRepository();
  const instanceRepository = makeRepository();
  const authorityRepository = makeRepository();
  const levyRuleRepository = makeRepository();
  const assessmentRepository = makeRepository();
  const levyRepository = makeRepository();
  const lineRepository = makeRepository();
  const premiumLedgerService = {
    summarizeGrossPremium: jest
      .fn()
      .mockResolvedValue({ gross_premium: '100000.00' }),
  };
  const regulatoryLedgerService = {
    recordLevyAssessmentApproval: jest.fn().mockResolvedValue([]),
  };
  const regulatoryLevyCalculationService = {
    calculate: jest.fn().mockReturnValue('1507.5000'),
  };
  const configService = {
    get: jest.fn((key: string) => {
      if (key === 'PREMIUM_LEVY_DEFAULT_RATE') {
        return '1.5';
      }
      if (key === 'PREMIUM_LEVY_REQUIRE_ADJUSTMENT_EVIDENCE') {
        return 'true';
      }
      return undefined;
    }),
  };

  const service = new PremiumLevyReturnService(
    returnRepository as any,
    instanceRepository as any,
    authorityRepository as any,
    levyRuleRepository as any,
    assessmentRepository as any,
    levyRepository as any,
    lineRepository as any,
    premiumLedgerService as any,
    regulatoryLedgerService as any,
    regulatoryLevyCalculationService,
    configService as any,
  );

  return {
    service,
    returnRepository,
    instanceRepository,
    authorityRepository,
    levyRuleRepository,
    assessmentRepository,
    levyRepository,
    lineRepository,
    premiumLedgerService,
    regulatoryLedgerService,
    regulatoryLevyCalculationService,
  };
}

describe('PremiumLevyReturnService', () => {
  const user = { id: 'maker-1', companyId: 'company-1' } as any;
  const regulatoryReturn = {
    id: 'return-1',
    company_id: 'company-1',
    obligation_instance_id: 'instance-1',
    status: RegulatoryReturnStatus.DRAFT,
    period_start: '2026-01-01',
    period_end: '2026-01-31',
    currency: 'TZS',
    currency_code: 'TZS',
    report_definition_code: 'PREMIUM_LEVY',
    report_job_id: 'job-1',
    data: {},
  };

  it('calculates a levy return and upserts the canonical assessment', async () => {
    const {
      service,
      returnRepository,
      authorityRepository,
      levyRuleRepository,
      levyRepository,
      assessmentRepository,
      instanceRepository,
      lineRepository,
    } = makeService();
    returnRepository.findOne.mockResolvedValue({ ...regulatoryReturn });
    authorityRepository.findOne.mockResolvedValue({ id: 'authority-1' });
    levyRuleRepository.findOne.mockResolvedValue(null);
    levyRuleRepository.save.mockImplementation(async (value: any) => ({
      id: 'rule-1',
      ...value,
    }));
    levyRepository.findOne.mockResolvedValueOnce({
      id: 'levy-return-1',
    });
    lineRepository.createQueryBuilder.mockReturnValue(
      makeQueryBuilder('500.00'),
    );
    assessmentRepository.findOne.mockResolvedValue(null);
    assessmentRepository.save.mockImplementation(async (value: any) => ({
      id: 'assessment-1',
      ...value,
    }));
    instanceRepository.findOne.mockResolvedValue({
      id: 'instance-1',
      company_id: 'company-1',
    });

    const result = await service.calculate(user, 'return-1', {});

    expect(result.regulatory_return.status).toBe(
      RegulatoryReturnStatus.CALCULATED,
    );
    expect(result.regulatory_return.data.premium_levy).toEqual(
      expect.objectContaining({
        gross_premium: '100000.00',
        adjustments_amount: '500.00',
        levy_rate: '1.5000000000',
        levy_amount: '1507.50',
      }),
    );
    expect(assessmentRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        basis_amount: '100500.00',
        assessed_amount: '1507.50',
        status: LevyAssessmentStatus.CALCULATED,
      }),
    );
    expect(instanceRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        status: RegulatoryObligationStatus.PREPARATION_IN_PROGRESS,
        active_levy_assessment_id: 'assessment-1',
      }),
    );
  });

  it('requires adjustment evidence when configured', async () => {
    const { service, levyRepository } = makeService();
    levyRepository.findOne.mockResolvedValue({
      id: 'levy-return-1',
      company_id: 'company-1',
      regulatory_return_id: 'return-1',
      status: PremiumLevyReturnStatus.CALCULATED,
    });

    await expect(
      service.addAdjustment(user, 'return-1', {
        amount: '50.00',
        description: 'Manual correction',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('prevents the preparer from approving their own levy assessment', async () => {
    const { service, assessmentRepository } = makeService();
    assessmentRepository.findOne.mockResolvedValue({
      id: 'assessment-1',
      company_id: 'company-1',
      prepared_by: user.id,
      status: LevyAssessmentStatus.PENDING_APPROVAL,
    });

    await expect(
      service.approveAssessment(user, 'assessment-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('approves assessments with ledger posting and obligation status sync', async () => {
    const {
      service,
      assessmentRepository,
      returnRepository,
      authorityRepository,
      instanceRepository,
      regulatoryLedgerService,
    } = makeService();
    assessmentRepository.findOne.mockResolvedValue({
      id: 'assessment-1',
      company_id: 'company-1',
      obligation_instance_id: 'instance-1',
      assessment_no: 'ASM-1',
      prepared_by: 'maker-1',
      status: LevyAssessmentStatus.PENDING_APPROVAL,
      assessed_amount: '1500.00',
      paid_amount: '0.00',
      period_start: '2026-01-01',
      period_end: '2026-01-31',
      currency_code: 'TZS',
    });
    assessmentRepository.save.mockImplementation(async (value: any) => value);
    returnRepository.findOne.mockResolvedValue({
      id: 'return-1',
      company_id: 'company-1',
      obligation_instance_id: 'instance-1',
    });
    authorityRepository.findOne.mockResolvedValue({ id: 'authority-1' });
    instanceRepository.findOne.mockResolvedValue({
      id: 'instance-1',
      company_id: 'company-1',
    });

    const approved = await service.approveAssessment(
      { id: 'checker-1', companyId: 'company-1' } as any,
      'assessment-1',
    );

    expect(approved.status).toBe(LevyAssessmentStatus.PAYMENT_PENDING);
    expect(approved.approved_by).toBe('checker-1');
    expect(
      regulatoryLedgerService.recordLevyAssessmentApproval,
    ).toHaveBeenCalled();
    expect(instanceRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        status: RegulatoryObligationStatus.APPROVED,
        active_levy_assessment_id: 'assessment-1',
      }),
    );
  });

  it('reconciles partially paid assessments as out of balance', async () => {
    const { service, assessmentRepository } = makeService();
    assessmentRepository.findOne.mockResolvedValue({
      id: 'assessment-1',
      company_id: 'company-1',
      assessed_amount: '1500.00',
      paid_amount: '500.00',
    });
    assessmentRepository.save.mockImplementation(async (value: any) => value);

    const result = await service.reconcileAssessment(
      'company-1',
      'assessment-1',
    );

    expect(result.outstanding_amount).toBe('1000.00');
    expect(result.reconciliation_status).toBe(
      RegulatoryReconciliationStatus.OUT_OF_BALANCE,
    );
    expect(result.status).toBe(LevyAssessmentStatus.PARTIALLY_PAID);
  });

  it('persists adjustment lines with required evidence', async () => {
    const { service, levyRepository, lineRepository } = makeService();
    levyRepository.findOne.mockResolvedValue({
      id: 'levy-return-1',
      company_id: 'company-1',
      regulatory_return_id: 'return-1',
    });

    await service.addAdjustment(user, 'return-1', {
      amount: '-25.00',
      description: 'Correction',
      evidence_reference: 'DOC-1',
    });

    expect(lineRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        levy_return_id: 'levy-return-1',
        line_type: PremiumLevyLineType.ADJUSTMENT,
        description: 'Correction',
        amount: '-25.00',
        evidence_reference: 'DOC-1',
      }),
    );
  });
});

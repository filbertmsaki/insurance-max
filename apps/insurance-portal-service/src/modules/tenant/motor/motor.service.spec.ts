import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { MotorService } from './motor.service';
import { MotorVehicle } from './entities/motor-vehicle.entity';
import { MotorFleet } from './entities/motor-fleet.entity';
import { MotorFleetItem } from './entities/motor-fleet-item.entity';
import { MotorFleetMembership } from './entities/motor-fleet-membership.entity';
import { MotorPolicyDetail } from './entities/motor-policy-detail.entity';
import { MotorVehicleAuditLog } from './entities/motor-vehicle-audit-log.entity';
import { MotorVehicleOwnership } from './entities/motor-vehicle-ownership.entity';
import { MotorVehicleVersion } from './entities/motor-vehicle-version.entity';
import { TiraVehicleMapperService } from './services/tira-vehicle-mapper.service';
import { IdentifierGeneratorService } from '../../shared/identifiers/identifier-generator.service';
import { Company } from '../../platform/companies/entities/company.entity';
import { Customer } from '../customers/entities/customer.entity';
import { InsuredAsset } from '../customers/entities/insured-asset.entity';
import { Quotation } from '../quotations/entities/quotation.entity';
import { QuotationEntryRisk } from '../quotations/entities/structured/quotation-entry-risk.entity';
import { Policy } from '../policies/entities/policy.entity';
import { PolicyRisk } from '../policies/entities/policy-risk.entity';
import { User } from '../users/entities/user.entity';

function mockRepo() {
  return {
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn((v) => v),
    save: jest.fn((v) => v),
    softDelete: jest.fn(),
    restore: jest.fn(),
    delete: jest.fn(),
    createQueryBuilder: jest.fn(),
  };
}

describe('MotorService â€” tenant isolation on policy details', () => {
  let service: MotorService;
  let motorVehicleRepo: ReturnType<typeof mockRepo>;
  let policyRepo: ReturnType<typeof mockRepo>;
  let policyRiskRepo: ReturnType<typeof mockRepo>;
  let motorPolicyDetailRepo: ReturnType<typeof mockRepo>;

  const companyId = 'company-1';
  const otherCompanyId = 'company-2';

  beforeEach(async () => {
    motorVehicleRepo = mockRepo();
    policyRepo = mockRepo();
    policyRiskRepo = mockRepo();
    motorPolicyDetailRepo = mockRepo();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MotorService,
        { provide: DataSource, useValue: { transaction: jest.fn() } },
        {
          provide: getRepositoryToken(MotorVehicle),
          useValue: motorVehicleRepo,
        },
        { provide: getRepositoryToken(MotorFleet), useValue: mockRepo() },
        { provide: getRepositoryToken(MotorFleetItem), useValue: mockRepo() },
        {
          provide: getRepositoryToken(MotorFleetMembership),
          useValue: mockRepo(),
        },
        {
          provide: getRepositoryToken(MotorPolicyDetail),
          useValue: motorPolicyDetailRepo,
        },
        {
          provide: getRepositoryToken(MotorVehicleOwnership),
          useValue: mockRepo(),
        },
        {
          provide: getRepositoryToken(MotorVehicleVersion),
          useValue: mockRepo(),
        },
        {
          provide: getRepositoryToken(MotorVehicleAuditLog),
          useValue: mockRepo(),
        },
        { provide: getRepositoryToken(Company), useValue: mockRepo() },
        { provide: getRepositoryToken(Customer), useValue: mockRepo() },
        { provide: getRepositoryToken(InsuredAsset), useValue: mockRepo() },
        { provide: getRepositoryToken(Quotation), useValue: mockRepo() },
        {
          provide: getRepositoryToken(QuotationEntryRisk),
          useValue: mockRepo(),
        },
        { provide: getRepositoryToken(Policy), useValue: policyRepo },
        { provide: getRepositoryToken(PolicyRisk), useValue: policyRiskRepo },
        { provide: getRepositoryToken(User), useValue: mockRepo() },
        {
          provide: IdentifierGeneratorService,
          useValue: { generateMotorPolicyDetailNumber: jest.fn() },
        },
        {
          provide: TiraVehicleMapperService,
          useValue: { mapVehicle: jest.fn(() => ({})) },
        },
      ],
    }).compile();

    service = module.get(MotorService);
  });

  it('rejects createPolicyDetail when the policy belongs to another company', async () => {
    motorVehicleRepo.findOne.mockResolvedValue({
      id: 'vehicle-1',
      company_id: companyId,
    });
    // Policy lookup is scoped by company_id in the query itself, so a cross-tenant
    // policy id resolves to no row â€” this must produce a BadRequestException, not a save.
    policyRepo.findOne.mockResolvedValue(null);

    await expect(
      service.createPolicyDetail(companyId, {
        policy_id: 'policy-owned-by-' + otherCompanyId,
        motor_vehicle_id: 'vehicle-1',
      } as any),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(motorPolicyDetailRepo.save).not.toHaveBeenCalled();
  });

  it('allows createPolicyDetail when the policy belongs to the caller company', async () => {
    motorVehicleRepo.findOne.mockResolvedValue({
      id: 'vehicle-1',
      company_id: companyId,
    });
    policyRepo.findOne.mockResolvedValue({
      id: 'policy-1',
      company_id: companyId,
    });

    await service.createPolicyDetail(companyId, {
      policy_id: 'policy-1',
      motor_vehicle_id: 'vehicle-1',
    } as any);

    expect(motorPolicyDetailRepo.save).toHaveBeenCalled();
  });

  it('validates registration against the resulting motor type', () => {
    const validate = (service as any).validateMotorTypeAndRegistration.bind(
      service,
    );
    expect(() => validate(2, null)).not.toThrow();
    expect(() => validate(1, null)).toThrow('registration_no is required');
    expect(() => validate(1, null)).toThrow('registration_no is required');
    expect(() => validate(3, 'ABC123')).toThrow(
      'motor_type must be 1 (Registered) or 2 (In transit)',
    );
    expect(() => validate(1, 'ABC123')).not.toThrow();
  });
});

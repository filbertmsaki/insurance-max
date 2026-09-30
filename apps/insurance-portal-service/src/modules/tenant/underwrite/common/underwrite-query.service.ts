import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  quotationFlowForUnderwriteLine,
  type UnderwriteLine,
} from '@insurance-max/contracts';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';
import { CustomersService } from '../../customers/customers.service';
import { FilterCustomerDto } from '../../customers/dto/filter-customer.dto';
import { FilterPolicyDto } from '../../policies/dto/filter-policy.dto';
import { Policy } from '../../policies/entities/policy.entity';
import { PoliciesService } from '../../policies/policies.service';
import { policyBusinessLineSql } from '../../policies/utils/policy-business-line.sql';
import { FilterQuotationDto } from '../../quotations/dto/filter-quotation.dto';
import { Quotation } from '../../quotations/entities/quotation.entity';
import { QuotationFlow } from '../../quotations/enums/quotation-flow.enum';
import { QuotationsService } from '../../quotations/quotations.service';

/**
 * Line-scoped reads over the existing quotation and policy services.
 *
 * Every call delegates to the existing `*ForUser` methods, so data scope
 * (company, branch, department, own records) is applied exactly as it is for
 * the legacy `/underwriting` screens. This layer only pins the line and
 * rejects records that belong to a different line (404, not 403, so ids from
 * other lines are not disclosed).
 */
@Injectable()
export class UnderwriteQueryService {
  constructor(
    private readonly quotationsService: QuotationsService,
    private readonly policiesService: PoliciesService,
    private readonly customersService: CustomersService,
    @InjectRepository(Policy)
    private readonly policyRepository: Repository<Policy>,
    @InjectRepository(Quotation)
    private readonly quotationRepository: Repository<Quotation>,
  ) {}

  listQuotations(
    user: AuthenticatedUser,
    line: UnderwriteLine,
    query: FilterQuotationDto,
  ) {
    return this.quotationsService.findAllForUser(user, {
      ...query,
      quotation_type: undefined,
      quotation_flow: quotationFlowForUnderwriteLine(line) as QuotationFlow,
    });
  }

  async getQuotation(
    user: AuthenticatedUser,
    line: UnderwriteLine,
    id: string,
  ) {
    const quotation = await this.quotationsService.findOneForUser(user, id);
    const flow = await this.quotationRepository.findOne({
      select: { id: true, quotation_flow: true },
      where: { id },
    });

    if (flow?.quotation_flow !== quotationFlowForUnderwriteLine(line)) {
      throw new NotFoundException('Quotation not found');
    }

    return quotation;
  }

  /** Central customer records that have business in the line. */
  listCustomers(
    user: AuthenticatedUser,
    line: UnderwriteLine,
    query: FilterCustomerDto,
  ) {
    return this.customersService.findAllForUser(user, {
      ...query,
      business_line: line,
    });
  }

  listPolicies(
    user: AuthenticatedUser,
    line: UnderwriteLine,
    query: FilterPolicyDto,
  ) {
    return this.policiesService.findAllForUser(user, {
      ...query,
      business_line: line,
    });
  }

  async getPolicy(user: AuthenticatedUser, line: UnderwriteLine, id: string) {
    const policy = await this.policiesService.findOneForUser(user, id);
    const resolvedLine = await this.resolvePolicyLine(policy.id);

    if (resolvedLine !== line) {
      throw new NotFoundException('Policy not found');
    }

    return policy;
  }

  private async resolvePolicyLine(policyId: string): Promise<string | null> {
    const row = await this.policyRepository
      .createQueryBuilder('policy')
      .select(policyBusinessLineSql('policy'), 'business_line')
      .where('policy.id = :policyId', { policyId })
      .getRawOne<{ business_line: string | null }>();

    return row?.business_line ?? null;
  }
}

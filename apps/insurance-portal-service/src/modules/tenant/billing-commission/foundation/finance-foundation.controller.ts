import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Optional,
  ServiceUnavailableException,
} from '@nestjs/common';
import { CurrentUser } from '@insurance-max/portal-shared/decorators/current-user.decorator';
import { Permissions } from '@insurance-max/portal-shared/decorators/permissions.decorator';
import { TenantScoped } from '@insurance-max/portal-shared';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';
import { FinanceBookSelection } from './finance-scope.service';
import { FinanceLedgerFoundationService } from './finance-ledger-foundation.service';
import {
  CurrencyContextInput,
  FoundationAcceptInput,
  FoundationMode,
  FoundationRateInput,
} from './finance-ledger-foundation.types';
import { FinancePolicyService } from './finance-policy.service';
import { FinancePermissions } from '../finance.permissions';
import { ADMIN_ROLE_BY_COMPANY_TYPE } from '../../../platform/companies/access-rules';
import { FinanceJournalCandidateService } from './finance-journal-candidate.service';
import { FinanceApprovalService } from './finance-approval.service';
import type { JournalCandidateInput } from './finance-journal-candidate.types';
import type {
  ApprovalToken,
  BeneficiaryEvidence,
} from './finance-approval.types';
import {
  FinancePolicyAction,
  FinancePolicyDefinition,
} from './finance-policy.types';

/** Tenant/book identity is resolved from trusted bindings, never request claims. */
@Controller('tenant/finance/foundation')
@TenantScoped()
export class FinanceFoundationController {
  constructor(
    private readonly ledger: FinanceLedgerFoundationService,
    private readonly policies: FinancePolicyService,
    @Optional() private readonly candidates?: FinanceJournalCandidateService,
    @Optional() private readonly approvals?: FinanceApprovalService,
  ) {}
  private candidateService() {
    if (!this.candidates)
      throw new ServiceUnavailableException(
        'Journal candidate controls are not configured.',
      );
    return this.candidates;
  }
  private approvalService() {
    if (!this.approvals)
      throw new ServiceUnavailableException(
        'Independent approval controls are not configured.',
      );
    return this.approvals;
  }
  private async actor(
    user: AuthenticatedUser,
    scope: FinanceBookSelection,
    admin = false,
  ) {
    const companyAdmin =
      user?.userType === 'COMPANY_ADMIN' ||
      (user?.userType === 'COMPANY_USER' &&
        user.companyType !== undefined &&
        ADMIN_ROLE_BY_COMPANY_TYPE[user.companyType] !== undefined &&
        user.roles?.includes(ADMIN_ROLE_BY_COMPANY_TYPE[user.companyType]));
    if (
      user?.scope !== 'company' ||
      !user.companyId ||
      user.userType === 'CUSTOMER' ||
      (admin && !companyAdmin)
    )
      throw new ForbiddenException(
        admin
          ? 'A current company-admin identity is required; platform admin is not a company approval.'
          : 'An authenticated company Finance identity is required.',
      );
    return this.ledger.resolveIdentity(user, scope);
  }
  @Get('scopes')
  @Permissions(FinancePermissions.FOUNDATION_READ)
  async scopes(@CurrentUser() user: AuthenticatedUser) {
    if (
      user?.scope !== 'company' ||
      !user.companyId ||
      user.userType === 'CUSTOMER'
    )
      throw new ForbiddenException(
        'An authenticated company Finance identity is required.',
      );
    return this.ledger.scopes(user);
  }
  @Get('documents')
  @Permissions(FinancePermissions.FOUNDATION_READ)
  async documents(
    @CurrentUser() u: AuthenticatedUser,
    @Query() q: FinanceBookSelection & { kind?: string; limit?: string },
  ) {
    return this.ledger.documents(
      await this.actor(u, q),
      q,
      q.kind,
      q.limit === undefined ? 50 : Number(q.limit),
    );
  }
  @Get('documents/:id')
  @Permissions(FinancePermissions.FOUNDATION_READ)
  async document(
    @CurrentUser() u: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() q: FinanceBookSelection & { subjectHash: string },
  ) {
    return this.ledger.documentDetails(
      await this.actor(u, q),
      q,
      id,
      q.subjectHash,
    );
  }
  @Get('policies/:id')
  @Permissions(FinancePermissions.FOUNDATION_READ)
  async policy(
    @CurrentUser() u: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() q: FinanceBookSelection & { definitionHash: string },
  ) {
    return this.ledger.policyDetails(
      await this.actor(u, q),
      q,
      id,
      q.definitionHash,
    );
  }
  @Get('trial-balance')
  @Permissions(FinancePermissions.FOUNDATION_READ)
  async trialBalance(
    @CurrentUser() u: AuthenticatedUser,
    @Query()
    q: FinanceBookSelection & {
      mode: FoundationMode;
      openingId: string;
      openingHash: string;
      from: string;
      to: string;
    },
  ) {
    return this.ledger.trialBalance(await this.actor(u, q), q, q);
  }
  @Get('accounts/:code')
  @Permissions(FinancePermissions.FOUNDATION_READ)
  async account(
    @CurrentUser() u: AuthenticatedUser,
    @Param('code') accountCode: string,
    @Query()
    q: FinanceBookSelection & {
      mode: FoundationMode;
      openingId: string;
      openingHash: string;
      from: string;
      to: string;
    },
  ) {
    return this.ledger.accountLedger(await this.actor(u, q), q, {
      ...q,
      accountCode,
    });
  }
  @Get('journals/:id')
  @Permissions(FinancePermissions.FOUNDATION_READ)
  async journal(
    @CurrentUser() u: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() q: FinanceBookSelection & { mode: FoundationMode },
  ) {
    return this.ledger.journal(await this.actor(u, q), q, id, q.mode);
  }
  @Get('readiness')
  @Permissions(FinancePermissions.FOUNDATION_READ)
  async readiness(
    @CurrentUser() u: AuthenticatedUser,
    @Query()
    q: FinanceBookSelection & { contextId: string; contextHash: string },
  ) {
    return this.ledger.readiness(
      await this.actor(u, q),
      q,
      q.contextId,
      q.contextHash,
    );
  }
  @Post('currency-contexts')
  @Permissions(FinancePermissions.FOUNDATION_PREPARE)
  async context(
    @CurrentUser() u: AuthenticatedUser,
    @Body()
    b: {
      scope: FinanceBookSelection;
      input: CurrencyContextInput;
      reason: string;
    },
  ) {
    return this.ledger.prepareCurrencyContext(
      await this.actor(u, b.scope),
      b.scope,
      b.input,
      b.reason,
    );
  }
  @Post('exchange-rates')
  @Permissions(FinancePermissions.FOUNDATION_PREPARE)
  async rate(
    @CurrentUser() u: AuthenticatedUser,
    @Body()
    b: {
      scope: FinanceBookSelection;
      input: FoundationRateInput;
      version: number;
      reason: string;
    },
  ) {
    return this.ledger.prepareRate(
      await this.actor(u, b.scope),
      b.scope,
      b.input,
      b.version,
      b.reason,
    );
  }
  @Post('documents/:id/reviews')
  @Permissions(FinancePermissions.FOUNDATION_REVIEW)
  async review(
    @CurrentUser() u: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body()
    b: {
      scope: FinanceBookSelection;
      subjectHash: string;
      decision: 'REVIEWED' | 'REJECTED';
      evidenceHash: string;
      reason: string;
    },
  ) {
    if (!['REVIEWED', 'REJECTED'].includes(b.decision))
      throw new ForbiddenException(
        'Use the explicit company-admin release approval endpoint for approval.',
      );
    return this.ledger.reviewDocument(
      await this.actor(u, b.scope),
      b.scope,
      id,
      b.subjectHash,
      b.decision,
      b.evidenceHash,
      b.reason,
    );
  }
  @Post('periods')
  @Permissions(FinancePermissions.FOUNDATION_REVIEW)
  async period(
    @CurrentUser() u: AuthenticatedUser,
    @Body()
    b: {
      scope: FinanceBookSelection;
      input: { code: string; mode: FoundationMode; from: string; to: string };
      evidenceHash: string;
      reason: string;
    },
  ) {
    return this.ledger.createPeriod(
      await this.actor(u, b.scope, b.input.mode === 'LIVE'),
      b.scope,
      b.input,
      b.evidenceHash,
      b.reason,
    );
  }
  @Post('periods/:id/fences')
  @Permissions(FinancePermissions.FOUNDATION_RELEASE)
  async fence(
    @CurrentUser() u: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body()
    b: {
      scope: FinanceBookSelection;
      revision: number;
      state: 'OPEN' | 'CLOSED';
      evidenceHash: string;
      reason: string;
    },
  ) {
    return this.ledger.fencePeriod(
      await this.actor(u, b.scope, true),
      b.scope,
      id,
      b.revision,
      b.state,
      b.evidenceHash,
      b.reason,
    );
  }
  @Post('openings')
  @Permissions(FinancePermissions.FOUNDATION_PREPARE)
  async opening(
    @CurrentUser() u: AuthenticatedUser,
    @Body()
    b: {
      scope: FinanceBookSelection;
      input: Parameters<FinanceLedgerFoundationService['prepareOpening']>[2];
      version: number;
      reason: string;
    },
  ) {
    return this.ledger.prepareOpening(
      await this.actor(u, b.scope),
      b.scope,
      b.input,
      b.version,
      b.reason,
    );
  }
  @Post('journal-acceptances')
  @Permissions(FinancePermissions.FOUNDATION_ACCEPT_JOURNAL)
  async accept(
    @CurrentUser() u: AuthenticatedUser,
    @Body()
    b: {
      scope: FinanceBookSelection;
      input: FoundationAcceptInput;
      reason: string;
    },
  ) {
    return this.ledger.acceptCandidate(
      await this.actor(u, b.scope),
      b.scope,
      b.input,
      b.reason,
    );
  }
  @Post('candidate-periods')
  @Permissions(FinancePermissions.FOUNDATION_PREPARE)
  async candidatePeriod(
    @CurrentUser() u: AuthenticatedUser,
    @Body()
    b: {
      scope: FinanceBookSelection;
      input: { code: string; startsOn: string; endsBefore: string };
      reason: string;
    },
  ) {
    return this.candidateService().createDraftPeriod(
      await this.actor(u, b.scope),
      b.scope,
      b.input,
      b.reason,
    );
  }
  @Post('candidate-periods/:id/fences')
  @Permissions(FinancePermissions.FOUNDATION_PREPARE)
  async candidateFence(
    @CurrentUser() u: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body()
    b: {
      scope: FinanceBookSelection;
      revision: number;
      state: 'SEALED_DRAFT' | 'OPEN_FOR_VALIDATION';
      reason: string;
    },
  ) {
    return this.candidateService().fenceDraftPeriod(
      await this.actor(u, b.scope),
      b.scope,
      id,
      b.revision,
      b.state,
      b.reason,
    );
  }
  @Post('journal-candidates')
  @Permissions(FinancePermissions.FOUNDATION_PREPARE)
  async prepareCandidate(
    @CurrentUser() u: AuthenticatedUser,
    @Body()
    b: {
      scope: FinanceBookSelection;
      input: JournalCandidateInput;
      reason: string;
    },
  ) {
    return this.candidateService().prepareInactive(
      await this.actor(u, b.scope),
      b.scope,
      b.input,
      b.reason,
    );
  }
  @Post('journal-candidates/:id/approval-requests')
  @Permissions(FinancePermissions.FOUNDATION_PREPARE)
  async requestApproval(
    @CurrentUser() u: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body()
    b: {
      scope: FinanceBookSelection;
      subjectHash: string;
      profileId: string;
      profileHash: string;
      beneficiary: BeneficiaryEvidence;
      reason: string;
    },
  ) {
    return this.approvalService().requestInactive(
      await this.actor(u, b.scope),
      b.scope,
      id,
      b.subjectHash,
      b.profileId,
      b.profileHash,
      b.beneficiary,
      b.reason,
    );
  }
  @Post('approval-requests/:id/decisions')
  @Permissions(FinancePermissions.FOUNDATION_REVIEW)
  async decideApproval(
    @CurrentUser() u: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body()
    b: {
      scope: FinanceBookSelection;
      token: ApprovalToken;
      mandateId: string;
      action: 'APPROVED_INACTIVE' | 'REJECTED_INACTIVE';
      reason: string;
    },
  ) {
    if (id.toLowerCase() !== b.token?.requestId?.toLowerCase())
      throw new ForbiddenException('Approval path and frozen request differ.');
    return this.approvalService().decideInactive(
      await this.actor(u, b.scope),
      b.scope,
      b.token,
      b.mandateId,
      b.action,
      b.reason,
    );
  }
  @Post('journal-candidates/:id/validation')
  @Permissions(FinancePermissions.FOUNDATION_REVIEW)
  async validateCandidate(
    @CurrentUser() u: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body()
    b: {
      scope: FinanceBookSelection;
      subjectHash: string;
      token: ApprovalToken;
      reason: string;
    },
  ) {
    return this.candidateService().validateInactive(
      await this.actor(u, b.scope),
      b.scope,
      id,
      b.subjectHash,
      b.reason,
      b.token,
    );
  }
  @Post('acceptances')
  @Permissions(FinancePermissions.FOUNDATION_PREPARE)
  async acceptance(
    @CurrentUser() u: AuthenticatedUser,
    @Body()
    b: {
      scope: FinanceBookSelection;
      input: Parameters<FinanceLedgerFoundationService['prepareAcceptance']>[2];
      version: number;
      reason: string;
    },
  ) {
    return this.ledger.prepareAcceptance(
      await this.actor(u, b.scope),
      b.scope,
      b.input,
      b.version,
      b.reason,
    );
  }
  @Post('releases')
  @Permissions(FinancePermissions.FOUNDATION_PREPARE)
  async release(
    @CurrentUser() u: AuthenticatedUser,
    @Body()
    b: {
      scope: FinanceBookSelection;
      input: Parameters<FinanceLedgerFoundationService['prepareRelease']>[2];
      version: number;
      reason: string;
    },
  ) {
    return this.ledger.prepareRelease(
      await this.actor(u, b.scope),
      b.scope,
      b.input,
      b.version,
      b.reason,
    );
  }
  @Post('releases/:id/approval')
  @Permissions(FinancePermissions.FOUNDATION_RELEASE)
  async approveRelease(
    @CurrentUser() u: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body()
    b: {
      scope: FinanceBookSelection;
      subjectHash: string;
      evidenceHash: string;
      reason: string;
    },
  ) {
    return this.ledger.reviewDocument(
      await this.actor(u, b.scope, true),
      b.scope,
      id,
      b.subjectHash,
      'APPROVED',
      b.evidenceHash,
      b.reason,
    );
  }
  @Post('releases/:id/deployments')
  @Permissions(FinancePermissions.FOUNDATION_RELEASE)
  async deployment(
    @CurrentUser() u: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body()
    b: {
      scope: FinanceBookSelection;
      subjectHash: string;
      action: 'ENABLE' | 'DISABLE';
      reason: string;
    },
  ) {
    return this.ledger.deployment(
      await this.actor(u, b.scope, true),
      b.scope,
      id,
      b.subjectHash,
      b.action,
      b.reason,
    );
  }
  @Post('policies')
  @Permissions(FinancePermissions.FOUNDATION_PREPARE)
  async preparePolicy(
    @CurrentUser() u: AuthenticatedUser,
    @Body()
    b: { scope: FinanceBookSelection; definition: FinancePolicyDefinition },
  ) {
    const p = await this.actor(u, b.scope);
    return this.policies.prepare(
      {
        tenantId: p.tenantId,
        legalEntityId: b.scope.legalEntityId,
        bookId: b.scope.bookId,
      },
      p,
      b.definition,
    );
  }
  @Post('policies/:id/decisions')
  @Permissions(FinancePermissions.FOUNDATION_RELEASE)
  async policyDecision(
    @CurrentUser() u: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body()
    b: {
      scope: FinanceBookSelection;
      subjectHash: string;
      action: FinancePolicyAction;
      evidenceHash: string;
      reason: string;
    },
  ) {
    const p = await this.actor(u, b.scope, true);
    return this.policies.transition(
      {
        tenantId: p.tenantId,
        legalEntityId: b.scope.legalEntityId,
        bookId: b.scope.bookId,
      },
      p,
      id,
      b.subjectHash,
      b.action,
      b.evidenceHash,
      b.reason,
    );
  }
}

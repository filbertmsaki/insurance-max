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
import type { FinanceBookSelection } from './finance-configuration/finance-scope.service';
import { FinanceLedgerFoundationService } from '../accounting/general-ledger/finance-ledger-foundation.service';
import {
  CurrencyContextInput,
  FoundationAcceptInput,
  FoundationMode,
  FoundationRateInput,
} from '../accounting/general-ledger/finance-ledger-foundation.types';
import { FinancePolicyService } from '../governance/accounting-policies/finance-policy.service';
import { FinancePermissions } from '../governance/finance-permissions/finance.permissions';
import { ADMIN_ROLE_BY_COMPANY_TYPE } from '../../../platform/companies/access-rules';
import { FinanceJournalCandidateService } from '../accounting/journal-entries/finance-journal-candidate.service';
import { FinanceApprovalService } from '../governance/finance-approvals/finance-approval.service';
import { FinanceGlVoucherService } from '../accounting/general-ledger/finance-gl-voucher.service';
import { FinanceGlWorkflowsService } from '../accounting/general-ledger/finance-gl-workflows.service';
import { FinanceOperatingPostingService } from '../accounting/general-ledger/finance-operating-posting.service';
import type {
  VoucherInput,
  Evidence,
} from '../accounting/general-ledger/finance-gl-program';
import type { ProgramInput } from '../accounting/general-ledger/finance-gl-workflows.service';
import type { JournalCandidateInput } from '../accounting/journal-entries/finance-journal-candidate.types';
import type { BranchAllocationPreviewInput } from '../accounting/allocations/finance-branch-allocation';
import type {
  ApprovalToken,
  BeneficiaryEvidence,
} from '../governance/finance-approvals/finance-approval.types';
import {
  FinancePolicyAction,
  FinancePolicyDefinition,
} from '../governance/accounting-policies/finance-policy.types';

/** Tenant/book identity is resolved from trusted bindings, never request claims. */
@Controller('tenant/finance/foundation')
@TenantScoped()
export class FinanceFoundationController {
  constructor(
    private readonly ledger: FinanceLedgerFoundationService,
    private readonly policies: FinancePolicyService,
    @Optional() private readonly candidates?: FinanceJournalCandidateService,
    @Optional() private readonly approvals?: FinanceApprovalService,
    @Optional() private readonly operating?: FinanceOperatingPostingService,
    @Optional() private readonly gl?: FinanceGlWorkflowsService,
    @Optional() private readonly vouchers?: FinanceGlVoucherService,
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
  @Get('journals')
  @Permissions(FinancePermissions.FOUNDATION_READ)
  async journals(
    @CurrentUser() u: AuthenticatedUser,
    @Query()
    q: FinanceBookSelection & {
      mode: FoundationMode;
      from: string;
      to: string;
      limit?: string;
      beforeDate?: string;
      beforeId?: string;
    },
  ) {
    return this.ledger.searchJournals(await this.actor(u, q), q, {
      mode: q.mode,
      from: q.from,
      to: q.to,
      limit: q.limit === undefined ? 50 : Number(q.limit),
      beforeDate: q.beforeDate,
      beforeId: q.beforeId,
    });
  }
  @Get('journals/export')
  @Permissions(FinancePermissions.FOUNDATION_READ)
  async exportJournals(
    @CurrentUser() u: AuthenticatedUser,
    @Query()
    q: FinanceBookSelection & {
      mode: FoundationMode;
      from: string;
      to: string;
    },
  ) {
    return this.ledger.exportJournals(await this.actor(u, q), q, q);
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
  @Get('gl')
  @Permissions(FinancePermissions.FOUNDATION_READ)
  async glWorkspace(
    @CurrentUser() u: AuthenticatedUser,
    @Query() s: FinanceBookSelection,
  ) {
    return this.gl!.overview(await this.actor(u, s), s);
  }
  @Post('gl/invoices/:id/write-offs')
  @Permissions(
    FinancePermissions.INVOICES_WRITE_OFF,
    FinancePermissions.FOUNDATION_PREPARE,
  )
  async invoiceWriteOff(
    @CurrentUser() u: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body()
    b: {
      scope: FinanceBookSelection;
      input: Parameters<FinanceGlWorkflowsService['writeOff']>[3];
    },
  ) {
    return this.gl!.writeOff(
      await this.actor(u, b.scope),
      b.scope,
      id,
      b.input,
    );
  }
  @Post('gl/write-offs/:id/reverse')
  @Permissions(
    FinancePermissions.INVOICES_WRITE_OFF,
    FinancePermissions.FOUNDATION_PREPARE,
  )
  async reverseInvoiceWriteOff(
    @CurrentUser() u: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() b: { scope: FinanceBookSelection; reason: string },
  ) {
    return this.gl!.reverseWriteOff(
      await this.actor(u, b.scope),
      b.scope,
      id,
      b.reason,
    );
  }
  @Post('gl/deployments')
  @Permissions(FinancePermissions.FOUNDATION_RELEASE)
  async deployGl(
    @CurrentUser() u: AuthenticatedUser,
    @Body()
    b: {
      scope: FinanceBookSelection;
      input: Parameters<FinanceGlWorkflowsService['deploy']>[2];
      reason: string;
    },
  ) {
    return this.gl!.deploy(
      await this.actor(u, b.scope, true),
      b.scope,
      b.input,
      b.reason,
    );
  }
  @Post('gl/drafts')
  @Permissions(FinancePermissions.FOUNDATION_PREPARE)
  async saveVoucherDraft(
    @CurrentUser() u: AuthenticatedUser,
    @Body()
    b: {
      scope: FinanceBookSelection;
      input: VoucherInput;
      id?: string;
      revision?: number;
    },
  ) {
    return this.vouchers!.saveDraft(
      await this.actor(u, b.scope),
      b.scope,
      b.input,
      b.id,
      b.revision,
    );
  }
  @Post('gl/vouchers')
  @Permissions(FinancePermissions.FOUNDATION_PREPARE)
  async voucher(
    @CurrentUser() u: AuthenticatedUser,
    @Body()
    b: {
      scope: FinanceBookSelection;
      input: VoucherInput;
      draft?: { id: string; revision: number };
    },
  ) {
    return this.vouchers!.manual(
      await this.actor(u, b.scope),
      b.scope,
      b.input,
      b.draft,
    );
  }
  @Post('gl/journals/:id/reverse')
  @Permissions(FinancePermissions.FOUNDATION_PREPARE)
  async reverseVoucher(
    @CurrentUser() u: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body()
    b: {
      scope: FinanceBookSelection;
      input: {
        reference: string;
        date: string;
        description: string;
        evidence: Evidence;
      };
    },
  ) {
    return this.vouchers!.reverse(
      await this.actor(u, b.scope),
      b.scope,
      id,
      b.input,
    );
  }
  @Post('gl/programs')
  @Permissions(FinancePermissions.FOUNDATION_PREPARE)
  async glProgram(
    @CurrentUser() u: AuthenticatedUser,
    @Body()
    b: { scope: FinanceBookSelection; input: ProgramInput; reason: string },
  ) {
    return this.gl!.save(
      await this.actor(u, b.scope),
      b.scope,
      b.input,
      b.reason,
    );
  }
  @Post('gl/programs/:id/decisions')
  @Permissions(FinancePermissions.FOUNDATION_REVIEW)
  async glDecision(
    @CurrentUser() u: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body()
    b: {
      scope: FinanceBookSelection;
      subjectHash: string;
      action: 'APPROVE' | 'PAUSE';
      reason: string;
    },
  ) {
    return this.gl!.decide(
      await this.actor(u, b.scope),
      b.scope,
      id,
      b.action,
      b.subjectHash,
      b.reason,
    );
  }
  @Post('gl/programs/:id/occurrences')
  @Permissions(FinancePermissions.FOUNDATION_PREPARE)
  async glRun(
    @CurrentUser() u: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body()
    b: {
      scope: FinanceBookSelection;
      input: {
        subjectHash: string;
        stage: string;
        date: string;
        reference?: string;
      };
      reason: string;
    },
  ) {
    return this.gl!.run(
      await this.actor(u, b.scope),
      b.scope,
      id,
      b.input,
      b.reason,
    );
  }
  @Get('operating-postings')
  @Permissions(FinancePermissions.FOUNDATION_READ)
  async operatingPostings(
    @CurrentUser() user: AuthenticatedUser,
    @Query() scope: FinanceBookSelection,
  ) {
    return this.operating!.pending(await this.actor(user, scope), scope);
  }

  @Post('operating-postings/:id/renew')
  @Permissions(FinancePermissions.FOUNDATION_PREPARE)
  async renewOperating(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body()
    b: {
      scope: FinanceBookSelection;
      subjectHash: string;
      reason: string;
      evidence?: Evidence;
    },
  ) {
    return this.operating!.renew(
      await this.actor(user, b.scope),
      b.scope,
      id,
      b.subjectHash,
      b.reason,
      b.evidence,
    );
  }

  @Post('operating-postings/:id/reject')
  @Permissions(FinancePermissions.FOUNDATION_ACCEPT_JOURNAL)
  async rejectOperatingPosting(
    @CurrentUser() u: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body()
    b: { scope: FinanceBookSelection; subjectHash: string; reason: string },
  ) {
    return this.operating!.approve(
      await this.actor(u, b.scope),
      b.scope,
      id,
      b.subjectHash,
      b.reason,
      true,
    );
  }
  @Post('operating-postings/:id/approve')
  @Permissions(FinancePermissions.FOUNDATION_ACCEPT_JOURNAL)
  async approveOperatingPosting(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body()
    body: { scope: FinanceBookSelection; subjectHash: string; reason: string },
  ) {
    return this.operating!.approve(
      await this.actor(user, body.scope),
      body.scope,
      id,
      body.subjectHash,
      body.reason,
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
  @Post('reviewed-allocation-candidates')
  @Permissions(FinancePermissions.FOUNDATION_PREPARE)
  async prepareReviewedAllocation(
    @CurrentUser() u: AuthenticatedUser,
    @Body()
    b: {
      scope: FinanceBookSelection;
      template: Omit<JournalCandidateInput, 'lines'>;
      allocation: BranchAllocationPreviewInput;
      policy: { id: string; hash: string };
      dimensions: Record<string, string>;
      occurrence: { id: string; hash: string };
      reason: string;
    },
  ) {
    return this.candidateService().prepareReviewedAllocationInactive(
      await this.actor(u, b.scope),
      b.scope,
      b.template,
      b.allocation,
      b.policy,
      b.dimensions,
      b.occurrence,
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

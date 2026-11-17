import {
  Controller,
  Body,
  ForbiddenException,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { FinanceLedgerFoundationService } from '../../insurance-portal-service/src/modules/tenant/billing-commission/foundation/finance-ledger-foundation.service';
import { FinanceJournalCandidateService } from '../../insurance-portal-service/src/modules/tenant/billing-commission/foundation/finance-journal-candidate.service';
import type { JournalCandidateInput } from '../../insurance-portal-service/src/modules/tenant/billing-commission/foundation/finance-journal-candidate.types';
import type { ApprovalToken } from '../../insurance-portal-service/src/modules/tenant/billing-commission/foundation/finance-approval.types';
import type { FoundationMode } from '../../insurance-portal-service/src/modules/tenant/billing-commission/foundation/finance-ledger-foundation.types';
import {
  FinanceHumanReadService,
  type IndependentReadScope,
} from './human-read.service';

@Controller('finance')
export class FinanceHumanReadController {
  constructor(
    private readonly access: FinanceHumanReadService,
    private readonly ledger: FinanceLedgerFoundationService,
    private readonly candidates: FinanceJournalCandidateService,
  ) {}
  @Post('journal-candidates')
  prepareCandidate(
    @Headers('authorization') authorization: string,
    @Body()
    body: {
      scope: IndependentReadScope;
      input: JournalCandidateInput;
      reason: string;
    },
  ) {
    return this.access.withRead(
      authorization,
      body?.scope,
      async (manager, identity) => {
        const bindings = await manager.query(
          `SELECT id FROM finance_foundation_identity_bindings WHERE tenant_id=$1 AND legal_entity_id=$2 AND book_id=$3 AND source_company_id=$4 AND source_user_id=$5 AND subject_id=$6 AND natural_person_id=$7 AND revoked_at IS NULL AND valid_from<=statement_timestamp() AND (valid_to IS NULL OR valid_to>statement_timestamp()) FOR SHARE`,
          [
            identity.tenantId,
            identity.legalEntityId,
            identity.bookId,
            identity.companyId,
            identity.sourceUserId,
            identity.subjectId,
            identity.naturalPersonId,
          ],
        );
        if (bindings.length !== 1)
          throw new ForbiddenException(
            'A unique independent ledger identity binding is required.',
          );
        if (
          Array.isArray(body?.input?.lines) &&
          body.input.lines.some(
            (line) =>
              typeof line?.dimensions?.COMPANY === 'string' &&
              line.dimensions.COMPANY.toLowerCase() !== identity.companyId,
          )
        )
          throw new ForbiddenException(
            'Journal company differs from the authenticated company.',
          );
        const result = await this.candidates.prepareInactive(
          {
            kind: 'USER',
            tenantId: identity.tenantId,
            subjectId: identity.subjectId,
            naturalPersonId: identity.naturalPersonId,
          },
          { legalEntityId: identity.legalEntityId, bookId: identity.bookId },
          body.input,
          body.reason,
          manager,
        );
        const [binding] = await manager.query(
          `SELECT id FROM finance_foundation_identity_bindings WHERE id=$1 AND revoked_at IS NULL AND valid_from<=statement_timestamp() AND (valid_to IS NULL OR valid_to>statement_timestamp())`,
          [bindings[0].id],
        );
        if (!binding)
          throw new ForbiddenException(
            'Independent identity expired before completion.',
          );
        return { ...result, postingAuthorized: false };
      },
      'prepare',
    );
  }
  @Post('journal-candidates/:id/validation')
  validateCandidate(
    @Headers('authorization') authorization: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body()
    body: {
      scope: IndependentReadScope;
      subjectHash: string;
      token?: ApprovalToken;
      reason: string;
    },
  ) {
    return this.access.withRead(
      authorization,
      body?.scope,
      async (manager, identity) => {
        const bindings = await manager.query(
          `SELECT id FROM finance_foundation_identity_bindings WHERE tenant_id=$1 AND legal_entity_id=$2 AND book_id=$3 AND source_company_id=$4 AND source_user_id=$5 AND subject_id=$6 AND natural_person_id=$7 AND revoked_at IS NULL AND valid_from<=statement_timestamp() AND (valid_to IS NULL OR valid_to>statement_timestamp()) FOR SHARE`,
          [
            identity.tenantId,
            identity.legalEntityId,
            identity.bookId,
            identity.companyId,
            identity.sourceUserId,
            identity.subjectId,
            identity.naturalPersonId,
          ],
        );
        if (bindings.length !== 1)
          throw new ForbiddenException(
            'A unique independent ledger identity binding is required.',
          );
        const [candidate] = await manager.query(
          `SELECT payload FROM finance_journal_candidates WHERE tenant_id=$1 AND legal_entity_id=$2 AND book_id=$3 AND id=$4 FOR SHARE`,
          [identity.tenantId, identity.legalEntityId, identity.bookId, id],
        );
        if (
          candidate?.payload?.lines?.some(
            (line: any) =>
              typeof line?.dimensions?.COMPANY === 'string' &&
              line.dimensions.COMPANY.toLowerCase() !== identity.companyId,
          )
        )
          throw new ForbiddenException(
            'Journal company differs from the authenticated company.',
          );
        const result = await this.candidates.validateInactive(
          {
            kind: 'USER',
            tenantId: identity.tenantId,
            subjectId: identity.subjectId,
            naturalPersonId: identity.naturalPersonId,
          },
          { legalEntityId: identity.legalEntityId, bookId: identity.bookId },
          id,
          body.subjectHash,
          body.reason,
          body.token,
          manager,
        );
        const [binding] = await manager.query(
          `SELECT id FROM finance_foundation_identity_bindings WHERE id=$1 AND revoked_at IS NULL AND valid_from<=statement_timestamp() AND (valid_to IS NULL OR valid_to>statement_timestamp())`,
          [bindings[0].id],
        );
        if (!binding)
          throw new ForbiddenException(
            'Independent identity expired before completion.',
          );
        return { ...result, postingAuthorized: false };
      },
      'review',
    );
  }
  @Get('journals/export')
  exportJournals(
    @Headers('authorization') authorization: string,
    @Query()
    scope: IndependentReadScope & {
      mode: FoundationMode;
      from: string;
      to: string;
    },
  ) {
    return this.access.withRead(
      authorization,
      scope,
      async (_manager, identity) => {
        const selection = {
          legalEntityId: identity.legalEntityId,
          bookId: identity.bookId,
        };
        const actor = await this.ledger.resolveIdentity(
          { id: identity.sourceUserId, companyId: identity.companyId },
          selection,
        );
        if (
          actor.tenantId !== identity.tenantId ||
          actor.subjectId !== identity.subjectId ||
          actor.naturalPersonId !== identity.naturalPersonId
        )
          throw new ForbiddenException(
            'Independent ledger identity does not match the verified portal session.',
          );
        return this.ledger.exportJournals(actor, selection, {
          mode: scope.mode,
          from: scope.from,
          to: scope.to,
        });
      },
    );
  }
  @Get('journals')
  journals(
    @Headers('authorization') authorization: string,
    @Query()
    scope: IndependentReadScope & {
      mode: FoundationMode;
      from: string;
      to: string;
      limit?: string;
      beforeDate?: string;
      beforeId?: string;
    },
  ) {
    return this.access.withRead(
      authorization,
      scope,
      async (_manager, identity) => {
        const selection = {
          legalEntityId: identity.legalEntityId,
          bookId: identity.bookId,
        };
        const actor = await this.ledger.resolveIdentity(
          { id: identity.sourceUserId, companyId: identity.companyId },
          selection,
        );
        if (
          actor.tenantId !== identity.tenantId ||
          actor.subjectId !== identity.subjectId ||
          actor.naturalPersonId !== identity.naturalPersonId
        )
          throw new ForbiddenException(
            'Independent ledger identity does not match the verified portal session.',
          );
        return this.ledger.searchJournals(actor, selection, {
          mode: scope.mode,
          from: scope.from,
          to: scope.to,
          limit: scope.limit === undefined ? 50 : Number(scope.limit),
          beforeDate: scope.beforeDate,
          beforeId: scope.beforeId,
        });
      },
    );
  }
  @Get('session')
  session(
    @Headers('authorization') authorization: string,
    @Query() scope: IndependentReadScope,
  ) {
    return this.access.withRead(authorization, scope, async (_m, identity) => ({
      identity,
      permission: 'READ_DRAFT',
      postingAuthorized: false,
    }));
  }
  @Get('allocation-previews')
  previews(
    @Headers('authorization') authorization: string,
    @Query() scope: IndependentReadScope,
  ) {
    return this.access.withRead(authorization, scope, async (m, identity) => {
      const previews = await m.query(
        `SELECT id,subject_hash,occurrence_date::text AS occurrence_date,payload FROM finance_allocation_preview_occurrences WHERE tenant_id=$1 AND legal_entity_id=$2 AND book_id=$3 AND payload->'dimension'->>'companyId'=$4 ORDER BY occurrence_date DESC,id LIMIT 100`,
        [
          identity.tenantId,
          identity.legalEntityId,
          identity.bookId,
          identity.companyId,
        ],
      );
      return { previews, postingAuthorized: false };
    });
  }
}

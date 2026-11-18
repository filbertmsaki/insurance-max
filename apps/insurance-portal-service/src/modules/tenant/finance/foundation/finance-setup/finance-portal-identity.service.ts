import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';
import { FinanceLedgerFoundationService } from '../../accounting/general-ledger/finance-ledger-foundation.service';
import type { FinanceBookSelection } from '../finance-configuration/finance-scope.service';
import { FinanceSetupService } from './finance-setup.service';
import { setupObject, setupUuid } from './finance-setup.types';

export interface FinancePortalIdentity {
  schema: 'FINANCE_PORTAL_IDENTITY_V1';
  tenantId: string;
  companyId: string | undefined;
  sourceUserId: string | undefined;
  subjectId: string;
  naturalPersonId: string;
  legalEntityId: string;
  bookId: string;
  postingAuthorized: false;
}

/** Resolves the Finance identity of a portal session for one legal entity and book. */
@Injectable()
export class FinancePortalIdentityService {
  constructor(
    private readonly setup: FinanceSetupService,
    private readonly ledger: FinanceLedgerFoundationService,
  ) {}

  scope(value: unknown): FinanceBookSelection {
    if (
      !setupObject(value) ||
      Object.keys(value).some(
        (k) => !['legalEntityId', 'bookId', 'subjectHash'].includes(k),
      ) ||
      !setupUuid(value.legalEntityId) ||
      !setupUuid(value.bookId)
    )
      throw new BadRequestException(
        'Select an authorized legal entity and accounting book.',
      );
    return {
      legalEntityId: value.legalEntityId.toLowerCase(),
      bookId: value.bookId.toLowerCase(),
    };
  }

  actor(user: AuthenticatedUser, scope: FinanceBookSelection) {
    if (
      user?.scope !== 'company' ||
      !user.companyId ||
      !['COMPANY_USER', 'COMPANY_ADMIN'].includes(user.userType)
    )
      throw new ForbiddenException('Use the current company Finance session.');
    return this.ledger.resolveIdentity(user, scope);
  }

  async identityFor(
    user: AuthenticatedUser,
    query: unknown,
    permission: string,
  ): Promise<FinancePortalIdentity> {
    const scope = this.scope(query);
    const actor = await this.actor(user, scope);
    return this.setup.withAccess(
      actor,
      scope,
      'READ',
      permission,
      async () => ({
        schema: 'FINANCE_PORTAL_IDENTITY_V1' as const,
        tenantId: actor.tenantId,
        companyId: actor.sourceCompanyId,
        sourceUserId: actor.sourceUserId,
        subjectId: actor.subjectId,
        naturalPersonId: actor.naturalPersonId,
        legalEntityId: scope.legalEntityId,
        bookId: scope.bookId,
        postingAuthorized: false as const,
      }),
    );
  }
}

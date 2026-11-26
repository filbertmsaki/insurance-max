import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { TenantScoped } from '@insurance-max/portal-shared';
import { CurrentUser } from '@insurance-max/portal-shared/decorators/current-user.decorator';
import { Permissions } from '@insurance-max/portal-shared/decorators/permissions.decorator';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';
import { FinancePermissions as P } from '../../governance/finance-permissions/finance.permissions';
import { FinanceLedgerFoundationService } from '../../accounting/general-ledger/finance-ledger-foundation.service';
import type { FinanceBookSelection } from '../../foundation/finance-configuration/finance-scope.service';
import type { BankObservation } from '../../accounting/general-ledger/finance-bank-observation';
import { CustomerAccountsService } from './customer-accounts.service';
import { uuid, type ArInput } from './customer-accounts.types';
import type { CollectionInput } from './customer-collections';
type Scoped = { scope: FinanceBookSelection };
@Controller('tenant/finance/customer-accounts')
@TenantScoped()
export class CustomerAccountsController {
  constructor(
    private readonly ledger: FinanceLedgerFoundationService,
    private readonly ar: CustomerAccountsService,
  ) {}
  private actor(u: AuthenticatedUser, s: FinanceBookSelection) {
    if (u?.scope !== 'company' || !u.companyId || u.userType === 'CUSTOMER')
      throw new ForbiddenException('A company finance identity is required.');
    uuid(s?.bookId, 'book');
    uuid(s?.legalEntityId, 'legal entity');
    return this.ledger.resolveIdentity(u, s);
  }
  @Get()
  @Permissions(P.FOUNDATION_READ)
  async workspace(
    @CurrentUser() u: AuthenticatedUser,
    @Query() s: FinanceBookSelection,
  ) {
    return this.ar.workspace(await this.actor(u, s), s);
  }
  @Get('reports')
  @Permissions(P.FOUNDATION_READ)
  async reports(
    @CurrentUser() u: AuthenticatedUser,
    @Query()
    q: FinanceBookSelection & {
      from: string;
      to: string;
      currency: string;
      customer?: string;
    },
  ) {
    return this.ar.reports(await this.actor(u, q), q, q);
  }
  @Post()
  @Permissions(P.FOUNDATION_PREPARE)
  async submit(
    @CurrentUser() u: AuthenticatedUser,
    @Body() b: Scoped & { input: ArInput },
  ) {
    return this.ar.submit(await this.actor(u, b.scope), b.scope, b.input);
  }
  @Post('opening-imports')
  @Permissions(P.FOUNDATION_PREPARE)
  async importOpening(
    @CurrentUser() u: AuthenticatedUser,
    @Body() b: Scoped & { input: ArInput },
  ) {
    return this.ar.submit(await this.actor(u, b.scope), b.scope, {
      ...b.input,
      kind: 'OPENING_IMPORT',
    });
  }
  @Post('collections')
  @Permissions(P.FOUNDATION_PREPARE)
  async collect(
    @CurrentUser() u: AuthenticatedUser,
    @Body() b: Scoped & { input: CollectionInput },
  ) {
    return this.ar.collect(await this.actor(u, b.scope), b.scope, b.input);
  }
  @Post('reminders')
  @Permissions(P.FOUNDATION_PREPARE)
  async remind(@CurrentUser() u: AuthenticatedUser, @Body() b: Scoped) {
    return this.ar.remind(await this.actor(u, b.scope), b.scope);
  }
  @Post(':id/approve')
  @Permissions(P.FOUNDATION_REVIEW)
  async approve(
    @CurrentUser() u: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() b: Scoped & { reason: string },
  ) {
    return this.ar.review(
      await this.actor(u, b.scope),
      b.scope,
      id,
      'approve',
      b.reason,
    );
  }
  @Post(':id/reject')
  @Permissions(P.FOUNDATION_REVIEW)
  async reject(
    @CurrentUser() u: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() b: Scoped & { reason: string },
  ) {
    return this.ar.review(
      await this.actor(u, b.scope),
      b.scope,
      id,
      'reject',
      b.reason,
    );
  }
  @Post(':id/cancel')
  @Permissions(P.FOUNDATION_PREPARE)
  async cancel(
    @CurrentUser() u: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() b: Scoped & { reason: string },
  ) {
    return this.ar.review(
      await this.actor(u, b.scope),
      b.scope,
      id,
      'cancel',
      b.reason,
    );
  }
  @Post(':id/post')
  @Permissions(P.FOUNDATION_PREPARE)
  async postDoc(
    @CurrentUser() u: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() b: Scoped & { observation?: BankObservation },
  ) {
    return this.ar.post(
      await this.actor(u, b.scope),
      b.scope,
      id,
      b.observation,
    );
  }
}

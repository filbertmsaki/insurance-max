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
import { TradePayablesService } from './trade-payables.service';
import { FinanceOperatingPostingService } from '../../accounting/general-ledger/finance-operating-posting.service';
import type { Evidence } from '../../accounting/general-ledger/finance-gl-program';
import { fail, type Input } from './trade-payables.types';

type Scoped = { scope: FinanceBookSelection };
@Controller('tenant/finance/payables')
@TenantScoped()
export class TradePayablesController {
  constructor(
    private readonly ledger: FinanceLedgerFoundationService,
    private readonly ap: TradePayablesService,
    private readonly postings: FinanceOperatingPostingService,
  ) {}
  private actor(u: AuthenticatedUser, s: FinanceBookSelection) {
    if (u?.scope !== 'company' || !u.companyId || u.userType === 'CUSTOMER')
      throw new ForbiddenException(
        'An active company finance identity is required.',
      );
    if (!s?.bookId || !s?.legalEntityId)
      fail('Select a book and legal entity.');
    return this.ledger.resolveIdentity(u, s);
  }
  @Get('my-expenses')
  async employee(@CurrentUser() u: AuthenticatedUser) {
    return this.ap.employee(u);
  }
  @Post('my-expenses')
  async requestExpense(
    @CurrentUser() u: AuthenticatedUser,
    @Body() b: { input: Input },
  ) {
    if (!b.input) fail('Enter a staff request.');
    return this.ap.employee(u, b.input);
  }
  @Post('my-expenses/:id/withdraw')
  withdrawEmployee(
    @CurrentUser() u: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() b: { reason: string },
  ) {
    return this.ap.withdrawEmployee(u, id, b.reason);
  }
  @Get()
  @Permissions(P.FOUNDATION_READ)
  async workspace(
    @CurrentUser() u: AuthenticatedUser,
    @Query() s: FinanceBookSelection,
  ) {
    return this.ap.workspace(await this.actor(u, s), s);
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
      party?: string;
    },
  ) {
    return this.ap.reports(await this.actor(u, q), q, q);
  }
  @Get('schedule')
  @Permissions(P.FOUNDATION_READ)
  async schedule(
    @CurrentUser() u: AuthenticatedUser,
    @Query() q: FinanceBookSelection & { payOn: string; discounts: string },
  ) {
    return this.ap.schedule(
      await this.actor(u, q),
      q,
      q.payOn,
      q.discounts === 'true',
    );
  }
  @Post('schedule')
  @Permissions(P.FOUNDATION_PREPARE)
  async plan(
    @CurrentUser() u: AuthenticatedUser,
    @Body()
    b: Scoped & {
      payOn: string;
      selections: { itemId: string; bankId: string; requestKey: string }[];
      takeDiscount: boolean;
    },
  ) {
    return this.ap.plan(
      await this.actor(u, b.scope),
      b.scope,
      b.payOn,
      b.selections,
      b.takeDiscount === true,
    );
  }
  @Post()
  @Permissions(P.FOUNDATION_PREPARE)
  async submit(
    @CurrentUser() u: AuthenticatedUser,
    @Body() b: Scoped & { input: Input },
  ) {
    return this.ap.submit(await this.actor(u, b.scope), b.scope, b.input);
  }
  @Post('opening-imports')
  @Permissions(P.FOUNDATION_PREPARE)
  async importOpening(
    @CurrentUser() u: AuthenticatedUser,
    @Body() b: Scoped & { input: Input },
  ) {
    if (b.input?.kind !== 'OPENING_IMPORT')
      fail('Provide an opening invoice import.');
    return this.submit(u, b);
  }
  @Post(':id/review')
  @Permissions(P.FOUNDATION_REVIEW)
  async review(
    @CurrentUser() u: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() b: Scoped & { decision: string; reason: string },
  ) {
    if (!['APPROVE', 'REJECT'].includes(b.decision))
      fail('Select an approval decision.');
    return this.ap.review(
      await this.actor(u, b.scope),
      b.scope,
      id,
      b.decision === 'APPROVE',
      b.reason,
    );
  }
  @Post([':id/void-purchase', ':id/void-opening'])
  @Permissions(P.FOUNDATION_REVIEW)
  async voidPurchase(
    @CurrentUser() u: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() b: Scoped & { reason: string; evidence: Evidence },
  ) {
    return this.ap.voidPurchase(
      await this.actor(u, b.scope),
      b.scope,
      id,
      b.reason,
      b.evidence,
    );
  }
  @Post(':id/cancel')
  @Permissions(P.FOUNDATION_PREPARE)
  async cancel(
    @CurrentUser() u: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() b: Scoped & { reason: string },
  ) {
    return this.ap.cancel(await this.actor(u, b.scope), b.scope, id, b.reason);
  }
  @Post(':id/post')
  @Permissions(P.FOUNDATION_PREPARE)
  async post(
    @CurrentUser() u: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() b: Scoped & { observation?: BankObservation },
  ) {
    return this.ap.post(
      await this.actor(u, b.scope),
      b.scope,
      id,
      b.observation,
    );
  }
  @Post(':id/execute')
  @Permissions(P.FOUNDATION_PREPARE)
  async execute(
    @CurrentUser() u: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() b: Scoped & { observations: Record<string, BankObservation> },
  ) {
    return this.ap.settleBatch(
      await this.actor(u, b.scope),
      b.scope,
      id,
      b.observations,
    );
  }
  @Post(':id/instructions')
  @Permissions(P.FOUNDATION_PREPARE)
  async instructions(
    @CurrentUser() u: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() b: Scoped,
  ) {
    return this.ap.instructions(await this.actor(u, b.scope), b.scope, id);
  }
  @Post(':id/renew')
  @Permissions(P.FOUNDATION_PREPARE)
  async renew(
    @CurrentUser() u: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() b: Scoped & { reason: string; evidence: Evidence },
  ) {
    const a = await this.actor(u, b.scope),
      candidate = await this.ap.rejected(a, b.scope, id);
    return this.postings.renew(
      a,
      b.scope,
      candidate.id,
      candidate.hash,
      b.reason,
      b.evidence,
    );
  }
  @Post(':id/bank-review')
  @Permissions(P.FOUNDATION_REVIEW)
  async bank(
    @CurrentUser() u: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() b: Scoped,
  ) {
    return this.ap.bankReview(await this.actor(u, b.scope), b.scope, id);
  }
  @Get(':id/history')
  @Permissions(P.FOUNDATION_READ)
  async history(
    @CurrentUser() u: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() s: FinanceBookSelection,
  ) {
    return this.ap.history(await this.actor(u, s), s, id);
  }
}

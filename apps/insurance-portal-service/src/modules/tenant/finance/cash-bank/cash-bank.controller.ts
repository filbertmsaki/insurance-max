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
import { FinancePermissions as P } from '../governance/finance-permissions/finance.permissions';
import { FinanceLedgerFoundationService } from '../accounting/general-ledger/finance-ledger-foundation.service';
import type { FinanceBookSelection } from '../foundation/finance-configuration/finance-scope.service';
import { CashBankService } from './cash-bank.service';
import { uuid, type Input, bad } from './cash-bank.types';
type Scoped = { scope: FinanceBookSelection };
@Controller('tenant/finance/cash-bank')
@TenantScoped()
export class CashBankController {
  constructor(
    private readonly ledger: FinanceLedgerFoundationService,
    private readonly cash: CashBankService,
  ) {}
  private actor(u: AuthenticatedUser, s: FinanceBookSelection) {
    if (u?.scope !== 'company' || !u.companyId || u.userType === 'CUSTOMER')
      throw new ForbiddenException('Use a company finance identity.');
    uuid(s?.bookId);
    uuid(s?.legalEntityId);
    return this.ledger.resolveIdentity(u, s);
  }
  @Get() @Permissions(P.FOUNDATION_READ) async workspace(
    @CurrentUser() u: AuthenticatedUser,
    @Query() s: FinanceBookSelection,
  ) {
    return this.cash.workspace(await this.actor(u, s), s);
  }
  @Get('cutover') @Permissions(P.FOUNDATION_READ) async cutover(
    @CurrentUser() u: AuthenticatedUser,
    @Query()
    s: FinanceBookSelection & { role: string; currency: string; date: string },
  ) {
    return this.cash.cutover(
      await this.actor(u, s),
      s,
      s.role,
      s.currency,
      s.date,
    );
  }
  @Get('documents/:id') @Permissions(P.FOUNDATION_READ) async detail(
    @CurrentUser() u: AuthenticatedUser,
    @Query() s: FinanceBookSelection,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.cash.detail(await this.actor(u, s), s, id);
  }
  @Get('forecast') @Permissions(P.FOUNDATION_READ) async report(
    @CurrentUser() u: AuthenticatedUser,
    @Query() s: FinanceBookSelection & { from: string; to: string },
  ) {
    return this.cash.report(await this.actor(u, s), s, s.from, s.to);
  }
  @Get('statements/:id') @Permissions(P.FOUNDATION_READ) async summary(
    @CurrentUser() u: AuthenticatedUser,
    @Query() s: FinanceBookSelection,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.cash.summary(await this.actor(u, s), s, id);
  }
  @Get('eft/:id') @Permissions(P.FOUNDATION_PREPARE) async eft(
    @CurrentUser() u: AuthenticatedUser,
    @Query() s: FinanceBookSelection,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.cash.instruction(await this.actor(u, s), s, id);
  }
  @Post() @Permissions(P.FOUNDATION_PREPARE) async submit(
    @CurrentUser() u: AuthenticatedUser,
    @Body() b: Scoped & { input: Input },
  ) {
    return this.cash.submit(await this.actor(u, b.scope), b.scope, b.input);
  }
  @Post(':id/review') @Permissions(P.FOUNDATION_REVIEW) async review(
    @CurrentUser() u: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() b: Scoped & { decision: 'approve' | 'reject'; reason: string },
  ) {
    if (!['approve', 'reject'].includes(b.decision))
      bad('Choose approve or reject.');
    return this.cash.review(
      await this.actor(u, b.scope),
      b.scope,
      id,
      b.decision,
      b.reason,
    );
  }
  @Post(':id/cancel') @Permissions(P.FOUNDATION_PREPARE) async cancel(
    @CurrentUser() u: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() b: Scoped & { reason: string },
  ) {
    return this.cash.review(
      await this.actor(u, b.scope),
      b.scope,
      id,
      'cancel',
      b.reason,
    );
  }
  @Post(':id/post') @Permissions(P.FOUNDATION_PREPARE) async post(
    @CurrentUser() u: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() b: Scoped,
  ) {
    return this.cash.post(await this.actor(u, b.scope), b.scope, id);
  }
}

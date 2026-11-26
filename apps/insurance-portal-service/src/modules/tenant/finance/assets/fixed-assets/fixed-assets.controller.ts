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
import { FixedAssetsService } from './fixed-assets.service';
import { uuid, type Input } from './fixed-asset.types';

type Scoped = { scope: FinanceBookSelection };
@Controller('tenant/finance/fixed-assets')
@TenantScoped()
export class FixedAssetsController {
  constructor(
    private readonly ledger: FinanceLedgerFoundationService,
    private readonly assets: FixedAssetsService,
  ) {}
  private actor(u: AuthenticatedUser, s: FinanceBookSelection) {
    if (u?.scope !== 'company' || !u.companyId || u.userType === 'CUSTOMER')
      throw new ForbiddenException('A company finance identity is required.');
    uuid(s?.bookId);
    uuid(s?.legalEntityId);
    return this.ledger.resolveIdentity(u, s);
  }
  @Get()
  @Permissions(P.FOUNDATION_READ)
  async workspace(
    @CurrentUser() u: AuthenticatedUser,
    @Query() s: FinanceBookSelection,
  ) {
    return this.assets.workspace(await this.actor(u, s), s);
  }
  @Get('sources')
  @Permissions(P.FOUNDATION_READ)
  async sources(
    @CurrentUser() u: AuthenticatedUser,
    @Query()
    s: FinanceBookSelection & { q?: string; to: string; page?: string },
  ) {
    return this.assets.sources(
      await this.actor(u, s),
      s,
      s.q ?? '',
      s.to,
      Number(s.page ?? 0),
    );
  }
  @Get('reports')
  @Permissions(P.FOUNDATION_READ)
  async reports(
    @CurrentUser() u: AuthenticatedUser,
    @Query() s: FinanceBookSelection & { from: string; to: string },
  ) {
    return this.assets.reports(await this.actor(u, s), s, s.from, s.to);
  }
  @Post()
  @Permissions(P.FOUNDATION_PREPARE)
  async submit(
    @CurrentUser() u: AuthenticatedUser,
    @Body() b: Scoped & { input: Input },
  ) {
    return this.assets.submit(await this.actor(u, b.scope), b.scope, b.input);
  }
  @Post('revaluation-run')
  @Permissions(P.FOUNDATION_PREPARE)
  async revalue(
    @CurrentUser() u: AuthenticatedUser,
    @Body()
    b: Scoped & { input: Parameters<FixedAssetsService['revaluation']>[2] },
  ) {
    return this.assets.revaluation(
      await this.actor(u, b.scope),
      b.scope,
      b.input,
    );
  }
  @Post('depreciation-run')
  @Permissions(P.FOUNDATION_PREPARE)
  async run(
    @CurrentUser() u: AuthenticatedUser,
    @Body() b: Scoped & { input: Parameters<FixedAssetsService['batch']>[2] },
  ) {
    return this.assets.batch(await this.actor(u, b.scope), b.scope, b.input);
  }
  @Post(':id/approve')
  @Permissions(P.FOUNDATION_REVIEW)
  async approve(
    @CurrentUser() u: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() b: Scoped & { reason: string },
  ) {
    return this.assets.review(
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
    return this.assets.review(
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
    return this.assets.review(
      await this.actor(u, b.scope),
      b.scope,
      id,
      'cancel',
      b.reason,
    );
  }
  @Post(':id/post')
  @Permissions(P.FOUNDATION_PREPARE)
  async post(
    @CurrentUser() u: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() b: Scoped,
  ) {
    return this.assets.post(await this.actor(u, b.scope), b.scope, id);
  }
}

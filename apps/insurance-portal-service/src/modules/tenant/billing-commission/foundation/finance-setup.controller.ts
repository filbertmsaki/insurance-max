import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
  StreamableFile,
} from '@nestjs/common';
import type { Response } from 'express';
import { CurrentUser } from '@insurance-max/portal-shared/decorators/current-user.decorator';
import { Permissions } from '@insurance-max/portal-shared/decorators/permissions.decorator';
import { TenantScoped } from '@insurance-max/portal-shared';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';
import { FinancePermissions } from '../finance.permissions';
import { FinanceLedgerFoundationService } from './finance-ledger-foundation.service';
import { FinanceSetupService } from './finance-setup.service';
import { FinanceSetupConfigurationService } from './finance-setup-configuration.service';
import type { FinanceBookSelection } from './finance-scope.service';
import { setupObject, setupUuid } from './finance-setup.types';
import { FinanceSetupEvidenceService } from './finance-setup-evidence.service';

@Controller('tenant/finance/setup')
@TenantScoped()
export class FinanceSetupController {
  constructor(
    private readonly setup: FinanceSetupService,
    private readonly ledger: FinanceLedgerFoundationService,
    private readonly configuration: FinanceSetupConfigurationService,
    private readonly evidence: FinanceSetupEvidenceService,
  ) {}
  private scope(value: unknown): FinanceBookSelection {
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
  private body(value: unknown, keys: string[]) {
    if (
      !setupObject(value) ||
      Object.keys(value).some((k) => !['scope', ...keys].includes(k))
    )
      throw new BadRequestException('Unsupported setup request fields.');
    return { ...value, scope: this.scope(value.scope) } as any;
  }
  private actor(user: AuthenticatedUser, scope: FinanceBookSelection) {
    if (
      user?.scope !== 'company' ||
      !user.companyId ||
      !['COMPANY_USER', 'COMPANY_ADMIN'].includes(user.userType)
    )
      throw new ForbiddenException('Use the current company Finance session.');
    return this.ledger.resolveIdentity(user, scope);
  }
  @Get()
  @Permissions(FinancePermissions.FOUNDATION_READ)
  async overview(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: FinanceBookSelection,
  ) {
    const scope = this.scope(query);
    return this.setup.overview(await this.actor(user, scope), scope);
  }
  @Get('independent-identity')
  @Permissions(FinancePermissions.FOUNDATION_READ)
  async independentIdentity(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: FinanceBookSelection,
  ) {
    return this.independentIdentityFor(
      user,
      query,
      FinancePermissions.FOUNDATION_READ,
    );
  }
  @Get('independent-identity-prepare')
  @Permissions(FinancePermissions.FOUNDATION_PREPARE)
  async independentPrepareIdentity(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: FinanceBookSelection,
  ) {
    return this.independentIdentityFor(
      user,
      query,
      FinancePermissions.FOUNDATION_PREPARE,
    );
  }
  @Get('independent-identity-review')
  @Permissions(FinancePermissions.FOUNDATION_REVIEW)
  async independentReviewIdentity(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: FinanceBookSelection,
  ) {
    return this.independentIdentityFor(
      user,
      query,
      FinancePermissions.FOUNDATION_REVIEW,
    );
  }
  private async independentIdentityFor(
    user: AuthenticatedUser,
    query: FinanceBookSelection,
    permission: string,
  ) {
    const scope = this.scope(query);
    const actor = await this.actor(user, scope);
    return this.setup.withAccess(
      actor,
      scope,
      'READ',
      permission,
      async () => ({
        schema: 'FINANCE_PORTAL_IDENTITY_V1',
        tenantId: actor.tenantId,
        companyId: actor.sourceCompanyId,
        sourceUserId: actor.sourceUserId,
        subjectId: actor.subjectId,
        naturalPersonId: actor.naturalPersonId,
        legalEntityId: scope.legalEntityId,
        bookId: scope.bookId,
        postingAuthorized: false,
      }),
    );
  }
  @Get('versions/:id')
  @Permissions(FinancePermissions.FOUNDATION_READ)
  async detail(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: FinanceBookSelection & { subjectHash: string },
  ) {
    const scope = this.scope(query);
    return this.setup.detail(
      await this.actor(user, scope),
      scope,
      id,
      query.subjectHash,
    );
  }
  @Post('versions')
  @Permissions(FinancePermissions.SETUP_PREPARE)
  async create(@CurrentUser() user: AuthenticatedUser, @Body() value: unknown) {
    const b = this.body(value, ['input', 'reason']);
    return this.setup.create(
      await this.actor(user, b.scope),
      b.scope,
      b.input,
      b.reason,
    );
  }
  @Post('versions/:id/submit')
  @Permissions(FinancePermissions.SETUP_PREPARE)
  async submit(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() value: unknown,
  ) {
    const b = this.body(value, ['subjectHash', 'reason']);
    return this.setup.transition(
      await this.actor(user, b.scope),
      b.scope,
      id,
      b.subjectHash,
      'SUBMIT',
      b.reason,
    );
  }
  @Post('versions/:id/review')
  @Permissions(FinancePermissions.SETUP_REVIEW)
  async review(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() value: unknown,
  ) {
    const b = this.body(value, ['subjectHash', 'decision', 'reason']);
    if (!['REVIEW_INACTIVE', 'REJECT'].includes(b.decision))
      throw new BadRequestException('Choose inactive review or rejection.');
    return this.setup.transition(
      await this.actor(user, b.scope),
      b.scope,
      id,
      b.subjectHash,
      b.decision,
      b.reason,
    );
  }
  @Get('configurations/:id')
  @Permissions(FinancePermissions.FOUNDATION_READ)
  async configDetail(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: FinanceBookSelection & { subjectHash: string },
  ) {
    const scope = this.scope(query);
    return this.configuration.configuration(
      await this.actor(user, scope),
      scope,
      id,
      query.subjectHash,
    );
  }
  @Post('configurations')
  @Permissions(FinancePermissions.CONFIG_PREPARE)
  async createConfig(
    @CurrentUser() user: AuthenticatedUser,
    @Body() value: unknown,
  ) {
    const b = this.body(value, ['input', 'reason']);
    return this.configuration.createConfiguration(
      await this.actor(user, b.scope),
      b.scope,
      b.input,
      b.reason,
    );
  }
  @Post('configurations/:id/submit')
  @Permissions(FinancePermissions.CONFIG_PREPARE)
  async submitConfig(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() value: unknown,
  ) {
    const b = this.body(value, ['subjectHash', 'reason']);
    return this.configuration.configurationDecision(
      await this.actor(user, b.scope),
      b.scope,
      id,
      b.subjectHash,
      'SUBMIT',
      b.reason,
    );
  }
  @Post('configurations/:id/review')
  @Permissions(FinancePermissions.CONFIG_REVIEW)
  async reviewConfig(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() value: unknown,
  ) {
    const b = this.body(value, ['subjectHash', 'decision', 'reason']);
    if (!['REVIEW_INACTIVE', 'REJECT'].includes(b.decision))
      throw new BadRequestException('Choose inactive review or rejection.');
    return this.configuration.configurationDecision(
      await this.actor(user, b.scope),
      b.scope,
      id,
      b.subjectHash,
      b.decision,
      b.reason,
    );
  }
  @Post('source-attestations')
  @Permissions(FinancePermissions.CONFIG_REVIEW)
  async prepareSourceAttestation(
    @CurrentUser() user: AuthenticatedUser,
    @Body() value: unknown,
  ) {
    const b = this.body(value, ['masterId', 'subjectHash', 'reason']);
    return this.configuration.prepareSourceAttestation(
      await this.actor(user, b.scope),
      b.scope,
      b.masterId,
      b.subjectHash,
      b.reason,
    );
  }
  @Get('source-attestations/:id')
  @Permissions(FinancePermissions.FOUNDATION_READ)
  async sourceAttestation(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: FinanceBookSelection & { subjectHash: string },
  ) {
    const scope = this.scope(query);
    return this.configuration.sourceAttestation(
      await this.actor(user, scope),
      scope,
      id,
      query.subjectHash,
    );
  }
  @Post('source-attestations/:id/receipt')
  @Permissions(FinancePermissions.CONFIG_REVIEW)
  async reconcileSourceAttestation(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() value: unknown,
  ) {
    const b = this.body(value, [
      'receiptBodyBase64',
      'receiptSignature',
      'reason',
    ]);
    return this.configuration.reconcileSourceAttestation(
      await this.actor(user, b.scope),
      b.scope,
      id,
      b.receiptBodyBase64,
      b.receiptSignature,
      b.reason,
    );
  }
  @Post('source-delivery-workers')
  @Permissions(FinancePermissions.CONFIG_REVIEW)
  async grantSourceDeliveryWorker(
    @CurrentUser() user: AuthenticatedUser,
    @Body() value: unknown,
  ) {
    const b = this.body(value, ['input', 'reason']);
    return this.configuration.grantSourceDeliveryWorker(
      await this.actor(user, b.scope),
      b.scope,
      b.input,
      b.reason,
    );
  }
  @Post('source-delivery-workers/:id/revoke')
  @Permissions(FinancePermissions.CONFIG_REVIEW)
  async revokeSourceDeliveryWorker(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() value: unknown,
  ) {
    const b = this.body(value, ['reason']);
    return this.configuration.revokeSourceDeliveryWorker(
      await this.actor(user, b.scope),
      b.scope,
      id,
      b.reason,
    );
  }
  @Post('source-maps')
  @Permissions(FinancePermissions.CONFIG_PREPARE)
  async createSourceMap(
    @CurrentUser() user: AuthenticatedUser,
    @Body() value: unknown,
  ) {
    const b = this.body(value, ['input', 'reason']);
    return this.configuration.createSourceMap(
      await this.actor(user, b.scope),
      b.scope,
      b.input,
      b.reason,
    );
  }
  @Post('allocation-workers')
  @Permissions(FinancePermissions.CONFIG_REVIEW)
  async grantAllocationWorker(
    @CurrentUser() user: AuthenticatedUser,
    @Body() value: unknown,
  ) {
    const b = this.body(value, ['input', 'reason']);
    return this.configuration.grantAllocationWorker(
      await this.actor(user, b.scope),
      b.scope,
      b.input,
      b.reason,
    );
  }
  @Post('allocation-workers/:id/revoke')
  @Permissions(FinancePermissions.CONFIG_REVIEW)
  async revokeAllocationWorker(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() value: unknown,
  ) {
    const b = this.body(value, ['reason']);
    return this.configuration.revokeAllocationWorker(
      await this.actor(user, b.scope),
      b.scope,
      id,
      b.reason,
    );
  }
  @Post('allocation-previews/:id/review')
  @Permissions(FinancePermissions.CONFIG_REVIEW)
  async reviewAllocationPreview(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() value: unknown,
  ) {
    const b = this.body(value, ['subjectHash', 'reason']);
    return this.configuration.reviewAllocationPreview(
      await this.actor(user, b.scope),
      b.scope,
      id,
      b.subjectHash,
      b.reason,
    );
  }
  @Get('allocation-previews')
  @Permissions(FinancePermissions.FOUNDATION_READ)
  async allocationPreviews(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: FinanceBookSelection,
  ) {
    const scope = this.scope(query);
    return this.configuration.allocationPreviews(
      await this.actor(user, scope),
      scope,
    );
  }
  @Post('source-maps/:id/read-mandate')
  @Permissions(FinancePermissions.CONFIG_REVIEW)
  async sourceRead(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() value: unknown,
  ) {
    const b = this.body(value, ['subjectHash', 'reason']);
    return this.configuration.claimSourceRead(
      await this.actor(user, b.scope),
      b.scope,
      id,
      b.subjectHash,
      b.reason,
    );
  }
  @Post('policies')
  @Permissions(FinancePermissions.POLICY_PREPARE)
  async preparePolicy(
    @CurrentUser() user: AuthenticatedUser,
    @Body() value: unknown,
  ) {
    const b = this.body(value, ['definition']);
    return this.configuration.createPolicy(
      await this.actor(user, b.scope),
      b.scope,
      b.definition,
    );
  }
  @Get('policies/:id')
  @Permissions(FinancePermissions.FOUNDATION_READ)
  async policy(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: FinanceBookSelection & { subjectHash: string },
  ) {
    const scope = this.scope(query);
    return this.configuration.policy(
      await this.actor(user, scope),
      scope,
      id,
      query.subjectHash,
    );
  }
  @Get('evidence/:id')
  @Permissions(FinancePermissions.FOUNDATION_READ)
  async downloadEvidence(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query()
    query: FinanceBookSelection & { documentId: string; subjectHash: string },
    @Res({ passthrough: true }) response: Response,
  ) {
    const scope = this.scope({
      legalEntityId: query.legalEntityId,
      bookId: query.bookId,
    });
    const file = await this.evidence.download(
      await this.actor(user, scope),
      scope,
      {
        id,
        documentId: query.documentId,
        hash: query.subjectHash,
        purpose: 'SETUP_REVIEW',
      },
    );
    response.setHeader('Content-Type', 'application/octet-stream');
    response.setHeader(
      'Content-Disposition',
      "attachment; filename*=UTF-8''" + encodeURIComponent(file.fileName),
    );
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
    return new StreamableFile(file.buffer);
  }
  @Post('policies/:id/configure')
  @Permissions(FinancePermissions.POLICY_PREPARE)
  async configurePolicy(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() value: unknown,
  ) {
    const b = this.body(value, ['subjectHash', 'evidenceHash', 'reason']);
    return this.configuration.policyDecision(
      await this.actor(user, b.scope),
      b.scope,
      id,
      b.subjectHash,
      'CONFIGURE',
      b.evidenceHash,
      b.reason,
    );
  }
  @Post('policies/:id/inactive-decisions')
  @Permissions(FinancePermissions.POLICY_DECIDE)
  async decidePolicy(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() value: unknown,
  ) {
    const b = this.body(value, [
      'subjectHash',
      'action',
      'evidenceHash',
      'reason',
    ]);
    if (!['VALIDATE', 'APPROVE', 'NOT_APPLICABLE'].includes(b.action))
      throw new BadRequestException(
        'Policy activation and release are outside setup review.',
      );
    return this.configuration.policyDecision(
      await this.actor(user, b.scope),
      b.scope,
      id,
      b.subjectHash,
      b.action,
      b.evidenceHash,
      b.reason,
    );
  }
}

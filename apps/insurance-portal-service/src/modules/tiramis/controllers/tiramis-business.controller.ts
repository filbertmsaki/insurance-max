import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBody, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';

import { RequireTiramisPermissions } from '../auth/tiramis-permission.decorator';
import { TiramisPermissionGuard } from '../auth/tiramis-permission.guard';
import { TiramisPermissions } from '../auth/tiramis-permissions.constant';
import { listTiramisBusinessRecordMappings } from '../constants/tiramis-business-record-map.constant';
import { SubmitAnyTiramisBusinessDto } from '../dto/submit-any-tiramis-business.dto';
import { SubmitBusinessRecordToTiramisDto } from '../dto/submit-business-record-to-tiramis.dto';
import { TiramisDashboardQueryDto } from '../dto/tiramis-dashboard-query.dto';
import { TiramisBusinessStatusQueryDto } from '../dto/tiramis-business-status-query.dto';
import { ValidateTiramisBusinessDto } from '../dto/validate-tiramis-business.dto';
import { TiramisRequestType } from '../enums/tiramis-request-type.enum';
import { TiramisAccessScopeService } from '../services/tiramis-access-scope.service';
import { TiramisDashboardService } from '../services/tiramis-dashboard.service';
import { TiramisBusinessSchemaService } from '../services/tiramis-business-schema.service';
import { TiramisBusinessSubmitService } from '../services/tiramis-business-submit.service';
import { TiramisStatusSyncService } from '../services/tiramis-status-sync.service';
import { buildTiramisBusinessFingerprint } from '../utils/tiramis-idempotency.util';

@ApiTags('TIRAMIS Business')
@Controller('tiramis/business')
@UseGuards(AuthGuard('jwt'), TiramisPermissionGuard)
@RequireTiramisPermissions(TiramisPermissions.SUBMIT)
export class TiramisBusinessController {
  constructor(
    private readonly tiramisBusinessSubmitService: TiramisBusinessSubmitService,
    private readonly tiramisStatusSyncService: TiramisStatusSyncService,
    private readonly tiramisBusinessSchemaService: TiramisBusinessSchemaService,
    private readonly tiramisDashboardService: TiramisDashboardService,
    private readonly tiramisAccessScopeService: TiramisAccessScopeService,
  ) {}

  @ApiOperation({ summary: 'List TIRAMIS business record mappings' })
  @RequireTiramisPermissions(TiramisPermissions.VIEW_TRACKING)
  @Get('mappings')
  listMappings() {
    return {
      success: true,
      mappings: listTiramisBusinessRecordMappings(),
    };
  }

  @ApiOperation({
    summary: 'Check whether business tables have TIRAMIS result columns',
  })
  @RequireTiramisPermissions(TiramisPermissions.VIEW_TRACKING)
  @Get('schema-status')
  getBusinessSchemaStatus() {
    return this.tiramisBusinessSchemaService.getSchemaStatus();
  }

  @ApiOperation({
    summary: 'Validate TIRAMIS business payload without submitting',
  })
  @ApiBody({ type: ValidateTiramisBusinessDto })
  @RequireTiramisPermissions(TiramisPermissions.VALIDATE)
  @Post('validate')
  validateBusinessSubmission(
    @Body() dto: ValidateTiramisBusinessDto,
    @Req() req: any,
  ) {
    return this.tiramisBusinessSubmitService.validateBusinessSubmission({
      requestType: dto.requestType,
      sourceModule: dto.sourceModule,
      sourceRecordId: dto.sourceRecordId,
      payload: dto.payload || null,
      authContext: this.getAuthContext(req),
    });
  }

  @ApiOperation({ summary: 'List supported TIRAMIS request types' })
  @RequireTiramisPermissions(TiramisPermissions.VIEW_TRACKING)
  @Get('request-types')
  listRequestTypes() {
    return {
      success: true,
      requestTypes: Object.values(TiramisRequestType),
    };
  }

  @ApiOperation({
    summary: 'Get tenant TIRAMIS dashboard',
  })
  @RequireTiramisPermissions(TiramisPermissions.VIEW_TRACKING)
  @Get('dashboard')
  getTenantDashboard(@Query() query: TiramisDashboardQueryDto, @Req() req: any) {
    return this.tiramisDashboardService.getDashboard(
      query,
      this.getScope(req),
    );
  }

  @ApiOperation({
    summary: 'Get tenant TIRAMIS health',
  })
  @RequireTiramisPermissions(TiramisPermissions.VIEW_TRACKING)
  @Get('health')
  getTenantHealth(@Query() query: TiramisDashboardQueryDto, @Req() req: any) {
    return this.tiramisDashboardService.getHealth(query, this.getScope(req));
  }

  @ApiOperation({
    summary: 'Submit any business record to TIRAMIS using request body',
  })
  @ApiBody({ type: SubmitAnyTiramisBusinessDto })
  @RequireTiramisPermissions(TiramisPermissions.SUBMIT)
  @Post('submit')
  submitAnyBusinessRecord(
    @Body() dto: SubmitAnyTiramisBusinessDto,
    @Req() req: any,
  ) {
    return this.tiramisBusinessSubmitService.submitAnyBusinessRecord({
      requestType: dto.requestType,
      sourceModule: dto.sourceModule,
      sourceRecordId: dto.sourceRecordId,
      businessReference: dto.businessReference,
      payload: dto.payload || null,
      forceResubmit: dto.forceResubmit,
      returnExisting: dto.returnExisting,
      authContext: this.getAuthContext(req),
    });
  }

  @ApiOperation({
    summary: 'Submit any business record to TIRAMIS using URL params',
  })
  @ApiBody({ type: SubmitBusinessRecordToTiramisDto })
  @RequireTiramisPermissions(TiramisPermissions.SUBMIT)
  @Post(':requestType/:sourceModule/:sourceRecordId/submit')
  submitAnyBusinessRecordByParams(
    @Param('requestType') requestTypeParam: string,
    @Param('sourceModule') sourceModule: string,
    @Param('sourceRecordId') sourceRecordId: string,
    @Body() dto: SubmitBusinessRecordToTiramisDto = {},
    @Req() req: any,
  ) {
    const requestType = this.parseRequestType(requestTypeParam);

    return this.tiramisBusinessSubmitService.submitAnyBusinessRecord({
      requestType,
      sourceModule,
      sourceRecordId,
      businessReference: dto.businessReference,
      payload: dto.payload || null,
      forceResubmit: dto.forceResubmit,
      returnExisting: dto.returnExisting,
      authContext: this.getAuthContext(req),
    });
  }

  @ApiOperation({
    summary: 'Get latest TIRAMIS status for a business record',
  })
  @RequireTiramisPermissions(TiramisPermissions.VIEW_TRACKING)
  @Get(':sourceModule/:sourceRecordId/status')
  getBusinessRecordStatus(
    @Param('sourceModule') sourceModule: string,
    @Param('sourceRecordId') sourceRecordId: string,
    @Query() query: TiramisBusinessStatusQueryDto,
    @Req() req: any,
  ) {
    return this.tiramisBusinessSubmitService.getBusinessRecordStatus({
      sourceModule,
      sourceRecordId,
      requestType: query.requestType || null,
      includePayload: query.includePayload === 'true',
      includeHistory: query.includeHistory === 'true',
      authContext: this.getAuthContext(req),
    });
  }

  @ApiOperation({
    summary: 'Get TIRAMIS submission history for a business record',
  })
  @RequireTiramisPermissions(TiramisPermissions.VIEW_TRACKING)
  @Get(':sourceModule/:sourceRecordId/history')
  getBusinessRecordHistory(
    @Param('sourceModule') sourceModule: string,
    @Param('sourceRecordId') sourceRecordId: string,
    @Query() query: TiramisBusinessStatusQueryDto,
    @Req() req: any,
  ) {
    return this.tiramisBusinessSubmitService.getBusinessRecordHistory({
      sourceModule,
      sourceRecordId,
      requestType: query.requestType || null,
      includePayload: query.includePayload === 'true',
      authContext: this.getAuthContext(req),
    });
  }

  @ApiOperation({
    summary: 'Sync latest TIRAMIS status for one business record',
  })
  @RequireTiramisPermissions(TiramisPermissions.SYNC)
  @Post(':sourceModule/:sourceRecordId/sync')
  syncBusinessRecordStatus(
    @Param('sourceModule') sourceModule: string,
    @Param('sourceRecordId') sourceRecordId: string,
    @Query('requestType') requestType: string,
    @Req() req: any,
  ) {
    const authContext = this.getAuthContext(req);
    const scope = this.tiramisAccessScopeService.resolveScope(authContext);

    return this.tiramisStatusSyncService.syncLatestBusinessRecord({
      sourceModule,
      sourceRecordId,
      requestType: requestType || null,
      sourceCompanyId: scope.companyId,
      canAccessAllCompanies: scope.canAccessAllCompanies,
    });
  }

  @ApiOperation({
    summary: 'Check whether a business record has an active TIRAMIS duplicate',
  })
  @RequireTiramisPermissions(TiramisPermissions.VIEW_TRACKING)
  @Get(':requestType/:sourceModule/:sourceRecordId/duplicate-check')
  async checkDuplicate(
    @Param('requestType') requestTypeParam: string,
    @Param('sourceModule') sourceModule: string,
    @Param('sourceRecordId') sourceRecordId: string,
    @Query('businessReference') businessReference: string,
    @Req() req: any,
  ) {
    const requestType = this.parseRequestType(requestTypeParam);
    const authContext = this.getAuthContext(req);
    const scope = this.tiramisAccessScopeService.resolveScope(authContext);

    this.tiramisAccessScopeService.assertHasPermission(
      scope,
      TiramisPermissions.VIEW_TRACKING,
    );

    const sourceCompanyId = scope.companyId;

    const resolvedBusinessReference = businessReference || sourceRecordId;

    const businessFingerprint = buildTiramisBusinessFingerprint({
      sourceCompanyId,
      requestType,
      sourceModule,
      sourceRecordId,
      businessReference: resolvedBusinessReference,
    });

    const duplicate =
      await this.tiramisBusinessSubmitService.findDuplicateForBusinessRecord({
        sourceCompanyId,
        requestType,
        sourceModule,
        sourceRecordId,
        businessReference: resolvedBusinessReference,
        businessFingerprint,
      });

    return {
      success: true,
      duplicateFound: !!duplicate,
      requestType,
      sourceModule,
      sourceRecordId,
      businessReference: resolvedBusinessReference,
      businessFingerprint,
      duplicate,
    };
  }

  @ApiOperation({ summary: 'Submit cover note to TIRAMIS' })
  @ApiQuery({
    name: 'type',
    required: false,
    enum: [
      TiramisRequestType.NON_MOTOR,
      TiramisRequestType.MOTOR,
      TiramisRequestType.MOTOR_FLEET,
    ],
    example: TiramisRequestType.NON_MOTOR,
  })
  @ApiBody({ type: SubmitBusinessRecordToTiramisDto })
  @Post('cover-notes/:id/submit')
  submitCoverNote(
    @Param('id') id: string,
    @Query('type') type: TiramisRequestType,
    @Body() dto: SubmitBusinessRecordToTiramisDto = {},
    @Req() req: any,
  ) {
    const requestType = type || TiramisRequestType.NON_MOTOR;

    return this.tiramisBusinessSubmitService.submitCoverNote({
      id: dto.sourceRecordId || id,
      requestType: requestType as any,
      payload: dto?.payload || null,
      businessReference: dto?.businessReference,
      forceResubmit: dto?.forceResubmit,
      returnExisting: dto?.returnExisting,
      authContext: this.getAuthContext(req),
    });
  }

  @ApiOperation({ summary: 'Submit reinsurance to TIRAMIS' })
  @ApiBody({ type: SubmitBusinessRecordToTiramisDto })
  @Post('reinsurance/:id/submit')
  submitReinsurance(
    @Param('id') id: string,
    @Body() dto: SubmitBusinessRecordToTiramisDto = {},
    @Req() req: any,
  ) {
    return this.tiramisBusinessSubmitService.submitReinsurance({
      id: dto.sourceRecordId || id,
      payload: dto?.payload || null,
      businessReference: dto?.businessReference,
      forceResubmit: dto?.forceResubmit,
      returnExisting: dto?.returnExisting,
      authContext: this.getAuthContext(req),
    });
  }

  @ApiOperation({ summary: 'Submit policy to TIRAMIS' })
  @ApiBody({ type: SubmitBusinessRecordToTiramisDto })
  @Post('policies/:id/submit')
  submitPolicy(
    @Param('id') id: string,
    @Body() dto: SubmitBusinessRecordToTiramisDto = {},
    @Req() req: any,
  ) {
    return this.tiramisBusinessSubmitService.submitPolicy({
      id: dto.sourceRecordId || id,
      payload: dto?.payload || null,
      businessReference: dto?.businessReference,
      forceResubmit: dto?.forceResubmit,
      returnExisting: dto?.returnExisting,
      authContext: this.getAuthContext(req),
    });
  }

  @ApiOperation({ summary: 'Submit claim notification to TIRAMIS' })
  @ApiBody({ type: SubmitBusinessRecordToTiramisDto })
  @Post('claims/:id/notification/submit')
  submitClaimNotification(
    @Param('id') id: string,
    @Body() dto: SubmitBusinessRecordToTiramisDto = {},
    @Req() req: any,
  ) {
    return this.tiramisBusinessSubmitService.submitClaimNotification({
      id: dto.sourceRecordId || id,
      payload: dto?.payload || null,
      businessReference: dto?.businessReference,
      forceResubmit: dto?.forceResubmit,
      returnExisting: dto?.returnExisting,
      authContext: this.getAuthContext(req),
    });
  }

  @ApiOperation({ summary: 'Submit claim intimation to TIRAMIS' })
  @ApiBody({ type: SubmitBusinessRecordToTiramisDto })
  @Post('claims/:id/intimation/submit')
  submitClaimIntimation(
    @Param('id') id: string,
    @Body() dto: SubmitBusinessRecordToTiramisDto = {},
    @Req() req: any,
  ) {
    return this.tiramisBusinessSubmitService.submitClaimIntimation({
      id: dto.sourceRecordId || id,
      payload: dto?.payload || null,
      businessReference: dto?.businessReference,
      forceResubmit: dto?.forceResubmit,
      returnExisting: dto?.returnExisting,
      authContext: this.getAuthContext(req),
    });
  }

  @ApiOperation({ summary: 'Submit claim assessment to TIRAMIS' })
  @ApiBody({ type: SubmitBusinessRecordToTiramisDto })
  @Post('claims/:id/assessment/submit')
  submitClaimAssessment(
    @Param('id') id: string,
    @Body() dto: SubmitBusinessRecordToTiramisDto = {},
    @Req() req: any,
  ) {
    return this.tiramisBusinessSubmitService.submitClaimAssessment({
      id: dto.sourceRecordId || id,
      payload: dto?.payload || null,
      businessReference: dto?.businessReference,
      forceResubmit: dto?.forceResubmit,
      returnExisting: dto?.returnExisting,
      authContext: this.getAuthContext(req),
    });
  }

  @ApiOperation({ summary: 'Submit discharge voucher to TIRAMIS' })
  @ApiBody({ type: SubmitBusinessRecordToTiramisDto })
  @Post('claims/:id/discharge-voucher/submit')
  submitDischargeVoucher(
    @Param('id') id: string,
    @Body() dto: SubmitBusinessRecordToTiramisDto = {},
    @Req() req: any,
  ) {
    return this.tiramisBusinessSubmitService.submitDischargeVoucher({
      id: dto.sourceRecordId || id,
      payload: dto?.payload || null,
      businessReference: dto?.businessReference,
      forceResubmit: dto?.forceResubmit,
      returnExisting: dto?.returnExisting,
      authContext: this.getAuthContext(req),
    });
  }

  @ApiOperation({ summary: 'Submit claim payment to TIRAMIS' })
  @ApiBody({ type: SubmitBusinessRecordToTiramisDto })
  @Post('claims/:id/payment/submit')
  submitClaimPayment(
    @Param('id') id: string,
    @Body() dto: SubmitBusinessRecordToTiramisDto = {},
    @Req() req: any,
  ) {
    return this.tiramisBusinessSubmitService.submitClaimPayment({
      id: dto.sourceRecordId || id,
      payload: dto?.payload || null,
      businessReference: dto?.businessReference,
      forceResubmit: dto?.forceResubmit,
      returnExisting: dto?.returnExisting,
      authContext: this.getAuthContext(req),
    });
  }

  @ApiOperation({ summary: 'Submit claim rejection to TIRAMIS' })
  @ApiBody({ type: SubmitBusinessRecordToTiramisDto })
  @Post('claims/:id/rejection/submit')
  submitClaimRejection(
    @Param('id') id: string,
    @Body() dto: SubmitBusinessRecordToTiramisDto = {},
    @Req() req: any,
  ) {
    return this.tiramisBusinessSubmitService.submitClaimRejection({
      id: dto.sourceRecordId || id,
      payload: dto?.payload || null,
      businessReference: dto?.businessReference,
      forceResubmit: dto?.forceResubmit,
      returnExisting: dto?.returnExisting,
      authContext: this.getAuthContext(req),
    });
  }

  @ApiOperation({ summary: 'Submit cover note verification to TIRAMIS' })
  @ApiBody({ type: SubmitBusinessRecordToTiramisDto })
  @Post('verifications/cover-note/submit')
  submitCoverNoteVerification(
    @Body() dto: SubmitBusinessRecordToTiramisDto = {},
    @Req() req: any,
  ) {
    return this.tiramisBusinessSubmitService.submitVerification({
      requestType: TiramisRequestType.COVER_NOTE_VERIFICATION,
      sourceRecordId: dto.sourceRecordId,
      payload: dto?.payload || null,
      businessReference: dto?.businessReference,
      forceResubmit: dto?.forceResubmit,
      returnExisting: dto?.returnExisting,
      authContext: this.getAuthContext(req),
    });
  }

  @ApiOperation({ summary: 'Submit motor verification to TIRAMIS' })
  @ApiBody({ type: SubmitBusinessRecordToTiramisDto })
  @Post('verifications/motor/submit')
  submitMotorVerification(
    @Body() dto: SubmitBusinessRecordToTiramisDto = {},
    @Req() req: any,
  ) {
    return this.tiramisBusinessSubmitService.submitVerification({
      requestType: TiramisRequestType.MOTOR_VERIFICATION,
      sourceRecordId: dto.sourceRecordId,
      payload: dto?.payload || null,
      businessReference: dto?.businessReference,
      forceResubmit: dto?.forceResubmit,
      returnExisting: dto?.returnExisting,
      authContext: this.getAuthContext(req),
    });
  }

  @ApiOperation({ summary: 'Submit NIN verification to TIRAMIS' })
  @ApiBody({ type: SubmitBusinessRecordToTiramisDto })
  @Post('verifications/nin/submit')
  submitNinVerification(
    @Body() dto: SubmitBusinessRecordToTiramisDto = {},
    @Req() req: any,
  ) {
    return this.tiramisBusinessSubmitService.submitVerification({
      requestType: TiramisRequestType.NIN_VERIFICATION,
      sourceRecordId: dto.sourceRecordId,
      payload: dto?.payload || null,
      businessReference: dto?.businessReference,
      forceResubmit: dto?.forceResubmit,
      returnExisting: dto?.returnExisting,
      authContext: this.getAuthContext(req),
    });
  }

  @ApiOperation({ summary: 'Submit company verification to TIRAMIS' })
  @ApiBody({ type: SubmitBusinessRecordToTiramisDto })
  @Post('verifications/company/submit')
  submitCompanyVerification(
    @Body() dto: SubmitBusinessRecordToTiramisDto = {},
    @Req() req: any,
  ) {
    return this.tiramisBusinessSubmitService.submitVerification({
      requestType: TiramisRequestType.COMPANY_VERIFICATION,
      sourceRecordId: dto.sourceRecordId,
      payload: dto?.payload || null,
      businessReference: dto?.businessReference,
      forceResubmit: dto?.forceResubmit,
      returnExisting: dto?.returnExisting,
      authContext: this.getAuthContext(req),
    });
  }

  @ApiOperation({ summary: 'Submit details verification to TIRAMIS' })
  @ApiBody({ type: SubmitBusinessRecordToTiramisDto })
  @Post('verifications/details/submit')
  submitDetailsVerification(
    @Body() dto: SubmitBusinessRecordToTiramisDto = {},
    @Req() req: any,
  ) {
    return this.tiramisBusinessSubmitService.submitVerification({
      requestType: TiramisRequestType.DETAILS_VERIFICATION,
      sourceRecordId: dto.sourceRecordId,
      payload: dto?.payload || null,
      businessReference: dto?.businessReference,
      forceResubmit: dto?.forceResubmit,
      returnExisting: dto?.returnExisting,
      authContext: this.getAuthContext(req),
    });
  }

  private parseRequestType(value: string): TiramisRequestType {
    const normalized = String(value || '')
      .trim()
      .toUpperCase();

    const found = Object.values(TiramisRequestType).find(
      (item) => item === normalized,
    );

    if (!found) {
      throw new BadRequestException({
        message: `Unsupported TIRAMIS request type: ${value}`,
        allowedRequestTypes: Object.values(TiramisRequestType),
      });
    }

    return found as TiramisRequestType;
  }

  private getAuthContext(req: any) {
    return {
      userId: req.user?.id || req.user?.sub || null,
      sub: req.user?.sub || null,
      email: req.user?.email || null,
      userType: req.user?.user_type || req.user?.userType || null,
      companyId:
        req.user?.companyId ||
        req.user?.active_company_id ||
        req.user?.activeCompanyId ||
        null,
      activeCompanyId:
        req.user?.active_company_id ||
        req.user?.activeCompanyId ||
        req.user?.companyId ||
        null,
      branchId:
        req.user?.branchId ||
        req.user?.active_branch_id ||
        req.user?.activeBranchId ||
        null,
      activeBranchId:
        req.user?.active_branch_id ||
        req.user?.activeBranchId ||
        req.user?.branchId ||
        null,
      permissionCodes:
        req.user?.permission_codes ||
        req.user?.permissionCodes ||
        req.user?.permissions ||
        [],
      roleCodes:
        req.user?.role_codes || req.user?.roleCodes || req.user?.roles || [],
      correlationId:
        req.headers?.['x-correlation-id'] ||
        req.headers?.['x-request-id'] ||
        null,
      method: req.method || null,
      endpoint: req.originalUrl || req.url || null,
      ipAddress:
        req.ip ||
        req.headers?.['x-forwarded-for'] ||
        req.connection?.remoteAddress ||
        null,
      userAgent: req.headers?.['user-agent'] || null,
    };
  }

  private getScope(req: any) {
    const authContext = this.getAuthContext(req);
    const scope = this.tiramisAccessScopeService.resolveScope(authContext);

    return {
      companyId: scope.companyId,
      canAccessAllCompanies: scope.canAccessAllCompanies,
    };
  }
}

import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';

import { CurrentUser } from '@insurance-max/portal-shared/decorators/current-user.decorator';
import { Permissions } from '@insurance-max/portal-shared/decorators/permissions.decorator';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';

import {
  AcceptFacultativeOfferDto,
  AdmitRecoveryDto,
  CreateFacultativePlacementDto,
  CreatePolicyCessionDto,
  CreateReinsuranceSettlementDto,
  CreateTreatyDto,
  CreateTreatyParticipantDto,
  CreateTreatySectionDto,
  EvaluateCapacityDto,
  EvaluateQuotationCapacityDto,
  GenerateReinsuranceBordereauDto,
  GenerateReinsurancePremiumAccountDto,
  InviteFacultativeOfferDto,
  RejectReinsuranceSettlementDto,
  RespondFacultativeOfferDto,
} from './dto/reinsurance.dto';
import { ReinsurancePermissions } from './reinsurance.permissions';
import { ReinsuranceService } from './reinsurance.service';
import { ReinsuranceCapacityService } from './services/reinsurance-capacity.service';
import { ReinsuranceAccountingService } from './services/reinsurance-accounting.service';
import { ReinsuranceRecoveryService } from './services/reinsurance-recovery.service';
import { ReinsuranceSettlementService } from './services/reinsurance-settlement.service';
import { TenantScoped } from '@insurance-max/portal-shared';

@Controller('tenant/reinsurance')
@TenantScoped()
export class ReinsuranceController {
  constructor(
    private readonly reinsuranceService: ReinsuranceService,
    private readonly recoveryService: ReinsuranceRecoveryService,
    private readonly capacityService: ReinsuranceCapacityService,
    private readonly accountingService: ReinsuranceAccountingService,
    private readonly settlementService: ReinsuranceSettlementService,
  ) {}

  @Get('treaties')
  @Permissions(ReinsurancePermissions.READ)
  findTreaties(@CurrentUser() user: AuthenticatedUser) {
    return this.reinsuranceService.findTreaties(user);
  }

  @Post('treaties')
  @Permissions(ReinsurancePermissions.TREATY_CREATE)
  createTreaty(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateTreatyDto,
  ) {
    return this.reinsuranceService.createTreaty(user, dto);
  }

  @Post('treaties/:id/sections')
  @Permissions(ReinsurancePermissions.TREATY_UPDATE)
  addSection(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateTreatySectionDto,
  ) {
    return this.reinsuranceService.addTreatySection(user, id, dto);
  }

  @Post('treaties/:id/participants')
  @Permissions(ReinsurancePermissions.TREATY_UPDATE)
  addParticipant(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateTreatyParticipantDto,
  ) {
    return this.reinsuranceService.addTreatyParticipant(user, id, dto);
  }

  @Post('treaties/:id/submit')
  @Permissions(ReinsurancePermissions.TREATY_SUBMIT)
  submitTreaty(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.reinsuranceService.submitTreaty(user, id);
  }

  @Post('treaties/:id/approve')
  @Permissions(ReinsurancePermissions.TREATY_APPROVE)
  approveTreaty(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.reinsuranceService.approveTreaty(user, id);
  }

  @Post('treaties/:id/activate')
  @Permissions(ReinsurancePermissions.TREATY_ACTIVATE)
  activateTreaty(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.reinsuranceService.activateTreaty(user, id);
  }

  @Post('facultative-placements')
  @Permissions(ReinsurancePermissions.PLACEMENT_CREATE)
  createPlacement(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateFacultativePlacementDto,
  ) {
    return this.reinsuranceService.createFacultativePlacement(user, dto);
  }

  @Post('facultative-placements/:id/offers')
  @Permissions(ReinsurancePermissions.PLACEMENT_MARKET)
  inviteOffer(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: InviteFacultativeOfferDto,
  ) {
    return this.reinsuranceService.inviteFacultativeOffer(user, id, dto);
  }

  @Post('facultative-offers/:id/respond')
  @Permissions(ReinsurancePermissions.OFFER_RESPOND)
  respondToOffer(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RespondFacultativeOfferDto,
  ) {
    return this.reinsuranceService.respondToFacultativeOffer(user, id, dto);
  }

  @Post('facultative-offers/:id/accept')
  @Permissions(ReinsurancePermissions.PLACEMENT_CLOSE)
  acceptOffer(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AcceptFacultativeOfferDto,
  ) {
    return this.reinsuranceService.acceptFacultativeOffer(user, id, dto);
  }

  @Get('cessions')
  @Permissions(ReinsurancePermissions.READ)
  findCessions(@CurrentUser() user: AuthenticatedUser) {
    return this.reinsuranceService.findCessions(user);
  }

  @Post('cessions')
  @Permissions(ReinsurancePermissions.CESSION_CREATE)
  createCession(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreatePolicyCessionDto,
  ) {
    return this.reinsuranceService.createPolicyCession(user, dto);
  }

  @Post('cessions/:id/submit')
  @Permissions(ReinsurancePermissions.CESSION_SUBMIT)
  submitCession(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.reinsuranceService.submitCession(user, id);
  }

  @Post('cessions/:id/approve')
  @Permissions(ReinsurancePermissions.CESSION_APPROVE)
  approveCession(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.reinsuranceService.approveCession(user, id);
  }

  @Post('cessions/:id/apply')
  @Permissions(ReinsurancePermissions.CESSION_APPLY)
  applyCession(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.reinsuranceService.applyCession(user, id);
  }

  @Post('cessions/:id/declaration')
  @Permissions(ReinsurancePermissions.DECLARATION_CREATE)
  createDeclaration(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.reinsuranceService.createDeclaration(user, id);
  }

  @Post('declarations/:id/tiramis')
  @Permissions(ReinsurancePermissions.TIRAMIS_SUBMIT)
  submitDeclaration(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.reinsuranceService.submitDeclarationToTiramis(user, id);
  }

  @Post('claims/:claimId/recoveries/calculate')
  @Permissions(ReinsurancePermissions.RECOVERY_CREATE)
  calculateRecoveries(
    @CurrentUser() user: AuthenticatedUser,
    @Param('claimId', ParseUUIDPipe) claimId: string,
  ) {
    return this.recoveryService.calculateRecoveries(user, claimId);
  }

  @Post('recoveries/:id/admit')
  @Permissions(ReinsurancePermissions.RECOVERY_APPROVE)
  admitRecovery(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdmitRecoveryDto,
  ) {
    return this.recoveryService.admitRecovery(user, id, dto.admitted_amount);
  }

  @Post('capacity/evaluate')
  @Permissions(ReinsurancePermissions.CAPACITY_EVALUATE)
  evaluateCapacity(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: EvaluateCapacityDto,
  ) {
    return this.capacityService.evaluate(user, {
      treatyId: dto.treaty_id,
      treatySectionId: dto.treaty_section_id ?? null,
      exposureAmount: dto.exposure_amount,
      classOfBusiness: dto.class_of_business ?? null,
      territory: dto.territory ?? null,
    });
  }

  @Get('quotations/:id/capacity')
  @Permissions(ReinsurancePermissions.CAPACITY_EVALUATE)
  evaluateQuotationCapacity(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) _quotationId: string,
    @Query() query: EvaluateQuotationCapacityDto,
  ) {
    return this.capacityService.evaluate(user, {
      treatyId: query.treaty_id,
      treatySectionId: query.treaty_section_id ?? null,
      exposureAmount: query.exposure_amount,
      classOfBusiness: query.class_of_business ?? null,
      territory: query.territory ?? null,
    });
  }

  @Get('bordereaux')
  @Permissions(ReinsurancePermissions.READ)
  findBordereaux(@CurrentUser() user: AuthenticatedUser) {
    return this.accountingService.findBordereaux(user);
  }

  @Post('bordereaux')
  @Permissions(ReinsurancePermissions.BORDEREAU_CREATE)
  generateBordereau(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: GenerateReinsuranceBordereauDto,
  ) {
    return this.accountingService.generateBordereau(user, dto);
  }

  @Post('bordereaux/:id/submit')
  @Permissions(ReinsurancePermissions.BORDEREAU_SUBMIT)
  submitBordereau(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.accountingService.submitBordereau(user, id);
  }

  @Post('bordereaux/:id/approve')
  @Permissions(ReinsurancePermissions.BORDEREAU_APPROVE)
  approveBordereau(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.accountingService.approveBordereau(user, id);
  }

  @Get('premium-accounts')
  @Permissions(ReinsurancePermissions.READ)
  findPremiumAccounts(@CurrentUser() user: AuthenticatedUser) {
    return this.accountingService.findPremiumAccounts(user);
  }

  @Post('premium-accounts')
  @Permissions(ReinsurancePermissions.ACCOUNT_CREATE)
  generatePremiumAccount(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: GenerateReinsurancePremiumAccountDto,
  ) {
    return this.accountingService.generatePremiumAccount(user, dto);
  }

  @Post('premium-accounts/:id/submit')
  @Permissions(ReinsurancePermissions.ACCOUNT_SUBMIT)
  submitPremiumAccount(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.accountingService.submitPremiumAccount(user, id);
  }

  @Post('premium-accounts/:id/confirm')
  @Permissions(ReinsurancePermissions.ACCOUNT_APPROVE)
  confirmPremiumAccount(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.accountingService.confirmPremiumAccount(user, id);
  }

  @Get('settlements')
  @Permissions(ReinsurancePermissions.READ)
  findSettlements(@CurrentUser() user: AuthenticatedUser) {
    return this.settlementService.findAll(user);
  }

  @Post('settlements')
  @Permissions(ReinsurancePermissions.SETTLEMENT_CREATE)
  createSettlement(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateReinsuranceSettlementDto,
  ) {
    return this.settlementService.create(user, dto);
  }

  @Post('settlements/:id/submit')
  @Permissions(ReinsurancePermissions.SETTLEMENT_CREATE)
  submitSettlement(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.settlementService.submit(user, id);
  }

  @Post('settlements/:id/approve')
  @Permissions(ReinsurancePermissions.SETTLEMENT_APPROVE)
  approveSettlement(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.settlementService.approve(user, id);
  }

  @Post('settlements/:id/reject')
  @Permissions(ReinsurancePermissions.SETTLEMENT_APPROVE)
  rejectSettlement(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectReinsuranceSettlementDto,
  ) {
    return this.settlementService.reject(user, id, dto.reason);
  }

  @Post('settlements/:id/pay')
  @Permissions(ReinsurancePermissions.SETTLEMENT_PAY)
  paySettlement(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.settlementService.confirmPayment(user, id);
  }
}

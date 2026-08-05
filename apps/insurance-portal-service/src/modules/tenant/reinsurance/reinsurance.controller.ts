import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';

import { CurrentUser } from '@insurance-max/portal-shared/decorators/current-user.decorator';
import { Permissions } from '@insurance-max/portal-shared/decorators/permissions.decorator';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';

import {
  AcceptFacultativeOfferDto,
  AdmitRecoveryDto,
  CreateFacultativePlacementDto,
  CreatePolicyCessionDto,
  CreateTreatyDto,
  CreateTreatyParticipantDto,
  CreateTreatySectionDto,
  InviteFacultativeOfferDto,
  RespondFacultativeOfferDto,
} from './dto/reinsurance.dto';
import { ReinsurancePermissions } from './reinsurance.permissions';
import { ReinsuranceService } from './reinsurance.service';
import { ReinsuranceRecoveryService } from './services/reinsurance-recovery.service';
import { TenantScoped } from '@insurance-max/portal-shared';

@Controller('tenant/reinsurance')
@TenantScoped()
export class ReinsuranceController {
  constructor(
    private readonly reinsuranceService: ReinsuranceService,
    private readonly recoveryService: ReinsuranceRecoveryService,
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
}

import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

import { CurrentUser } from '@insurance-max/portal-shared/decorators/current-user.decorator';
import { Permissions } from '@insurance-max/portal-shared/decorators/permissions.decorator';
import { PermissionsGuard } from '@insurance-max/portal-shared/guards/permissions.guard';
import { TenantGuard } from '@insurance-max/portal-shared/guards/tenant.guard';
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

@Controller('tenant/reinsurance')
@UseGuards(AuthGuard('jwt'), TenantGuard)
export class ReinsuranceController {
  constructor(
    private readonly reinsuranceService: ReinsuranceService,
    private readonly recoveryService: ReinsuranceRecoveryService,
  ) {}

  @Get('treaties')
  @UseGuards(PermissionsGuard)
  @Permissions(ReinsurancePermissions.READ)
  findTreaties(@CurrentUser() user: AuthenticatedUser) {
    return this.reinsuranceService.findTreaties(user);
  }

  @Post('treaties')
  @UseGuards(PermissionsGuard)
  @Permissions(ReinsurancePermissions.TREATY_CREATE)
  createTreaty(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateTreatyDto,
  ) {
    return this.reinsuranceService.createTreaty(user, dto);
  }

  @Post('treaties/:id/sections')
  @UseGuards(PermissionsGuard)
  @Permissions(ReinsurancePermissions.TREATY_UPDATE)
  addSection(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateTreatySectionDto,
  ) {
    return this.reinsuranceService.addTreatySection(user, id, dto);
  }

  @Post('treaties/:id/participants')
  @UseGuards(PermissionsGuard)
  @Permissions(ReinsurancePermissions.TREATY_UPDATE)
  addParticipant(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateTreatyParticipantDto,
  ) {
    return this.reinsuranceService.addTreatyParticipant(user, id, dto);
  }

  @Post('treaties/:id/submit')
  @UseGuards(PermissionsGuard)
  @Permissions(ReinsurancePermissions.TREATY_SUBMIT)
  submitTreaty(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.reinsuranceService.submitTreaty(user, id);
  }

  @Post('treaties/:id/approve')
  @UseGuards(PermissionsGuard)
  @Permissions(ReinsurancePermissions.TREATY_APPROVE)
  approveTreaty(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.reinsuranceService.approveTreaty(user, id);
  }

  @Post('treaties/:id/activate')
  @UseGuards(PermissionsGuard)
  @Permissions(ReinsurancePermissions.TREATY_ACTIVATE)
  activateTreaty(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.reinsuranceService.activateTreaty(user, id);
  }

  @Post('facultative-placements')
  @UseGuards(PermissionsGuard)
  @Permissions(ReinsurancePermissions.PLACEMENT_CREATE)
  createPlacement(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateFacultativePlacementDto,
  ) {
    return this.reinsuranceService.createFacultativePlacement(user, dto);
  }

  @Post('facultative-placements/:id/offers')
  @UseGuards(PermissionsGuard)
  @Permissions(ReinsurancePermissions.PLACEMENT_MARKET)
  inviteOffer(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: InviteFacultativeOfferDto,
  ) {
    return this.reinsuranceService.inviteFacultativeOffer(user, id, dto);
  }

  @Post('facultative-offers/:id/respond')
  @UseGuards(PermissionsGuard)
  @Permissions(ReinsurancePermissions.OFFER_RESPOND)
  respondToOffer(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RespondFacultativeOfferDto,
  ) {
    return this.reinsuranceService.respondToFacultativeOffer(user, id, dto);
  }

  @Post('facultative-offers/:id/accept')
  @UseGuards(PermissionsGuard)
  @Permissions(ReinsurancePermissions.PLACEMENT_CLOSE)
  acceptOffer(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AcceptFacultativeOfferDto,
  ) {
    return this.reinsuranceService.acceptFacultativeOffer(user, id, dto);
  }

  @Get('cessions')
  @UseGuards(PermissionsGuard)
  @Permissions(ReinsurancePermissions.READ)
  findCessions(@CurrentUser() user: AuthenticatedUser) {
    return this.reinsuranceService.findCessions(user);
  }

  @Post('cessions')
  @UseGuards(PermissionsGuard)
  @Permissions(ReinsurancePermissions.CESSION_CREATE)
  createCession(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreatePolicyCessionDto,
  ) {
    return this.reinsuranceService.createPolicyCession(user, dto);
  }

  @Post('cessions/:id/submit')
  @UseGuards(PermissionsGuard)
  @Permissions(ReinsurancePermissions.CESSION_SUBMIT)
  submitCession(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.reinsuranceService.submitCession(user, id);
  }

  @Post('cessions/:id/approve')
  @UseGuards(PermissionsGuard)
  @Permissions(ReinsurancePermissions.CESSION_APPROVE)
  approveCession(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.reinsuranceService.approveCession(user, id);
  }

  @Post('cessions/:id/apply')
  @UseGuards(PermissionsGuard)
  @Permissions(ReinsurancePermissions.CESSION_APPLY)
  applyCession(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.reinsuranceService.applyCession(user, id);
  }

  @Post('cessions/:id/declaration')
  @UseGuards(PermissionsGuard)
  @Permissions(ReinsurancePermissions.DECLARATION_CREATE)
  createDeclaration(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.reinsuranceService.createDeclaration(user, id);
  }

  @Post('declarations/:id/tiramis')
  @UseGuards(PermissionsGuard)
  @Permissions(ReinsurancePermissions.TIRAMIS_SUBMIT)
  submitDeclaration(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.reinsuranceService.submitDeclarationToTiramis(user, id);
  }

  @Post('claims/:claimId/recoveries/calculate')
  @UseGuards(PermissionsGuard)
  @Permissions(ReinsurancePermissions.RECOVERY_CREATE)
  calculateRecoveries(
    @CurrentUser() user: AuthenticatedUser,
    @Param('claimId', ParseUUIDPipe) claimId: string,
  ) {
    return this.recoveryService.calculateRecoveries(user, claimId);
  }

  @Post('recoveries/:id/admit')
  @UseGuards(PermissionsGuard)
  @Permissions(ReinsurancePermissions.RECOVERY_APPROVE)
  admitRecovery(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdmitRecoveryDto,
  ) {
    return this.recoveryService.admitRecovery(user, id, dto.admitted_amount);
  }
}

import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { UnderwriteAction, UnderwriteLine } from '@insurance-max/contracts';
import { TenantScoped } from '@insurance-max/portal-shared';
import { CurrentUser } from '@insurance-max/portal-shared/decorators/current-user.decorator';
import { Permissions } from '@insurance-max/portal-shared/decorators/permissions.decorator';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';
import {
  CurrentUnderwriteLine,
  UnderwriteLineAccess,
} from '../common/underwrite-line.access';
import { UnderwriteLineGuard } from '../common/underwrite-line.guard';
import { UnderwriteQueryService } from '../common/underwrite-query.service';
import { UnderwriteTransactionsService } from '../common/underwrite-transactions.service';
import { PolicyTransaction } from '../../policy-transactions/entities/policy-transaction.entity';
import { FleetVehicleEndorsementService } from '../../policy-transactions/services/fleet-vehicle-endorsement.service';
import { AddFleetVehicleDto } from './dto/fleet-vehicle-endorsement.dto';
import { FleetRegisterService } from './fleet-register.service';
import { FleetVehiclesService } from './fleet-vehicles.service';

const FLEET_PARAM = {
  name: 'line',
  enum: ['fleet'],
  description: 'Fleet line only',
};

/**
 * Fleet-only endpoints under `tenant/underwrite/fleet/...`. They share the
 * `:line` guard (so the fleet gates apply) and answer 404 for other lines.
 * Access to the underlying quotation/policy is checked through the
 * line-scoped query service, which applies data scope.
 */
@ApiTags('underwrite')
@ApiBearerAuth()
@Controller('tenant/underwrite/:line')
@TenantScoped()
@UseGuards(UnderwriteLineGuard)
export class UnderwriteFleetController {
  constructor(
    private readonly queryService: UnderwriteQueryService,
    private readonly fleetVehicles: FleetVehiclesService,
    private readonly fleetRegister: FleetRegisterService,
    private readonly transactions: UnderwriteTransactionsService,
    private readonly fleetEndorsements: FleetVehicleEndorsementService,
  ) {}

  @Get('quotations/:id/vehicles')
  @Permissions('quotations:read')
  @UnderwriteLineAccess(UnderwriteAction.VIEW)
  @ApiParam(FLEET_PARAM)
  @ApiOperation({ summary: 'Vehicles of a fleet quotation, with premiums' })
  async quotationVehicles(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentUnderwriteLine() line: UnderwriteLine,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    this.assertFleet(line);
    await this.queryService.getQuotation(user, line, id);
    return this.fleetVehicles.forQuotation(id);
  }

  @Get('policies/:id/vehicles')
  @Permissions('policies:read')
  @UnderwriteLineAccess(UnderwriteAction.POLICIES_VIEW)
  @ApiParam(FLEET_PARAM)
  @ApiOperation({
    summary: 'Vehicles of a fleet policy, with cover note and cover status',
  })
  async policyVehicles(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentUnderwriteLine() line: UnderwriteLine,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    this.assertFleet(line);
    await this.queryService.getPolicy(user, line, id);
    return this.fleetVehicles.forPolicy(id);
  }

  @Post('quotations/:id/fleet-register')
  @HttpCode(HttpStatus.OK)
  @Permissions('quotations:update')
  @UnderwriteLineAccess(UnderwriteAction.EDIT)
  @ApiParam(FLEET_PARAM)
  @ApiOperation({
    summary: 'Re-project a fleet quotation into the fleet register',
  })
  async syncRegister(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentUnderwriteLine() line: UnderwriteLine,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    this.assertFleet(line);
    await this.queryService.getQuotation(user, line, id);
    return this.fleetRegister.syncFromQuotation(user.companyId!, id);
  }

  @Post('endorsements/:id/vehicles')
  @Permissions('endorsements:update-draft')
  @UnderwriteLineAccess(UnderwriteAction.ENDORSEMENTS_MANAGE)
  @ApiParam(FLEET_PARAM)
  @ApiOperation({
    summary:
      'Add a vehicle on a "Fleet - Add Vehicle" endorsement (priced for the remaining period)',
  })
  async addVehicle(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentUnderwriteLine() line: UnderwriteLine,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddFleetVehicleDto,
  ) {
    await this.assertFleetEndorsement(user, line, id);
    return this.withVehicles(
      await this.fleetEndorsements.addVehicle(user, id, dto),
    );
  }

  @Delete('endorsements/:id/vehicles/:fleetEntry')
  @Permissions('endorsements:update-draft')
  @UnderwriteLineAccess(UnderwriteAction.ENDORSEMENTS_MANAGE)
  @ApiParam(FLEET_PARAM)
  @ApiOperation({
    summary: 'Remove a vehicle on a "Fleet - Remove Vehicle" endorsement',
  })
  async removeVehicle(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentUnderwriteLine() line: UnderwriteLine,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('fleetEntry', ParseIntPipe) fleetEntry: number,
  ) {
    await this.assertFleetEndorsement(user, line, id);
    return this.withVehicles(
      await this.fleetEndorsements.removeVehicle(user, id, fleetEntry),
    );
  }

  @Post('endorsements/:id/vehicles/:fleetEntry/revert')
  @HttpCode(HttpStatus.OK)
  @Permissions('endorsements:update-draft')
  @UnderwriteLineAccess(UnderwriteAction.ENDORSEMENTS_MANAGE)
  @ApiParam(FLEET_PARAM)
  @ApiOperation({ summary: 'Undo a pending vehicle addition or removal' })
  async revertVehicle(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentUnderwriteLine() line: UnderwriteLine,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('fleetEntry', ParseIntPipe) fleetEntry: number,
  ) {
    await this.assertFleetEndorsement(user, line, id);
    return this.withVehicles(
      await this.fleetEndorsements.revertVehicle(user, id, fleetEntry),
    );
  }

  private async assertFleetEndorsement(
    user: AuthenticatedUser,
    line: UnderwriteLine,
    id: string,
  ) {
    this.assertFleet(line);
    await this.transactions.assertTransactionInLine(
      user,
      line,
      id,
      'endorsement',
    );
  }

  private withVehicles(transaction: PolicyTransaction) {
    return {
      transaction,
      vehicles: this.fleetEndorsements.listVehicles(transaction),
    };
  }

  private assertFleet(line: UnderwriteLine) {
    if (line !== UnderwriteLine.FLEET) {
      throw new NotFoundException();
    }
  }
}

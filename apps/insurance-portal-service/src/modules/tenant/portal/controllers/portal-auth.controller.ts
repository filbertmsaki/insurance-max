import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { Throttle } from '@nestjs/throttler';

import { CurrentUser } from '@insurance-max/portal-shared/decorators/current-user.decorator';
import { Public } from '@insurance-max/portal-shared/decorators/public.decorator';
import { AuthenticatedAccess } from '@insurance-max/portal-shared/decorators/authorization.decorator';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';

import { AcceptPortalInvitationDto } from '../dto/portal-invitation.dto';
import { PortalAccountsService } from '../services/portal-accounts.service';

@ApiTags('Portal authentication')
@Controller({ path: 'portal/auth', version: '1' })
export class PortalAuthController {
  constructor(private readonly accountsService: PortalAccountsService) {}

  /** Public endpoint used by the invitation acceptance page. */
  @Get('invitations/:token')
  @Public()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({ summary: 'Inspect a portal invitation' })
  inspect(@Param('token') token: string) {
    return this.accountsService.inspectInvitation(token);
  }

  /** Public acceptance endpoint for a new portal user. */
  @Post('invitations/accept')
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Accept an invitation and create a new portal user',
  })
  acceptNewUser(@Body() dto: AcceptPortalInvitationDto) {
    return this.accountsService.acceptInvitation(dto);
  }

  /**
   * Existing users must authenticate before the invitation is attached to
   * their existing user identity.
   */
  @Post('invitations/accept-existing')
  @UseGuards(AuthGuard('jwt'))
  @AuthenticatedAccess()
  @ApiBearerAuth('access-token')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Accept an invitation using an existing authenticated account',
  })
  acceptExistingUser(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AcceptPortalInvitationDto,
  ) {
    return this.accountsService.acceptInvitationForExistingUser(user.id, dto);
  }
}

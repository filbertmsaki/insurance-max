import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';

import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { AuthGuard } from '@nestjs/passport';

import { SessionsService } from './sessions.service';

import { CurrentUser } from '@insurance-max/portal-shared/decorators/current-user.decorator';
import { AuthenticatedAccess } from '@insurance-max/portal-shared/decorators/authorization.decorator';

import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';

@ApiTags('sessions')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard('jwt'))
@Controller({ path: 'sessions', version: '1' })
export class SessionsController {
  constructor(private readonly sessionsService: SessionsService) {}

  @Get()
  @ApiOperation({ summary: 'List my active sessions' })
  findMySessions(@CurrentUser() user: AuthenticatedUser) {
    return this.sessionsService.findUserSessions(user.id, user.sessionId);
  }

  @Delete('others')
  @AuthenticatedAccess()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoke all sessions except the current session' })
  revokeOthers(@CurrentUser() user: AuthenticatedUser) {
    return this.sessionsService.revokeOtherUserSessions(
      user.id,
      user.sessionId,
    );
  }

  @Delete('all')
  @AuthenticatedAccess()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Revoke all sessions including the current session',
  })
  revokeAll(@CurrentUser() user: AuthenticatedUser) {
    return this.sessionsService.revokeAllUserSessions(
      user.id,
      'user_revoke_all',
    );
  }

  @Delete(':id')
  @AuthenticatedAccess()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoke one session' })
  revoke(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.sessionsService.revoke(
      id,
      user.id,
      id === user.sessionId ? 'current_session_revoked' : 'user_revoked',
    );
  }
}

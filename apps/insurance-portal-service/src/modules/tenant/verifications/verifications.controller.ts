import { Body, Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@insurance-max/portal-shared/decorators/current-user.decorator';
import { Permissions } from '@insurance-max/portal-shared/decorators/permissions.decorator';
import { TenantScoped } from '@insurance-max/portal-shared';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';
import {
  CoverNoteVerificationDto,
  MotorVerificationDto,
} from './dto/verify.dto';
import { VerificationsService } from './verifications.service';

@ApiTags('Verifications')
@ApiBearerAuth()
@Controller('verifications')
@TenantScoped()
export class VerificationsController {
  constructor(private readonly service: VerificationsService) {}
  @Post('motor')
  @Permissions('verifications:motor:submit')
  @ApiOperation({ summary: 'Verify a motor vehicle with TIRAMIS' })
  verifyMotor(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: MotorVerificationDto,
  ) {
    return this.service.verifyMotor(user, dto);
  }
  @Post('cover-note')
  @Permissions('verifications:cover-note:submit')
  @ApiOperation({ summary: 'Verify a cover note with TIRAMIS' })
  verifyCoverNote(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CoverNoteVerificationDto,
  ) {
    return this.service.verifyCoverNote(user, dto);
  }
}

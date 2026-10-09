import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '@insurance-max/portal-shared/decorators/current-user.decorator';
import { Permissions } from '@insurance-max/portal-shared/decorators/permissions.decorator';
import { TenantScoped } from '@insurance-max/portal-shared';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';

import { CoverNotesService } from './cover-notes.service';

@ApiTags('cover-notes')
@ApiBearerAuth()
@Controller('tenant/cover-notes')
@TenantScoped()
export class CoverNotesController {
  constructor(private readonly coverNotesService: CoverNotesService) {}

  @Get()
  @Permissions('cover-notes:read')
  @ApiOperation({ summary: 'List cover notes for the current company' })
  @ApiQuery({ name: 'policy_id', required: false })
  @ApiQuery({ name: 'quotation_id', required: false })
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('policy_id', new ParseUUIDPipe({ optional: true }))
    policyId?: string,
    @Query('quotation_id', new ParseUUIDPipe({ optional: true }))
    quotationId?: string,
  ) {
    return this.coverNotesService.findAll(user, { policyId, quotationId });
  }

  @Get(':id')
  @Permissions('cover-notes:read')
  @ApiOperation({ summary: 'Get a cover note by ID' })
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.coverNotesService.findOne(user, id);
  }

  @Post('issue/quotation/:quotationId')
  @Permissions('cover-notes:issue')
  @ApiOperation({
    summary:
      'Re-sync cover notes for a quotation TIRA has already accepted (idempotent)',
  })
  issueForQuotation(
    @CurrentUser() user: AuthenticatedUser,
    @Param('quotationId', ParseUUIDPipe) quotationId: string,
  ) {
    return this.coverNotesService.issueForQuotation(user, quotationId);
  }
}

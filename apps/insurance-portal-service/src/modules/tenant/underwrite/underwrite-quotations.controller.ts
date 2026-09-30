import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import {
  UnderwriteAction,
  type UnderwriteLine,
} from '@insurance-max/contracts';
import { TenantScoped } from '@insurance-max/portal-shared';
import { CurrentUser } from '@insurance-max/portal-shared/decorators/current-user.decorator';
import { Permissions } from '@insurance-max/portal-shared/decorators/permissions.decorator';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';
import {
  SaveQuotationDraftDto,
  UpdateQuotationDraftDto,
} from '../quotations/dto/quotation-draft.dto';
import { UpdateQuotationDto } from '../quotations/dto/quotation-payload.dto';
import {
  CurrentUnderwriteLine,
  UnderwriteLineAccess,
} from './common/underwrite-line.access';
import { UnderwriteLineGuard } from './common/underwrite-line.guard';
import { UnderwriteQuotationCommandService } from './common/underwrite-quotation-command.service';

const LINE_PARAM = {
  name: 'line',
  enum: ['motor', 'fleet', 'non-motor'],
  description: 'Underwrite business line',
};

/**
 * Quotation wizard writes for a line. Each route requires the line gate AND
 * the permission the legacy `tenant/quotations` route requires, and calls the
 * same QuotationsService method.
 */
@ApiTags('underwrite')
@ApiBearerAuth()
@Controller('tenant/underwrite/:line/quotations')
@TenantScoped()
@UseGuards(UnderwriteLineGuard)
export class UnderwriteQuotationsController {
  constructor(private readonly commands: UnderwriteQuotationCommandService) {}

  @Post('drafts')
  @Permissions('quotations:create')
  @UnderwriteLineAccess(UnderwriteAction.CREATE)
  @ApiParam(LINE_PARAM)
  @ApiBody({ type: SaveQuotationDraftDto })
  @ApiOperation({ summary: 'Create a quotation draft in the line' })
  createDraft(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentUnderwriteLine() line: UnderwriteLine,
    @Body() dto: SaveQuotationDraftDto,
  ) {
    return this.commands.createDraft(user, line, dto);
  }

  @Get(':id/edit')
  @Permissions('quotations:update')
  @UnderwriteLineAccess(UnderwriteAction.EDIT)
  @ApiParam(LINE_PARAM)
  @ApiOperation({ summary: 'Load a quotation in the line for the wizard' })
  getForEdit(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentUnderwriteLine() line: UnderwriteLine,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.commands.getForEdit(user, line, id);
  }

  @Put(':id/draft')
  @Permissions('quotations:update')
  @UnderwriteLineAccess(UnderwriteAction.EDIT)
  @ApiParam(LINE_PARAM)
  @ApiBody({ type: UpdateQuotationDraftDto })
  @ApiOperation({ summary: 'Save the wizard draft of a quotation in the line' })
  updateDraft(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentUnderwriteLine() line: UnderwriteLine,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateQuotationDraftDto,
  ) {
    return this.commands.updateDraft(user, line, id, dto);
  }

  @Post(':id/finalize')
  @HttpCode(HttpStatus.OK)
  @Permissions('quotations:complete')
  @UnderwriteLineAccess(UnderwriteAction.CREATE)
  @ApiParam(LINE_PARAM)
  @ApiBody({ type: UpdateQuotationDto })
  @ApiOperation({
    summary: 'Validate, price and complete a quotation in the line',
  })
  finalize(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentUnderwriteLine() line: UnderwriteLine,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateQuotationDto,
  ) {
    return this.commands.finalize(user, line, id, dto);
  }

  @Delete(':id/draft')
  @Permissions('quotations:delete-draft')
  @UnderwriteLineAccess(UnderwriteAction.DELETE)
  @ApiParam(LINE_PARAM)
  @ApiOperation({ summary: 'Delete a draft quotation in the line' })
  removeDraft(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentUnderwriteLine() line: UnderwriteLine,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.commands.removeDraft(user, line, id);
  }
}

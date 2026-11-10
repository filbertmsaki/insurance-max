import { Controller, Get, Param, ParseUUIDPipe, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { CurrentUser } from '@insurance-max/portal-shared/decorators/current-user.decorator';
import { Permissions } from '@insurance-max/portal-shared/decorators/permissions.decorator';
import { TenantScoped } from '@insurance-max/portal-shared';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';
import { FinancePermissions } from '../billing-commission/finance.permissions';
import { InsurancePdfService } from './insurance-pdf.service';

@ApiTags('insurance-documents')
@ApiBearerAuth()
@TenantScoped()
@Controller('tenant')
export class InsuranceDocumentsController {
  constructor(private readonly documents: InsurancePdfService) {}

  @Get('quotations/:id/document/preview')
  @Permissions('quotations:read')
  @ApiOperation({ summary: 'Preview a quotation PDF' })
  async quotationPreview(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Res() res: Response,
  ) {
    return this.send(await this.documents.quotation(user, id), res, false);
  }

  @Get('quotations/:id/document/download')
  @Permissions('quotations:read')
  async quotationDownload(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Res() res: Response,
  ) {
    return this.send(await this.documents.quotation(user, id), res, true);
  }

  @Get('policies/:id/schedule/preview')
  @Permissions('policies:read')
  @ApiOperation({ summary: 'Preview the current policy schedule PDF' })
  async schedulePreview(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Res() res: Response,
  ) {
    return this.send(await this.documents.schedule(user, id), res, false);
  }

  @Get('policies/:id/schedule/download')
  @Permissions('policies:read')
  async scheduleDownload(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Res() res: Response,
  ) {
    return this.send(await this.documents.schedule(user, id), res, true);
  }

  @Get('finance/invoices/:id/document/preview')
  @Permissions(FinancePermissions.INVOICES_READ)
  @ApiOperation({ summary: 'Preview a tax invoice PDF' })
  async invoicePreview(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Res() res: Response,
  ) {
    return this.send(await this.documents.invoice(user, id), res, false);
  }

  @Get('finance/invoices/:id/document/download')
  @Permissions(FinancePermissions.INVOICES_READ)
  async invoiceDownload(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Res() res: Response,
  ) {
    return this.send(await this.documents.invoice(user, id), res, true);
  }

  @Get('finance/receipts/:id/document/preview')
  @Permissions(FinancePermissions.RECEIPTS_READ)
  @ApiOperation({ summary: 'Preview a receipt PDF' })
  async receiptPreview(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Res() res: Response,
  ) {
    return this.send(await this.documents.receipt(user, id), res, false);
  }

  @Get('finance/receipts/:id/document/download')
  @Permissions(FinancePermissions.RECEIPTS_READ)
  async receiptDownload(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Res() res: Response,
  ) {
    return this.send(await this.documents.receipt(user, id), res, true);
  }

  private send(
    doc: { bytes: Uint8Array; filename: string },
    res: Response,
    attachment: boolean,
  ) {
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `${attachment ? 'attachment' : 'inline'}; filename="${doc.filename}"`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    });
    return res.send(Buffer.from(doc.bytes));
  }
}

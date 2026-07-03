import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@insurance-max/portal-shared/decorators/current-user.decorator';
import { Permissions } from '@insurance-max/portal-shared/decorators/permissions.decorator';
import { PermissionsGuard } from '@insurance-max/portal-shared/guards/permissions.guard';
import { TenantGuard } from '@insurance-max/portal-shared/guards/tenant.guard';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';
import { CreateQuotationDto } from './dto/create-quotation.dto';
import { FilterQuotationDto } from './dto/filter-quotation.dto';
import { UpdateQuotationDto } from './dto/update-quotation.dto';
import { QuotationsService } from './quotations.service';

@ApiTags('quotations')
@ApiBearerAuth()
@Controller('tenant/quotations')
@UseGuards(AuthGuard('jwt'), TenantGuard)
export class QuotationsController {
  constructor(private readonly quotationsService: QuotationsService) {}

  @Post()
  @UseGuards(PermissionsGuard)
  @Permissions('quotations:create')
  @ApiOperation({ summary: 'Create a quotation' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateQuotationDto,
  ) {
    return this.quotationsService.create(
      user.companyId!,
      user.companyType,
      dto,
      user.id,
    );
  }

  @Get()
  @UseGuards(PermissionsGuard)
  @Permissions('quotations:read')
  @ApiOperation({ summary: 'List quotations for the current company' })
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: FilterQuotationDto,
  ) {
    return this.quotationsService.findAll(user.companyId!, query);
  }

  @Get(':id')
  @UseGuards(PermissionsGuard)
  @Permissions('quotations:read')
  @ApiOperation({ summary: 'Get a quotation by ID' })
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.quotationsService.findOne(user.companyId!, id);
  }

  @Patch(':id')
  @UseGuards(PermissionsGuard)
  @Permissions('quotations:update')
  @ApiOperation({ summary: 'Update a quotation' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateQuotationDto,
  ) {
    return this.quotationsService.update(
      user.companyId!,
      user.companyType,
      id,
      dto,
      user.id,
    );
  }

  @Delete(':id')
  @UseGuards(PermissionsGuard)
  @Permissions('quotations:delete')
  @ApiOperation({ summary: 'Soft-delete a quotation' })
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.quotationsService.remove(user.companyId!, id);
    return { message: 'Quotation deleted successfully' };
  }

  @Patch(':id/restore')
  @UseGuards(PermissionsGuard)
  @Permissions('quotations:update')
  @ApiOperation({ summary: 'Restore a soft-deleted quotation' })
  restore(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.quotationsService.restore(user.companyId!, id);
  }
}

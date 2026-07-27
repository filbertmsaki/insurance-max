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
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { CurrentUser } from '@insurance-max/portal-shared/decorators/current-user.decorator';
import { Permissions } from '@insurance-max/portal-shared/decorators/permissions.decorator';
import { PermissionsGuard } from '@insurance-max/portal-shared/guards/permissions.guard';
import { TenantGuard } from '@insurance-max/portal-shared/guards/tenant.guard';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';
import { ClonePricingRateBookDto } from './dto/clone-pricing-rate-book.dto';
import { CreatePricingRateBookDto } from './dto/create-pricing-rate-book.dto';
import { FilterPricingRateBookDto } from './dto/filter-pricing-rate-book.dto';
import { UpdatePricingRateBookDto } from './dto/update-pricing-rate-book.dto';
import { PricingRateBooksService } from './pricing-rate-books.service';

@ApiTags('Pricing Rate Books')
@ApiBearerAuth()
@Controller('pricing-rate-books')
@UseGuards(AuthGuard('jwt'), TenantGuard)
export class PricingRateBooksController {
  constructor(private readonly service: PricingRateBooksService) {}

  @Get()
  @UseGuards(PermissionsGuard)
  @Permissions('pricing.manage_rate_books')
  @ApiOperation({ summary: 'List pricing rate books' })
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: FilterPricingRateBookDto,
  ) {
    return this.service.findAll(user.companyId!, query);
  }

  @Post()
  @UseGuards(PermissionsGuard)
  @Permissions('pricing.manage_rate_books')
  @ApiOperation({ summary: 'Create a draft pricing rate book' })
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreatePricingRateBookDto,
  ) {
    return this.service.create(user.companyId!, dto, user.id);
  }

  @Post('clone')
  @UseGuards(PermissionsGuard)
  @Permissions('pricing.manage_rate_books')
  @ApiOperation({ summary: 'Clone an existing pricing rate book into a new draft version' })
  async clone(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ClonePricingRateBookDto,
  ) {
    return this.service.clone(user.companyId!, dto, user.id);
  }

  @Get(':rateBookId')
  @UseGuards(PermissionsGuard)
  @Permissions('pricing.manage_rate_books')
  @ApiOperation({ summary: 'Get a pricing rate book with rules and conditions' })
  async findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('rateBookId', ParseUUIDPipe) rateBookId: string,
  ) {
    return this.service.findOne(user.companyId!, rateBookId);
  }

  @Patch(':rateBookId')
  @UseGuards(PermissionsGuard)
  @Permissions('pricing.manage_rate_books')
  @ApiOperation({ summary: 'Update an editable pricing rate book' })
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('rateBookId', ParseUUIDPipe) rateBookId: string,
    @Body() dto: UpdatePricingRateBookDto,
  ) {
    return this.service.update(user.companyId!, rateBookId, dto, user.id);
  }

  @Post(':rateBookId/submit-review')
  @UseGuards(PermissionsGuard)
  @Permissions('pricing.publish_rate_books')
  @ApiOperation({ summary: 'Submit a pricing rate book for review' })
  async submitForReview(
    @CurrentUser() user: AuthenticatedUser,
    @Param('rateBookId', ParseUUIDPipe) rateBookId: string,
  ) {
    return this.service.submitForReview(user.companyId!, rateBookId, user.id);
  }

  @Post(':rateBookId/approve')
  @UseGuards(PermissionsGuard)
  @Permissions('pricing.publish_rate_books')
  @ApiOperation({ summary: 'Approve a pricing rate book' })
  async approve(
    @CurrentUser() user: AuthenticatedUser,
    @Param('rateBookId', ParseUUIDPipe) rateBookId: string,
  ) {
    return this.service.approve(user.companyId!, rateBookId, user.id);
  }

  @Post(':rateBookId/reject')
  @UseGuards(PermissionsGuard)
  @Permissions('pricing.publish_rate_books')
  @ApiOperation({ summary: 'Reject a pricing rate book' })
  async reject(
    @CurrentUser() user: AuthenticatedUser,
    @Param('rateBookId', ParseUUIDPipe) rateBookId: string,
  ) {
    return this.service.reject(user.companyId!, rateBookId, user.id);
  }

  @Post(':rateBookId/publish')
  @UseGuards(PermissionsGuard)
  @Permissions('pricing.publish_rate_books')
  @ApiOperation({ summary: 'Publish an approved pricing rate book' })
  async publish(
    @CurrentUser() user: AuthenticatedUser,
    @Param('rateBookId', ParseUUIDPipe) rateBookId: string,
  ) {
    return this.service.publish(user.companyId!, rateBookId, user.id);
  }

  @Post(':rateBookId/retire')
  @UseGuards(PermissionsGuard)
  @Permissions('pricing.publish_rate_books')
  @ApiOperation({ summary: 'Retire a published pricing rate book' })
  async retire(
    @CurrentUser() user: AuthenticatedUser,
    @Param('rateBookId', ParseUUIDPipe) rateBookId: string,
  ) {
    return this.service.retire(user.companyId!, rateBookId, user.id);
  }

  @Delete(':rateBookId')
  @UseGuards(PermissionsGuard)
  @Permissions('pricing.manage_rate_books')
  @ApiOperation({ summary: 'Soft-delete an editable pricing rate book' })
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('rateBookId', ParseUUIDPipe) rateBookId: string,
  ) {
    await this.service.remove(user.companyId!, rateBookId);
    return { message: 'Pricing rate book deleted successfully' };
  }
}

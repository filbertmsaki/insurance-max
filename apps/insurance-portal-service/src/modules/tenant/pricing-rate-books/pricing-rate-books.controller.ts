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
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@insurance-max/portal-shared/decorators/current-user.decorator';
import { Permissions } from '@insurance-max/portal-shared/decorators/permissions.decorator';
import { TenantScoped } from '@insurance-max/portal-shared';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';
import { ClonePricingRateBookDto } from './dto/clone-pricing-rate-book.dto';
import { CreatePricingRateBookDto } from './dto/create-pricing-rate-book.dto';
import { FilterPricingRateBookDto } from './dto/filter-pricing-rate-book.dto';
import { UpdatePricingRateBookDto } from './dto/update-pricing-rate-book.dto';
import { CreateAddonRateRuleDto } from './dto/create-addon-rate-rule.dto';
import { UpdateAddonRateRuleDto } from './dto/update-addon-rate-rule.dto';
import { PricingRateBooksService } from './pricing-rate-books.service';

@ApiTags('Pricing Rate Books')
@ApiBearerAuth()
@Controller('pricing-rate-books')
@TenantScoped()
export class PricingRateBooksController {
  constructor(private readonly service: PricingRateBooksService) {}

  @Get()
  @Permissions('pricing.manage_rate_books')
  @ApiOperation({ summary: 'List pricing rate books' })
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: FilterPricingRateBookDto,
  ) {
    return this.service.findAll(user.companyId!, query);
  }

  @Post()
  @Permissions('pricing.manage_rate_books')
  @ApiOperation({ summary: 'Create a draft pricing rate book' })
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreatePricingRateBookDto,
  ) {
    return this.service.create(user.companyId!, dto, user.id);
  }

  @Post('clone')
  @Permissions('pricing.manage_rate_books')
  @ApiOperation({
    summary: 'Clone an existing pricing rate book into a new draft version',
  })
  async clone(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ClonePricingRateBookDto,
  ) {
    return this.service.clone(user.companyId!, dto, user.id);
  }

  @Get(':rateBookId')
  @Permissions('pricing.manage_rate_books')
  @ApiOperation({
    summary: 'Get a pricing rate book with rules and conditions',
  })
  async findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('rateBookId', ParseUUIDPipe) rateBookId: string,
  ) {
    return this.service.findOne(user.companyId!, rateBookId);
  }

  @Patch(':rateBookId')
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
  @Permissions('pricing.publish_rate_books')
  @ApiOperation({ summary: 'Submit a pricing rate book for review' })
  async submitForReview(
    @CurrentUser() user: AuthenticatedUser,
    @Param('rateBookId', ParseUUIDPipe) rateBookId: string,
  ) {
    return this.service.submitForReview(user.companyId!, rateBookId, user.id);
  }

  @Post(':rateBookId/approve')
  @Permissions('pricing.publish_rate_books')
  @ApiOperation({ summary: 'Approve a pricing rate book' })
  async approve(
    @CurrentUser() user: AuthenticatedUser,
    @Param('rateBookId', ParseUUIDPipe) rateBookId: string,
  ) {
    return this.service.approve(user.companyId!, rateBookId, user.id);
  }

  @Post(':rateBookId/reject')
  @Permissions('pricing.publish_rate_books')
  @ApiOperation({ summary: 'Reject a pricing rate book' })
  async reject(
    @CurrentUser() user: AuthenticatedUser,
    @Param('rateBookId', ParseUUIDPipe) rateBookId: string,
  ) {
    return this.service.reject(user.companyId!, rateBookId, user.id);
  }

  @Post(':rateBookId/publish')
  @Permissions('pricing.publish_rate_books')
  @ApiOperation({ summary: 'Publish an approved pricing rate book' })
  async publish(
    @CurrentUser() user: AuthenticatedUser,
    @Param('rateBookId', ParseUUIDPipe) rateBookId: string,
  ) {
    return this.service.publish(user.companyId!, rateBookId, user.id);
  }

  @Post(':rateBookId/retire')
  @Permissions('pricing.publish_rate_books')
  @ApiOperation({ summary: 'Retire a published pricing rate book' })
  async retire(
    @CurrentUser() user: AuthenticatedUser,
    @Param('rateBookId', ParseUUIDPipe) rateBookId: string,
  ) {
    return this.service.retire(user.companyId!, rateBookId, user.id);
  }

  @Delete(':rateBookId')
  @Permissions('pricing.manage_rate_books')
  @ApiOperation({ summary: 'Soft-delete an editable pricing rate book' })
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('rateBookId', ParseUUIDPipe) rateBookId: string,
  ) {
    await this.service.remove(user.companyId!, rateBookId);
    return { message: 'Pricing rate book deleted successfully' };
  }

  @Get(':rateBookId/addon-rules')
  @Permissions('pricing.manage_rate_books')
  @ApiOperation({ summary: 'List add-on rate rules for a rate book' })
  async findAddonRules(
    @CurrentUser() user: AuthenticatedUser,
    @Param('rateBookId', ParseUUIDPipe) rateBookId: string,
  ) {
    return this.service.findAddonRules(user.companyId!, rateBookId);
  }

  @Post(':rateBookId/addon-rules')
  @Permissions('pricing.manage_rate_books')
  @ApiOperation({ summary: 'Create an add-on rate rule for a rate book' })
  async createAddonRule(
    @CurrentUser() user: AuthenticatedUser,
    @Param('rateBookId', ParseUUIDPipe) rateBookId: string,
    @Body() dto: CreateAddonRateRuleDto,
  ) {
    return this.service.createAddonRule(
      user.companyId!,
      rateBookId,
      dto,
      user.id,
    );
  }

  @Patch(':rateBookId/addon-rules/:ruleId')
  @Permissions('pricing.manage_rate_books')
  @ApiOperation({ summary: 'Update an add-on rate rule' })
  async updateAddonRule(
    @CurrentUser() user: AuthenticatedUser,
    @Param('rateBookId', ParseUUIDPipe) rateBookId: string,
    @Param('ruleId', ParseUUIDPipe) ruleId: string,
    @Body() dto: UpdateAddonRateRuleDto,
  ) {
    return this.service.updateAddonRule(
      user.companyId!,
      rateBookId,
      ruleId,
      dto,
      user.id,
    );
  }

  @Delete(':rateBookId/addon-rules/:ruleId')
  @Permissions('pricing.manage_rate_books')
  @ApiOperation({ summary: 'Remove an add-on rate rule' })
  async removeAddonRule(
    @CurrentUser() user: AuthenticatedUser,
    @Param('rateBookId', ParseUUIDPipe) rateBookId: string,
    @Param('ruleId', ParseUUIDPipe) ruleId: string,
  ) {
    await this.service.removeAddonRule(user.companyId!, rateBookId, ruleId);
    return { message: 'Add-on rate rule deleted successfully' };
  }
}

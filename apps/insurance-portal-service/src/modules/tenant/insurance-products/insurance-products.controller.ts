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
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';
import { InsuranceProductsService } from './insurance-products.service';
import { ProductDefinitionService } from './product-definition.service';
import { CreateInsuranceProductDto } from './dto/create-insurance-product.dto';
import { UpdateInsuranceProductDto } from './dto/update-insurance-product.dto';
import { FilterInsuranceProductDto } from './dto/filter-insurance-product.dto';
import { UpsertProductVersionDto } from './dto/upsert-product-version.dto';
import { ReviewProductVersionDto } from './dto/review-product-version.dto';
import { TenantScoped } from '@insurance-max/portal-shared';

@ApiTags('Insurance Products')
@ApiBearerAuth()
@Controller('insurance-products')
@TenantScoped()
export class InsuranceProductsController {
  constructor(
    private readonly service: InsuranceProductsService,
    private readonly definitionService: ProductDefinitionService,
  ) {}

  @Get()
  @Permissions('insurance-products:read')
  @ApiOperation({
    summary: 'List all insurance products for the current company',
  })
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: FilterInsuranceProductDto,
  ) {
    return this.service.findAll(user.companyId!, query);
  }

  @Post()
  @Permissions('insurance-products:create')
  @ApiOperation({ summary: 'Create a new insurance product identity' })
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateInsuranceProductDto,
  ) {
    return this.service.create(user.companyId!, dto, user.id);
  }

  @Get(':productId')
  @Permissions('insurance-products:read')
  @ApiOperation({ summary: 'Get an insurance product by ID' })
  async findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('productId', ParseUUIDPipe) productId: string,
  ) {
    return this.service.findOne(user.companyId!, productId);
  }

  @Patch(':productId')
  @Permissions('insurance-products:update')
  @ApiOperation({ summary: 'Update product identity (category/code only)' })
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('productId', ParseUUIDPipe) productId: string,
    @Body() dto: UpdateInsuranceProductDto,
  ) {
    return this.service.update(user.companyId!, productId, dto, user.id);
  }

  @Delete(':productId')
  @Permissions('insurance-products:delete')
  @ApiOperation({ summary: 'Soft-delete an insurance product' })
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('productId', ParseUUIDPipe) productId: string,
  ) {
    await this.service.remove(user.companyId!, productId);
    return { message: 'Insurance product deleted successfully' };
  }

  // ─── Product definition versions ─────────────────────────────────────────────

  @Get(':productId/versions')
  @Permissions('product-definitions:read')
  @ApiOperation({ summary: 'List product definition versions' })
  listVersions(
    @CurrentUser() user: AuthenticatedUser,
    @Param('productId', ParseUUIDPipe) productId: string,
  ) {
    return this.definitionService.listVersions(user.companyId!, productId);
  }

  @Post(':productId/versions')
  @Permissions('product-definitions:create-version')
  @ApiOperation({ summary: 'Create the next draft version' })
  createVersion(
    @CurrentUser() user: AuthenticatedUser,
    @Param('productId', ParseUUIDPipe) productId: string,
  ) {
    return this.definitionService.createNextVersion(
      user.companyId!,
      productId,
      user.id,
    );
  }

  @Get(':productId/versions/:versionId')
  @Permissions('product-definitions:read')
  @ApiOperation({ summary: 'Get a product definition version' })
  findVersion(
    @CurrentUser() user: AuthenticatedUser,
    @Param('productId', ParseUUIDPipe) productId: string,
    @Param('versionId', ParseUUIDPipe) versionId: string,
  ) {
    return this.definitionService.findVersion(
      user.companyId!,
      productId,
      versionId,
    );
  }

  @Patch(':productId/versions/:versionId')
  @Permissions('product-definitions:update')
  @ApiOperation({ summary: 'Update a draft product definition version' })
  updateDraft(
    @CurrentUser() user: AuthenticatedUser,
    @Param('productId', ParseUUIDPipe) productId: string,
    @Param('versionId', ParseUUIDPipe) versionId: string,
    @Body() dto: UpsertProductVersionDto,
  ) {
    return this.definitionService.updateDraft(
      user.companyId!,
      productId,
      versionId,
      dto,
      user.id,
    );
  }

  @Post(':productId/versions/:versionId/submit-review')
  @Permissions('product-definitions:submit-review')
  @ApiOperation({ summary: 'Submit a draft version for review' })
  submitReview(
    @CurrentUser() user: AuthenticatedUser,
    @Param('productId', ParseUUIDPipe) productId: string,
    @Param('versionId', ParseUUIDPipe) versionId: string,
  ) {
    return this.definitionService.submitForReview(
      user.companyId!,
      productId,
      versionId,
      user.id,
    );
  }

  @Post(':productId/versions/:versionId/reject')
  @Permissions('product-definitions:review')
  @ApiOperation({ summary: 'Reject a version that is in review' })
  rejectReview(
    @CurrentUser() user: AuthenticatedUser,
    @Param('productId', ParseUUIDPipe) productId: string,
    @Param('versionId', ParseUUIDPipe) versionId: string,
    @Body() dto: ReviewProductVersionDto,
  ) {
    return this.definitionService.rejectReview(
      user.companyId!,
      productId,
      versionId,
      dto.comments,
      user.id,
    );
  }

  @Post(':productId/versions/:versionId/return-draft')
  @Permissions('product-definitions:update')
  @ApiOperation({ summary: 'Return a rejected version to draft' })
  returnDraft(
    @CurrentUser() user: AuthenticatedUser,
    @Param('productId', ParseUUIDPipe) productId: string,
    @Param('versionId', ParseUUIDPipe) versionId: string,
  ) {
    return this.definitionService.returnToDraft(
      user.companyId!,
      productId,
      versionId,
      user.id,
    );
  }

  @Post(':productId/versions/:versionId/publish')
  @Permissions('product-definitions:publish')
  @ApiOperation({ summary: 'Publish a version that is in review' })
  publish(
    @CurrentUser() user: AuthenticatedUser,
    @Param('productId', ParseUUIDPipe) productId: string,
    @Param('versionId', ParseUUIDPipe) versionId: string,
  ) {
    return this.definitionService.publish(
      user.companyId!,
      productId,
      versionId,
      user.id,
    );
  }

  @Post(':productId/versions/:versionId/retire')
  @Permissions('product-definitions:retire')
  @ApiOperation({ summary: 'Retire a published version' })
  retire(
    @CurrentUser() user: AuthenticatedUser,
    @Param('productId', ParseUUIDPipe) productId: string,
    @Param('versionId', ParseUUIDPipe) versionId: string,
  ) {
    return this.definitionService.retire(
      user.companyId!,
      productId,
      versionId,
      user.id,
    );
  }

  @Get(':productId/published-definition')
  @Permissions('product-definitions:use')
  @ApiOperation({
    summary: 'Resolve the approved, quotation-ready product definition',
  })
  getPublishedDefinition(
    @CurrentUser() user: AuthenticatedUser,
    @Param('productId', ParseUUIDPipe) productId: string,
    @Query('sub_class_id') subClassId?: string,
    @Query('effective_date') effectiveDate?: string,
  ) {
    return this.definitionService.resolvePublishedDefinition(
      user.companyId!,
      productId,
      subClassId,
      effectiveDate ? new Date(effectiveDate) : new Date(),
    );
  }
}

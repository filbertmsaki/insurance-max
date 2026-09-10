import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@insurance-max/portal-shared/decorators/current-user.decorator';
import { CompanyTypes } from '@insurance-max/portal-shared/decorators/company-types.decorator';
import { Permissions } from '@insurance-max/portal-shared/decorators/permissions.decorator';
import { CompanyTypeGuard } from '@insurance-max/portal-shared/guards/company-type.guard';
import { TenantScoped } from '@insurance-max/portal-shared';
import { CompanyType } from '@insurance-max/portal-shared/enums/company-type.enum';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';
import { CreateProductCommissionRuleDto } from './dto/create-product-commission-rule.dto';
import { CreateProductDistributionChannelDto } from './dto/create-product-distribution-channel.dto';
import { CreateProductDocumentRequirementDto } from './dto/create-product-document-requirement.dto';
import { CreateProductTaxRuleDto } from './dto/create-product-tax-rule.dto';
import { ProductDistributionService } from './product-distribution.service';

@ApiTags('Product Distribution')
@ApiBearerAuth()
@Controller('product-distribution')
@TenantScoped()
export class ProductDistributionController {
  constructor(private readonly service: ProductDistributionService) {}

  @Post('channels')
  @UseGuards(CompanyTypeGuard)
  @CompanyTypes(CompanyType.INSURANCE_COMPANY)
  @Permissions('product-distribution:create')
  @ApiOperation({ summary: 'Create a product distribution channel' })
  createChannel(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateProductDistributionChannelDto,
  ) {
    return this.service.createChannel(user.companyId!, dto, user.id);
  }

  @Get('channels')
  @UseGuards(CompanyTypeGuard)
  @CompanyTypes(CompanyType.INSURANCE_COMPANY)
  @Permissions('product-distribution:read')
  @ApiOperation({
    summary: 'List distribution channels for the insurer company',
  })
  listChannels(@CurrentUser() user: AuthenticatedUser) {
    return this.service.listChannels(user.companyId!);
  }

  @Get('channels/my')
  @Permissions('product-distribution:read')
  @ApiOperation({
    summary: 'List distribution channels for the current intermediary company',
  })
  listMyChannels(@CurrentUser() user: AuthenticatedUser) {
    return this.service.listChannelsForIntermediary(user.companyId!);
  }

  @Delete('channels/:id')
  @UseGuards(CompanyTypeGuard)
  @CompanyTypes(CompanyType.INSURANCE_COMPANY)
  @Permissions('product-distribution:delete')
  @ApiOperation({ summary: 'Delete a distribution channel' })
  removeChannel(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.removeChannel(user.companyId!, id);
  }

  @Patch('channels/:id/restore')
  @UseGuards(CompanyTypeGuard)
  @CompanyTypes(CompanyType.INSURANCE_COMPANY)
  @Permissions('product-distribution:update')
  @ApiOperation({ summary: 'Restore a soft-deleted distribution channel' })
  restoreChannel(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.restoreChannel(user.companyId!, id);
  }

  @Post('commission-rules')
  @UseGuards(CompanyTypeGuard)
  @CompanyTypes(CompanyType.INSURANCE_COMPANY)
  @Permissions('product-distribution:create')
  @ApiOperation({ summary: 'Create a product commission rule' })
  createCommissionRule(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateProductCommissionRuleDto,
  ) {
    return this.service.createCommissionRule(user.companyId!, dto);
  }

  @Get('commission-rules')
  @UseGuards(CompanyTypeGuard)
  @CompanyTypes(CompanyType.INSURANCE_COMPANY)
  @Permissions('product-distribution:read')
  @ApiOperation({ summary: 'List commission rules for the insurer company' })
  listCommissionRules(@CurrentUser() user: AuthenticatedUser) {
    return this.service.listCommissionRules(user.companyId!);
  }

  @Delete('commission-rules/:id')
  @UseGuards(CompanyTypeGuard)
  @CompanyTypes(CompanyType.INSURANCE_COMPANY)
  @Permissions('product-distribution:delete')
  @ApiOperation({ summary: 'Delete a product commission rule' })
  removeCommissionRule(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.removeCommissionRule(user.companyId!, id);
  }

  @Patch('commission-rules/:id/restore')
  @UseGuards(CompanyTypeGuard)
  @CompanyTypes(CompanyType.INSURANCE_COMPANY)
  @Permissions('product-distribution:update')
  @ApiOperation({ summary: 'Restore a soft-deleted commission rule' })
  restoreCommissionRule(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.restoreCommissionRule(user.companyId!, id);
  }

  @Get('tax-rules/active')
  @Permissions('pricing.calculate')
  @ApiOperation({
    summary:
      'List active tax rules available for premium calculation (lightweight — available to any user who can calculate premiums, not just product-distribution admins)',
  })
  listActiveTaxRulesForCalculation(@CurrentUser() user: AuthenticatedUser) {
    return this.service.listActiveTaxRulesForCalculation(user.companyId!);
  }

  @Post('tax-rules')
  @UseGuards(CompanyTypeGuard)
  @CompanyTypes(CompanyType.INSURANCE_COMPANY)
  @Permissions('product-distribution:create')
  @ApiOperation({ summary: 'Create a product tax rule' })
  createTaxRule(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateProductTaxRuleDto,
  ) {
    return this.service.createTaxRule(user.companyId!, dto);
  }

  @Get('tax-rules')
  @UseGuards(CompanyTypeGuard)
  @CompanyTypes(CompanyType.INSURANCE_COMPANY)
  @Permissions('product-distribution:read')
  @ApiOperation({ summary: 'List tax rules for the insurer company' })
  listTaxRules(@CurrentUser() user: AuthenticatedUser) {
    return this.service.listTaxRules(user.companyId!);
  }

  @Delete('tax-rules/:id')
  @UseGuards(CompanyTypeGuard)
  @CompanyTypes(CompanyType.INSURANCE_COMPANY)
  @Permissions('product-distribution:delete')
  @ApiOperation({ summary: 'Delete a product tax rule' })
  removeTaxRule(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.removeTaxRule(user.companyId!, id);
  }

  @Patch('tax-rules/:id/restore')
  @UseGuards(CompanyTypeGuard)
  @CompanyTypes(CompanyType.INSURANCE_COMPANY)
  @Permissions('product-distribution:update')
  @ApiOperation({ summary: 'Restore a soft-deleted tax rule' })
  restoreTaxRule(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.restoreTaxRule(user.companyId!, id);
  }

  @Post('document-requirements')
  @UseGuards(CompanyTypeGuard)
  @CompanyTypes(CompanyType.INSURANCE_COMPANY)
  @Permissions('product-distribution:create')
  @ApiOperation({ summary: 'Create a product document requirement' })
  createDocumentRequirement(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateProductDocumentRequirementDto,
  ) {
    return this.service.createDocumentRequirement(user.companyId!, dto);
  }

  @Get('document-requirements')
  @UseGuards(CompanyTypeGuard)
  @CompanyTypes(CompanyType.INSURANCE_COMPANY)
  @Permissions('product-distribution:read')
  @ApiOperation({
    summary: 'List document requirements for the insurer company',
  })
  listDocumentRequirements(@CurrentUser() user: AuthenticatedUser) {
    return this.service.listDocumentRequirements(user.companyId!);
  }

  @Delete('document-requirements/:id')
  @UseGuards(CompanyTypeGuard)
  @CompanyTypes(CompanyType.INSURANCE_COMPANY)
  @Permissions('product-distribution:delete')
  @ApiOperation({ summary: 'Delete a product document requirement' })
  removeDocumentRequirement(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.removeDocumentRequirement(user.companyId!, id);
  }

  @Patch('document-requirements/:id/restore')
  @UseGuards(CompanyTypeGuard)
  @CompanyTypes(CompanyType.INSURANCE_COMPANY)
  @Permissions('product-distribution:update')
  @ApiOperation({ summary: 'Restore a soft-deleted document requirement' })
  restoreDocumentRequirement(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.restoreDocumentRequirement(user.companyId!, id);
  }
}

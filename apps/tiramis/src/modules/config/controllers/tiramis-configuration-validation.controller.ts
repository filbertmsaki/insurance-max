import { Body, Controller, Post } from '@nestjs/common';
import { IsIn, IsOptional, IsString } from 'class-validator';

import { ServiceScopes } from '@insurance-max/shared-kernel';

import { TiramisConfigService } from '../services/tiramis-config.service';

class ValidateOrganizationConfigurationDto {
  @IsIn(['test', 'live'])
  environment!: 'test' | 'live';

  @IsString()
  companyCode!: string;

  @IsString()
  systemCode!: string;

  @IsOptional()
  @IsString()
  insurerCompanyCode?: string;
}

@Controller('tiramis/configurations')
export class TiramisConfigurationValidationController {
  constructor(private readonly configService: TiramisConfigService) {}

  @Post('validate-organization')
  @ServiceScopes('tiramis:admin')
  async validate(@Body() dto: ValidateOrganizationConfigurationDto) {
    const configuration = await this.configService.getActiveConfiguration({
      environment: dto.environment,
      companyCode: dto.companyCode,
      systemCode: dto.systemCode,
    });

    const security =
      await this.configService.validateConfigurationSecurity(configuration);

    return {
      valid: security.ok,
      message: security.ok
        ? 'TIRAMIS organization configuration is valid.'
        : security.errors.join('; '),
      configurationId: configuration.id,
      companyCode: configuration.companyCode,
      systemCode: configuration.systemCode,
    };
  }
}

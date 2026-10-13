import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import {
  ApiClientStatus,
  ApiClientType,
  DeploymentEnvironment,
} from '@insurance-max/contracts';
import { TableQueryDto } from '@insurance-max/portal-shared/dto/table-query.dto';

export class FindApiClientsQueryDto extends TableQueryDto {
  @ApiPropertyOptional({ enum: ApiClientStatus })
  @IsOptional()
  @IsEnum(ApiClientStatus)
  status?: ApiClientStatus;

  @ApiPropertyOptional({ enum: ApiClientType })
  @IsOptional()
  @IsEnum(ApiClientType)
  client_type?: ApiClientType;

  @ApiPropertyOptional({ enum: DeploymentEnvironment })
  @IsOptional()
  @IsEnum(DeploymentEnvironment)
  environment?: DeploymentEnvironment;
}

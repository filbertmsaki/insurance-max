import { PartialType } from '@nestjs/swagger';
import { CreateRatingFactorDto } from './create-rating-factor.dto';

export class UpdateRatingFactorDto extends PartialType(CreateRatingFactorDto) {}

import { PartialType } from '@nestjs/mapped-types';
import { CreateSubjectMatterDto } from './create-subject-matter.dto';

export class UpdateSubjectMatterDto extends PartialType(
  CreateSubjectMatterDto,
) {}

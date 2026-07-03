import { SetMetadata } from '@nestjs/common';
import { CompanyType } from '../enums/company-type.enum';

export const COMPANY_TYPES_KEY = 'companyTypes';
export const CompanyTypes = (...types: CompanyType[]) =>
  SetMetadata(COMPANY_TYPES_KEY, types);

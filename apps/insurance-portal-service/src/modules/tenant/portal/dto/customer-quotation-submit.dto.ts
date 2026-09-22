import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';

import { SaveQuotationDraftDto } from '../../quotations/dto/quotation-draft.dto';
import { UpdateQuotationDto } from '../../quotations/dto/quotation-payload.dto';

export class SubmitCustomerQuotationDto {
  @ValidateNested()
  @Type(() => SaveQuotationDraftDto)
  draft: SaveQuotationDraftDto;

  @ValidateNested()
  @Type(() => UpdateQuotationDto)
  payload: UpdateQuotationDto;
}

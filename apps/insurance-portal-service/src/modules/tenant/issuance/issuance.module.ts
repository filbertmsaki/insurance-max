import { Module } from '@nestjs/common';
import { ProductDefinitionModule } from '@insurance-max/shared-kernel';

import { InsuranceDocumentsModule } from '../insurance-documents/insurance-documents.module';
import { CertificateGenerationService } from './certificate-generation.service';
import { IssuanceService } from './issuance.service';

@Module({
  imports: [ProductDefinitionModule, InsuranceDocumentsModule],
  providers: [IssuanceService, CertificateGenerationService],
  exports: [IssuanceService],
})
export class IssuanceModule {}

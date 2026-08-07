import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import {
  DocumentTemplateVersionsController,
  DocumentTemplatesController,
} from './document-templates.controller';
import { DocumentGenerationService } from './document-generation.service';
import { DocumentRenderService } from './document-render.service';
import { DocumentStorageService } from './document-storage.service';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { DocumentTemplatesService } from './document-templates.service';
import {
  PublicDocumentVerificationController,
  PublicSignatureController,
  SignatureRequestsController,
} from './signature-requests.controller';
import { SignatureRequestsService } from './signature-requests.service';
import { DocumentAccessEvent } from './entities/document-access-event.entity';
import { Document } from './entities/document.entity';
import { DocumentLink } from './entities/document-link.entity';
import { DocumentSecurityScan } from './entities/document-security-scan.entity';
import { DocumentTemplateVersion } from './entities/document-template-version.entity';
import { DocumentTemplate } from './entities/document-template.entity';
import { DocumentUploadSession } from './entities/document-upload-session.entity';
import { DocumentVersion } from './entities/document-version.entity';
import { SignatureEvidence } from './entities/signature-evidence.entity';
import { SignatureEvent } from './entities/signature-event.entity';
import { SignatureParticipant } from './entities/signature-participant.entity';
import { SignatureRequest } from './entities/signature-request.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Document,
      DocumentVersion,
      DocumentLink,
      DocumentUploadSession,
      DocumentSecurityScan,
      DocumentAccessEvent,
      DocumentTemplate,
      DocumentTemplateVersion,
      SignatureRequest,
      SignatureParticipant,
      SignatureEvent,
      SignatureEvidence,
    ]),
  ],
  controllers: [
    DocumentsController,
    DocumentTemplatesController,
    DocumentTemplateVersionsController,
    SignatureRequestsController,
    PublicSignatureController,
    PublicDocumentVerificationController,
  ],
  providers: [
    DocumentsService,
    DocumentStorageService,
    DocumentRenderService,
    DocumentTemplatesService,
    DocumentGenerationService,
    SignatureRequestsService,
  ],
  exports: [DocumentsService, DocumentTemplatesService, SignatureRequestsService],
})
export class InsuranceDocumentsModule {}

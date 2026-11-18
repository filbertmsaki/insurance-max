import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { FinancePermissions } from '../../governance/finance-permissions/finance.permissions';
import { FinanceSetupService } from './finance-setup.service';
import { FoundationActor } from '../../accounting/general-ledger/finance-ledger-foundation.service';
import { FinanceBookSelection } from '../finance-configuration/finance-scope.service';
import { SetupEvidence, setupHash, setupUuid } from './finance-setup.types';
import { DocumentStorageService } from '../../../insurance-documents/document-storage.service';
import { DocumentAccessEvent } from '../../../insurance-documents/entities/document-access-event.entity';

/** Reuses native document storage and audit; never grants general document access. */
@Injectable()
export class FinanceSetupEvidenceService {
  constructor(
    private readonly setup: FinanceSetupService,
    private readonly storage: DocumentStorageService,
  ) {}
  async download(
    actor: FoundationActor,
    scope: FinanceBookSelection,
    evidence: SetupEvidence,
  ) {
    if (
      !setupUuid(evidence.id) ||
      !setupUuid(evidence.documentId) ||
      !setupHash(evidence.hash)
    )
      throw new BadRequestException(
        'Exact evidence document, version and hash are required.',
      );
    return this.setup.withAccess(
      actor,
      scope,
      'READ',
      FinancePermissions.FOUNDATION_READ,
      async (m) => {
        const rows = await m.query(
          `SELECT v.storage_key,v.original_file_name,v.safe_file_name,v.file_size FROM document_versions v JOIN documents d ON d.id=v.document_id AND d.company_id=v.company_id WHERE v.id=$1 AND v.document_id=$2 AND v.sha256_hash=$3 AND v.company_id=$4 AND v.status='AVAILABLE' AND d.status='AVAILABLE' AND ((d.owner_type='COMPANY' AND d.owner_id=$4) OR (d.owner_type='FINANCE_SETUP' AND d.owner_id=$5)) FOR SHARE OF v,d`,
          [
            evidence.id,
            evidence.documentId,
            evidence.hash,
            actor.sourceCompanyId,
            scope.bookId,
          ],
        );
        if (rows.length !== 1)
          throw new ForbiddenException(
            'Exact owned setup evidence is unavailable.',
          );
        const file = rows[0],
          size = Number(file.file_size);
        if (!Number.isSafeInteger(size) || size < 0 || size > 25 * 1024 * 1024)
          throw new ConflictException(
            'Evidence size exceeds the supported review limit.',
          );
        const buffer = await this.storage.read(file.storage_key);
        if (
          buffer.length !== size ||
          createHash('sha256').update(buffer).digest('hex') !== evidence.hash
        )
          throw new ConflictException(
            'Evidence bytes differ from the immutable document-version hash.',
          );
        await m.getRepository(DocumentAccessEvent).save({
          company_id: actor.sourceCompanyId,
          document_id: evidence.documentId,
          document_version_id: evidence.id,
          actor_type: 'USER',
          actor_id: actor.sourceUserId,
          action: 'DOWNLOAD',
          access_channel: 'FINANCE_SETUP',
          purpose: 'EXACT_VERSION_SETUP_REVIEW',
          result: 'SUCCESS',
          occurred_at: new Date(),
        });
        return {
          buffer,
          fileName: file.original_file_name ?? file.safe_file_name,
        };
      },
    );
  }
}

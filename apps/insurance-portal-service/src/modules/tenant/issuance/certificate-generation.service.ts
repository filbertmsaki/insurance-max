import { Injectable, Logger } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import * as QRCode from 'qrcode';
import {
  DocumentClassification,
  DocumentLinkType,
  DocumentSourceType,
  DocumentStatus,
  InsuranceDocumentType,
} from '@insurance-max/contracts';

import { DocumentStorageService } from '../insurance-documents/document-storage.service';
import { Document } from '../insurance-documents/entities/document.entity';
import { DocumentLink } from '../insurance-documents/entities/document-link.entity';
import { DocumentVersion } from '../insurance-documents/entities/document-version.entity';
import { CoverNote } from '../cover-notes/entities/cover-note.entity';
import { InsuranceRisk } from '../insurance-risks/entities/insurance-risk.entity';
import { Policy } from '../policies/entities/policy.entity';
import { PolicyRisk } from '../policies/entities/policy-risk.entity';
import { Quotation } from '../quotations/entities/quotation.entity';
import { QuotationFlow } from '../quotations/enums/quotation-flow.enum';

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN = 50;

/**
 * Renders a real policy/motor certificate PDF (fixed regulatory layout, not
 * a company-customizable template — unlike `DocumentGenerationService`,
 * which is for user-authored document templates) and persists it through
 * the same `documents`/`document_versions`/`document_links` tables the rest
 * of the engagement module uses, so it shows up in the existing
 * list/download/public-verification endpoints for free. Runs inside the
 * same transaction as policy activation (`IssuanceService.applyPolicyActivation`)
 * so a certificate never exists without an active policy behind it.
 */
@Injectable()
export class CertificateGenerationService {
  private readonly logger = new Logger(CertificateGenerationService.name);

  constructor(private readonly storageService: DocumentStorageService) {}

  async generateForPolicy(
    manager: EntityManager,
    policy: Policy,
  ): Promise<Document | null> {
    // Certificate generation is a side effect of policy activation, not the
    // regulatory act itself (TIRA has already accepted the cover note by
    // this point) — any failure here is logged and swallowed so it never
    // rolls back the enclosing activation transaction.
    try {
      return await this.doGenerateForPolicy(manager, policy);
    } catch (error) {
      this.logger.warn(
        `Failed to generate certificate for policy ${policy.id}: ${
          error instanceof Error ? error.message : error
        }`,
      );
      return null;
    }
  }

  private async doGenerateForPolicy(
    manager: EntityManager,
    policy: Policy,
  ): Promise<Document> {
    const coverNotes = await manager.getRepository(CoverNote).find({
      where: { policy_id: policy.id },
      order: { created_at: 'ASC' },
    });

    const risks = await manager.getRepository(PolicyRisk).find({
      where: { policy_id: policy.id },
      relations: { risk: true },
    });

    const documentType = await this.resolveDocumentType(manager, policy);
    const verificationCode = `CERT-${policy.id.replace(/-/g, '')}-${Date.now().toString(36).toUpperCase()}`;

    const pdf = await this.renderCertificatePdf({
      policy,
      coverNotes,
      risks,
      verificationCode,
      documentType,
    });

    const stored = await this.storageService.store({
      buffer: pdf,
      companyId: policy.company_id,
      fileName: `certificate-${policy.policy_no.replace(/[^A-Z0-9_-]/gi, '-')}.pdf`,
      maximumBytes: this.storageService.maximumBytes(),
      prefix: 'documents/certificates',
    });

    const documentRepository = manager.getRepository(Document);

    const document = await documentRepository.save(
      documentRepository.create({
        company_id: policy.company_id,
        document_no: verificationCode,
        owner_type: 'POLICY',
        owner_id: policy.id,
        title: `Certificate of Insurance - ${policy.policy_no}`,
        document_type: documentType,
        classification: DocumentClassification.CONFIDENTIAL,
        source_type: DocumentSourceType.GENERATED,
        storage_key: stored.storageKey,
        checksum: stored.checksum,
        content_type: stored.detectedMimeType,
        file_name: stored.originalFileName,
        file_size: stored.size,
        status: DocumentStatus.AVAILABLE,
        current_version_id: null,
        customer_visible: true,
        intermediary_visible: true,
        public_verification_enabled: true,
        public_verification_code: verificationCode,
        uploaded_by: null,
        verified_by: null,
        verified_at: new Date(),
        created_by: policy.created_by,
      }),
    );

    const version = await manager.getRepository(DocumentVersion).save({
      company_id: policy.company_id,
      document_id: document.id,
      version_number: 1,
      status: DocumentStatus.AVAILABLE,
      storage_provider: this.storageService.storageProvider(),
      storage_bucket: this.storageService.storageBucket(),
      storage_key: stored.storageKey,
      original_file_name: stored.originalFileName,
      safe_file_name: stored.safeFileName,
      declared_mime_type: stored.detectedMimeType,
      detected_mime_type: stored.detectedMimeType,
      detected_extension: stored.detectedExtension,
      file_size: stored.size,
      sha256_hash: stored.checksum,
      source_snapshot: { policyId: policy.id, policyNo: policy.policy_no },
      source_snapshot_hash: stored.checksum,
      generator_version: 'certificate-v1',
      page_count: 1,
      scan_status: 'CLEAN',
      scan_provider: 'internal',
      scanned_at: new Date(),
      scan_result: { generated: true },
      uploaded_by: policy.created_by,
      uploaded_at: new Date(),
    });

    document.current_version_id = version.id;
    await documentRepository.save(document);

    await manager.getRepository(DocumentLink).save({
      company_id: policy.company_id,
      document_id: document.id,
      link_type: DocumentLinkType.POLICY,
      linked_record_type: 'POLICY',
      linked_record_id: policy.id,
      customer_visible: true,
      intermediary_visible: true,
      label: document.title,
      created_by: policy.created_by,
    });

    return document;
  }

  private async resolveDocumentType(
    manager: EntityManager,
    policy: Policy,
  ): Promise<InsuranceDocumentType> {
    if (!policy.quotation_id) {
      return InsuranceDocumentType.POLICY_CERTIFICATE;
    }

    const quotation = await manager.getRepository(Quotation).findOne({
      where: { id: policy.quotation_id },
      select: { id: true, quotation_flow: true },
    });

    const isMotor =
      quotation?.quotation_flow === QuotationFlow.MOTOR_SINGLE ||
      quotation?.quotation_flow === QuotationFlow.MOTOR_FLEET;

    return isMotor
      ? InsuranceDocumentType.MOTOR_CERTIFICATE
      : InsuranceDocumentType.POLICY_CERTIFICATE;
  }

  private async renderCertificatePdf(params: {
    policy: Policy;
    coverNotes: CoverNote[];
    risks: Array<PolicyRisk & { risk: InsuranceRisk }>;
    verificationCode: string;
    documentType: InsuranceDocumentType;
  }): Promise<Buffer> {
    const { policy, coverNotes, risks, verificationCode, documentType } =
      params;
    const doc = await PDFDocument.create();
    const page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const boldFont = await doc.embedFont(StandardFonts.HelveticaBold);

    let y = PAGE_HEIGHT - MARGIN;

    const heading =
      documentType === InsuranceDocumentType.MOTOR_CERTIFICATE
        ? 'CERTIFICATE OF MOTOR INSURANCE'
        : 'CERTIFICATE OF INSURANCE';

    page.drawText(heading, { x: MARGIN, y, size: 18, font: boldFont });
    y -= 30;
    page.drawLine({
      start: { x: MARGIN, y },
      end: { x: PAGE_WIDTH - MARGIN, y },
      thickness: 1,
      color: rgb(0.6, 0.6, 0.6),
    });
    y -= 24;

    const customerSnapshot = policy.customer_snapshot ?? {};
    const policyHolder =
      (customerSnapshot.policyHolder as Record<string, unknown> | null) ?? null;

    const fields: Array<[string, string]> = [
      ['Policy Number', policy.policy_no],
      [
        'Policy Holder',
        String(policyHolder?.name ?? customerSnapshot.displayName ?? 'N/A'),
      ],
      [
        'Cover Note Reference',
        policy.cover_note_no ??
          coverNotes[0]?.cover_note_reference_number ??
          'N/A',
      ],
      ['Period of Insurance', `${policy.start_date} to ${policy.end_date}`],
      ['Sum Insured', `${policy.currency} ${policy.sum_insured}`],
      ['Total Premium', `${policy.currency} ${policy.total_premium}`],
    ];

    for (const [label, value] of fields) {
      page.drawText(`${label}:`, { x: MARGIN, y, size: 11, font: boldFont });
      const size =
        label === 'Policy Number'
          ? Math.min(
              11,
              (PAGE_WIDTH - MARGIN * 2 - 180) /
                font.widthOfTextAtSize(value, 1),
            )
          : 11;
      page.drawText(value, { x: MARGIN + 180, y, size, font });
      y -= 20;
    }

    if (risks.length) {
      y -= 10;
      page.drawText('Covered Risks', {
        x: MARGIN,
        y,
        size: 13,
        font: boldFont,
      });
      y -= 20;

      for (const risk of risks) {
        const label = risk.risk?.risk_name ?? risk.risk?.risk_code ?? 'Risk';
        page.drawText(`- ${label}: ${policy.currency} ${risk.sum_insured}`, {
          x: MARGIN,
          y,
          size: 10,
          font,
        });
        y -= 16;
      }
    }

    y -= 16;
    page.drawText(
      'This certificate is evidence of insurance cover for the period stated above.',
      { x: MARGIN, y, size: 9, font },
    );
    y -= 14;
    page.drawText(`Verification code: ${verificationCode}`, {
      x: MARGIN,
      y,
      size: 9,
      font,
    });

    const qrPngBuffer = await QRCode.toBuffer(verificationCode, {
      type: 'png',
      margin: 1,
      width: 120,
    });
    const qrImage = await doc.embedPng(qrPngBuffer);
    page.drawImage(qrImage, {
      x: PAGE_WIDTH - MARGIN - 90,
      y: MARGIN,
      width: 90,
      height: 90,
    });

    return Buffer.from(await doc.save());
  }
}

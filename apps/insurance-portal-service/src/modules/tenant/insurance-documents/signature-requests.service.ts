import {
  createHash,
  createHmac,
  randomUUID,
  timingSafeEqual,
} from 'node:crypto';

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';
import { Repository } from 'typeorm';
import { DocumentStatus } from '@insurance-max/contracts';

import { DocumentStorageService } from './document-storage.service';
import { Document } from './entities/document.entity';
import { DocumentVersion } from './entities/document-version.entity';
import { SignatureEvidence } from './entities/signature-evidence.entity';
import { SignatureEvent } from './entities/signature-event.entity';
import { SignatureParticipant } from './entities/signature-participant.entity';
import { SignatureRequest } from './entities/signature-request.entity';

@Injectable()
export class SignatureRequestsService {
  constructor(
    @InjectRepository(SignatureRequest)
    private readonly requestRepository: Repository<SignatureRequest>,
    @InjectRepository(SignatureParticipant)
    private readonly participantRepository: Repository<SignatureParticipant>,
    @InjectRepository(SignatureEvent)
    private readonly eventRepository: Repository<SignatureEvent>,
    @InjectRepository(SignatureEvidence)
    private readonly evidenceRepository: Repository<SignatureEvidence>,
    @InjectRepository(Document)
    private readonly documentRepository: Repository<Document>,
    @InjectRepository(DocumentVersion)
    private readonly versionRepository: Repository<DocumentVersion>,
    private readonly storageService: DocumentStorageService,
    private readonly configService: ConfigService,
  ) {}

  listForCompany(companyId: string) {
    return this.requestRepository.find({
      where: { company_id: companyId },
      order: { created_at: 'DESC' },
    });
  }

  async create(
    user: AuthenticatedUser,
    input: {
      documentId: string;
      signatureProvider?: string;
      signingOrderRequired?: boolean;
      expiresAt?: string;
      participants: Array<{
        participantType: string;
        participantId?: string;
        name: string;
        email?: string;
        phone?: string;
        signingOrder?: number;
      }>;
    },
  ) {
    const document = await this.documentRepository.findOne({
      where: { id: input.documentId, company_id: user.companyId! },
    });

    if (!document?.current_version_id) {
      throw new NotFoundException('Document is not ready for signature.');
    }

    if (document.status !== DocumentStatus.AVAILABLE) {
      throw new BadRequestException('Only available documents can be signed.');
    }

    const request = await this.requestRepository.save(
      this.requestRepository.create({
        company_id: user.companyId!,
        request_no: `SIG-${randomUUID().slice(0, 8).toUpperCase()}`,
        document_id: document.id,
        document_version_id: document.current_version_id,
        status: 'DRAFT',
        signature_provider: input.signatureProvider ?? 'internal',
        provider_request_id: null,
        signing_order_required: input.signingOrderRequired ?? false,
        expires_at: input.expiresAt ? new Date(input.expiresAt) : null,
        completion_document_version_id: null,
        evidence_document_id: null,
        created_by: user.id,
        completed_at: null,
      }),
    );

    const participants = await this.participantRepository.save(
      input.participants.map((participant, index) =>
        this.participantRepository.create({
          signature_request_id: request.id,
          participant_type: participant.participantType,
          participant_id: participant.participantId ?? null,
          name: participant.name,
          email: participant.email ?? null,
          phone: participant.phone ?? null,
          signing_order: participant.signingOrder ?? index + 1,
          status: 'PENDING',
          access_token_hash: null,
          signed_at: null,
          declined_at: null,
          decline_reason: null,
        }),
      ),
    );

    await this.addEvent(request.id, 'CREATED', user.id, 'USER', null, {
      participantCount: participants.length,
    });

    return {
      request,
      participants,
    };
  }

  async findOne(companyId: string, id: string) {
    const request = await this.requestRepository.findOne({
      where: { id, company_id: companyId },
    });

    if (!request) {
      throw new NotFoundException('Signature request not found.');
    }

    const participants = await this.participantRepository.find({
      where: { signature_request_id: request.id },
      order: { signing_order: 'ASC', created_at: 'ASC' },
    });
    const events = await this.eventRepository.find({
      where: { signature_request_id: request.id },
      order: { created_at: 'ASC' },
    });

    return {
      ...request,
      participants,
      events,
    };
  }

  async send(user: AuthenticatedUser, id: string) {
    const request = await this.requireRequest(user.companyId!, id);
    const participants = await this.participantRepository.find({
      where: { signature_request_id: request.id },
      order: { signing_order: 'ASC', created_at: 'ASC' },
    });

    const issuedTokens = participants.map((participant) => {
      const token = randomUUID();
      participant.access_token_hash = this.hashToken(token);
      participant.status =
        participant.status === 'PENDING' ? 'SENT' : participant.status;
      return {
        participant_id: participant.id,
        name: participant.name,
        token,
      };
    });

    await this.participantRepository.save(participants);
    request.status = 'SENT';
    request.provider_request_id =
      request.provider_request_id ?? `internal-${request.id}`;
    await this.requestRepository.save(request);

    await this.addEvent(request.id, 'SENT', user.id, 'USER', null, {
      participantCount: participants.length,
    });

    return {
      request: await this.findOne(user.companyId!, request.id),
      issued_tokens: issuedTokens,
    };
  }

  async remind(user: AuthenticatedUser, id: string) {
    const request = await this.requireRequest(user.companyId!, id);
    await this.addEvent(request.id, 'REMINDER_SENT', user.id, 'USER');
    return this.findOne(user.companyId!, id);
  }

  async cancel(user: AuthenticatedUser, id: string, reason: string) {
    const request = await this.requireRequest(user.companyId!, id);
    request.status = 'CANCELLED';
    await this.requestRepository.save(request);
    await this.addEvent(request.id, 'CANCELLED', user.id, 'USER', reason);
    return this.findOne(user.companyId!, id);
  }

  async reconcile(user: AuthenticatedUser, id: string) {
    const request = await this.requireRequest(user.companyId!, id);
    const participants = await this.participantRepository.find({
      where: { signature_request_id: request.id },
      order: { signing_order: 'ASC', created_at: 'ASC' },
    });

    const hasDecline = participants.some(
      (participant) => participant.status === 'DECLINED',
    );
    const allSigned =
      participants.length > 0 &&
      participants.every((participant) => participant.status === 'SIGNED');

    if (hasDecline) {
      request.status = 'DECLINED';
    } else if (allSigned) {
      request.status = 'COMPLETED';
      request.completed_at = new Date();
      if (!request.completion_document_version_id) {
        request.completion_document_version_id =
          await this.createCompletionDocumentVersion(user.companyId!, request);
      }
    } else if (
      participants.some((participant) => participant.status === 'SIGNED')
    ) {
      request.status = 'PARTIALLY_SIGNED';
    } else {
      request.status = request.status === 'DRAFT' ? 'DRAFT' : 'SENT';
    }

    await this.requestRepository.save(request);
    await this.addEvent(request.id, 'RECONCILED', user.id, 'USER', null, {
      status: request.status,
    });

    return this.findOne(user.companyId!, id);
  }

  async getPublicParticipant(token: string) {
    const participant = await this.participantRepository.findOne({
      where: {
        access_token_hash: this.hashToken(token),
      },
    });

    if (!participant) {
      throw new NotFoundException('Signature participant not found.');
    }

    const request = await this.requestRepository.findOne({
      where: { id: participant.signature_request_id },
    });

    if (!request) {
      throw new NotFoundException('Signature request not found.');
    }

    const document = await this.documentRepository.findOne({
      where: { id: request.document_id },
    });

    return {
      token,
      participant,
      request,
      document,
    };
  }

  async respondPublic(
    token: string,
    input: {
      decision: 'SIGN' | 'DECLINE';
      declineReason?: string;
      name?: string;
      ipAddress?: string | null;
      userAgent?: string | null;
    },
  ) {
    const current = await this.getPublicParticipant(token);
    const { participant, request } = current;

    if (request.expires_at && request.expires_at.getTime() < Date.now()) {
      throw new BadRequestException('Signature request has expired.');
    }

    if (['COMPLETED', 'CANCELLED', 'DECLINED'].includes(request.status)) {
      throw new BadRequestException('Signature request is no longer active.');
    }

    if (participant.status === 'SIGNED' || participant.status === 'DECLINED') {
      return this.getPublicParticipant(token);
    }

    const participants = await this.participantRepository.find({
      where: { signature_request_id: request.id },
      order: { signing_order: 'ASC', created_at: 'ASC' },
    });

    if (request.signing_order_required) {
      const currentOrder = participant.signing_order ?? 1;
      const earlierPending = participants.some(
        (item) =>
          (item.signing_order ?? 0) < currentOrder && item.status !== 'SIGNED',
      );

      if (earlierPending) {
        throw new BadRequestException(
          'This signature request enforces signing order.',
        );
      }
    }

    if (input.name?.trim()) {
      participant.name = input.name.trim();
    }

    if (input.decision === 'SIGN') {
      participant.status = 'SIGNED';
      participant.signed_at = new Date();
    } else {
      participant.status = 'DECLINED';
      participant.declined_at = new Date();
      participant.decline_reason =
        input.declineReason?.trim() ?? 'No reason provided';
    }

    await this.participantRepository.save(participant);
    const evidencePayload = await this.buildSignedEvidencePayload({
      request,
      participant,
      decision: input.decision,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
    });
    await this.evidenceRepository.save(
      this.evidenceRepository.create({
        signature_request_id: request.id,
        participant_id: participant.id,
        evidence_type: input.decision === 'SIGN' ? 'SIGNATURE' : 'DECLINE',
        ip_address: input.ipAddress ?? null,
        user_agent: input.userAgent ?? null,
        payload: evidencePayload,
      }),
    );
    await this.addEvent(
      request.id,
      input.decision === 'SIGN' ? 'PARTICIPANT_SIGNED' : 'PARTICIPANT_DECLINED',
      participant.id,
      'PARTICIPANT',
      input.decision === 'DECLINE' ? participant.decline_reason : null,
    );

    await this.reconcile(
      {
        companyId: request.company_id,
        id: participant.id,
      } as AuthenticatedUser,
      request.id,
    );

    return this.getPublicParticipant(token);
  }

  async verifyEvidence(companyId: string, evidenceId: string) {
    const evidence = await this.evidenceRepository.findOne({
      where: { id: evidenceId },
    });

    if (!evidence) {
      throw new NotFoundException('Signature evidence not found.');
    }

    const request = await this.requestRepository.findOne({
      where: { id: evidence.signature_request_id, company_id: companyId },
    });

    if (!request) {
      throw new NotFoundException('Signature request not found.');
    }

    const payload = evidence.payload ?? {};
    const canonicalPayload = payload.canonicalPayload;
    const signature = payload.signature;

    if (
      !canonicalPayload ||
      typeof canonicalPayload !== 'object' ||
      typeof signature !== 'string'
    ) {
      return {
        evidence_id: evidence.id,
        verified: false,
        reason: 'Signature evidence does not contain a signed payload.',
      };
    }

    return {
      evidence_id: evidence.id,
      verified: this.verifyHmac(canonicalPayload, signature),
      algorithm: payload.algorithm ?? 'HMAC-SHA256',
      payload_hash: payload.payloadHash ?? null,
    };
  }

  private async requireRequest(companyId: string, id: string) {
    const request = await this.requestRepository.findOne({
      where: { id, company_id: companyId },
    });

    if (!request) {
      throw new NotFoundException('Signature request not found.');
    }

    return request;
  }

  private async createCompletionDocumentVersion(
    companyId: string,
    request: SignatureRequest,
  ): Promise<string> {
    const document = await this.documentRepository.findOne({
      where: { id: request.document_id, company_id: companyId },
      relations: { current_version: true },
    });

    if (!document?.current_version) {
      throw new NotFoundException('Document version not found.');
    }

    const buffer = await this.storageService.read(
      document.current_version.storage_key,
    );
    const stored = await this.storageService.store({
      buffer,
      companyId,
      fileName:
        document.current_version.original_file_name ?? document.file_name,
      maximumBytes: this.storageService.maximumBytes(),
      prefix: 'documents/signed',
    });

    const previousVersion = document.current_version;
    previousVersion.status = DocumentStatus.SUPERSEDED;
    await this.versionRepository.save(previousVersion);

    const newVersion = await this.versionRepository.save(
      this.versionRepository.create({
        company_id: companyId,
        document_id: document.id,
        version_number: previousVersion.version_number + 1,
        status: DocumentStatus.AVAILABLE,
        storage_provider: 'local_private',
        storage_bucket: null,
        storage_key: stored.storageKey,
        original_file_name: stored.originalFileName,
        safe_file_name: stored.safeFileName,
        declared_mime_type: stored.detectedMimeType,
        detected_mime_type: stored.detectedMimeType,
        detected_extension: stored.detectedExtension,
        file_size: stored.size,
        sha256_hash: stored.checksum,
        encryption_key_reference: null,
        source_snapshot: {
          signatureRequestId: request.id,
          completedAt: new Date().toISOString(),
        },
        source_snapshot_hash: null,
        template_code: previousVersion.template_code,
        template_version: previousVersion.template_version,
        generator_version: 'signature-completion',
        page_count: previousVersion.page_count,
        scan_status: 'CLEAN',
        scan_provider: 'internal',
        scan_reference: null,
        scanned_at: new Date(),
        scan_result: { signatureRequestId: request.id },
        uploaded_by: request.created_by,
        uploaded_at: new Date(),
        supersedes_version_id: previousVersion.id,
      }),
    );

    document.current_version_id = newVersion.id;
    document.status = DocumentStatus.AVAILABLE;
    await this.documentRepository.save(document);

    return newVersion.id;
  }

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private async buildSignedEvidencePayload(params: {
    request: SignatureRequest;
    participant: SignatureParticipant;
    decision: 'SIGN' | 'DECLINE';
    ipAddress: string | null;
    userAgent: string | null;
  }) {
    const documentVersion = await this.versionRepository.findOne({
      where: { id: params.request.document_version_id },
    });
    const occurredAt = new Date().toISOString();
    const canonicalPayload = {
      requestId: params.request.id,
      requestNo: params.request.request_no,
      documentId: params.request.document_id,
      documentVersionId: params.request.document_version_id,
      documentSha256Hash: documentVersion?.sha256_hash ?? null,
      participantId: params.participant.id,
      participantName: params.participant.name,
      participantType: params.participant.participant_type,
      participantEmail: params.participant.email,
      decision: params.decision,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      occurredAt,
    };
    const serialized = this.stableStringify(canonicalPayload);
    const payloadHash = createHash('sha256').update(serialized).digest('hex');

    return {
      canonicalPayload,
      payloadHash,
      algorithm: 'HMAC-SHA256',
      signature: this.signHmac(canonicalPayload),
      signedAt: occurredAt,
    };
  }

  private signHmac(payload: unknown) {
    return createHmac('sha256', this.signatureSecret())
      .update(this.stableStringify(payload))
      .digest('hex');
  }

  private verifyHmac(payload: unknown, signature: string) {
    const expected = this.signHmac(payload);
    const expectedBuffer = Buffer.from(expected, 'hex');
    const actualBuffer = Buffer.from(signature, 'hex');

    return (
      expectedBuffer.length === actualBuffer.length &&
      timingSafeEqual(expectedBuffer, actualBuffer)
    );
  }

  private signatureSecret() {
    const secret =
      this.configService.get<string>('SIGNATURE_EVIDENCE_SECRET') ??
      this.configService.get<string>('JWT_SECRET') ??
      this.configService.get<string>('AUTH_JWT_SECRET');

    if (!secret) {
      throw new BadRequestException(
        'Signature evidence secret is not configured.',
      );
    }

    return secret;
  }

  private stableStringify(value: unknown): string {
    if (Array.isArray(value)) {
      return `[${value.map((item) => this.stableStringify(item)).join(',')}]`;
    }

    if (value && typeof value === 'object') {
      const record = value as Record<string, unknown>;
      return `{${Object.keys(record)
        .sort()
        .map(
          (key) =>
            `${JSON.stringify(key)}:${this.stableStringify(record[key])}`,
        )
        .join(',')}}`;
    }

    return JSON.stringify(value);
  }

  private async addEvent(
    requestId: string,
    eventType: string,
    actorId: string | null,
    actorType: string,
    notes?: string | null,
    payload?: Record<string, unknown>,
  ) {
    await this.eventRepository.save(
      this.eventRepository.create({
        signature_request_id: requestId,
        event_type: eventType,
        actor_id: actorId,
        actor_type: actorType,
        notes: notes ?? null,
        payload: payload ?? null,
      }),
    );
  }
}

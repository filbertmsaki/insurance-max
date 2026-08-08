import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';

import { CreateCommunicationMessageDto } from '../../communications/dto/communications.dto';
import { CommunicationMessage } from '../../communications/entities/communication-message.entity';
import { CommunicationThread } from '../../communications/entities/communication-thread.entity';
import { Customer } from '../../customers/entities/customer.entity';
import { DocumentsService } from '../../insurance-documents/documents.service';
import { DocumentLink } from '../../insurance-documents/entities/document-link.entity';
import { Document } from '../../insurance-documents/entities/document.entity';
import { SignatureEvent } from '../../insurance-documents/entities/signature-event.entity';
import { SignatureParticipant } from '../../insurance-documents/entities/signature-participant.entity';
import { SignatureRequest } from '../../insurance-documents/entities/signature-request.entity';
import { Invoice } from '../../billing-commission/entities/invoice.entity';
import { Receipt } from '../../billing-commission/entities/receipt.entity';
import { Policy } from '../../policies/entities/policy.entity';
import { Quotation } from '../../quotations/entities/quotation.entity';

import { PortalListQueryDto } from '../dto/portal-query.dto';
import { PortalAccount } from '../entities/portal-account.entity';
import { PortalActorType } from '../enums/portal.enums';

type ScopeResourceKey =
  | 'CUSTOMER'
  | 'POLICY'
  | 'QUOTATION'
  | 'INVOICE'
  | 'RECEIPT'
  | 'INTERMEDIARY_COMPANY';

type AccessScope = {
  actorType: PortalActorType;
  visibleFlag: 'customer_visible' | 'intermediary_visible';
  companyIds: Set<string> | null;
  resourceIds: Record<ScopeResourceKey, Set<string>>;
};

@Injectable()
export class PortalEngagementService {
  constructor(
    @InjectRepository(Document)
    private readonly documentRepository: Repository<Document>,
    @InjectRepository(DocumentLink)
    private readonly documentLinkRepository: Repository<DocumentLink>,
    @InjectRepository(CommunicationThread)
    private readonly threadRepository: Repository<CommunicationThread>,
    @InjectRepository(CommunicationMessage)
    private readonly messageRepository: Repository<CommunicationMessage>,
    @InjectRepository(SignatureRequest)
    private readonly signatureRequestRepository: Repository<SignatureRequest>,
    @InjectRepository(SignatureParticipant)
    private readonly participantRepository: Repository<SignatureParticipant>,
    @InjectRepository(SignatureEvent)
    private readonly eventRepository: Repository<SignatureEvent>,
    @InjectRepository(Customer)
    private readonly customerRepository: Repository<Customer>,
    @InjectRepository(Quotation)
    private readonly quotationRepository: Repository<Quotation>,
    @InjectRepository(Policy)
    private readonly policyRepository: Repository<Policy>,
    @InjectRepository(Invoice)
    private readonly invoiceRepository: Repository<Invoice>,
    @InjectRepository(Receipt)
    private readonly receiptRepository: Repository<Receipt>,
    private readonly documentsService: DocumentsService,
  ) {}

  async listDocuments(account: PortalAccount, query: PortalListQueryDto) {
    const scope = await this.buildScope(account);
    const documents = await this.documentRepository.find({
      where: this.companyWhere(scope),
      relations: {
        current_version: true,
        links: true,
      },
      order: { created_at: 'DESC' },
    });

    return this.filterList(
      documents.filter((document) =>
        this.documentMatchesScope(document, scope),
      ),
      query,
      (document) =>
        [
          document.document_no,
          document.title,
          document.file_name,
          document.document_type,
          document.owner_type,
        ].join(' '),
      (document) => document.status,
    );
  }

  async findDocument(account: PortalAccount, id: string) {
    const scope = await this.buildScope(account);
    const document = await this.documentRepository.findOne({
      where: {
        id,
        ...(this.companyWhere(scope) ?? {}),
      },
      relations: {
        current_version: true,
        links: true,
      },
    });

    if (!document || !this.documentMatchesScope(document, scope)) {
      throw new NotFoundException('Document not found');
    }

    return document;
  }

  async downloadDocument(
    account: PortalAccount,
    id: string,
    actor: {
      actorId: string | null;
      ipAddress?: string | null;
      userAgent?: string | null;
    },
  ) {
    const document = await this.findDocument(account, id);

    return this.documentsService.download(document.company_id, id, {
      actorId: actor.actorId,
      actorType:
        account.actor_type === PortalActorType.CUSTOMER
          ? 'PORTAL_CUSTOMER'
          : 'PORTAL_INTERMEDIARY',
      accessChannel: 'PORTAL',
      ipAddress: actor.ipAddress ?? null,
      userAgent: actor.userAgent ?? null,
    });
  }

  async listThreads(account: PortalAccount, query: PortalListQueryDto) {
    const scope = await this.buildScope(account);
    const threads = await this.threadRepository.find({
      where: this.companyWhere(scope),
      order: { updated_at: 'DESC' },
    });

    return this.filterList(
      threads.filter((thread) => this.threadMatchesScope(thread, scope)),
      query,
      (thread) =>
        [
          thread.thread_no,
          thread.subject,
          thread.thread_type,
          thread.resource_type,
        ].join(' '),
      (thread) => (thread.closed_at ? 'CLOSED' : 'OPEN'),
    );
  }

  async findThread(account: PortalAccount, id: string) {
    const scope = await this.buildScope(account);
    const thread = await this.threadRepository.findOne({
      where: {
        id,
        ...(this.companyWhere(scope) ?? {}),
      },
    });

    if (!thread || !this.threadMatchesScope(thread, scope)) {
      throw new NotFoundException('Communication thread not found');
    }

    return thread;
  }

  async listMessages(account: PortalAccount, id: string) {
    const thread = await this.findThread(account, id);

    return this.messageRepository.find({
      where: {
        company_id: thread.company_id,
        thread_id: id,
        internal_only: false,
      },
      order: { created_at: 'ASC' },
    });
  }

  async postMessage(
    account: PortalAccount,
    id: string,
    dto: CreateCommunicationMessageDto,
  ) {
    const thread = await this.findThread(account, id);

    if (thread.closed_at) {
      throw new BadRequestException('Communication thread is closed.');
    }

    const message = await this.messageRepository.save(
      this.messageRepository.create({
        company_id: thread.company_id,
        thread_id: thread.id,
        direction: 'OUTBOUND',
        status: 'SENT',
        channel: dto.channel ?? 'PORTAL',
        subject: dto.subject ?? thread.subject,
        body_text: dto.body_text,
        body_html: null,
        sender_type: 'PORTAL_ACCOUNT',
        sender_id: account.id,
        recipient_type: dto.recipient_type ?? null,
        recipient_id: dto.recipient_id ?? null,
        provider: null,
        provider_message_id: null,
        internal_only: false,
        metadata: {
          portal_actor_type: account.actor_type,
          portal_account_id: account.id,
        },
      }),
    );

    thread.updated_at = new Date();
    await this.threadRepository.save(thread);

    return message;
  }

  async listSignatureRequests(
    account: PortalAccount,
    query: PortalListQueryDto,
  ) {
    const scope = await this.buildScope(account);
    const documents = await this.documentRepository.find({
      where: this.companyWhere(scope),
      relations: { links: true },
    });
    const accessibleDocumentIds = new Set(
      documents
        .filter((document) => this.documentMatchesScope(document, scope))
        .map((document) => document.id),
    );

    const requests = await this.signatureRequestRepository.find({
      where: this.companyWhere(scope),
      order: { created_at: 'DESC' },
    });

    return this.filterList(
      requests.filter((request) =>
        accessibleDocumentIds.has(request.document_id),
      ),
      query,
      (request) =>
        [request.request_no, request.signature_provider, request.status].join(
          ' ',
        ),
      (request) => request.status,
    );
  }

  async findSignatureRequest(account: PortalAccount, id: string) {
    const scope = await this.buildScope(account);
    const request = await this.signatureRequestRepository.findOne({
      where: {
        id,
        ...(this.companyWhere(scope) ?? {}),
      },
    });

    if (!request) {
      throw new NotFoundException('Signature request not found');
    }

    await this.findDocument(account, request.document_id);

    const [participants, events] = await Promise.all([
      this.participantRepository.find({
        where: { signature_request_id: request.id },
        order: { signing_order: 'ASC', created_at: 'ASC' },
      }),
      this.eventRepository.find({
        where: { signature_request_id: request.id },
        order: { created_at: 'ASC' },
      }),
    ]);

    return {
      ...request,
      participants,
      events,
    };
  }

  private async buildScope(account: PortalAccount): Promise<AccessScope> {
    if (account.actor_type === PortalActorType.CUSTOMER) {
      if (!account.customer_id) {
        throw new NotFoundException('Portal customer account is not linked');
      }

      const [quotations, policies, invoices, receipts] = await Promise.all([
        this.quotationRepository.find({
          select: { id: true },
          where: {
            company_id: account.company_id,
            customer_id: account.customer_id,
          },
        }),
        this.policyRepository.find({
          select: { id: true },
          where: {
            company_id: account.company_id,
            customer_id: account.customer_id,
          },
        }),
        this.invoiceRepository.find({
          select: { id: true },
          where: {
            company_id: account.company_id,
            customer_id: account.customer_id,
          },
        }),
        this.receiptRepository.find({
          select: { id: true },
          where: {
            company_id: account.company_id,
            customer_id: account.customer_id,
          },
        }),
      ]);

      return {
        actorType: account.actor_type,
        visibleFlag: 'customer_visible',
        companyIds: new Set([account.company_id]),
        resourceIds: {
          CUSTOMER: new Set([account.customer_id]),
          POLICY: new Set(policies.map((item) => item.id)),
          QUOTATION: new Set(quotations.map((item) => item.id)),
          INVOICE: new Set(invoices.map((item) => item.id)),
          RECEIPT: new Set(receipts.map((item) => item.id)),
          INTERMEDIARY_COMPANY: new Set<string>(),
        },
      };
    }

    if (!account.intermediary_company_id) {
      throw new NotFoundException('Portal intermediary account is not linked');
    }

    const [quotations, policies, invoices] = await Promise.all([
      this.quotationRepository.find({
        select: { id: true, customer_id: true },
        where: {
          intermediary_company_id: account.intermediary_company_id,
        },
      }),
      this.policyRepository.find({
        select: { id: true, customer_id: true },
        where: {
          intermediary_company_id: account.intermediary_company_id,
        },
      }),
      this.invoiceRepository.find({
        select: { id: true, customer_id: true },
        where: {
          intermediary_company_id: account.intermediary_company_id,
        },
      }),
    ]);

    const customerIds = new Set<string>();

    for (const record of [...quotations, ...policies, ...invoices]) {
      if (record.customer_id) {
        customerIds.add(record.customer_id);
      }
    }

    const directCustomers = customerIds.size
      ? await this.customerRepository.find({
          select: { id: true },
          where: {
            id: In([...customerIds]),
          },
        })
      : [];

    const receipts = customerIds.size
      ? await this.receiptRepository.find({
          select: { id: true },
          where: {
            customer_id: In([...customerIds]),
          },
        })
      : [];

    return {
      actorType: account.actor_type,
      visibleFlag: 'intermediary_visible',
      companyIds: null,
      resourceIds: {
        CUSTOMER: new Set(directCustomers.map((item) => item.id)),
        POLICY: new Set(policies.map((item) => item.id)),
        QUOTATION: new Set(quotations.map((item) => item.id)),
        INVOICE: new Set(invoices.map((item) => item.id)),
        RECEIPT: new Set(receipts.map((item) => item.id)),
        INTERMEDIARY_COMPANY: new Set([account.intermediary_company_id]),
      },
    };
  }

  private documentMatchesScope(document: Document, scope: AccessScope) {
    const isVisible =
      scope.visibleFlag === 'customer_visible'
        ? document.customer_visible
        : document.intermediary_visible;

    const ownerMatch = this.resourceMatchesScope(
      document.owner_type,
      document.owner_id,
      scope,
    );

    const linkMatch = (document.links ?? []).some((link) => {
      const linkVisible =
        scope.visibleFlag === 'customer_visible'
          ? link.customer_visible
          : link.intermediary_visible;

      return (
        linkVisible &&
        this.resourceMatchesScope(
          link.linked_record_type,
          link.linked_record_id,
          scope,
        )
      );
    });

    return (isVisible && ownerMatch) || linkMatch;
  }

  private threadMatchesScope(thread: CommunicationThread, scope: AccessScope) {
    const isVisible =
      scope.visibleFlag === 'customer_visible'
        ? thread.customer_visible
        : thread.intermediary_visible;

    return (
      isVisible &&
      this.resourceMatchesScope(thread.resource_type, thread.resource_id, scope)
    );
  }

  private resourceMatchesScope(
    resourceType: string | null | undefined,
    resourceId: string | null | undefined,
    scope: AccessScope,
  ) {
    if (!resourceType || !resourceId) {
      return false;
    }

    const normalizedType = resourceType.trim().toUpperCase();

    if (scope.resourceIds.CUSTOMER.has(resourceId)) {
      if (
        normalizedType === 'CUSTOMER' ||
        normalizedType === 'POLICY_HOLDER' ||
        normalizedType === 'POLICYHOLDER'
      ) {
        return true;
      }
    }

    if (
      scope.resourceIds.POLICY.has(resourceId) &&
      normalizedType === 'POLICY'
    ) {
      return true;
    }

    if (
      scope.resourceIds.QUOTATION.has(resourceId) &&
      normalizedType === 'QUOTATION'
    ) {
      return true;
    }

    if (
      scope.resourceIds.INVOICE.has(resourceId) &&
      normalizedType === 'INVOICE'
    ) {
      return true;
    }

    if (
      scope.resourceIds.RECEIPT.has(resourceId) &&
      normalizedType === 'RECEIPT'
    ) {
      return true;
    }

    if (
      scope.actorType === PortalActorType.INTERMEDIARY &&
      scope.resourceIds.INTERMEDIARY_COMPANY.has(resourceId) &&
      [
        'INTERMEDIARY_COMPANY',
        'INTERMEDIARY',
        'BROKER',
        'AGENT',
        'COMPANY',
      ].includes(normalizedType)
    ) {
      return true;
    }

    return false;
  }

  private filterList<T>(
    items: T[],
    query: PortalListQueryDto,
    toSearchText: (item: T) => string,
    toStatus: (item: T) => string | null | undefined,
  ) {
    const search = query.search?.trim().toLowerCase();
    const status = query.status?.trim().toLowerCase();

    const filtered = items.filter((item) => {
      if (search && !toSearchText(item).toLowerCase().includes(search)) {
        return false;
      }

      if (status) {
        const itemStatus = toStatus(item)?.toLowerCase() ?? '';
        if (itemStatus !== status) {
          return false;
        }
      }

      return true;
    });

    const page = Math.max(1, query.page ?? 1);
    const limit = Math.max(1, Math.min(100, query.limit ?? 20));
    const offset = (page - 1) * limit;

    return filtered.slice(offset, offset + limit);
  }

  private companyWhere(scope: AccessScope) {
    if (!scope.companyIds) {
      return undefined;
    }

    return {
      company_id: In([...scope.companyIds]),
    };
  }
}

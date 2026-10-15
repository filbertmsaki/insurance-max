import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, In, Repository } from 'typeorm';
import type { ObjectLiteral, SelectQueryBuilder } from 'typeorm';
import { paginateQueryBuilder } from '@insurance-max/portal-shared/utils/paginate-query.util';

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

import { PortalTableQueryDto } from '../dto/portal-query.dto';
import { PortalAccount } from '../entities/portal-account.entity';
import { PortalAccountStatus, PortalActorType } from '../enums/portal.enums';

type LegacyListQuery = {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
};

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
    @InjectRepository(PortalAccount)
    private readonly portalAccountRepository: Repository<PortalAccount>,
    private readonly documentsService: DocumentsService,
  ) {}

  async listDocuments(account: PortalAccount, query: LegacyListQuery) {
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

  /**
   * Server-side table. The portal access scope (company, visibility flag and
   * owned resource ids) is translated to SQL and applied before paging, so
   * the count and every page only contain the caller's own documents.
   */
  async findDocumentsPage(account: PortalAccount, query: PortalTableQueryDto) {
    const scope = await this.buildScope(account);
    const qb = this.documentRepository
      .createQueryBuilder('document')
      .leftJoinAndSelect('document.current_version', 'current_version');
    this.applyCompanyScope(qb, 'document', scope);
    this.applyDocumentScope(qb, 'document', scope);
    if (query.status) {
      qb.andWhere('LOWER(document.status) = LOWER(:status)', {
        status: query.status,
      });
    }
    return paginateQueryBuilder(qb, query, {
      sortable: {
        document_no: 'document.document_no',
        title: 'document.title',
        document_type: 'document.document_type',
        status: 'document.status',
        created_at: 'document.created_at',
      },
      defaultSort: 'created_at',
      searchable: [
        'document.document_no',
        'document.title',
        'document.file_name',
        'document.document_type',
        'document.owner_type',
      ],
      tieBreaker: 'document.id',
    });
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

  async listThreads(account: PortalAccount, query: LegacyListQuery) {
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

  /** Server-side table; see findDocumentsPage for how scope is applied. */
  async findThreadsPage(account: PortalAccount, query: PortalTableQueryDto) {
    const scope = await this.buildScope(account);
    const qb = this.threadRepository.createQueryBuilder('thread');
    this.applyCompanyScope(qb, 'thread', scope);
    qb.andWhere(`thread.${scope.visibleFlag} = true`).andWhere(
      this.resourceMatchSql(
        'thread.resource_type',
        'thread.resource_id',
        scope,
      ),
    );
    const status = query.status?.trim().toUpperCase();
    if (status === 'OPEN') qb.andWhere('thread.closed_at IS NULL');
    else if (status === 'CLOSED') qb.andWhere('thread.closed_at IS NOT NULL');
    else if (status) qb.andWhere('1 = 0');
    return paginateQueryBuilder(qb, query, {
      sortable: {
        thread_no: 'thread.thread_no',
        subject: 'thread.subject',
        thread_type: 'thread.thread_type',
        updated_at: 'thread.updated_at',
        created_at: 'thread.created_at',
      },
      defaultSort: 'updated_at',
      searchable: [
        'thread.thread_no',
        'thread.subject',
        'thread.thread_type',
        'thread.resource_type',
      ],
      tieBreaker: 'thread.id',
    });
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

  async listSignatureRequests(account: PortalAccount, query: LegacyListQuery) {
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

  /** Server-side table: only requests for documents the caller can access. */
  async findSignatureRequestsPage(
    account: PortalAccount,
    query: PortalTableQueryDto,
  ) {
    const scope = await this.buildScope(account);
    const qb = this.signatureRequestRepository.createQueryBuilder('request');
    this.applyCompanyScope(qb, 'request', scope);
    const documents = this.documentRepository
      .createQueryBuilder('scoped_document')
      .select('1')
      .where('scoped_document.id = request.document_id');
    this.applyCompanyScope(documents, 'scoped_document', scope);
    this.applyDocumentScope(documents, 'scoped_document', scope);
    qb.andWhere(`EXISTS (${documents.getQuery()})`, documents.getParameters());
    if (query.status) {
      qb.andWhere('LOWER(request.status) = LOWER(:status)', {
        status: query.status,
      });
    }
    return paginateQueryBuilder(qb, query, {
      sortable: {
        request_no: 'request.request_no',
        signature_provider: 'request.signature_provider',
        status: 'request.status',
        expires_at: 'request.expires_at',
        created_at: 'request.created_at',
      },
      defaultSort: 'created_at',
      searchable: [
        'request.request_no',
        'request.signature_provider',
        'request.status',
      ],
      tieBreaker: 'request.id',
    });
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

      const accounts = await this.portalAccountRepository.find({
        select: { company_id: true, customer_id: true },
        where: {
          user_id: account.user_id,
          actor_type: PortalActorType.CUSTOMER,
          status: PortalAccountStatus.ACTIVE,
        },
      });
      const customerIds = new Set(
        accounts
          .map((item) => item.customer_id)
          .filter((value): value is string => Boolean(value)),
      );
      const companyIds = new Set(accounts.map((item) => item.company_id));

      if (customerIds.size === 0 || companyIds.size === 0) {
        throw new NotFoundException('Portal customer account is not linked');
      }

      const [quotations, policies, invoices, receipts] = await Promise.all([
        this.quotationRepository.find({
          select: { id: true },
          where: {
            company_id: In([...companyIds]),
            customer_id: In([...customerIds]),
          },
        }),
        this.policyRepository.find({
          select: { id: true },
          where: {
            company_id: In([...companyIds]),
            customer_id: In([...customerIds]),
          },
        }),
        this.invoiceRepository.find({
          select: { id: true },
          where: {
            company_id: In([...companyIds]),
            customer_id: In([...customerIds]),
          },
        }),
        this.receiptRepository.find({
          select: { id: true },
          where: {
            company_id: In([...companyIds]),
            customer_id: In([...customerIds]),
          },
        }),
      ]);

      return {
        actorType: account.actor_type,
        visibleFlag: 'customer_visible',
        companyIds,
        resourceIds: {
          CUSTOMER: customerIds,
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

  private applyCompanyScope<T extends ObjectLiteral>(
    qb: SelectQueryBuilder<T>,
    alias: string,
    scope: AccessScope,
  ) {
    if (scope.companyIds) {
      qb.andWhere(`${alias}.company_id IN (:...scopeCompanyIds)`, {
        scopeCompanyIds: [...scope.companyIds],
      });
    }
  }

  /** SQL twin of documentMatchesScope: visible owner match or visible link match. */
  private applyDocumentScope<T extends ObjectLiteral>(
    qb: SelectQueryBuilder<T>,
    alias: string,
    scope: AccessScope,
  ) {
    const flag = scope.visibleFlag;
    const link = `${alias}_link`;
    const links = this.documentLinkRepository
      .createQueryBuilder(link)
      .select('1')
      .where(`${link}.document_id = ${alias}.id`)
      .andWhere(`${link}.${flag} = true`)
      .andWhere(
        this.resourceMatchSql(
          `${link}.linked_record_type`,
          `${link}.linked_record_id`,
          scope,
        ),
      );
    qb.andWhere(
      new Brackets((visible) => {
        visible
          .where(
            new Brackets((owner) => {
              owner
                .where(`${alias}.${flag} = true`)
                .andWhere(
                  this.resourceMatchSql(
                    `${alias}.owner_type`,
                    `${alias}.owner_id`,
                    scope,
                  ),
                );
            }),
          )
          .orWhere(`EXISTS (${links.getQuery()})`, links.getParameters());
      }),
    );
  }

  /** SQL twin of resourceMatchesScope; ids are always bound as parameters. */
  private resourceMatchSql(
    typeColumn: string,
    idColumn: string,
    scope: AccessScope,
  ) {
    const groups: Array<[ScopeResourceKey, string[]]> = [
      ['CUSTOMER', ['CUSTOMER', 'POLICY_HOLDER', 'POLICYHOLDER']],
      ['POLICY', ['POLICY']],
      ['QUOTATION', ['QUOTATION']],
      ['INVOICE', ['INVOICE']],
      ['RECEIPT', ['RECEIPT']],
    ];
    if (scope.actorType === PortalActorType.INTERMEDIARY) {
      groups.push([
        'INTERMEDIARY_COMPANY',
        ['INTERMEDIARY_COMPANY', 'INTERMEDIARY', 'BROKER', 'AGENT', 'COMPANY'],
      ]);
    }
    return new Brackets((match) => {
      let any = false;
      for (const [key, types] of groups) {
        const ids = [...scope.resourceIds[key]];
        if (!ids.length) continue;
        const clause = `(UPPER(TRIM(${typeColumn})) IN (:...scopeTypes_${key}) AND ${idColumn} IN (:...scopeIds_${key}))`;
        const params = {
          [`scopeTypes_${key}`]: types,
          [`scopeIds_${key}`]: ids,
        };
        if (any) match.orWhere(clause, params);
        else match.where(clause, params);
        any = true;
      }
      if (!any) match.where('1 = 0');
    });
  }

  private filterList<T>(
    items: T[],
    query: LegacyListQuery,
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
    const limit = Math.max(1, Math.min(100, query.limit ?? 10));
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

import { CertificateGenerationService } from './certificate-generation.service';

function makePolicy(overrides: Record<string, unknown> = {}) {
  return {
    id: 'policy-1',
    company_id: 'company-1',
    policy_no: 'POL-DIR-2026-00001',
    cover_note_no: 'CN-00001',
    quotation_id: 'quotation-1',
    currency: 'TZS',
    sum_insured: '10000000.00',
    total_premium: '250000.00',
    start_date: '2026-01-01',
    end_date: '2026-12-31',
    created_by: 'user-1',
    customer_snapshot: {
      displayName: 'Jane Doe',
      policyHolder: { name: 'Jane Doe' },
    },
    ...overrides,
  } as any;
}

function makeHarness(params: {
  policy: any;
  coverNotes?: any[];
  risks?: any[];
  quotationFlow?: string | null;
}) {
  const {
    policy,
    coverNotes = [],
    risks = [],
    quotationFlow = 'MOTOR_SINGLE',
  } = params;

  const documentRepo = {
    create: jest.fn((value) => value),
    save: jest.fn().mockImplementation(async (value) => ({
      id: value.id ?? 'document-1',
      ...value,
    })),
  };
  const versionRepo = {
    save: jest.fn().mockImplementation(async (value) => ({
      id: 'version-1',
      ...value,
    })),
  };
  const linkRepo = {
    save: jest.fn().mockResolvedValue({ id: 'link-1' }),
  };
  const coverNoteRepo = {
    find: jest.fn().mockResolvedValue(coverNotes),
  };
  const policyRiskRepo = {
    find: jest.fn().mockResolvedValue(risks),
  };
  const quotationRepo = {
    findOne: jest
      .fn()
      .mockResolvedValue(
        quotationFlow === null
          ? null
          : { id: policy.quotation_id, quotation_flow: quotationFlow },
      ),
  };

  const manager = {
    getRepository: (entity: any) => {
      switch (entity?.name) {
        case 'Document':
          return documentRepo;
        case 'DocumentVersion':
          return versionRepo;
        case 'DocumentLink':
          return linkRepo;
        case 'CoverNote':
          return coverNoteRepo;
        case 'PolicyRisk':
          return policyRiskRepo;
        case 'Quotation':
          return quotationRepo;
        default:
          throw new Error(`Unexpected entity ${entity?.name}`);
      }
    },
  } as any;

  const storageService = {
    store: jest.fn().mockImplementation(async ({ buffer }) => ({
      checksum: 'checksum-1',
      detectedExtension: '.pdf',
      detectedMimeType: 'application/pdf',
      originalFileName: 'certificate.pdf',
      safeFileName: 'certificate.pdf',
      size: buffer.length,
      storageKey: 'documents/certificates/company-1/certificate.pdf',
    })),
    maximumBytes: jest.fn().mockReturnValue(10 * 1024 * 1024),
  } as any;

  const service = new CertificateGenerationService(storageService);

  return {
    service,
    manager,
    documentRepo,
    versionRepo,
    linkRepo,
    storageService,
    quotationRepo,
  };
}

describe('CertificateGenerationService', () => {
  it('renders a real PDF, stores it, and links it to the policy (motor)', async () => {
    const policy = makePolicy();
    const risks = [
      {
        sum_insured: '10000000.00',
        risk: { risk_name: 'Comprehensive Motor Cover', risk_code: 'MOT-COMP' },
      },
    ];
    const {
      service,
      manager,
      documentRepo,
      versionRepo,
      linkRepo,
      storageService,
    } = makeHarness({ policy, risks, quotationFlow: 'MOTOR_SINGLE' });

    const document = await service.generateForPolicy(manager, policy);

    expect(document).not.toBeNull();

    // A real PDF was produced (starts with the PDF magic bytes) and stored.
    expect(storageService.store).toHaveBeenCalledTimes(1);
    const storedBuffer = storageService.store.mock.calls[0][0].buffer as Buffer;
    expect(storedBuffer.subarray(0, 5).toString('ascii')).toBe('%PDF-');
    expect(storedBuffer.length).toBeGreaterThan(500);

    expect(documentRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        document_type: 'MOTOR_CERTIFICATE',
        owner_type: 'POLICY',
        owner_id: 'policy-1',
        public_verification_enabled: true,
      }),
    );

    expect(versionRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ document_id: 'document-1', version_number: 1 }),
    );

    expect(linkRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        document_id: 'document-1',
        link_type: 'POLICY',
        linked_record_id: 'policy-1',
      }),
    );
  });

  it('uses MOTOR_CERTIFICATE for a motor fleet quotation too', async () => {
    const policy = makePolicy();
    const { service, manager, documentRepo } = makeHarness({
      policy,
      quotationFlow: 'MOTOR_FLEET',
    });

    await service.generateForPolicy(manager, policy);

    expect(documentRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ document_type: 'MOTOR_CERTIFICATE' }),
    );
  });

  it('uses POLICY_CERTIFICATE for a non-motor quotation', async () => {
    const policy = makePolicy();
    const { service, manager, documentRepo } = makeHarness({
      policy,
      quotationFlow: 'NON_MOTOR',
    });

    await service.generateForPolicy(manager, policy);

    expect(documentRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ document_type: 'POLICY_CERTIFICATE' }),
    );
  });

  it('defaults to POLICY_CERTIFICATE when there is no linked quotation', async () => {
    const policy = makePolicy({ quotation_id: null });
    const { service, manager, documentRepo, quotationRepo } = makeHarness({
      policy,
      quotationFlow: null,
    });

    await service.generateForPolicy(manager, policy);

    expect(quotationRepo.findOne).not.toHaveBeenCalled();
    expect(documentRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ document_type: 'POLICY_CERTIFICATE' }),
    );
  });

  it('returns null instead of throwing if generation fails', async () => {
    const policy = makePolicy({ customer_snapshot: null });
    const { service, manager, documentRepo, storageService } = makeHarness({
      policy,
    });

    // Simulate an unexpected failure deep in the render/store path (e.g. a
    // storage write error) rather than letting it bubble up and abort the
    // policy-activation transaction the caller runs inside.
    storageService.store.mockRejectedValueOnce(new Error('disk full'));

    const result = await service.generateForPolicy(manager, policy);

    expect(result).toBeNull();
    expect(documentRepo.save).not.toHaveBeenCalled();
  });
});

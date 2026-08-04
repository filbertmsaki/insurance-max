import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { mkdtemp, readFile, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

import { PortalFileStorageService } from './portal-file-storage.service';

describe('PortalFileStorageService', () => {
  let service: PortalFileStorageService;
  let uploadRoot: string;

  beforeEach(async () => {
    uploadRoot = await mkdtemp(join(tmpdir(), 'insurance-portal-'));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PortalFileStorageService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: unknown) => {
              const values: Record<string, unknown> = {
                PORTAL_UPLOAD_ROOT: uploadRoot,
                PORTAL_UPLOAD_MAX_BYTES: 1024 * 1024,
                PORTAL_ALLOWED_MIME_TYPES:
                  'application/pdf,image/jpeg,image/png',
              };

              return values[key] ?? defaultValue;
            }),
          },
        },
      ],
    }).compile();

    service = module.get(PortalFileStorageService);
  });

  afterEach(async () => {
    await rm(uploadRoot, { recursive: true, force: true });
  });

  it('stores a valid PDF and calculates its checksum', async () => {
    const buffer = Buffer.from('%PDF-1.7 test file');

    const result = await service.store({
      companyId: 'company-id',
      requestId: 'request-id',
      file: {
        originalname: 'payment.pdf',
        mimetype: 'application/pdf',
        size: buffer.length,
        buffer,
      },
    });

    expect(result.mimeType).toBe('application/pdf');
    expect(result.checksum).toMatch(/^[a-f0-9]{64}$/);

    const stored = await readFile(join(uploadRoot, result.storageKey));

    expect(stored.equals(buffer)).toBe(true);
  });

  it('rejects a fake PDF', async () => {
    const buffer = Buffer.from('this is not a PDF');

    await expect(
      service.store({
        companyId: 'company-id',
        requestId: 'request-id',
        file: {
          originalname: 'fake.pdf',
          mimetype: 'application/pdf',
          size: buffer.length,
          buffer,
        },
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects an unsupported MIME type', async () => {
    const buffer = Buffer.from('text file');

    await expect(
      service.store({
        companyId: 'company-id',
        requestId: 'request-id',
        file: {
          originalname: 'test.txt',
          mimetype: 'text/plain',
          size: buffer.length,
          buffer,
        },
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects a file above the configured limit', async () => {
    const buffer = Buffer.concat([
      Buffer.from('%PDF-'),
      Buffer.alloc(1024 * 1024),
    ]);

    await expect(
      service.store({
        companyId: 'company-id',
        requestId: 'request-id',
        file: {
          originalname: 'large.pdf',
          mimetype: 'application/pdf',
          size: buffer.length,
          buffer,
        },
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('removes a stored file', async () => {
    const buffer = Buffer.from('%PDF-test');

    const result = await service.store({
      companyId: 'company-id',
      requestId: 'request-id',
      file: {
        originalname: 'test.pdf',
        mimetype: 'application/pdf',
        size: buffer.length,
        buffer,
      },
    });

    await expect(service.remove(result.storageKey)).resolves.toBeUndefined();
    await expect(service.read(result.storageKey)).rejects.toThrow();
  });
});

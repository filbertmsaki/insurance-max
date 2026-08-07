import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { basename, dirname, extname, join, resolve } from 'node:path';

export interface StoredDocumentFile {
  checksum: string;
  detectedExtension: string;
  detectedMimeType: string;
  originalFileName: string;
  safeFileName: string;
  size: number;
  storageKey: string;
}

export interface UploadedDocumentFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

const MIME_EXTENSIONS: Record<string, string> = {
  'application/pdf': '.pdf',
  'image/jpeg': '.jpg',
  'image/png': '.png',
};

@Injectable()
export class DocumentStorageService {
  constructor(private readonly configService: ConfigService) {}

  allowedMimeTypes(): string[] {
    const configured = this.configService.get<string>(
      'DOCUMENT_ALLOWED_MIME_TYPES',
      Object.keys(MIME_EXTENSIONS).join(','),
    );

    return configured
      .split(',')
      .map((value) => value.trim().toLowerCase())
      .filter((value) => value in MIME_EXTENSIONS);
  }

  maximumBytes(): number {
    return this.configService.get<number>(
      'DOCUMENT_DEFAULT_MAX_BYTES',
      10 * 1024 * 1024,
    );
  }

  async store(params: {
    buffer: Buffer;
    companyId: string;
    fileName: string;
    maximumBytes: number;
    prefix: string;
  }): Promise<StoredDocumentFile> {
    const detection = this.detectFile(params.fileName, params.buffer);

    if (params.buffer.length > params.maximumBytes) {
      throw new BadRequestException('The uploaded file exceeds the permitted size.');
    }

    const allowedMimeTypes = new Set(this.allowedMimeTypes());

    if (!allowedMimeTypes.has(detection.detectedMimeType)) {
      throw new BadRequestException('The uploaded file type is not allowed.');
    }

    const safeFileName = this.sanitizeFileName(params.fileName, detection.detectedExtension);
    const storageKey = join(
      params.prefix,
      params.companyId,
      `${randomUUID()}-${safeFileName}`,
    ).replace(/\\/g, '/');

    const absolutePath = this.resolveStorageKey(storageKey);
    await mkdir(dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, params.buffer, { flag: 'wx' });

    return {
      checksum: createHash('sha256').update(params.buffer).digest('hex'),
      detectedExtension: detection.detectedExtension,
      detectedMimeType: detection.detectedMimeType,
      originalFileName: basename(params.fileName),
      safeFileName,
      size: params.buffer.length,
      storageKey,
    };
  }

  async read(storageKey: string): Promise<Buffer> {
    try {
      return await readFile(this.resolveStorageKey(storageKey));
    } catch {
      throw new NotFoundException('Document file not found');
    }
  }

  async remove(storageKey: string): Promise<void> {
    try {
      await unlink(this.resolveStorageKey(storageKey));
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== 'ENOENT') {
        throw error;
      }
    }
  }

  private detectFile(fileName: string, buffer: Buffer): {
    detectedExtension: string;
    detectedMimeType: string;
  } {
    if (buffer.subarray(0, 5).toString('ascii') === '%PDF-') {
      return {
        detectedExtension: '.pdf',
        detectedMimeType: 'application/pdf',
      };
    }

    if (
      buffer.length >= 3 &&
      buffer[0] === 0xff &&
      buffer[1] === 0xd8 &&
      buffer[2] === 0xff
    ) {
      return {
        detectedExtension: '.jpg',
        detectedMimeType: 'image/jpeg',
      };
    }

    const pngSignature = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ]);

    if (
      buffer.length >= pngSignature.length &&
      buffer.subarray(0, pngSignature.length).equals(pngSignature)
    ) {
      return {
        detectedExtension: '.png',
        detectedMimeType: 'image/png',
      };
    }

    throw new BadRequestException(
      `The uploaded file could not be recognized from its content: ${basename(fileName)}`,
    );
  }

  private sanitizeFileName(fileName: string, extension: string): string {
    const withoutExtension = basename(fileName, extname(fileName))
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .replace(/_+/g, '_')
      .slice(0, 180);

    const safeBaseName = withoutExtension || 'document';
    return `${safeBaseName}${extension}`;
  }

  private resolveStorageKey(storageKey: string): string {
    const root = resolve(
      this.configService.get<string>('DOCUMENT_STORAGE_ROOT') ??
        join(process.cwd(), 'uploads', 'documents'),
    );

    const target = resolve(root, storageKey);
    const relative = target.slice(root.length);

    if (
      target !== root &&
      !relative.startsWith('/') &&
      !relative.startsWith('\\')
    ) {
      throw new BadRequestException('Invalid document storage key');
    }

    return target;
  }
}

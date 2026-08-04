import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomUUID } from 'crypto';
import { mkdir, readFile, unlink, writeFile } from 'fs/promises';
import { basename, dirname, join, resolve } from 'path';

export interface PortalUploadFile {
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

/**
 * Suitable for a single server. With multiple API instances, replace this
 * local-disk adapter with shared storage such as S3-compatible object
 * storage.
 */
@Injectable()
export class PortalFileStorageService {
  constructor(private readonly configService: ConfigService) {}

  async store(params: {
    companyId: string;
    requestId: string;
    file: PortalUploadFile;
  }) {
    const maxBytes = this.configService.get<number>(
      'PORTAL_UPLOAD_MAX_BYTES',
      10 * 1024 * 1024,
    );

    const allowedMimeTypes = this.allowedMimeTypes();

    if (!params.file?.buffer?.length) {
      throw new BadRequestException('Uploaded file is empty');
    }

    if (params.file.size !== params.file.buffer.length) {
      throw new BadRequestException('Uploaded file size is invalid');
    }

    if (params.file.size > maxBytes) {
      throw new BadRequestException(
        `Uploaded file exceeds the ${Math.floor(maxBytes / 1024 / 1024)} MB limit`,
      );
    }

    if (!allowedMimeTypes.has(params.file.mimetype)) {
      throw new BadRequestException(
        'Only PDF, JPEG, and PNG files are allowed',
      );
    }

    if (!this.matchesSignature(params.file.mimetype, params.file.buffer)) {
      throw new BadRequestException(
        'Uploaded file content does not match its declared file type',
      );
    }

    const extension = MIME_EXTENSIONS[params.file.mimetype];
    const storedFileName = `${randomUUID()}${extension}`;

    const storageKey = join(
      'portal',
      params.companyId,
      params.requestId,
      storedFileName,
    ).replace(/\\/g, '/');

    const absolutePath = this.resolveStorageKey(storageKey);

    await mkdir(dirname(absolutePath), { recursive: true });

    await writeFile(absolutePath, params.file.buffer, { flag: 'wx' });

    return {
      originalFileName: basename(params.file.originalname),
      storedFileName,
      storageKey,
      mimeType: params.file.mimetype,
      fileSize: String(params.file.size),
      checksum: createHash('sha256').update(params.file.buffer).digest('hex'),
    };
  }

  async read(storageKey: string): Promise<Buffer> {
    try {
      return await readFile(this.resolveStorageKey(storageKey));
    } catch {
      throw new NotFoundException('Portal attachment file not found');
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

  private allowedMimeTypes(): Set<string> {
    const configured = this.configService.get<string>(
      'PORTAL_ALLOWED_MIME_TYPES',
      Object.keys(MIME_EXTENSIONS).join(','),
    );

    return new Set(
      configured
        .split(',')
        .map((value) => value.trim().toLowerCase())
        .filter((value) => value in MIME_EXTENSIONS),
    );
  }

  private matchesSignature(mimeType: string, buffer: Buffer): boolean {
    if (mimeType === 'application/pdf') {
      return buffer.subarray(0, 5).toString('ascii') === '%PDF-';
    }

    if (mimeType === 'image/jpeg') {
      return (
        buffer.length >= 3 &&
        buffer[0] === 0xff &&
        buffer[1] === 0xd8 &&
        buffer[2] === 0xff
      );
    }

    if (mimeType === 'image/png') {
      const signature = Buffer.from([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      ]);

      return (
        buffer.length >= signature.length &&
        buffer.subarray(0, 8).equals(signature)
      );
    }

    return false;
  }

  private resolveStorageKey(storageKey: string): string {
    const root = resolve(
      this.configService.get<string>('PORTAL_UPLOAD_ROOT') ??
        join(process.cwd(), 'uploads'),
    );

    const target = resolve(root, storageKey);
    const relative = target.slice(root.length);

    if (
      target !== root &&
      !relative.startsWith('/') &&
      !relative.startsWith('\\')
    ) {
      throw new BadRequestException('Invalid portal storage key');
    }

    return target;
  }
}

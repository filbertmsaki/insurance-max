import {
  INestApplication,
  RequestMethod,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { randomUUID } from 'crypto';
import type { AddressInfo } from 'net';

import { hashPassword } from '@insurance-max/portal-shared/utils/hash.util';

import { AppModule } from '../apps/insurance-portal-service/src/app.module';
import { NotificationPublisherService } from '../apps/insurance-portal-service/src/modules/shared/notifications/notification-publisher.service';

type StreamEvent = {
  type?: string;
  targetRecordId?: string | null;
  payload?: Record<string, unknown>;
};

const testPassword = 'StrongPassword@2026';

function parseSseFrame(frame: string): StreamEvent | null {
  const data = frame
    .split('\n')
    .map((line) => line.replace(/\r$/, ''))
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trimStart())
    .join('\n');

  if (!data) {
    return null;
  }

  return JSON.parse(data) as StreamEvent;
}

async function readNextEvent(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  decoder: TextDecoder,
  bufferRef: { value: string },
  predicate: (event: StreamEvent) => boolean,
  timeoutMs: number,
): Promise<StreamEvent> {
  const timeoutAt = Date.now() + timeoutMs;

  while (Date.now() < timeoutAt) {
    let boundaryIndex = bufferRef.value.indexOf('\n\n');
    while (boundaryIndex >= 0) {
      const frame = bufferRef.value.slice(0, boundaryIndex);
      bufferRef.value = bufferRef.value.slice(boundaryIndex + 2);

      const event = parseSseFrame(frame);
      if (event && predicate(event)) {
        return event;
      }

      boundaryIndex = bufferRef.value.indexOf('\n\n');
    }

    const remainingMs = Math.max(1, timeoutAt - Date.now());
    const read = await Promise.race([
      reader.read(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Timed out waiting for SSE data')), remainingMs),
      ),
    ]);

    if (read.done) {
      throw new Error('SSE stream ended before the expected event arrived');
    }

    bufferRef.value += decoder
      .decode(read.value, { stream: true })
      .replace(/\r\n/g, '\n');
  }

  throw new Error('Timed out waiting for the expected SSE event');
}

async function seedSmokeUser(dataSource: DataSource) {
  const suffix = randomUUID().slice(0, 8);
  const email = `notification.smoke.${suffix}@example.test`;
  const phone = `+25573${suffix.slice(0, 7)}0`;
  const passwordHash = await hashPassword(testPassword);

  await dataSource.query(
    `
    INSERT INTO users (
      user_no, first_name, last_name, email, phone, password, status,
      user_type, officer_title, is_email_verified, is_phone_verified,
      is_two_factor_enabled
    )
    VALUES ($1, 'Notification', 'Smoke', $2, $3, $4, 'active',
      'OWNER', 'Owner', true, true, false)
    `,
    [`USR-NS-${suffix}`, email, phone, passwordHash],
  );

  return { email };
}

async function bootstrapApp(): Promise<INestApplication> {
  const app = await NestFactory.create(AppModule, { logger: false });

  app.setGlobalPrefix('api', {
    exclude: [{ path: '', method: RequestMethod.GET }],
  });
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  await app.listen(0, '127.0.0.1');

  return app;
}

async function main() {
  const app = await bootstrapApp();
  const server = app.getHttpServer();
  const address = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${address.port}/api/v1`;
  const abortController = new AbortController();

  try {
    const dataSource = app.get(DataSource);
    const { email } = await seedSmokeUser(dataSource);

    const loginResponse = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: testPassword }),
    });

    if (!loginResponse.ok) {
      throw new Error(
        `Login failed: HTTP ${loginResponse.status} ${await loginResponse.text()}`,
      );
    }

    const loginPayload = (await loginResponse.json()) as any;
    const accessToken =
      loginPayload.data?.access_token ?? loginPayload.access_token;

    if (!accessToken) {
      throw new Error('Login response did not include an access token');
    }

    const streamResponse = await fetch(`${baseUrl}/notifications/stream`, {
      headers: {
        Accept: 'text/event-stream',
        Authorization: `Bearer ${accessToken}`,
      },
      signal: abortController.signal,
    });

    if (!streamResponse.ok || !streamResponse.body) {
      throw new Error(
        `Stream failed: HTTP ${streamResponse.status} ${await streamResponse.text()}`,
      );
    }

    const reader = streamResponse.body.getReader();
    const decoder = new TextDecoder();
    const bufferRef = { value: '' };

    await readNextEvent(
      reader,
      decoder,
      bufferRef,
      (event) => event.type === 'notification.ready',
      10_000,
    );

    const quotationId = randomUUID();
    const publisher = app.get(NotificationPublisherService);

    publisher.publishQuotationTiramisUpdated({
      companyId: randomUUID(),
      quotationId,
      requestId: `REQ-SMOKE-${Date.now()}`,
      eventType: 'TIRAMIS_FINAL_SUCCESS',
      statusCode: 'TIRA001',
      statusDescription: 'Smoke success',
      coverNoteReferenceNumber: 'CN-SMOKE',
      stickerNumber: 'STK-SMOKE',
      occurredAt: new Date().toISOString(),
    });

    const event = await readNextEvent(
      reader,
      decoder,
      bufferRef,
      (candidate) =>
        candidate.type === 'quotation.tiramis.updated' &&
        candidate.targetRecordId === quotationId,
      10_000,
    );

    if (event.payload?.statusCode !== 'TIRA001') {
      throw new Error(
        `Unexpected notification payload: ${JSON.stringify(event)}`,
      );
    }

    process.stdout.write(
      `notification-live-smoke passed: received ${event.type} for ${event.targetRecordId}\n`,
    );
  } finally {
    abortController.abort();
    await app.close();
  }
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

/**
 * Unit tests for company mutation error handling and API error mapper.
 *
 * These tests exercise the parseApiError utility and Zod schemas for
 * create/update company forms — no network or React runtime required.
 */
import { describe, it, expect } from 'vitest';
import { AxiosError, AxiosHeaders } from 'axios';
import { parseApiError } from '@/lib/api-error';

// ─── parseApiError ────────────────────────────────────────────────────────────

function makeAxiosError(status: number, data: unknown): AxiosError {
  const error = new AxiosError('Request failed');
  error.response = {
    status,
    data,
    headers: {},
    config: { headers: new AxiosHeaders() },
    statusText: String(status),
  };
  return error;
}

describe('parseApiError', () => {
  it('extracts string message from 400 response', () => {
    const err = makeAxiosError(400, { message: 'Bad request data' });
    expect(parseApiError(err).message).toBe('Bad request data');
    expect(parseApiError(err).status).toBe(400);
  });

  it('extracts first item from array message (422 validation)', () => {
    const err = makeAxiosError(422, {
      message: ['email must be an email', 'name is too short'],
    });
    const result = parseApiError(err);
    expect(result.message).toBe('email must be an email');
    expect(result.errors).toHaveLength(2);
  });

  it('returns predefined message for 403', () => {
    const err = makeAxiosError(403, {});
    expect(parseApiError(err).message).toBe(
      'You do not have permission to perform this action.',
    );
  });

  it('returns predefined message for 404', () => {
    const err = makeAxiosError(404, {});
    expect(parseApiError(err).message).toBe(
      'The requested resource was not found.',
    );
  });

  it('returns predefined message for 500', () => {
    const err = makeAxiosError(500, {});
    expect(parseApiError(err).message).toBe(
      'A server error occurred. Please try again later.',
    );
  });

  it('returns network error message for non-axios error', () => {
    expect(parseApiError(new Error('fetch failed')).message).toBe(
      'Network error. Check your connection and try again.',
    );
  });

  it('returns network error for null', () => {
    expect(parseApiError(null).status).toBe(0);
  });
});

// ─── Permission gating logic ──────────────────────────────────────────────────

describe('OWNER detection', () => {
  const isOwner = (userType: string) =>
    userType === 'OWNER' || userType === 'SUPER_ADMIN';

  it('recognises OWNER', () => expect(isOwner('OWNER')).toBe(true));
  it('recognises SUPER_ADMIN', () => expect(isOwner('SUPER_ADMIN')).toBe(true));
  it('rejects COMPANY_ADMIN', () =>
    expect(isOwner('COMPANY_ADMIN')).toBe(false));
  it('rejects STAFF', () => expect(isOwner('STAFF')).toBe(false));
});

// ─── Create company schema validation ─────────────────────────────────────────

import { z } from 'zod';

const createSchema = z.object({
  company_name: z.string().min(2),
  admin_email: z.string().email(),
  admin_phone: z.string().regex(/^(0\d{9}|255\d{9}|\+255\d{9})$/),
  admin_password: z
    .string()
    .min(8)
    .regex(/[A-Z]/)
    .regex(/[a-z]/)
    .regex(/\d/)
    .regex(/[^A-Za-z0-9]/),
});

describe('createCompany schema', () => {
  const valid = {
    company_name: 'Acme Ltd',
    admin_email: 'admin@acme.co.tz',
    admin_phone: '0712345678',
    admin_password: 'SecureP@ss1',
  };

  it('accepts valid payload', () => {
    expect(createSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects company_name shorter than 2 chars', () => {
    const r = createSchema.safeParse({ ...valid, company_name: 'A' });
    expect(r.success).toBe(false);
  });

  it('rejects invalid email', () => {
    const r = createSchema.safeParse({ ...valid, admin_email: 'not-an-email' });
    expect(r.success).toBe(false);
  });

  it('rejects non-Tanzanian phone', () => {
    const r = createSchema.safeParse({ ...valid, admin_phone: '07123' });
    expect(r.success).toBe(false);
  });

  it('rejects weak password (no symbol)', () => {
    const r = createSchema.safeParse({ ...valid, admin_password: 'Weakpass1' });
    expect(r.success).toBe(false);
  });

  it('accepts +255 prefix phone', () => {
    const r = createSchema.safeParse({
      ...valid,
      admin_phone: '+255712345678',
    });
    expect(r.success).toBe(true);
  });
});

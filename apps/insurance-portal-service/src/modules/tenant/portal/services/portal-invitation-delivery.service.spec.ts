import { PortalInvitationDeliveryStatus } from '../enums/portal.enums';
import {
  INVITATION_MAX_DELIVERY_ATTEMPTS,
  PortalInvitationDeliveryService,
  invitationRetryDelayMs,
} from './portal-invitation-delivery.service';

function makeHarness(params: {
  invitation?: any;
  claimedIds?: string[];
  mailError?: Error;
}) {
  const manager = {
    query: jest
      .fn()
      .mockResolvedValueOnce(undefined) // cancel undeliverable
      // TypeORM returns [rows, rowCount] for UPDATE ... RETURNING.
      .mockResolvedValueOnce([
        (params.claimedIds ?? ['inv-1']).map((id) => ({ id })),
        (params.claimedIds ?? ['inv-1']).length,
      ]),
  };
  const dataSource = {
    transaction: jest.fn((fn: any) => fn(manager)),
  };
  const builder: any = {
    addSelect: jest.fn(() => builder),
    leftJoinAndSelect: jest.fn(() => builder),
    where: jest.fn(() => builder),
    getOne: jest.fn().mockResolvedValue(
      params.invitation === undefined
        ? {
            id: 'inv-1',
            email: 'customer@example.com',
            first_name: 'Asha',
            expires_at: new Date('2026-12-01T00:00:00Z'),
            delivery_attempts: 1,
            delivery_token_ciphertext: 'enc:v1:sealed',
            company: { name: 'Alliance Insurance' },
          }
        : params.invitation,
    ),
  };
  const invitationRepository = {
    createQueryBuilder: jest.fn(() => builder),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
  };
  const mailService = {
    sendPortalInvitationEmail: params.mailError
      ? jest.fn().mockRejectedValue(params.mailError)
      : jest.fn().mockResolvedValue(undefined),
  };
  const cryptoService = {
    encrypt: jest.fn((value: string) => `enc:v1:${value}`),
    decrypt: jest.fn(() => 'raw-token'),
    isEncrypted: jest.fn((value: string) => value.startsWith('enc:v1:')),
  };
  const configService = {
    getOrThrow: jest.fn(() => 'https://portal.example.com'),
  };

  const service = new PortalInvitationDeliveryService(
    dataSource as any,
    invitationRepository as any,
    mailService as any,
    cryptoService as any,
    configService as any,
  );

  return { service, manager, invitationRepository, mailService, cryptoService };
}

const lastUpdate = (h: ReturnType<typeof makeHarness>) =>
  h.invitationRepository.update.mock.calls.at(-1);

describe('invitationRetryDelayMs', () => {
  it.each([
    [1, 1],
    [2, 2],
    [3, 4],
    [4, 8],
    [10, 60],
  ])('waits %i attempt(s) -> %i minute(s)', (attempts, minutes) => {
    expect(invitationRetryDelayMs(attempts)).toBe(minutes * 60_000);
  });
});

describe('PortalInvitationDeliveryService', () => {
  it('seals tokens with the auth secret cipher', () => {
    const h = makeHarness({});

    expect(h.service.sealToken('abc')).toBe('enc:v1:abc');
  });

  it('claims due rows with SKIP LOCKED and cancels undeliverable ones first', async () => {
    const h = makeHarness({ claimedIds: [] });

    await expect(h.service.dispatchDue()).resolves.toEqual({
      claimed: 0,
      sent: 0,
    });
    expect(h.manager.query.mock.calls[0][0]).toContain(
      "status <> 'PENDING' OR expires_at <= now()",
    );
    expect(h.manager.query.mock.calls[1][0]).toContain(
      'FOR UPDATE SKIP LOCKED',
    );
  });

  it('sends the decrypted link and marks the invitation SENT, clearing the token', async () => {
    const h = makeHarness({});

    await expect(h.service.dispatchDue()).resolves.toEqual({
      claimed: 1,
      sent: 1,
    });
    const [email, name, company, url] =
      h.mailService.sendPortalInvitationEmail.mock.calls[0];
    expect([email, name, company]).toEqual([
      'customer@example.com',
      'Asha',
      'Alliance Insurance',
    ]);
    expect(url).toContain('raw-token');
    expect(lastUpdate(h)).toEqual([
      { id: 'inv-1', delivery_status: PortalInvitationDeliveryStatus.SENDING },
      expect.objectContaining({
        delivery_status: PortalInvitationDeliveryStatus.SENT,
        delivery_token_ciphertext: null,
        last_delivery_error: null,
      }),
    ]);
  });

  it('records a backed-off FAILED retry when the mail send fails', async () => {
    const h = makeHarness({ mailError: new Error('SMTP timeout') });
    const before = Date.now();

    await expect(h.service.dispatchDue()).resolves.toEqual({
      claimed: 1,
      sent: 0,
    });
    const [, changes] = lastUpdate(h);
    expect(changes).toMatchObject({
      delivery_status: PortalInvitationDeliveryStatus.FAILED,
      last_delivery_error: 'SMTP timeout',
    });
    expect(changes.next_delivery_attempt_at.getTime()).toBeGreaterThanOrEqual(
      before + invitationRetryDelayMs(1),
    );
    expect(changes).not.toHaveProperty('delivery_token_ciphertext');
  });

  it('dead-letters after the last allowed attempt and drops the token', async () => {
    const h = makeHarness({
      mailError: new Error('Mailbox unavailable'),
      invitation: {
        id: 'inv-1',
        email: 'customer@example.com',
        first_name: null,
        expires_at: new Date(),
        delivery_attempts: INVITATION_MAX_DELIVERY_ATTEMPTS,
        delivery_token_ciphertext: 'enc:v1:sealed',
        company: { name: 'Alliance Insurance' },
      },
    });

    await h.service.dispatchDue();

    expect(lastUpdate(h)[1]).toMatchObject({
      delivery_status: PortalInvitationDeliveryStatus.DEAD_LETTER,
      delivery_token_ciphertext: null,
    });
  });

  it('dead-letters a row with no sealed token instead of retrying forever', async () => {
    const h = makeHarness({
      invitation: {
        id: 'inv-1',
        email: 'customer@example.com',
        expires_at: new Date(),
        delivery_attempts: 1,
        delivery_token_ciphertext: null,
        company: { name: 'Alliance Insurance' },
      },
    });

    await h.service.dispatchDue();

    expect(h.mailService.sendPortalInvitationEmail).not.toHaveBeenCalled();
    expect(lastUpdate(h)[1]).toMatchObject({
      delivery_status: PortalInvitationDeliveryStatus.DEAD_LETTER,
    });
  });
});

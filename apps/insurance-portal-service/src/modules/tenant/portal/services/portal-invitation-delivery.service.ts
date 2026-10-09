import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { buildUrl } from '@insurance-max/shared-config';
import { DataSource, Repository } from 'typeorm';

import { returningRows } from '../../../../database/returning-rows.util';
import { AuthSecretCryptoService } from '../../../shared/auth/2fa/auth-secret-crypto.service';
import { MailService } from '../../../shared/mail/mail.service';
import { PortalInvitation } from '../entities/portal-invitation.entity';
import { PortalInvitationDeliveryStatus } from '../enums/portal.enums';

export const INVITATION_MAX_DELIVERY_ATTEMPTS = 5;
const DISPATCH_BATCH_SIZE = 20;
/** A SENDING row older than this belongs to a worker that died mid-send. */
const STALE_SENDING_MINUTES = 10;

/** 1, 2, 4, 8 ... minutes between attempts, capped at an hour. */
export function invitationRetryDelayMs(attempts: number) {
  return Math.min(60, 2 ** Math.max(0, attempts - 1)) * 60_000;
}

/**
 * Outbox for portal invitation emails. Creating or resending an invitation
 * only queues it (in the same transaction as the invitation row); this
 * service claims due rows with FOR UPDATE SKIP LOCKED, sends them, and
 * records SENT, a backed-off FAILED retry, or DEAD_LETTER.
 */
@Injectable()
export class PortalInvitationDeliveryService {
  private readonly logger = new Logger(PortalInvitationDeliveryService.name);

  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(PortalInvitation)
    private readonly invitationRepository: Repository<PortalInvitation>,
    private readonly mailService: MailService,
    private readonly cryptoService: AuthSecretCryptoService,
    private readonly configService: ConfigService,
  ) {}

  /** Encrypts a raw token for the outbox; cleared once delivered. */
  sealToken(rawToken: string) {
    return this.cryptoService.encrypt(rawToken);
  }

  async dispatchDue(): Promise<{ claimed: number; sent: number }> {
    const ids = await this.claimDue();
    let sent = 0;

    for (const id of ids) {
      if (await this.deliver(id)) {
        sent += 1;
      }
    }

    return { claimed: ids.length, sent };
  }

  private claimDue(): Promise<string[]> {
    return this.dataSource.transaction(async (manager) => {
      // Invitations revoked, accepted or expired before delivery must never
      // be sent; drop their sealed token as well.
      await manager.query(
        `UPDATE portal_invitations
         SET delivery_status = $1,
             delivery_token_ciphertext = NULL,
             next_delivery_attempt_at = NULL
         WHERE delivery_status IN ($2, $3)
           AND (status <> 'PENDING' OR expires_at <= now())`,
        [
          PortalInvitationDeliveryStatus.CANCELLED,
          PortalInvitationDeliveryStatus.QUEUED,
          PortalInvitationDeliveryStatus.FAILED,
        ],
      );

      const result: unknown = await manager.query(
        `WITH due AS (
           SELECT id
           FROM portal_invitations
           WHERE status = 'PENDING'
             AND expires_at > now()
             AND (
               (delivery_status IN ($2, $3)
                 AND COALESCE(next_delivery_attempt_at, now()) <= now())
               OR (delivery_status = $4
                 AND last_delivery_attempt_at
                   < now() - make_interval(mins => $5))
             )
           ORDER BY next_delivery_attempt_at ASC NULLS FIRST
           LIMIT $1
           FOR UPDATE SKIP LOCKED
         )
         UPDATE portal_invitations invitation
         SET delivery_status = $4,
             delivery_attempts = invitation.delivery_attempts + 1,
             last_delivery_attempt_at = now()
         FROM due
         WHERE invitation.id = due.id
         RETURNING invitation.id`,
        [
          DISPATCH_BATCH_SIZE,
          PortalInvitationDeliveryStatus.QUEUED,
          PortalInvitationDeliveryStatus.FAILED,
          PortalInvitationDeliveryStatus.SENDING,
          STALE_SENDING_MINUTES,
        ],
      );

      return returningRows<{ id: string }>(result).map((row) => row.id);
    });
  }

  /** Sends one claimed invitation; returns true when it was delivered. */
  private async deliver(id: string): Promise<boolean> {
    const invitation = await this.invitationRepository
      .createQueryBuilder('invitation')
      .addSelect('invitation.delivery_token_ciphertext')
      .leftJoinAndSelect('invitation.company', 'company')
      .where('invitation.id = :id', { id })
      .getOne();

    if (!invitation) {
      return false;
    }

    const sealed = invitation.delivery_token_ciphertext;
    if (!sealed || !this.cryptoService.isEncrypted(sealed)) {
      // Nothing can ever be sent for this row; retrying would not help.
      await this.markUndeliverable(
        invitation,
        'Invitation token is not available for delivery',
      );
      return false;
    }

    try {
      const invitationUrl = buildUrl(
        this.configService.getOrThrow<string>('app.frontendUrl'),
        'portal',
        'accept-invitation',
        { token: this.cryptoService.decrypt(sealed) },
      );

      await this.mailService.sendPortalInvitationEmail(
        invitation.email,
        invitation.first_name ?? 'User',
        invitation.company.name,
        invitationUrl,
        invitation.expires_at,
      );
    } catch (error) {
      await this.recordFailure(invitation, error);
      return false;
    }

    await this.invitationRepository.update(
      { id, delivery_status: PortalInvitationDeliveryStatus.SENDING },
      {
        delivery_status: PortalInvitationDeliveryStatus.SENT,
        sent_at: new Date(),
        last_delivery_error: null,
        next_delivery_attempt_at: null,
        delivery_token_ciphertext: null,
      },
    );
    return true;
  }

  private async recordFailure(invitation: PortalInvitation, error: unknown) {
    const message = (
      error instanceof Error ? error.message : String(error)
    ).slice(0, 1000);

    if (invitation.delivery_attempts >= INVITATION_MAX_DELIVERY_ATTEMPTS) {
      await this.markUndeliverable(invitation, message);
      return;
    }

    this.logger.warn(
      `Portal invitation ${invitation.id} delivery attempt ${invitation.delivery_attempts} failed: ${message}`,
    );
    await this.invitationRepository.update(
      {
        id: invitation.id,
        delivery_status: PortalInvitationDeliveryStatus.SENDING,
      },
      {
        delivery_status: PortalInvitationDeliveryStatus.FAILED,
        last_delivery_error: message,
        next_delivery_attempt_at: new Date(
          Date.now() + invitationRetryDelayMs(invitation.delivery_attempts),
        ),
      },
    );
  }

  private async markUndeliverable(
    invitation: PortalInvitation,
    message: string,
  ) {
    this.logger.error(
      `Portal invitation ${invitation.id} moved to dead letter: ${message}`,
    );
    await this.invitationRepository.update(
      {
        id: invitation.id,
        delivery_status: PortalInvitationDeliveryStatus.SENDING,
      },
      {
        delivery_status: PortalInvitationDeliveryStatus.DEAD_LETTER,
        last_delivery_error: message,
        next_delivery_attempt_at: null,
        delivery_token_ciphertext: null,
      },
    );
  }
}

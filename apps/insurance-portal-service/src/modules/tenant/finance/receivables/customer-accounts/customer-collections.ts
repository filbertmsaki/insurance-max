import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { DataSource, type EntityManager } from 'typeorm';
import { DecimalUtil } from '../../../../shared/finance/decimal.util';
import {
  activePostingBook,
  type ActivePostingBook,
} from '../../accounting/general-ledger/finance-book-request';
import { conflict, day, invalid, text, uuid } from './customer-accounts.types';

export interface CollectionInput {
  invoiceId: string;
  kind: string;
  ownerId: string;
  followUp?: string;
  promiseAmount?: string;
  note: string;
  requestKey: string;
}
export async function collectionEvent(
  m: EntityManager,
  b: ActivePostingBook,
  user: string,
  v: CollectionInput,
) {
  if (
    !v ||
    ![
      'ASSIGN',
      'FOLLOW_UP',
      'PROMISE',
      'DISPUTE',
      'RESOLVE',
      'ESCALATE',
    ].includes(v.kind)
  )
    invalid('Choose a collection action.');
  const invoice = uuid(v.invoiceId, 'invoice'),
    owner = uuid(v.ownerId, 'collector'),
    key = text(v.requestKey, 'request key', 180),
    note = text(v.note, 'collection note', 1000);
  if (v.followUp) day(v.followUp);
  const [i] = await m.query(
    'SELECT balance_amount,currency FROM invoices WHERE company_id=$1 AND id=$2 AND deleted_at IS NULL FOR UPDATE',
    [b.company_id, invoice],
  );
  const [old] = await m.query(
    'SELECT * FROM finance_ar_collection_events WHERE book_id=$1 AND request_key=$2',
    [b.book_id, key],
  );
  if (old) {
    if (
      old.invoice_id !== invoice ||
      old.kind !== v.kind ||
      old.owner_id !== owner ||
      old.note !== note ||
      old.actor_id !== user ||
      String(old.follow_up ?? '') !== (v.followUp ?? '') ||
      !DecimalUtil.value(old.promise_amount ?? 0).eq(v.promiseAmount ?? 0)
    )
      conflict('The collection request key already has different details.');
    return old;
  }
  if (!i || DecimalUtil.value(i.balance_amount).lte(0))
    conflict('Choose an open customer invoice.');
  if (
    !(
      await m.query(
        "SELECT 1 FROM company_users cu JOIN users u ON u.id::text=cu.user_id::text WHERE cu.company_id::text=$1 AND cu.user_id::text=$2 AND cu.status='active' AND u.status='active' AND u.deleted_at IS NULL",
        [b.company_id, owner],
      )
    ).length
  )
    invalid('Select an active company collector.');
  if (
    v.kind === 'PROMISE' &&
    (!v.followUp ||
      typeof v.promiseAmount !== 'string' ||
      !/^\d+(\.\d{1,4})?$/.test(v.promiseAmount) ||
      DecimalUtil.value(v.promiseAmount).lte(0) ||
      DecimalUtil.value(v.promiseAmount).gt(i.balance_amount))
  )
    invalid(
      'Enter a promise date and a positive amount within the outstanding balance.',
    );
  return (
    await m.query(
      'INSERT INTO finance_ar_collection_events(book_id,company_id,invoice_id,kind,owner_id,follow_up,promise_amount,note,actor_id,request_key) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *',
      [
        b.book_id,
        b.company_id,
        invoice,
        v.kind,
        owner,
        v.followUp || null,
        v.kind === 'PROMISE' ? v.promiseAmount : null,
        note,
        user,
        key,
      ],
    )
  )[0];
}

// The delivery and its unique history row commit together in the customer's portal inbox.
export async function sendDueReminders(m: EntityManager, b: ActivePostingBook) {
  const eligible = await m.query(
    `SELECT i.id,i.customer_id,i.invoice_no,i.balance_amount,i.currency,c.user_id,stage.n
    FROM invoices i JOIN customers c ON c.id=i.customer_id AND c.company_id=i.company_id AND c.deleted_at IS NULL
    JOIN users u ON u.id=c.user_id AND u.deleted_at IS NULL AND u.status='active'
    CROSS JOIN LATERAL(SELECT (now() AT TIME ZONE $3)::date today) local
    JOIN LATERAL(SELECT data FROM finance_ar_documents p WHERE p.book_id=$2 AND p.kind='POLICY' AND p.currency=i.currency AND p.state='APPROVED' AND p.effective_date<=local.today ORDER BY p.effective_date DESC,p.sequence DESC LIMIT 1) p ON true
    JOIN LATERAL(SELECT max(x::int) n FROM jsonb_array_elements_text(p.data->'reminderDays') x WHERE x::int<=local.today-i.due_date)stage ON stage.n IS NOT NULL
    LEFT JOIN LATERAL(SELECT kind FROM finance_ar_collection_events e WHERE e.invoice_id=i.id AND e.kind IN ('DISPUTE','RESOLVE') ORDER BY e.created_at DESC,e.id DESC LIMIT 1)d ON true
    WHERE i.company_id=$1 AND i.deleted_at IS NULL AND i.balance_amount>0 AND i.status IN ('ISSUED','PARTIALLY_PAID') AND coalesce(d.kind,'')<>'DISPUTE'
    AND NOT EXISTS(SELECT 1 FROM finance_ar_reminders r WHERE r.invoice_id=i.id AND r.stage>=stage.n)
    ORDER BY i.due_date,i.id LIMIT 200 FOR UPDATE OF i SKIP LOCKED`,
    [b.company_id, b.book_id, b.timezone],
  );
  for (const r of eligible) {
    const [n] = await m.query(
      `INSERT INTO portal_notifications(company_id,user_id,type,severity,title,message,resource_type,resource_id)
      VALUES($1,$2,'INVOICE_PAYMENT_REMINDER','INFO',$3,$4,'INVOICE',$5) RETURNING id`,
      [
        b.company_id,
        r.user_id,
        'Invoice ' + r.invoice_no,
        'Your outstanding balance is ' +
          r.currency +
          ' ' +
          r.balance_amount +
          '. Please quote ' +
          r.invoice_no +
          ' when arranging payment.',
        r.id,
      ],
    );
    await m.query(
      'INSERT INTO finance_ar_reminders(invoice_id,stage,book_id,notification_id) VALUES($1,$2,$3,$4)',
      [r.id, r.n, b.book_id, n.id],
    );
  }
  return { delivered: eligible.length };
}
@Injectable()
export class CustomerReminderWorker {
  private readonly log = new Logger(CustomerReminderWorker.name);
  constructor(private readonly db: DataSource) {}
  @Interval(300000)
  async tick() {
    if (
      !(
        await this.db.query(
          "SELECT to_regclass('public.finance_ar_documents') IS NOT NULL installed",
        )
      )[0].installed
    )
      return;
    const books = await this.db.query(
      "SELECT DISTINCT company_id FROM finance_ar_documents WHERE kind='POLICY' AND state='APPROVED' AND jsonb_array_length(data->'reminderDays')>0",
    );
    for (const row of books) {
      try {
        await this.db.transaction(async (m) => {
          const b = await activePostingBook(m, row.company_id);
          if (b) await sendDueReminders(m, b);
        });
      } catch (error) {
        this.log.warn(
          'Customer reminder processing failed for ' +
            row.company_id +
            ': ' +
            (error as Error).message,
        );
      }
    }
  }
}

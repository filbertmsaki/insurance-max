import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';
import { Customer } from '../../../customers/entities/customer.entity';
import { DataAccessScopeService } from '../../../../shared/authorization/data-access-scope.service';
import { FinancePermissions } from '../../governance/finance-permissions/finance.permissions';

@Injectable()
export class ManualInvoiceOptionsService {
  constructor(
    private readonly db: DataSource,
    private readonly access: DataAccessScopeService,
  ) {}

  async options(companyId: string) {
    const [book] = await this.db.query(
      `SELECT controls->>'functionalCurrency' AS currency, controls->'currencyScales' AS scales,
              controls->'paymentTerms' AS terms
         FROM finance_operating_setups
        WHERE company_id=$1 AND book_role='PRIMARY' AND withdrawn_at IS NULL AND finance_fin01_current(id)`,
      [companyId],
    );
    if (!book) return { ready: false };
    return {
      ready: true,
      currency: book.currency,
      scales: book.scales,
      terms: book.terms
        .filter((t: { party: string }) => t.party === 'CUSTOMER')
        .map((t: { code: string; label: string }) => ({
          code: t.code,
          label: t.label,
        })),
    };
  }

  async customers(user: AuthenticatedUser, search: string) {
    const term = typeof search === 'string' ? search.trim().slice(0, 100) : '';
    if (term.length < 2) return [];
    const scope = this.access.resolve(
      user,
      FinancePermissions.INVOICES_CREATE_MANUAL,
    );
    const label =
      "COALESCE(NULLIF(c.display_name,''), NULLIF(c.company_name,''), NULLIF(concat_ws(' ', c.first_name,c.last_name),''), c.customer_no)";
    const query = this.db
      .getRepository(Customer)
      .createQueryBuilder('c')
      .select('c.id', 'id')
      .addSelect('c.customer_no', 'code')
      .addSelect(label, 'label')
      .where('c.deleted_at IS NULL')
      .andWhere(
        "strpos(lower(concat_ws(' ', c.customer_no, " +
          label +
          ')),lower(:term)) > 0',
        { term },
      )
      .orderBy('label', 'ASC')
      .addOrderBy('c.id', 'ASC')
      .limit(20);
    this.access.applyCustomerReadScope(query, 'c', scope);
    return query.getRawMany<{ id: string; code: string; label: string }>();
  }
}

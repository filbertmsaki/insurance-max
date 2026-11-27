import type { ReactNode } from 'react';
import type { FoundationScope } from './foundation/api';
import { Field } from './journals/GlFields';
import { useFinanceBook } from './use-finance-view';
import { Link } from 'react-router-dom';
import { useAuthStore } from '@/modules/shared/auth/store/auth.store';

export function FinanceBookEmpty() {
  const permissions = useAuthStore((s) => s.authorizationContext?.permissions);
  return (
    <div role="status" className="space-y-2 rounded-md border bg-white p-4">
      <p>No accounting book is available for this company.</p>
      {permissions?.includes('finance-foundation:release') ? (
        <Link
          className="font-medium text-primary underline"
          to="/apps/finance/setup"
        >
          Set up the first accounting book
        </Link>
      ) : (
        <p>
          Ask your company finance administrator to set up a book or grant you
          access.
        </p>
      )}
    </div>
  );
}

export function FinanceBookWorkspace({
  books,
  children,
}: {
  books: FoundationScope[];
  children: (scope: FoundationScope) => ReactNode;
}) {
  const { selected, selectBook } = useFinanceBook(books);
  return (
    <>
      <Field
        label="Accounting book"
        value={selected?.bookId ?? ''}
        change={selectBook}
        emptyOptionLabel="Select an authorized book"
        options={books.map((book) => ({
          value: book.bookId,
          label: book.entity_code + ' / ' + book.book_code,
        }))}
      />
      {selected ? (
        children(selected)
      ) : (
        <p role="status">
          The linked book is unavailable. Select an authorized accounting book
          to continue.
        </p>
      )}
    </>
  );
}

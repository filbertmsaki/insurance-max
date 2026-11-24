import { FirstFinanceBook } from './FirstFinanceBook';
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/modules/shared/api/client';
import { Button } from '@/components/ui/button';
import type { FoundationScope } from '../foundation/api';

export function BookManagement({
  scope,
  identity,
}: {
  scope: FoundationScope;
  identity: string[];
}) {
  const [code, setCode] = useState(scope.book_code);
  const [action, setAction] = useState<'create' | 'rename' | 'archive' | null>(
    null,
  );
  const client = useQueryClient();
  const selection = {
    legalEntityId: scope.legalEntityId,
    bookId: scope.bookId,
  };
  const change = useMutation({
    mutationFn: async ({
      action,
      bookCode,
    }: {
      action: 'rename' | 'delete';
      bookCode?: string;
    }) => {
      if (action === 'rename')
        return apiClient.patch('/tenant/finance/setup/books', {
          scope: selection,
          bookCode,
        });
      return apiClient.delete('/tenant/finance/setup/books', {
        data: { scope: selection },
      });
    },
    onSuccess: async () => {
      setAction(null);
      await client.invalidateQueries({
        queryKey: ['finance-setup', ...identity, 'scopes'],
      });
    },
  });
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={change.isPending}
          onClick={() => {
            change.reset();
            setAction('create');
          }}
        >
          Create another book
        </Button>
        {scope.state === 'DRAFT' && (
          <>
            <Button
              type="button"
              variant="outline"
              disabled={change.isPending}
              onClick={() => {
                change.reset();
                setCode(scope.book_code);
                setAction('rename');
              }}
            >
              Rename selected book
            </Button>
            <Button
              type="button"
              variant="danger-outline"
              disabled={change.isPending}
              onClick={() => {
                change.reset();
                setAction('archive');
              }}
            >
              Archive selected book
            </Button>
          </>
        )}
      </div>
      {action === 'create' && (
        <div>
          <FirstFinanceBook
            identity={identity}
            scope={scope}
            created={() => {
              setAction(null);
              void client.invalidateQueries({
                queryKey: ['finance-setup', ...identity, 'scopes'],
              });
            }}
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => setAction(null)}
          >
            Cancel
          </Button>
        </div>
      )}
      {action === 'rename' && (
        <div className="space-y-3 rounded-md border p-4">
          <p className="text-sm">
            Rename the selected draft book: {scope.book_code}.
          </p>
          <label className="block text-sm">
            New code for the selected book
            <input
              className="mt-1 block w-full max-w-sm rounded border px-3 py-2"
              maxLength={50}
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={
                !code.trim() ||
                code.trim() === scope.book_code ||
                change.isPending
              }
              onClick={() =>
                change.mutate({ action: 'rename', bookCode: code.trim() })
              }
            >
              Save new code
            </Button>
            <Button
              variant="outline"
              disabled={change.isPending}
              onClick={() => setAction(null)}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
      {action === 'archive' && (
        <div role="alert" className="space-x-2 text-sm">
          Archive {scope.book_code}? Its records and history will be retained.{' '}
          <Button
            variant="destructive"
            disabled={change.isPending}
            onClick={() => change.mutate({ action: 'delete' })}
          >
            Confirm archive
          </Button>
          <Button variant="outline" onClick={() => setAction(null)}>
            Cancel
          </Button>
        </div>
      )}
      {change.isError && (
        <p role="alert" className="text-sm text-red-700">
          Unable to change the book. Check your access, the book code, and
          whether another administrator-accessible book remains.
        </p>
      )}
      {change.isSuccess && (
        <p role="status" className="text-sm text-green-800">
          Book change saved.
        </p>
      )}
    </div>
  );
}

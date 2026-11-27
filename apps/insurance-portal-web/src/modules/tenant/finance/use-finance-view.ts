import type { FoundationScope } from './foundation/api';
import { useSearchParams } from 'react-router-dom';

export function useFinanceView(allowed: readonly string[]) {
  const [params, setParams] = useSearchParams();
  const slug = (value: string) => value.toLowerCase().replaceAll(' ', '-');
  const view =
    allowed.find((value) => slug(value) === params.get('view')) ?? allowed[0];
  function openView(value: string, action?: string) {
    if (!allowed.includes(value)) return;
    const next = new URLSearchParams(params);
    if (value === allowed[0]) next.delete('view');
    else next.set('view', slug(value));
    next.delete('control');
    if (action && value === 'New document') next.set('action', action);
    else next.delete('action');
    if (next.toString() !== params.toString()) setParams(next);
  }
  return {
    view,
    control: params.get('control'),
    openView,
    action: view === 'New document' ? (params.get('action') ?? '') : '',
  };
}

export function useFinanceBook(scopes?: FoundationScope[]) {
  const [params, setParams] = useSearchParams();
  const requested = params.get('book');
  const selected = requested
    ? scopes?.find((item) => item.bookId === requested)
    : scopes?.[0];
  function selectBook(id: string) {
    if (!scopes?.some((item) => item.bookId === id)) return;
    const next = new URLSearchParams(params);
    next.set('book', id);
    setParams(next);
  }
  return { selected, selectBook };
}

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import type { SetupOverview } from './api';

type Inventory = SetupOverview['inventory'];
const UNCLASSIFIED = '__uncategorized__';

export function ProductScopeSelector({
  products,
  categories = [],
  selected,
  onChange,
  disabled,
}: {
  products: Inventory['products'];
  categories?: NonNullable<Inventory['productCategories']>;
  selected: string[];
  onChange: (ids: string[]) => void;
  disabled: boolean;
}) {
  const [category, setCategory] = useState('');
  const [search, setSearch] = useState('');
  const categoryByProduct = useMemo(
    () => new Map(categories.map((item) => [item.product_id, item])),
    [categories],
  );
  const categoryOptions = useMemo(() => {
    const values = new Map<string, string>();
    for (const product of products) {
      const item = categoryByProduct.get(product.id);
      values.set(
        item?.category_id ?? UNCLASSIFIED,
        item?.category_name ?? 'Uncategorized',
      );
    }
    return [...values].sort((a, b) => a[1].localeCompare(b[1]));
  }, [products, categoryByProduct]);
  const shown = products.filter((product) => {
    const item = categoryByProduct.get(product.id);
    const matchesCategory =
      !category || (item?.category_id ?? UNCLASSIFIED) === category;
    const query = search.trim().toLocaleLowerCase();
    return (
      matchesCategory &&
      (!query ||
        `${product.product_code} ${product.product_name}`
          .toLocaleLowerCase()
          .includes(query))
    );
  });
  const selectedSet = new Set(selected);
  const shownIds = new Set(shown.map((product) => product.id));
  return (
    <fieldset className="space-y-3 rounded border p-3">
      <legend>Products in scope</legend>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">
          Category
          <select
            className="mt-1 block w-full rounded border bg-white p-2"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
          >
            <option value="">All categories</option>
            {categoryOptions.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Search products
          <input
            className="mt-1 block w-full rounded border bg-white p-2"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by name or code"
          />
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={
            disabled ||
            !shown.length ||
            shown.every((product) => selectedSet.has(product.id))
          }
          onClick={() =>
            onChange([
              ...new Set([...selected, ...shown.map((product) => product.id)]),
            ])
          }
        >
          Select all shown
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={
            disabled || !shown.some((product) => selectedSet.has(product.id))
          }
          onClick={() => onChange(selected.filter((id) => !shownIds.has(id)))}
        >
          Clear shown
        </Button>
        <span className="text-sm">
          {selectedSet.size} selected · {shown.length} shown
        </span>
      </div>
      {shown.length ? (
        <div className="max-h-80 space-y-2 overflow-y-auto">
          {shown.map((product) => (
            <label key={product.id} className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                disabled={disabled}
                checked={selectedSet.has(product.id)}
                onChange={(event) =>
                  onChange(
                    event.target.checked
                      ? [...new Set([...selected, product.id])]
                      : selected.filter((id) => id !== product.id),
                  )
                }
              />
              <span>
                {product.product_code} — {product.product_name} (
                {product.lifecycle_status})
              </span>
            </label>
          ))}
        </div>
      ) : (
        <p className="text-sm">No products match these filters.</p>
      )}
    </fieldset>
  );
}

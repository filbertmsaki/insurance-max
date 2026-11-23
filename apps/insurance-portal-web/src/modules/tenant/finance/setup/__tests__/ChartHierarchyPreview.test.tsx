import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ChartHierarchyPreview } from '../ChartHierarchyPreview';

describe('draft hierarchy preview', () => {
  it('orders child accounts beneath their parent and labels posting status', () => {
    render(
      <ChartHierarchyPreview
        accounts={[
          {
            code: '1100',
            name: 'Cash',
            type: 'ASSET',
            parentCode: '1000',
            posting: true,
            control: true,
          },
          {
            code: '1000',
            name: 'Assets',
            type: 'ASSET',
            parentCode: null,
            posting: false,
            control: false,
          },
        ]}
      />,
    );
    const items = within(
      screen.getByRole('region', { name: 'Draft account hierarchy' }),
    ).getAllByRole('listitem');
    expect(items[0]).toHaveTextContent('1000 — Assets');
    expect(items[1]).toHaveTextContent('1100 — Cash');
    expect(items[1]).toHaveTextContent('Posting · Control');
  });
  it('does not render a misleading tree when parent relationships are invalid', () => {
    render(
      <ChartHierarchyPreview
        accounts={[
          {
            code: '1100',
            name: 'Cash',
            type: 'ASSET',
            parentCode: 'missing',
            posting: true,
            control: false,
          },
        ]}
      />,
    );
    expect(
      screen.queryByRole('region', { name: 'Draft account hierarchy' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(/Complete account codes and parent relationships/),
    ).toBeInTheDocument();
  });
});

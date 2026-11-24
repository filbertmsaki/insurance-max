import { fireEvent, render, screen, within } from '@testing-library/react';
import { AxiosHeaders } from 'axios';
import { afterEach, expect, it, vi } from 'vitest';
import { OperatingBook } from '../OperatingBook';
import { setupApi } from '../api';
import { makeOverview, scope, summary, uuid } from './fixtures';

afterEach(() => {
  vi.restoreAllMocks();
});

it('navigates all sixteen requirements and releases only a reviewed company setup', () => {
  const overview = makeOverview();
  const release = {
    id: uuid(94),
    hash: 'b'.repeat(64),
    version: 2,
    startsOn: '2026-01-01',
    endsBefore: '2027-01-01',
  };
  overview.operating = {
    activation: null,
    approvedReleases: [release],
    deployment: null,
  };
  const openStep = vi.fn();
  const props = {
    scope,
    canRelease: true,
    busy: false,
    openStep,
    run: (work: () => Promise<unknown>) => void work(),
  };
  const { rerender } = render(<OperatingBook {...props} overview={overview} />);
  expect(screen.getAllByRole('row')).toHaveLength(17);
  const row = screen.getByRole('row', { name: /FIN-01.01/ });
  fireEvent.click(within(row).getByRole('button', { name: 'G04-01' }));
  expect(openStep).toHaveBeenCalledWith('G04-01');
  fireEvent.change(screen.getByLabelText('Approved live release'), {
    target: { value: release.id },
  });
  fireEvent.change(screen.getByLabelText('Decision reason'), {
    target: { value: 'Verified company records' },
  });
  const activate = screen.getByRole('button', {
    name: 'Activate reviewed book',
  });
  expect(activate).toBeDisabled();
  const final = {
    ...summary,
    step: 'G04-10',
    state: 'REVIEWED_INACTIVE' as const,
  };
  overview.steps[9].latest = final;
  overview.complete = true;
  const call = vi.spyOn(setupApi, 'activateBook').mockResolvedValue({
    data: {},
    status: 200,
    statusText: 'OK',
    headers: {},
    config: { headers: new AxiosHeaders() },
  });
  rerender(
    <OperatingBook
      {...props}
      overview={{ ...overview, completionMeaning: 'DEMONSTRATION_ONLY' }}
    />,
  );
  expect(activate).toBeDisabled();
  rerender(<OperatingBook {...props} overview={overview} />);
  fireEvent.click(activate);
  expect(call).toHaveBeenCalledWith(
    scope,
    final,
    release,
    'Verified company records',
  );
});

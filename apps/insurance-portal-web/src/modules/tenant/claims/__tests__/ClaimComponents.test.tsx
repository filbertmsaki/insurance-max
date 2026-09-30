import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AxiosError, AxiosHeaders } from 'axios';
import {
  ClaimStatusBadge,
  RegulatoryStatusBadge,
} from '../components/ClaimBadges';
import { ClaimErrorAlert } from '../components/ClaimErrorAlert';

describe('claim badges', () => {
  it('labels lifecycle and TIRA statuses', () => {
    render(
      <>
        <ClaimStatusBadge status="NOTIFICATION_FAILED" />
        <RegulatoryStatusBadge status="ACCEPTED" />
        <RegulatoryStatusBadge status={null} />
      </>,
    );
    expect(screen.getByText('Notification failed')).toBeInTheDocument();
    expect(screen.getByText('Accepted by TIRA')).toBeInTheDocument();
    expect(screen.getByText('Not submitted')).toBeInTheDocument();
  });
});

describe('ClaimErrorAlert', () => {
  it('shows every field the TIRAMIS rules rejected', () => {
    const error = new AxiosError(
      'Request failed',
      'ERR_BAD_REQUEST',
      undefined,
      undefined,
      {
        status: 400,
        statusText: '',
        headers: {},
        config: { headers: new AxiosHeaders() },
        data: {
          success: false,
          error: {
            code: 'CLAIM_TIRAMIS_PAYLOAD_INVALID',
            message:
              'Claim notification CLN-2026-00001 is not ready for TIRAMIS',
            errors: [
              { message: 'lossNature is required' },
              { message: 'lossDate must not be after claimReportDate' },
            ],
          },
          meta: {
            requestId: 'r',
            correlationId: 'c',
            timestamp: '',
            method: 'POST',
            path: '/',
            statusCode: 400,
            contractVersion: '1',
          },
        },
      },
    );

    render(
      <ClaimErrorAlert
        error={error}
        title="The notification was not submitted"
      />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent(
      'The notification was not submitted',
    );
    expect(screen.getByText('lossNature is required')).toBeInTheDocument();
    expect(
      screen.getByText('lossDate must not be after claimReportDate'),
    ).toBeInTheDocument();
  });

  it('renders nothing without an error', () => {
    const { container } = render(<ClaimErrorAlert error={null} />);
    expect(container).toBeEmptyDOMElement();
  });
});

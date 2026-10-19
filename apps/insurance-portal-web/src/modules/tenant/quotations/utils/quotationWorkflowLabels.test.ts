import { describe, expect, it } from 'vitest';
import type {
  QuotationPreviewTiramisSubmission,
  QuotationWorkflowView,
} from '../types';
import {
  getFriendlyTiramisStatus,
  getFriendlyWorkflowLabel,
} from './quotationWorkflowLabels';

const baseWorkflow: QuotationWorkflowView = {
  quotationId: 'quotation-1',
  quotationNumber: 'QTN-001',
  workflowRevision: 1,
  quotationStage: 'COMPLETED',
  approval: {
    required: false,
    status: 'NOT_REQUIRED',
  },
  payment: {
    required: false,
    status: 'NOT_REQUIRED',
  },
  submission: {
    status: 'NOT_READY',
  },
  blockingReasons: [],
  availableCommands: {},
};

const baseTiramis: QuotationPreviewTiramisSubmission = {
  source: 'quotation',
  submission_status: null,
  request_id: null,
  submission_attempt_number: null,
  date_submitted: null,
  submitted_by: null,
  tiramis_environment: null,
  last_submission_error: null,
  next_retry_time: null,
  acknowledgement_id: null,
  acknowledgement_status_code: null,
  acknowledgement_status_description: null,
  acknowledgement_received_date: null,
  callback_received_status: null,
  callback_received_date: null,
  response_id: null,
  response_status_code: null,
  response_status_description: null,
  cover_note_reference_number: null,
  sticker_number: null,
};

describe('quotationWorkflowLabels', () => {
  it.each([
    ['ACK_SUCCESS', 'Issuing'],
    ['NOT_SUBMITTED', 'Not Issued'],
    ['FINAL_SUCCESS', 'Issued'],
  ])(
    'labels %s without confusing acknowledgements with final success',
    (status, expected) => {
      expect(
        getFriendlyTiramisStatus({ ...baseTiramis, submission_status: status }),
      ).toBe(expected);
    },
  );
  it('maps approval, payment, and issuance workflow states to business labels', () => {
    expect(
      getFriendlyWorkflowLabel(
        {
          ...baseWorkflow,
          approval: { required: true, status: 'PENDING' },
        },
        null,
      ),
    ).toBe('Awaiting Approval');

    expect(
      getFriendlyWorkflowLabel(
        {
          ...baseWorkflow,
          payment: { required: true, status: 'REQUESTED' },
        },
        null,
      ),
    ).toBe('Payment Required');

    expect(
      getFriendlyWorkflowLabel(
        {
          ...baseWorkflow,
          submission: { status: 'READY' },
        },
        null,
      ),
    ).toBe('Ready to Issue');

    expect(
      getFriendlyWorkflowLabel(
        {
          ...baseWorkflow,
          submission: { status: 'PROCESSING' },
        },
        null,
      ),
    ).toBe('Issuing');
  });

  it('maps TIRAMIS technical statuses to issuance labels', () => {
    expect(getFriendlyTiramisStatus(null)).toBe('Not Issued');
    expect(
      getFriendlyTiramisStatus({
        ...baseTiramis,
        submission_status: 'PROCESSING',
      }),
    ).toBe('Issuing');
    expect(
      getFriendlyTiramisStatus({
        ...baseTiramis,
        submission_status: 'SUCCESS',
        cover_note_reference_number: 'CN-001',
      }),
    ).toBe('Issued');
    expect(
      getFriendlyTiramisStatus({
        ...baseTiramis,
        submission_status: 'FAILED',
      }),
    ).toBe('Action Required');
    expect(
      getFriendlyTiramisStatus({
        ...baseTiramis,
        submission_status: 'REJECTED',
      }),
    ).toBe('Rejected');
  });
});

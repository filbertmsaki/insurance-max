import { TiramisSubmissionStatus } from '../enums/tiramis-submission-status.enum';

export type NormalizedTiramisPortalResponse = {
  transactionId: string | null;
  requestId: string | null;
  serviceType: string | null;
  rootElement: string | null;
  acknowledgement: {
    rootName: string | null;
    acknowledgementId: string | null;
    statusCode: string | null;
    statusDesc: string | null;
    isSuccess: boolean;
  };
  final: {
    rootName: string | null;
    responseId: string | null;
    statusCode: string | null;
    statusDesc: string | null;
    receivedAt: string | Date | null;
    payload: Record<string, any> | null;
    isSuccess: boolean;
  };
  raw: any;
};

export const ACTIVE_TIRAMIS_STATUSES = [
  TiramisSubmissionStatus.PENDING,
  TiramisSubmissionStatus.SUBMITTING,
  TiramisSubmissionStatus.SENT_TO_TIRAMIS_SERVICE,
  TiramisSubmissionStatus.ACK_ACCEPTED,
  TiramisSubmissionStatus.ACKNOWLEDGED,
  TiramisSubmissionStatus.PENDING_FINAL,
  TiramisSubmissionStatus.RETRY_PENDING,
  TiramisSubmissionStatus.RETRYING,
  TiramisSubmissionStatus.FINAL_SUCCESS,
];

export const FAILED_TIRAMIS_STATUSES = [
  TiramisSubmissionStatus.ACK_FAILED,
  TiramisSubmissionStatus.FINAL_FAILED,
  TiramisSubmissionStatus.FAILED,
  TiramisSubmissionStatus.RETRY_EXHAUSTED,
  TiramisSubmissionStatus.CALLBACK_OVERDUE,
];

export const PENDING_FINAL_TIRAMIS_STATUSES = [
  TiramisSubmissionStatus.SENT_TO_TIRAMIS_SERVICE,
  TiramisSubmissionStatus.ACK_ACCEPTED,
  TiramisSubmissionStatus.ACKNOWLEDGED,
  TiramisSubmissionStatus.PENDING_FINAL,
  TiramisSubmissionStatus.CALLBACK_OVERDUE,
  TiramisSubmissionStatus.UNKNOWN,
];

export function normalizeTiramisPortalResponse(
  response: any,
): NormalizedTiramisPortalResponse {
  const transaction =
    response?.transaction ||
    response?.data?.transaction ||
    response?.tiramis?.transaction ||
    null;

  const tiraResponse =
    response?.tiraResponse ||
    response?.tiramis?.tiraResponse ||
    response?.data?.tiraResponse ||
    null;

  const acknowledgement =
    response?.acknowledgement ||
    response?.data?.acknowledgement ||
    response?.tiramis?.acknowledgement ||
    null;

  const finalResponse =
    response?.finalResponse ||
    response?.data?.finalResponse ||
    response?.tiramis?.finalResponse ||
    transaction?.finalResponse ||
    transaction?.latestFinalResponse ||
    tiraResponse?.finalResponse ||
    null;

  const rootElement = firstValue(
    response?.rootElement,
    response?.rootName,
    tiraResponse?.rootElement,
    tiraResponse?.rootName,
    acknowledgement?.rootName,
    finalResponse?.rootName,
    finalResponse?.rootElement,
    transaction?.rootElement,
    transaction?.serviceRoot,
  );

  const ackRootName = firstValue(
    acknowledgement?.rootName,
    acknowledgement?.rootElement,
    tiraResponse?.acknowledgementRoot,
    tiraResponse?.rootName,
    rootElement,
  );

  const isAckRoot = String(ackRootName || '').endsWith('Ack');

  const acknowledgementStatusCode = firstValue(
    acknowledgement?.statusCode,
    acknowledgement?.acknowledgementStatusCode,
    acknowledgement?.AcknowledgementStatusCode,
    tiraResponse?.acknowledgementStatusCode,
    tiraResponse?.AcknowledgementStatusCode,
    response?.acknowledgementStatusCode,
    response?.AcknowledgementStatusCode,
    isAckRoot ? tiraResponse?.responseStatusCode : null,
    isAckRoot ? tiraResponse?.ResponseStatusCode : null,
    isAckRoot ? response?.responseStatusCode : null,
    isAckRoot ? response?.ResponseStatusCode : null,
  );

  const acknowledgementStatusDesc = firstValue(
    acknowledgement?.statusDesc,
    acknowledgement?.acknowledgementStatusDesc,
    acknowledgement?.AcknowledgementStatusDesc,
    tiraResponse?.acknowledgementStatusDesc,
    tiraResponse?.AcknowledgementStatusDesc,
    response?.acknowledgementStatusDesc,
    response?.AcknowledgementStatusDesc,
    isAckRoot ? tiraResponse?.responseStatusDesc : null,
    isAckRoot ? tiraResponse?.ResponseStatusDesc : null,
    isAckRoot ? response?.responseStatusDesc : null,
    isAckRoot ? response?.ResponseStatusDesc : null,
  );

  const finalRootName = firstValue(
    finalResponse?.rootName,
    finalResponse?.rootElement,
    !isAckRoot ? tiraResponse?.rootName : null,
    !isAckRoot ? tiraResponse?.rootElement : null,
  );

  const finalStatusCode = firstValue(
    finalResponse?.responseStatusCode,
    finalResponse?.ResponseStatusCode,
    finalResponse?.statusCode,
    transaction?.finalResponseStatusCode,
    transaction?.responseStatusCode,
    !isAckRoot ? tiraResponse?.responseStatusCode : null,
    !isAckRoot ? tiraResponse?.ResponseStatusCode : null,
    !isAckRoot ? response?.responseStatusCode : null,
    !isAckRoot ? response?.ResponseStatusCode : null,
  );

  const finalStatusDesc = firstValue(
    finalResponse?.responseStatusDesc,
    finalResponse?.ResponseStatusDesc,
    finalResponse?.statusDesc,
    transaction?.finalResponseStatusDesc,
    transaction?.responseStatusDesc,
    !isAckRoot ? tiraResponse?.responseStatusDesc : null,
    !isAckRoot ? tiraResponse?.ResponseStatusDesc : null,
    !isAckRoot ? response?.responseStatusDesc : null,
    !isAckRoot ? response?.ResponseStatusDesc : null,
  );

  const finalResponseId = firstValue(
    finalResponse?.responseId,
    finalResponse?.ResponseId,
    transaction?.finalResponseId,
    transaction?.responseId,
    !isAckRoot ? tiraResponse?.responseId : null,
    !isAckRoot ? tiraResponse?.ResponseId : null,
    !isAckRoot ? response?.responseId : null,
    !isAckRoot ? response?.ResponseId : null,
  );

  return {
    transactionId: firstValue(
      transaction?.id,
      response?.transactionId,
      response?.tiramisTransactionId,
      response?.data?.transactionId,
    ),
    requestId: firstValue(
      response?.requestId,
      response?.tiramisRequestId,
      response?.data?.requestId,
      response?.record?.requestId,
      response?.coverNote?.requestId,
      response?.policy?.requestId,
      response?.reinsurance?.requestId,
      response?.claimNotification?.requestId,
      response?.claimIntimation?.requestId,
      response?.claimAssessment?.requestId,
      response?.dischargeVoucher?.requestId,
      response?.claimPayment?.requestId,
      response?.claimRejection?.requestId,
      acknowledgement?.requestId,
      tiraResponse?.requestId,
      finalResponse?.requestId,
      transaction?.currentRequestId,
      transaction?.requestId,
    ),
    serviceType: firstValue(
      response?.serviceType,
      response?.tiramisServiceType,
      transaction?.serviceType,
      transaction?.requestType,
      response?.requestType,
    ),
    rootElement,
    acknowledgement: {
      rootName: ackRootName,
      acknowledgementId: firstValue(
        acknowledgement?.acknowledgementId,
        acknowledgement?.AcknowledgementId,
        tiraResponse?.acknowledgementId,
        tiraResponse?.AcknowledgementId,
        response?.acknowledgementId,
      ),
      statusCode: acknowledgementStatusCode,
      statusDesc: acknowledgementStatusDesc,
      isSuccess: isTiraSuccessCode(acknowledgementStatusCode),
    },
    final: {
      rootName: finalRootName,
      responseId: finalResponseId,
      statusCode: finalStatusCode,
      statusDesc: finalStatusDesc,
      receivedAt: firstValue(
        finalResponse?.receivedAt,
        finalResponse?.createdAt,
        transaction?.finalResponseReceivedAt,
        response?.finalResponseReceivedAt,
      ),
      payload:
        finalResponse || (!isAckRoot && tiraResponse ? tiraResponse : null),
      isSuccess: isTiraSuccessCode(finalStatusCode),
    },
    raw: response,
  };
}

export function resolveSubmissionStatusFromNormalized(
  normalized: NormalizedTiramisPortalResponse,
): TiramisSubmissionStatus {
  if (normalized.final.statusCode || normalized.final.responseId) {
    return normalized.final.isSuccess
      ? TiramisSubmissionStatus.FINAL_SUCCESS
      : TiramisSubmissionStatus.FINAL_FAILED;
  }

  if (normalized.acknowledgement.statusCode) {
    if (normalized.acknowledgement.isSuccess) {
      const root = String(normalized.acknowledgement.rootName || '');

      return root.endsWith('Ack')
        ? TiramisSubmissionStatus.PENDING_FINAL
        : TiramisSubmissionStatus.ACK_ACCEPTED;
    }

    return TiramisSubmissionStatus.ACK_FAILED;
  }

  return TiramisSubmissionStatus.SENT_TO_TIRAMIS_SERVICE;
}

export function isTiraSuccessCode(code?: string | null): boolean {
  return String(code || '').trim().toUpperCase() === 'TIRA001';
}

export function isFailureTiramisStatus(status?: string | null): boolean {
  return FAILED_TIRAMIS_STATUSES.includes(status as TiramisSubmissionStatus);
}

export function isFinalTiramisStatus(status?: string | null): boolean {
  return [
    TiramisSubmissionStatus.FINAL_SUCCESS,
    TiramisSubmissionStatus.FINAL_FAILED,
    TiramisSubmissionStatus.FAILED,
    TiramisSubmissionStatus.RETRY_EXHAUSTED,
    TiramisSubmissionStatus.ACK_FAILED,
  ].includes(status as TiramisSubmissionStatus);
}

export function getTiramisFailureMessage(
  normalized: NormalizedTiramisPortalResponse,
): string | null {
  return normalized.final.statusDesc || normalized.acknowledgement.statusDesc || null;
}

function firstValue(...values: any[]): string | null {
  for (const value of values) {
    if (value !== null && value !== undefined && String(value).trim() !== '') {
      return String(value).trim();
    }
  }

  return null;
}

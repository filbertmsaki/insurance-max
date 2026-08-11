import { apiClient } from '@/modules/shared/api/client';
export type VerificationType = 'MOTOR' | 'COVER_NOTE';
export interface MotorVerificationRequest {
  motorCategory: 1 | 2;
  motorRegistrationNumber?: string;
  motorChassisNumber?: string;
}
export interface CoverNoteVerificationRequest {
  coverNoteReferenceNumber?: string;
  stickerNumber?: string;
  motorRegistrationNumber?: string;
  motorChassisNumber?: string;
}
export interface VerificationResult {
  success: boolean;
  verificationType: VerificationType;
  requestId: string | null;
  transactionId: string | null;
  status: string;
  responseCode: string | null;
  responseMessage: string | null;
  registrationNumber: string | null;
  coverNoteReferenceNumber: string | null;
  verifiedRecordDetails: unknown;
  xml?: string | null;
  respondedAt: string | null;
  fullResponse: Record<string, unknown>;
}
export const verificationsApi = {
  motor: (data: MotorVerificationRequest) =>
    apiClient
      .post<VerificationResult>('/verifications/motor', data)
      .then((r) => r.data),
  coverNote: (data: CoverNoteVerificationRequest) =>
    apiClient
      .post<VerificationResult>('/verifications/cover-note', data)
      .then((r) => r.data),
};

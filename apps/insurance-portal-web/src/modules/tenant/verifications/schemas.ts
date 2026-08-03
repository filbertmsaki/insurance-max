import { z } from 'zod';
const text = z.string().trim().max(50, 'Maximum 50 characters').optional().or(z.literal(''));
export const motorVerificationSchema = z.object({ motorCategory: z.enum(['1', '2']), motorRegistrationNumber: text, motorChassisNumber: text }).refine((v) => v.motorRegistrationNumber || v.motorChassisNumber, { message: 'Enter a registration number or chassis number', path: ['motorRegistrationNumber'] });
export const coverNoteVerificationSchema = z.object({ coverNoteReferenceNumber: text, stickerNumber: text, motorRegistrationNumber: text, motorChassisNumber: text }).refine((v) => v.coverNoteReferenceNumber || v.stickerNumber || v.motorRegistrationNumber || v.motorChassisNumber, { message: 'Enter at least one value to verify', path: ['coverNoteReferenceNumber'] });
export type MotorVerificationForm = z.infer<typeof motorVerificationSchema>;
export type CoverNoteVerificationForm = z.infer<typeof coverNoteVerificationSchema>;

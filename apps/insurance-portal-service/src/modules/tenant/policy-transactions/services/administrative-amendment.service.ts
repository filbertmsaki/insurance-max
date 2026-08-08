import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Policy } from '../../policies/entities/policy.entity';

const PROHIBITED_FIELDS = [
  'customer_id',
  'product_id',
  'category_id',
  'sub_class_id',
  'start_date',
  'end_date',
  'sum_insured',
  'total_premium',
  'net_premium',
  'currency',
  'policy_reference_number',
  'policy_no',
  'cover_note_no',
];

export interface AdministrativeAmendmentInput {
  servicing_officer_id?: string | null;
  department_id?: string | null;
  internal_notes?: string | null;
  document_delivery_preference?: string | null;
  communication_preference?: string | null;
  internal_tags?: string[] | null;
}

/**
 * PATCH /policies/:id/administrative-details (§13.27). Only internal,
 * non-contractual fields may be changed here — any contractual field
 * requires an endorsement instead.
 */
@Injectable()
export class AdministrativeAmendmentService {
  constructor(
    @InjectRepository(Policy)
    private readonly policyRepository: Repository<Policy>,
  ) {}

  async update(
    companyId: string,
    policyId: string,
    dto: Record<string, unknown>,
  ) {
    for (const field of PROHIBITED_FIELDS) {
      if (Object.prototype.hasOwnProperty.call(dto, field)) {
        throw new BadRequestException(`${field} requires an endorsement.`);
      }
    }

    const policy = await this.policyRepository.findOne({
      where: { id: policyId, company_id: companyId },
    });

    if (!policy) {
      throw new BadRequestException('Policy not found');
    }

    const input = dto as AdministrativeAmendmentInput;

    policy.metadata = {
      ...(policy.metadata ?? {}),
      administrative: {
        ...(policy.metadata as any)?.administrative,
        servicingOfficerId: input.servicing_officer_id,
        internalNotes: input.internal_notes,
        documentDeliveryPreference: input.document_delivery_preference,
        communicationPreference: input.communication_preference,
        internalTags: input.internal_tags,
      },
    };

    if (input.department_id !== undefined) {
      policy.department_id = input.department_id;
    }

    return this.policyRepository.save(policy);
  }
}

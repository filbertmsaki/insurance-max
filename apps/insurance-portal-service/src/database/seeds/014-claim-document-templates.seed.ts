import { createHash } from 'node:crypto';
import { environment } from '@insurance-max/shared-config';
import { DataSource } from 'typeorm';
import { Seeder } from 'typeorm-extension';

import { Company } from '../../modules/platform/companies/entities/company.entity';
import { DocumentTemplate } from '../../modules/tenant/insurance-documents/entities/document-template.entity';
import { DocumentTemplateVersion } from '../../modules/tenant/insurance-documents/entities/document-template-version.entity';

/**
 * Default, company-editable templates for the discharge voucher and the
 * claim rejection letter (ClaimDischargeService / ClaimRejectionService).
 * Existing templates are never overwritten.
 */
const TEMPLATES = [
  {
    code: 'CLAIM_DISCHARGE_VOUCHER',
    name: 'Claim Discharge Voucher',
    documentType: 'CLAIM_DISCHARGE_VOUCHER',
    content: [
      '# DISCHARGE VOUCHER',
      '',
      'Voucher No: {{voucher.number}} (version {{voucher.version}})',
      'Date: {{voucher.date}}',
      '',
      'Claim No: {{claim.claim_no}}',
      'TIRA Claim Reference: {{claim.claim_reference_number}}',
      'Cover Note Reference: {{claim.cover_note_reference_number}}',
      'Policy No: {{policy.policy_no}}',
      'Loss Date: {{claim.loss_date}}',
      'Nature of Loss: {{claim.loss_nature}}',
      '',
      'I, {{claimant.name}}, accept the sum of {{voucher.currency}} {{voucher.offer_amount}}',
      'in full and final settlement of the above claim and discharge the insurer from',
      'all further liability arising from the loss described above.',
      '',
      'Claimant signature: ______________________   Date: ______________',
      '',
      'Witness name: __________________________   Signature: ____________',
    ].join('\n'),
    schema: {
      voucher: { number: 'string', offer_amount: 'string', currency: 'string' },
      claim: { claim_no: 'string' },
    },
  },
  {
    code: 'CLAIM_REJECTION_LETTER',
    name: 'Claim Rejection Letter',
    documentType: 'CLAIM_REJECTION_LETTER',
    content: [
      '# CLAIM DECISION',
      '',
      'Dear {{customer.name}},',
      '',
      'Re: Claim {{claim.claim_no}} under Policy {{policy.policy_no}}',
      'TIRA Claim Reference: {{claim.claim_reference_number}}',
      '',
      'We have completed our review of the claim reported for the loss of {{claim.loss_date}}',
      '({{claim.loss_nature}}). We regret to inform you that the claim has been declined.',
      '',
      'Reason: {{rejection.reason}}',
      'Policy reference: {{rejection.policy_clause_reference}}',
      '',
      'Rejection No: {{rejection.number}}   Date: {{rejection.date}}',
      '',
      'If you disagree with this decision you may request a review or lodge a complaint',
      'with us, and you may also refer the matter to the Tanzania Insurance Regulatory Authority.',
    ].join('\n'),
    schema: {
      rejection: { number: 'string', reason: 'string' },
      claim: { claim_no: 'string' },
    },
  },
];

export default class ClaimDocumentTemplatesSeeder implements Seeder {
  async run(dataSource: DataSource): Promise<void> {
    const company = await dataSource.getRepository(Company).findOneBy({
      tira_company_code: environment.SEED_TARGET_COMPANY_CODE ?? 'ICC739',
    });

    if (!company) {
      return;
    }

    const [author] = await dataSource.query(
      `SELECT user_id FROM company_users WHERE company_id = $1 ORDER BY created_at ASC LIMIT 1`,
      [company.id],
    );

    if (!author?.user_id) {
      return;
    }

    const templates = dataSource.getRepository(DocumentTemplate);
    const versions = dataSource.getRepository(DocumentTemplateVersion);

    for (const definition of TEMPLATES) {
      const existing = await templates.findOne({
        where: { company_id: company.id, template_code: definition.code },
      });

      if (existing) {
        continue;
      }

      const template = await templates.save(
        templates.create({
          company_id: company.id,
          template_code: definition.code,
          template_name: definition.name,
          document_type: definition.documentType,
          engine: 'TEXT_TEMPLATE',
          scope: 'COMPANY',
          status: 'ACTIVE',
          active_version_id: null,
          created_by: author.user_id,
        }),
      );
      const version = await versions.save(
        versions.create({
          template_id: template.id,
          version_number: 1,
          status: 'PUBLISHED',
          template_content: definition.content,
          stylesheet_content: null,
          header_content: null,
          footer_content: null,
          variable_schema: definition.schema,
          sample_data: null,
          template_hash: createHash('sha256')
            .update(definition.content)
            .digest('hex'),
          created_by: author.user_id,
          approved_by: author.user_id,
          approved_at: new Date(),
        }),
      );

      await templates.update(
        { id: template.id },
        { active_version_id: version.id },
      );
    }
  }
}

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { Pencil, Plus, Power } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { EmptyState, SectionCard } from '@/components/shared/DetailSections';
import { humanizeCode } from '@/components/shared/detailFormat';
import { claimsApi } from '../api';
import { CLAIM_DOCUMENT_STAGES } from '../constants';
import { documentRequirementsKey, useDocumentRequirements } from '../hooks';
import type {
  ClaimDocumentStage,
  DocumentRequirement,
  DocumentRequirementPayload,
} from '../types';
import { ClaimErrorAlert } from './ClaimErrorAlert';
import { ClaimField } from './ClaimField';
import { FormDialog } from './FormDialog';
import { useSchemaForm } from './use-schema-form';

type Options = Array<{ value: string; label: string }>;

const ANY = '__any__';

const requirementSchema = z.object({
  claim_stage: z.enum(CLAIM_DOCUMENT_STAGES),
  document_type: z
    .string()
    .trim()
    .min(1, 'Enter a document type code')
    .max(80)
    .regex(/^[A-Z0-9_]+$/, 'Use capital letters, digits and underscores'),
  title: z.string().trim().min(1, 'Enter the title').max(180),
  description: z.string().trim().max(2000).optional(),
  is_mandatory: z.enum(['Y', 'N']),
  sort_order: z.string().regex(/^\d*$/, 'Use a whole number').optional(),
  product_id: z.string(),
  insurance_category_id: z.string(),
});

type RequirementFormValues = z.infer<typeof requirementSchema>;

function requirementDefaults(
  requirement: DocumentRequirement | null,
): RequirementFormValues {
  return {
    claim_stage: requirement?.claim_stage ?? 'NOTIFICATION',
    document_type: requirement?.document_type ?? '',
    title: requirement?.title ?? '',
    description: requirement?.description ?? '',
    is_mandatory: requirement?.is_mandatory === false ? 'N' : 'Y',
    sort_order:
      requirement?.sort_order != null ? String(requirement.sort_order) : '',
    product_id: requirement?.product_id ?? ANY,
    insurance_category_id: requirement?.insurance_category_id ?? ANY,
  };
}

function toRequirementPayload(
  values: RequirementFormValues,
  requirement: DocumentRequirement | null,
): DocumentRequirementPayload {
  const scope = (value: string) => (value === ANY ? null : value);
  return {
    id: requirement?.id,
    claim_stage: values.claim_stage as ClaimDocumentStage,
    document_type: values.document_type.trim(),
    title: values.title.trim(),
    description: values.description?.trim() || undefined,
    is_mandatory: values.is_mandatory === 'Y',
    sort_order: values.sort_order ? Number(values.sort_order) : undefined,
    product_id: scope(values.product_id),
    insurance_category_id: scope(values.insurance_category_id),
    is_active: requirement?.is_active ?? true,
  };
}

function RequirementDialog({
  requirement,
  products,
  categories,
  pending,
  error,
  onSave,
  onClose,
}: {
  requirement: DocumentRequirement | null;
  products: Options;
  categories: Options;
  pending: boolean;
  error: unknown;
  onSave: (payload: DocumentRequirementPayload) => void;
  onClose: () => void;
}) {
  const form = useSchemaForm<RequirementFormValues>(
    requirementSchema,
    requirementDefaults(requirement),
  );

  return (
    <FormDialog
      id="document-requirement-form"
      title={
        requirement ? 'Edit document requirement' : 'Add document requirement'
      }
      description="A required document must be uploaded before the stage can be submitted."
      form={form}
      submitLabel="Save requirement"
      pending={pending}
      error={error}
      onClose={onClose}
      onSubmit={(values) => onSave(toRequirementPayload(values, requirement))}
    >
      <div className="grid gap-4 md:grid-cols-2">
        <ClaimField
          form={form}
          name="claim_stage"
          label="Stage"
          options={CLAIM_DOCUMENT_STAGES.map((value) => ({
            value,
            label: humanizeCode(value),
          }))}
          required
        />
        <ClaimField
          form={form}
          name="is_mandatory"
          label="Required"
          options={[
            { value: 'Y', label: 'Required' },
            { value: 'N', label: 'Optional' },
          ]}
          required
        />
        <ClaimField
          form={form}
          name="document_type"
          label="Document type code"
          uppercase
          maxLength={80}
          placeholder="POLICE_REPORT"
          required
        />
        <ClaimField
          form={form}
          name="title"
          label="Title"
          maxLength={180}
          required
        />
        <ClaimField
          form={form}
          name="insurance_category_id"
          label="Class"
          options={[{ value: ANY, label: 'Any class' }, ...categories]}
        />
        <ClaimField
          form={form}
          name="product_id"
          label="Product"
          options={[{ value: ANY, label: 'Any product' }, ...products]}
        />
        <ClaimField form={form} name="sort_order" label="Order" type="number" />
      </div>
      <ClaimField
        form={form}
        name="description"
        label="Guidance for the uploader"
        multiline
        rows={2}
        maxLength={2000}
      />
    </FormDialog>
  );
}

/** Configuration of the documents each claim stage requires. */
export function DocumentRequirementsSection({
  products,
  categories,
}: {
  products: Options;
  categories: Options;
}) {
  const queryClient = useQueryClient();
  const requirements = useDocumentRequirements();
  const [editing, setEditing] = useState<DocumentRequirement | 'new' | null>(
    null,
  );
  const [deactivating, setDeactivating] = useState<DocumentRequirement | null>(
    null,
  );
  const refresh = () =>
    void queryClient.invalidateQueries({ queryKey: documentRequirementsKey });
  const save = useMutation({
    mutationFn: claimsApi.saveDocumentRequirement,
    onSuccess: refresh,
  });
  const deactivate = useMutation({
    mutationFn: (requirement: DocumentRequirement) =>
      claimsApi.deactivateDocumentRequirement(requirement.id),
    onSuccess: refresh,
  });
  const label = (options: Options, id?: string | null) =>
    id
      ? (options.find((option) => option.value === id)?.label ?? 'Unknown')
      : null;
  const rows = requirements.data ?? [];

  return (
    <>
      <SectionCard
        title="Document requirements"
        description="Documents each claim stage needs, for all products or a specific class or product."
        action={
          <Button variant="outline" onClick={() => setEditing('new')}>
            <Plus className="mr-2 h-4 w-4" />
            Add requirement
          </Button>
        }
      >
        {requirements.isError ? (
          <ClaimErrorAlert
            error={requirements.error}
            title="The document requirements could not be loaded"
          />
        ) : rows.length === 0 && !requirements.isLoading ? (
          <EmptyState text="No document requirements: claims can move through every stage without uploads." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Stage</TableHead>
                <TableHead>Document</TableHead>
                <TableHead>Scope</TableHead>
                <TableHead>Required</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((requirement) => {
                const scope = [
                  label(categories, requirement.insurance_category_id),
                  label(products, requirement.product_id),
                ].filter(Boolean);
                return (
                  <TableRow
                    key={requirement.id}
                    className={requirement.is_active ? undefined : 'opacity-60'}
                  >
                    <TableCell>
                      {humanizeCode(requirement.claim_stage)}
                    </TableCell>
                    <TableCell>
                      {requirement.title}
                      <div className="text-xs text-slate-500">
                        {requirement.document_type}
                      </div>
                    </TableCell>
                    <TableCell>
                      {scope.length ? scope.join(' · ') : 'All'}
                    </TableCell>
                    <TableCell>
                      {requirement.is_mandatory ? 'Required' : 'Optional'}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={requirement.is_active ? 'success' : 'muted'}
                      >
                        {requirement.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Edit requirement"
                          onClick={() => setEditing(requirement)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        {requirement.is_active ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Deactivate requirement"
                            onClick={() => setDeactivating(requirement)}
                          >
                            <Power className="h-4 w-4" />
                          </Button>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </SectionCard>

      {editing ? (
        <RequirementDialog
          requirement={editing === 'new' ? null : editing}
          products={products}
          categories={categories}
          pending={save.isPending}
          error={save.error}
          onClose={() => {
            save.reset();
            setEditing(null);
          }}
          onSave={(payload) =>
            save.mutate(payload, { onSuccess: () => setEditing(null) })
          }
        />
      ) : null}

      <ConfirmDialog
        open={!!deactivating}
        onOpenChange={(open) => !open && setDeactivating(null)}
        title="Deactivate document requirement"
        description="Stages submitted from now on no longer need this document. Documents already uploaded stay on their claims."
        confirmLabel="Deactivate"
        loading={deactivate.isPending}
        onConfirm={() =>
          deactivating &&
          deactivate.mutate(deactivating, {
            onSettled: () => setDeactivating(null),
          })
        }
      />
    </>
  );
}

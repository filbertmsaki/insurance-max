import { useState } from 'react';
import { useWatch } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { Pencil, RotateCcw } from 'lucide-react';
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
import { SectionCard } from '@/components/shared/DetailSections';
import { claimsApi } from '../api';
import { numberFormatsKey, useClaimNumberFormats } from '../hooks';
import type { ClaimNumberFormat } from '../types';
import { previewNumber } from '../utils';
import { ClaimErrorAlert } from './ClaimErrorAlert';
import { ClaimField } from './ClaimField';
import { FormDialog } from './FormDialog';
import { useSchemaForm } from './use-schema-form';

const formatSchema = z.object({
  prefix: z
    .string()
    .trim()
    .min(1, 'Enter a prefix')
    .max(40)
    .regex(
      /^[A-Za-z0-9{}/_-]+$/,
      'Use letters, digits, "-", "/", "_" and {YYYY}, {YY} or {MM}',
    ),
  sequence_length: z.string().regex(/^([3-9]|10)$/, 'Use 3 to 10 digits'),
});

type FormatFormValues = z.infer<typeof formatSchema>;

function FormatDialog({
  format,
  pending,
  error,
  onSave,
  onClose,
}: {
  format: ClaimNumberFormat;
  pending: boolean;
  error: unknown;
  onSave: (values: FormatFormValues) => void;
  onClose: () => void;
}) {
  const form = useSchemaForm<FormatFormValues>(formatSchema, {
    prefix: format.prefix,
    sequence_length: String(format.sequence_length),
  });
  const [prefix, sequenceLength] = useWatch({
    control: form.control,
    name: ['prefix', 'sequence_length'],
  });

  return (
    <FormDialog
      id="number-format-form"
      title={`${format.label} numbers`}
      description="New numbers use this format. Existing numbers are not changed and the running sequence continues."
      form={form}
      submitLabel="Save format"
      pending={pending}
      error={error}
      onClose={onClose}
      onSubmit={onSave}
    >
      <div className="grid gap-4 md:grid-cols-2">
        <ClaimField
          form={form}
          name="prefix"
          label="Prefix"
          maxLength={40}
          required
          description="Tokens: {YYYY} year, {YY} short year, {MM} month."
        />
        <ClaimField
          form={form}
          name="sequence_length"
          label="Digits"
          type="number"
          required
        />
      </div>
      <p className="text-sm text-slate-600">
        Next number looks like{' '}
        <span className="font-mono font-medium">
          {previewNumber(prefix ?? '', Number(sequenceLength))}
        </span>
      </p>
    </FormDialog>
  );
}

/** Per-company numbering of claims documents. */
export function NumberFormatsSection() {
  const queryClient = useQueryClient();
  const formats = useClaimNumberFormats();
  const [editing, setEditing] = useState<ClaimNumberFormat | null>(null);
  const refresh = () =>
    void queryClient.invalidateQueries({ queryKey: numberFormatsKey });
  const save = useMutation({
    mutationFn: claimsApi.saveNumberFormat,
    onSuccess: refresh,
  });
  const reset = useMutation({
    mutationFn: claimsApi.resetNumberFormat,
    onSuccess: refresh,
  });

  return (
    <>
      <SectionCard
        title="Number formats"
        description="How this company numbers its claims, vouchers, payments and rejections."
      >
        {formats.isError ? (
          <ClaimErrorAlert
            error={formats.error}
            title="The number formats could not be loaded"
          />
        ) : (
          <>
            <ClaimErrorAlert
              error={reset.error}
              title="The format was not reset"
            />
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Document</TableHead>
                  <TableHead>Format</TableHead>
                  <TableHead>Example</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {(formats.data ?? []).map((format) => (
                  <TableRow key={format.document_type}>
                    <TableCell>
                      {format.label}
                      {format.customised ? null : (
                        <Badge variant="muted" className="ml-2">
                          Default
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {format.prefix} · {format.sequence_length} digits
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {format.example}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Edit ${format.label} format`}
                          onClick={() => setEditing(format)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        {format.customised ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Reset ${format.label} format`}
                            disabled={reset.isPending}
                            onClick={() => reset.mutate(format.document_type)}
                          >
                            <RotateCcw className="h-4 w-4" />
                          </Button>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </>
        )}
      </SectionCard>

      {editing ? (
        <FormatDialog
          format={editing}
          pending={save.isPending}
          error={save.error}
          onClose={() => {
            save.reset();
            setEditing(null);
          }}
          onSave={(values) =>
            save.mutate(
              {
                document_type: editing.document_type,
                prefix: values.prefix.trim(),
                sequence_length: Number(values.sequence_length),
              },
              { onSuccess: () => setEditing(null) },
            )
          }
        />
      ) : null}
    </>
  );
}

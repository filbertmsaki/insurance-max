import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { EmptyState } from '@/components/shared/ContentStates';
import { SectionCard } from '@/components/shared/DetailSections';
import { PageHeader } from '@/components/shared/PageHeader';
import { getApiErrorMessage } from '@/lib/api-error';
import {
  useQuotationProducts,
  useQuotationSubClasses,
} from '@/modules/tenant/quotations/hooks';
import { nonMotorApi } from '../api';
import { underwriteKeys } from '../hooks';
import type { ProductRiskField } from '../types';
import { RiskFieldControl } from './RiskFieldControl';
import { RiskFieldDialog, type RiskFieldFormValues } from './RiskFieldDialog';
import { groupRiskFields, RISK_FIELD_TYPE_LABELS } from './riskFields';

const PRODUCT_LEVEL = '__product__';

/**
 * Risk Schemas: which risk fields each non-motor product (optionally each
 * sub-class) captures. This is what makes the Non-Motor wizard class
 * specific without hard-coding fire, marine, engineering... screens.
 */
export function RiskSchemasPage() {
  const queryClient = useQueryClient();
  const { data: products = [] } = useQuotationProducts({
    business_line: 'NON_MOTOR',
  });
  const [productId, setProductId] = useState('');
  const [subClassId, setSubClassId] = useState(PRODUCT_LEVEL);
  const { data: subClasses = [] } = useQuotationSubClasses(productId);
  const scopedSubClass = subClassId === PRODUCT_LEVEL ? null : subClassId;

  const fieldsKey = [
    ...underwriteKeys.all,
    'non-motor',
    'risk-schema-admin',
    productId,
    subClassId,
  ];
  const fields = useQuery({
    queryKey: fieldsKey,
    queryFn: () => nonMotorApi.getRiskFields(productId, scopedSubClass, true),
    enabled: Boolean(productId),
  });
  // Only fields defined exactly at this level are edited here; product-level
  // fields also apply to every sub-class and are shown in the preview.
  const ownFields = (fields.data ?? []).filter(
    (field) => (field.sub_class_id ?? null) === scopedSubClass,
  );

  const [editing, setEditing] = useState<ProductRiskField | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [removing, setRemoving] = useState<ProductRiskField | null>(null);

  const refresh = () =>
    queryClient.invalidateQueries({
      queryKey: [...underwriteKeys.all, 'non-motor'],
    });

  const save = useMutation({
    mutationFn: (values: RiskFieldFormValues) => {
      if (editing) {
        const { field_key: _key, ...changes } = values;
        void _key;
        return nonMotorApi.updateRiskField(editing.id, changes);
      }
      return nonMotorApi.createRiskField({
        ...values,
        product_id: productId,
        sub_class_id: scopedSubClass,
      });
    },
    onSuccess: () => {
      toast.success(editing ? 'Risk field updated' : 'Risk field added');
      setDialogOpen(false);
      setEditing(null);
      void refresh();
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  const remove = useMutation({
    mutationFn: (id: string) => nonMotorApi.deleteRiskField(id),
    onSuccess: () => {
      toast.success('Risk field removed');
      setRemoving(null);
      void refresh();
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  const previewFields = (fields.data ?? []).filter((field) => field.is_active);

  return (
    <div>
      <PageHeader
        eyebrow="Underwrite · Non-Motor"
        title="Risk schemas"
        description="Configure the risk details each non-motor product captures."
        action={
          productId ? (
            <Button
              onClick={() => {
                setEditing(null);
                setDialogOpen(true);
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add field
            </Button>
          ) : undefined
        }
      />

      <div className="mb-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="schema-product">Product</Label>
          <Select
            value={productId}
            onValueChange={(value) => {
              setProductId(value);
              setSubClassId(PRODUCT_LEVEL);
            }}
          >
            <SelectTrigger id="schema-product">
              <SelectValue placeholder="Select a non-motor product" />
            </SelectTrigger>
            <SelectContent>
              {products.map((product) => (
                <SelectItem key={product.id} value={product.id}>
                  {product.product_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {productId && subClasses.length > 0 && (
          <div className="space-y-1.5">
            <Label htmlFor="schema-sub-class">Applies to</Label>
            <Select value={subClassId} onValueChange={setSubClassId}>
              <SelectTrigger id="schema-sub-class">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={PRODUCT_LEVEL}>
                  All sub-classes (product level)
                </SelectItem>
                {subClasses.map((subClass) => (
                  <SelectItem key={subClass.id} value={subClass.id}>
                    {subClass.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {!productId ? (
        <EmptyState
          title="Select a product"
          description="Risk fields are configured per non-motor product."
        />
      ) : (
        <div className="grid gap-5 xl:grid-cols-5">
          <div className="xl:col-span-3">
            <SectionCard
              title="Fields"
              description={
                scopedSubClass
                  ? 'Fields specific to this sub-class.'
                  : 'Fields captured for every sub-class of this product.'
              }
            >
              {fields.isLoading ? (
                <p className="text-sm text-slate-500">Loading…</p>
              ) : ownFields.length === 0 ? (
                <EmptyState
                  title="No risk fields yet"
                  description="Add the risk information underwriters must capture for this product."
                />
              ) : (
                <ul className="divide-y rounded-lg border">
                  {ownFields.map((field) => (
                    <li
                      key={field.id}
                      className="flex items-start justify-between gap-3 p-3"
                    >
                      <div className="min-w-0">
                        <p className="flex flex-wrap items-center gap-2 font-medium text-slate-900">
                          {field.label}
                          <Badge variant="outline">
                            {RISK_FIELD_TYPE_LABELS[field.data_type]}
                          </Badge>
                          {field.is_required && (
                            <Badge variant="info">Required</Badge>
                          )}
                          {!field.is_active && (
                            <Badge variant="muted">Inactive</Badge>
                          )}
                        </p>
                        <p className="text-xs text-slate-500">
                          {field.field_key}
                          {field.section ? ` · ${field.section}` : ''} · order{' '}
                          {field.sort_order}
                        </p>
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Edit ${field.label}`}
                          onClick={() => {
                            setEditing(field);
                            setDialogOpen(true);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Remove ${field.label}`}
                          onClick={() => setRemoving(field)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>
          </div>
          <div className="xl:col-span-2">
            <SectionCard
              title="Preview"
              description="What underwriters see on the Risk Details step."
            >
              {previewFields.length === 0 ? (
                <p className="text-sm text-slate-500">No active fields.</p>
              ) : (
                <div className="space-y-5">
                  {groupRiskFields(previewFields).map((group) => (
                    <fieldset key={group.section} className="space-y-3">
                      <legend className="text-sm font-semibold text-slate-800">
                        {group.section}
                      </legend>
                      {group.fields.map((field) => (
                        <RiskFieldControl
                          key={field.id}
                          field={field}
                          value={undefined}
                          disabled
                          onChange={() => undefined}
                        />
                      ))}
                    </fieldset>
                  ))}
                </div>
              )}
            </SectionCard>
          </div>
        </div>
      )}

      {dialogOpen && (
        <RiskFieldDialog
          key={editing?.id ?? 'new'}
          open={dialogOpen}
          field={editing}
          saving={save.isPending}
          onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) setEditing(null);
          }}
          onSubmit={(values) => save.mutate(values)}
        />
      )}
      <ConfirmDialog
        open={Boolean(removing)}
        onOpenChange={(open) => !open && setRemoving(null)}
        title="Remove risk field"
        description={`"${removing?.label}" will no longer be captured on new quotations. Existing quotations keep what was captured.`}
        confirmLabel="Remove"
        loading={remove.isPending}
        onConfirm={() => removing && remove.mutate(removing.id)}
      />
    </div>
  );
}

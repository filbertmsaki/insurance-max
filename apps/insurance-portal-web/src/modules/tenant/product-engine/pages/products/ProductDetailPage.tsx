import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useFieldArray, useForm } from 'react-hook-form';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { PageHeader } from '@/components/shared/PageHeader';
import { useAuthStore } from '@/modules/shared/auth/store/auth.store';
import {
  useProduct,
  useProductVersion,
  useProductVersions,
  useCreateProductVersion,
  useUpdateProductVersionDraft,
  useSubmitProductVersionForReview,
  useRejectProductVersion,
  useReturnProductVersionToDraft,
  usePublishProductVersion,
  useRetireProductVersion,
  useSubClassesByProduct,
} from '@/modules/tenant/product-engine/hooks';
import type {
  InsuranceProductVersion,
  ProductDefinitionItemType,
  ProductDocumentRequirementType,
  ProductRequirementAppliesTo,
  UpsertProductVersionDto,
} from '@/types/product-engine';

const ITEM_TYPES: ProductDefinitionItemType[] = [
  'COVERAGE',
  'BENEFIT',
  'CONDITION',
  'WARRANTY',
  'EXCLUSION',
];
const DOC_TYPES: ProductDocumentRequirementType[] = [
  'IDENTITY',
  'OWNERSHIP',
  'FINANCIAL',
  'RISK_INFORMATION',
  'REGULATORY',
  'OTHER',
];
const DOC_STAGES: ProductRequirementAppliesTo[] = [
  'QUOTATION',
  'APPROVAL',
  'PAYMENT',
  'POLICY_ISSUANCE',
  'CLAIM',
];

function toFormValues(version: InsuranceProductVersion): UpsertProductVersionDto {
  return {
    product_name: version.product_name,
    description: version.description ?? '',
    supports_fleet: version.supports_fleet,
    tiramis_product_code: version.tiramis_product_code ?? '',
    cover_note_type: version.cover_note_type,
    default_cover_duration_days: version.default_cover_duration_days,
    currency_code: version.currency_code,
    cover_note_description: version.cover_note_description ?? '',
    operative_clause: version.operative_clause ?? '',
    policy_operative_clause: version.policy_operative_clause ?? '',
    special_conditions: version.special_conditions ?? '',
    exclusions: version.exclusions ?? '',
    allows_cover_text_override: version.allows_cover_text_override,
    effective_from: version.effective_from ?? '',
    effective_to: version.effective_to ?? '',
    sub_class_ids: version.sub_classes.map((s) => s.sub_class_id),
    default_sub_class_id:
      version.sub_classes.find((s) => s.is_default)?.sub_class_id ?? null,
    definition_items: version.definition_items.map((i) => ({ ...i })),
    addons: version.addons.map((a) => ({ ...a })),
    document_requirements: version.document_requirements.map((d) => ({
      ...d,
    })),
  };
}

function VersionStatusBadge({ version }: { version: InsuranceProductVersion }) {
  const statusStyles: Record<string, string> = {
    DRAFT: 'bg-amber-50 text-amber-700 border-amber-200',
    PUBLISHED: 'bg-green-50 text-green-700 border-green-200',
    RETIRED: 'bg-slate-100 text-slate-500 border-slate-200',
  };
  const reviewStyles: Record<string, string> = {
    APPROVED: 'bg-green-50 text-green-700 border-green-200',
    IN_REVIEW: 'bg-blue-50 text-blue-700 border-blue-200',
    REJECTED: 'bg-red-50 text-red-700 border-red-200',
    REQUIRES_REVIEW: 'bg-amber-50 text-amber-700 border-amber-200',
    DRAFT: 'bg-slate-50 text-slate-600 border-slate-200',
  };
  return (
    <div className="flex gap-2">
      <Badge variant="outline" className={statusStyles[version.status]}>
        {version.status}
      </Badge>
      <Badge variant="outline" className={reviewStyles[version.review_status]}>
        {version.review_status.replace('_', ' ')}
      </Badge>
    </div>
  );
}

export function ProductDetailPage() {
  const { productId } = useParams<{ productId: string }>();
  const navigate = useNavigate();
  const { hasPermission } = useAuthStore();

  const canUpdate = hasPermission('product-definitions:update');
  const canCreateVersion = hasPermission('product-definitions:create-version');
  const canSubmitReview = hasPermission('product-definitions:submit-review');
  const canReview = hasPermission('product-definitions:review');
  const canPublish = hasPermission('product-definitions:publish');
  const canRetire = hasPermission('product-definitions:retire');

  const { data: product } = useProduct(productId);
  const { data: versions = [] } = useProductVersions(productId ?? '');
  const { data: subClasses = [] } = useSubClassesByProduct(productId ?? '');

  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(
    null,
  );

  useEffect(() => {
    if (!selectedVersionId && versions.length) {
      const draft = versions.find((v) => v.status === 'DRAFT');
      setSelectedVersionId(draft?.id ?? versions[0].id);
    }
  }, [versions, selectedVersionId]);

  const { data: version } = useProductVersion(
    productId ?? '',
    selectedVersionId ?? '',
  );

  const createVersion = useCreateProductVersion(productId ?? '');
  const updateDraft = useUpdateProductVersionDraft(productId ?? '');
  const submitReview = useSubmitProductVersionForReview(productId ?? '');
  const rejectVersion = useRejectProductVersion(productId ?? '');
  const returnToDraft = useReturnProductVersionToDraft(productId ?? '');
  const publishVersion = usePublishProductVersion(productId ?? '');
  const retireVersion = useRetireProductVersion(productId ?? '');

  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectComments, setRejectComments] = useState('');

  const readOnly =
    !version ||
    version.status !== 'DRAFT' ||
    version.review_status === 'IN_REVIEW';

  const form = useForm<UpsertProductVersionDto>({
    values: version ? toFormValues(version) : undefined,
  });

  const definitionItems = useFieldArray({
    control: form.control,
    name: 'definition_items',
  });
  const addons = useFieldArray({ control: form.control, name: 'addons' });
  const documentRequirements = useFieldArray({
    control: form.control,
    name: 'document_requirements',
  });

  const selectedSubClassIds = form.watch('sub_class_ids') ?? [];
  const defaultSubClassId = form.watch('default_sub_class_id');

  const canSave = canUpdate && !readOnly;

  function onSave(values: UpsertProductVersionDto) {
    if (!version) return;
    updateDraft.mutate({ versionId: version.id, data: values });
  }

  async function onSaveThenSubmitReview(values: UpsertProductVersionDto) {
    if (!version) return;
    await updateDraft.mutateAsync({ versionId: version.id, data: values });
    submitReview.mutate(version.id);
  }

  if (!product) {
    return <div className="p-6">Loading…</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <PageHeader
          title={`${product.product_code} — ${product.product_name}`}
          description={`${product.category?.name ?? ''} · ${product.business_line} · Lifecycle: ${product.lifecycle_status}`}
        />
      </div>

      {/* Version selector + lifecycle actions */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border p-4">
        <Select
          value={selectedVersionId ?? undefined}
          onValueChange={setSelectedVersionId}
        >
          <SelectTrigger className="w-56">
            <SelectValue placeholder="Select version" />
          </SelectTrigger>
          <SelectContent>
            {versions.map((v) => (
              <SelectItem key={v.id} value={v.id}>
                v{v.version_number} — {v.status} / {v.review_status}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {version && <VersionStatusBadge version={version} />}

        <div className="ml-auto flex gap-2">
          {version?.status === 'DRAFT' &&
            version.review_status !== 'IN_REVIEW' && (
              <>
                {canSave && (
                  <Button
                    variant="outline"
                    onClick={form.handleSubmit(onSave)}
                    disabled={updateDraft.isPending}
                  >
                    Save
                  </Button>
                )}
                {canSubmitReview && (
                  <Button
                    onClick={form.handleSubmit(onSaveThenSubmitReview)}
                    disabled={updateDraft.isPending || submitReview.isPending}
                  >
                    Submit for Review
                  </Button>
                )}
              </>
            )}

          {version?.status === 'DRAFT' && version.review_status === 'IN_REVIEW' && (
            <>
              {canReview && (
                <Button
                  variant="outline"
                  onClick={() => setRejectOpen(true)}
                  disabled={rejectVersion.isPending}
                >
                  Reject
                </Button>
              )}
              {canReview && (
                <Button
                  variant="outline"
                  onClick={() => returnToDraft.mutate(version.id)}
                  disabled={returnToDraft.isPending}
                >
                  Return to Draft
                </Button>
              )}
              {canPublish && (
                <Button
                  onClick={() => publishVersion.mutate(version.id)}
                  disabled={publishVersion.isPending}
                >
                  Publish
                </Button>
              )}
            </>
          )}

          {version?.status === 'PUBLISHED' && (
            <>
              {canRetire && (
                <Button
                  variant="destructive"
                  onClick={() => retireVersion.mutate(version.id)}
                  disabled={retireVersion.isPending}
                >
                  Retire
                </Button>
              )}
              {canCreateVersion && (
                <Button
                  onClick={() =>
                    createVersion.mutate(undefined, {
                      onSuccess: (created) => setSelectedVersionId(created.id),
                    })
                  }
                  disabled={createVersion.isPending}
                >
                  Create New Version
                </Button>
              )}
            </>
          )}

          {version?.status === 'RETIRED' && canCreateVersion && (
            <Button
              onClick={() =>
                createVersion.mutate(undefined, {
                  onSuccess: (created) => setSelectedVersionId(created.id),
                })
              }
              disabled={createVersion.isPending}
            >
              Create New Version
            </Button>
          )}
        </div>
      </div>

      {!version ? (
        <div className="text-sm text-muted-foreground">
          No versions found for this product.
        </div>
      ) : (
        <Tabs defaultValue="wording" className="space-y-4">
          <TabsList>
            <TabsTrigger value="wording">Cover Wording</TabsTrigger>
            <TabsTrigger value="coverages">Coverages &amp; Benefits</TabsTrigger>
            <TabsTrigger value="addons">Add-ons</TabsTrigger>
            <TabsTrigger value="documents">Required Documents</TabsTrigger>
            <TabsTrigger value="subclasses">Subclasses</TabsTrigger>
          </TabsList>

          <TabsContent value="wording" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Product Name</label>
                <Input {...form.register('product_name')} disabled={readOnly} />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">TIRAMIS Product Code</label>
                <Input
                  {...form.register('tiramis_product_code')}
                  disabled={readOnly}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Cover Note Type</label>
                <Input
                  type="number"
                  {...form.register('cover_note_type', { valueAsNumber: true })}
                  disabled={readOnly}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">
                  Default Cover Duration (days)
                </label>
                <Input
                  type="number"
                  {...form.register('default_cover_duration_days', {
                    valueAsNumber: true,
                  })}
                  disabled={readOnly}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Currency</label>
                <Input {...form.register('currency_code')} disabled={readOnly} />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Effective From</label>
                <Input
                  type="date"
                  {...form.register('effective_from')}
                  disabled={readOnly}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Effective To</label>
                <Input
                  type="date"
                  {...form.register('effective_to')}
                  disabled={readOnly}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Description</label>
              <Textarea {...form.register('description')} disabled={readOnly} rows={2} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Cover Note Description</label>
              <Textarea
                {...form.register('cover_note_description')}
                disabled={readOnly}
                rows={2}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Operative Clause</label>
              <Textarea
                {...form.register('operative_clause')}
                disabled={readOnly}
                rows={3}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Policy Operative Clause</label>
              <Textarea
                {...form.register('policy_operative_clause')}
                disabled={readOnly}
                rows={3}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Special Conditions</label>
              <Textarea
                {...form.register('special_conditions')}
                disabled={readOnly}
                rows={2}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Exclusions</label>
              <Textarea {...form.register('exclusions')} disabled={readOnly} rows={2} />
            </div>

            <div className="flex items-center gap-3">
              <Switch
                checked={form.watch('allows_cover_text_override')}
                onCheckedChange={(v) =>
                  form.setValue('allows_cover_text_override', v)
                }
                disabled={readOnly}
              />
              <span className="text-sm">
                Allow quotation wording overrides
              </span>
            </div>
            {product.business_line === 'MOTOR' && (
              <div className="flex items-center gap-3">
                <Switch
                  checked={form.watch('supports_fleet')}
                  onCheckedChange={(v) => form.setValue('supports_fleet', v)}
                  disabled={readOnly}
                />
                <span className="text-sm">Supports motor fleet</span>
              </div>
            )}
          </TabsContent>

          <TabsContent value="coverages" className="space-y-3">
            {!readOnly && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  definitionItems.append({
                    code: '',
                    item_type: 'COVERAGE',
                    title: '',
                    description: '',
                    is_mandatory: true,
                    sort_order: 100,
                  })
                }
              >
                <Plus className="mr-2 h-4 w-4" /> Add item
              </Button>
            )}
            {definitionItems.fields.map((field, index) => (
              <div key={field.id} className="grid grid-cols-12 gap-2 rounded border p-3">
                <Input
                  className="col-span-2"
                  placeholder="Code"
                  disabled={readOnly}
                  {...form.register(`definition_items.${index}.code`)}
                />
                <Select
                  value={form.watch(`definition_items.${index}.item_type`)}
                  onValueChange={(v) =>
                    form.setValue(
                      `definition_items.${index}.item_type`,
                      v as ProductDefinitionItemType,
                    )
                  }
                  disabled={readOnly}
                >
                  <SelectTrigger className="col-span-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ITEM_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  className="col-span-3"
                  placeholder="Title"
                  disabled={readOnly}
                  {...form.register(`definition_items.${index}.title`)}
                />
                <Input
                  className="col-span-4"
                  placeholder="Description"
                  disabled={readOnly}
                  {...form.register(`definition_items.${index}.description`)}
                />
                {!readOnly && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="col-span-1"
                    onClick={() => definitionItems.remove(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </TabsContent>

          <TabsContent value="addons" className="space-y-3">
            {!readOnly && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  addons.append({
                    code: '',
                    name: '',
                    is_optional: true,
                    is_default_selected: false,
                    allows_separate_sum_insured: false,
                  })
                }
              >
                <Plus className="mr-2 h-4 w-4" /> Add add-on
              </Button>
            )}
            {addons.fields.map((field, index) => (
              <div key={field.id} className="grid grid-cols-12 gap-2 rounded border p-3">
                <Input
                  className="col-span-2"
                  placeholder="Code"
                  disabled={readOnly}
                  {...form.register(`addons.${index}.code`)}
                />
                <Input
                  className="col-span-4"
                  placeholder="Name"
                  disabled={readOnly}
                  {...form.register(`addons.${index}.name`)}
                />
                <Input
                  className="col-span-2"
                  placeholder="TIRAMIS code"
                  disabled={readOnly}
                  {...form.register(`addons.${index}.tiramis_addon_code`)}
                />
                <Input
                  className="col-span-2"
                  type="number"
                  placeholder="Max qty"
                  disabled={readOnly}
                  {...form.register(`addons.${index}.maximum_quantity`, {
                    valueAsNumber: true,
                  })}
                />
                <div className="col-span-1 flex items-center">
                  <Checkbox
                    checked={form.watch(`addons.${index}.is_optional`)}
                    onCheckedChange={(v) =>
                      form.setValue(`addons.${index}.is_optional`, !!v)
                    }
                    disabled={readOnly}
                  />
                </div>
                {!readOnly && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="col-span-1"
                    onClick={() => addons.remove(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </TabsContent>

          <TabsContent value="documents" className="space-y-3">
            {!readOnly && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  documentRequirements.append({
                    code: '',
                    requirement_type: 'OTHER',
                    applies_to: 'QUOTATION',
                    name: '',
                    is_mandatory: true,
                  })
                }
              >
                <Plus className="mr-2 h-4 w-4" /> Add requirement
              </Button>
            )}
            {documentRequirements.fields.map((field, index) => (
              <div key={field.id} className="grid grid-cols-12 gap-2 rounded border p-3">
                <Input
                  className="col-span-2"
                  placeholder="Code"
                  disabled={readOnly}
                  {...form.register(`document_requirements.${index}.code`)}
                />
                <Input
                  className="col-span-3"
                  placeholder="Name"
                  disabled={readOnly}
                  {...form.register(`document_requirements.${index}.name`)}
                />
                <Select
                  value={form.watch(
                    `document_requirements.${index}.requirement_type`,
                  )}
                  onValueChange={(v) =>
                    form.setValue(
                      `document_requirements.${index}.requirement_type`,
                      v as ProductDocumentRequirementType,
                    )
                  }
                  disabled={readOnly}
                >
                  <SelectTrigger className="col-span-3">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DOC_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={form.watch(`document_requirements.${index}.applies_to`)}
                  onValueChange={(v) =>
                    form.setValue(
                      `document_requirements.${index}.applies_to`,
                      v as ProductRequirementAppliesTo,
                    )
                  }
                  disabled={readOnly}
                >
                  <SelectTrigger className="col-span-3">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DOC_STAGES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!readOnly && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="col-span-1"
                    onClick={() => documentRequirements.remove(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </TabsContent>

          <TabsContent value="subclasses" className="space-y-2">
            {subClasses.map((sc) => {
              const checked = selectedSubClassIds.includes(sc.id);
              return (
                <div key={sc.id} className="flex items-center gap-3 rounded border p-2">
                  <Checkbox
                    checked={checked}
                    disabled={readOnly}
                    onCheckedChange={(v) => {
                      const next = v
                        ? [...selectedSubClassIds, sc.id]
                        : selectedSubClassIds.filter((id) => id !== sc.id);
                      form.setValue('sub_class_ids', next);
                      if (!v && defaultSubClassId === sc.id) {
                        form.setValue('default_sub_class_id', null);
                      }
                    }}
                  />
                  <span className="text-sm flex-1">
                    {sc.code} — {sc.name}
                  </span>
                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    <input
                      type="radio"
                      name="default_sub_class"
                      disabled={readOnly || !checked}
                      checked={defaultSubClassId === sc.id}
                      onChange={() =>
                        form.setValue('default_sub_class_id', sc.id)
                      }
                    />
                    Default
                  </label>
                </div>
              );
            })}
          </TabsContent>
        </Tabs>
      )}

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reject Version</DialogTitle>
          </DialogHeader>
          <Textarea
            value={rejectComments}
            onChange={(e) => setRejectComments(e.target.value)}
            rows={4}
            placeholder="Explain what needs to change…"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={!rejectComments.trim() || rejectVersion.isPending}
              onClick={() => {
                if (!version) return;
                rejectVersion.mutate(
                  { versionId: version.id, comments: rejectComments },
                  {
                    onSuccess: () => {
                      setRejectOpen(false);
                      setRejectComments('');
                    },
                  },
                );
              }}
            >
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

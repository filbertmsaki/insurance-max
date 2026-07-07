import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Plus, Save, Send, WandSparkles } from 'lucide-react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { PageHeader } from '@/components/shared/PageHeader';
import { underwritingPaths } from '@/modules/tenant/underwriting/paths';
import { useTiramisWizardDraft, useTiramisWizardReferenceData, useTiramisWizardSubmit } from '../hooks';
import { buildTiramisWizardSchema, createDefaultWizardValues } from '../schemas';
import type { TiramisWizardFlow, TiramisWizardFormValues, TiramisWizardStepId } from '../types';
import { TiramisWizardStepper } from '../components/TiramisWizardStepper';

function resolveFlow(flow?: string): TiramisWizardFlow | null {
  if (flow === 'motor' || flow === 'motor-fleet' || flow === 'non-motor') return flow;
  return null;
}

function FlowPicker({ onSelect }: { onSelect: (flow: TiramisWizardFlow) => void }) {
  const flows: Array<{ flow: TiramisWizardFlow; title: string; description: string }> = [
    { flow: 'motor', title: 'Motor Cover Note', description: 'Single vehicle motor cover note submission.' },
    { flow: 'motor-fleet', title: 'Motor Cover Note with Fleet', description: 'Fleet-based motor submission with multiple vehicles.' },
    { flow: 'non-motor', title: 'Non-Motor Cover Note', description: 'Property, liability, and other non-motor cover note submission.' },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {flows.map((item) => (
        <Card key={item.flow} className="cursor-pointer border-slate-200 hover:border-slate-300" onClick={() => onSelect(item.flow)}>
          <CardHeader>
            <CardTitle className="text-base">{item.title}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-slate-500">{item.description}</p>
            <Button className="w-full">Open wizard</Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function SectionTitle({ title, description }: { title: string; description?: string }) {
  return (
    <div className="space-y-1">
      <h3 className="text-base font-semibold text-slate-900">{title}</h3>
      {description ? <p className="text-sm text-slate-500">{description}</p> : null}
    </div>
  );
}

function arraySummary(values: TiramisWizardFormValues) {
  return [
    `Policyholders: ${values.policyholders.length}`,
    `Risks: ${values.risks.length}`,
    `Taxes: ${values.taxes.length}`,
    `Subject matters: ${values.subjectMatters.length}`,
    `Addons: ${values.addons.length}`,
    values.flow === 'motor-fleet' ? `Fleet entries: ${values.fleetEntries.length}` : null,
  ].filter(Boolean) as string[];
}

export function TiramisWizardPage() {
  const navigate = useNavigate();
  const { flow: flowParam } = useParams();
  const flow = resolveFlow(flowParam);

  if (!flow) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="TIRAMIS Wizard"
          description="Choose the cover note flow you want to create and submit."
          action={<Button variant="outline" onClick={() => navigate(underwritingPaths.root)}>Back to Underwriting</Button>}
        />
        <FlowPicker onSelect={(nextFlow) => navigate(underwritingPaths.tiramisWizardFlow(nextFlow))} />
      </div>
    );
  }

  return <TiramisWizardFlowPage flow={flow} navigate={navigate} />;
}

function TiramisWizardFlowPage({
  flow,
  navigate,
}: {
  flow: TiramisWizardFlow;
  navigate: ReturnType<typeof useNavigate>;
}) {
  const [step, setStep] = useState<TiramisWizardStepId>('quotation');
  const referenceData = useTiramisWizardReferenceData(flow);
  const { draft, saveDraft, clearDraft } = useTiramisWizardDraft(flow);
  const submitMutation = useTiramisWizardSubmit();

  const schema = useMemo(() => buildTiramisWizardSchema(flow), [flow]);
  const defaultValues = useMemo(() => ({
    ...createDefaultWizardValues(flow),
    ...draft,
    flow,
    companyCode: draft.companyCode || referenceData.companyCode,
    insurerCompanyCode: draft.insurerCompanyCode || referenceData.insurerCompanyCode,
    clientCode: draft.clientCode || referenceData.clientCode,
    clientKey: draft.clientKey || referenceData.clientKey,
    systemCode: draft.systemCode || referenceData.systemCode,
    branchCode: draft.branchCode || referenceData.branchCode,
    salePointCode: draft.salePointCode || referenceData.salePointCode,
    salePointName: draft.salePointName || referenceData.salePointName,
    callbackUrl: draft.callbackUrl || referenceData.callbackUrl,
    tranCompanyCode: draft.tranCompanyCode || referenceData.tranCompanyCode,
  }), [draft, flow, referenceData]);

  const form = useForm<TiramisWizardFormValues>({
    resolver: zodResolver(schema) as never,
    defaultValues,
  });

  const policyholders = useFieldArray({ control: form.control, name: 'policyholders' });
  const risks = useFieldArray({ control: form.control, name: 'risks' });
  const taxes = useFieldArray({ control: form.control, name: 'taxes' });
  const subjectMatters = useFieldArray({ control: form.control, name: 'subjectMatters' });
  const addons = useFieldArray({ control: form.control, name: 'addons' });

  useEffect(() => {
    form.reset(defaultValues);
  }, [defaultValues, form]);

  const currentValues = form.watch();

  useEffect(() => {
    saveDraft(currentValues);
  }, [currentValues, saveDraft]);

  const stepMeta: Record<TiramisWizardStepId, { title: string; description: string }> = {
    quotation: { title: 'Quotation', description: 'Capture the core quotation reference and product context.' },
    context: { title: 'Context', description: 'Auto-filled company, branch, sale point, and callback data.' },
    policyholders: { title: 'Policyholders', description: 'Add one or more policyholders or insured parties.' },
    details: { title: 'Details', description: flow === 'motor-fleet' ? 'Motor fleet header and vehicles.' : flow === 'motor' ? 'Motor vehicle details.' : 'Cover note business detail and reference data.' },
    risk: { title: 'Risk & Pricing', description: 'Repeatable rows for risks, taxes, subject matters, and addons.' },
    review: { title: 'Review', description: 'Validate the payload before submission.' },
  };

  async function handleValidateAndSave() {
    const result = await form.trigger();
    if (result) {
      saveDraft(form.getValues());
    }
  }

  async function handleSubmit() {
    const valid = await form.trigger();
    if (!valid) return;
    const values = form.getValues();
    const result = await submitMutation.mutateAsync(values);
    const submissionId = (result as { submission?: { id: string } })?.submission?.id;
    clearDraft();
    if (submissionId) {
      navigate(underwritingPaths.submissionDetail(submissionId));
      return;
    }
    navigate(underwritingPaths.submissions);
  }

  const currentStepIndex = ['quotation', 'context', 'policyholders', 'details', 'risk', 'review'].indexOf(step) + 1;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(underwritingPaths.root)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <PageHeader
          title="TIRAMIS Wizard"
          description="Quotation-first workflow for Motor, Motor Fleet, and Non-Motor cover note requests."
          action={<Button variant="outline" onClick={() => navigate(underwritingPaths.submissions)}>Open submissions</Button>}
        />
      </div>

      <Card className="border-slate-200 bg-slate-950 text-white">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-5">
          <div>
            <p className="text-sm font-medium text-slate-300">Flow</p>
            <p className="text-lg font-semibold capitalize">{flow.replace('-', ' ')}</p>
          </div>
          <div className="flex items-center gap-2">
            <WandSparkles className="h-4 w-4" />
            <span className="text-sm text-slate-300">Draft autosaves locally while you work</span>
          </div>
        </CardContent>
      </Card>

      <TiramisWizardStepper value={step} onChange={setStep} />

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {currentStepIndex}. {stepMeta[step].title}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <Form {...form}>
                <div className="space-y-6">
                  {step === 'quotation' && (
                    <div className="grid gap-4 md:grid-cols-2">
                      <FormField control={form.control} name="quotationId" render={({ field }) => (
                        <FormItem><FormLabel>Quotation ID</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                      )} />
                      <FormField control={form.control} name="quotationNo" render={({ field }) => (
                        <FormItem><FormLabel>Quotation No</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                      )} />
                      <FormField control={form.control} name="customerId" render={({ field }) => (
                        <FormItem><FormLabel>Customer ID</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                      )} />
                      <FormField control={form.control} name="quotationType" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Quotation Type</FormLabel>
                          <Select value={field.value} onValueChange={field.onChange}>
                            <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                            <SelectContent>
                              <SelectItem value="MOTOR">Motor</SelectItem>
                              <SelectItem value="NON_MOTOR">Non-Motor</SelectItem>
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="productCode" render={({ field }) => (
                        <FormItem><FormLabel>Product Code</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                      )} />
                      <FormField control={form.control} name="currencyCode" render={({ field }) => (
                        <FormItem><FormLabel>Currency</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                      )} />
                    </div>
                  )}

                  {step === 'context' && (
                    <div className="grid gap-4 md:grid-cols-2">
                      {(['requestId', 'companyCode', 'insurerCompanyCode', 'tranCompanyCode', 'systemCode', 'branchCode', 'salePointCode', 'salePointName', 'callbackUrl'] as const).map((name) => (
                        <FormField
                          key={name}
                          control={form.control}
                          name={name}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{name}</FormLabel>
                              <FormControl><Input {...field} /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      ))}
                    </div>
                  )}

                  {step === 'policyholders' && (
                    <div className="space-y-4">
                      {policyholders.fields.map((item, index) => (
                        <Card key={item.id}>
                          <CardContent className="grid gap-4 pt-6 md:grid-cols-2">
                            <FormField control={form.control} name={`policyholders.${index}.PolicyHolderName`} render={({ field }) => (<FormItem><FormLabel>Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                            <FormField control={form.control} name={`policyholders.${index}.PolicyHolderType`} render={({ field }) => (
                              <FormItem>
                                <FormLabel>Type</FormLabel>
                                <Select value={field.value} onValueChange={field.onChange}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                  <SelectContent><SelectItem value="1">Individual</SelectItem><SelectItem value="2">Corporate</SelectItem></SelectContent>
                                </Select>
                              </FormItem>
                            )} />
                            <FormField control={form.control} name={`policyholders.${index}.PolicyHolderIdNumber`} render={({ field }) => (<FormItem><FormLabel>ID Number</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                            <FormField control={form.control} name={`policyholders.${index}.PolicyHolderIdType`} render={({ field }) => (
                              <FormItem>
                                <FormLabel>ID Type</FormLabel>
                                <Select value={field.value} onValueChange={field.onChange}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                  <SelectContent><SelectItem value="6">TIN</SelectItem><SelectItem value="7">Company Incorporation Cert</SelectItem><SelectItem value="1">NIN</SelectItem></SelectContent>
                                </Select>
                              </FormItem>
                            )} />
                            <FormField control={form.control} name={`policyholders.${index}.PolicyHolderPhoneNumber`} render={({ field }) => (<FormItem><FormLabel>Phone</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                            <Button type="button" variant="ghost" onClick={() => policyholders.remove(index)} disabled={policyholders.fields.length === 1}>Remove</Button>
                          </CardContent>
                        </Card>
                      ))}
                      <Button type="button" variant="outline" onClick={() => policyholders.append(createDefaultWizardValues(flow).policyholders[0])}>
                        <Plus className="mr-2 h-4 w-4" />
                        Add policyholder
                      </Button>
                    </div>
                  )}

                  {step === 'details' && (
                    <div className="space-y-6">
                      {flow === 'motor' && (
                        <div className="grid gap-4 md:grid-cols-2">
                          <FormField control={form.control} name="motor.MotorCategory" render={({ field }) => (
                            <FormItem><FormLabel>Motor Category</FormLabel><Select value={field.value} onValueChange={field.onChange}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="1">Motor Vehicle</SelectItem><SelectItem value="2">Motor Cycle</SelectItem></SelectContent></Select></FormItem>
                          )} />
                          <FormField control={form.control} name="motor.MotorType" render={({ field }) => (
                            <FormItem><FormLabel>Motor Type</FormLabel><Select value={field.value} onValueChange={field.onChange}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="1">Registered</SelectItem><SelectItem value="2">In Transit</SelectItem></SelectContent></Select></FormItem>
                          )} />
                          <FormField control={form.control} name="motor.RegistrationNumber" render={({ field }) => (<FormItem><FormLabel>Registration</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                          <FormField control={form.control} name="motor.ChassisNumber" render={({ field }) => (<FormItem><FormLabel>Chassis Number</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                        </div>
                      )}

                      {flow === 'motor-fleet' && (
                        <div className="grid gap-4 md:grid-cols-2">
                          {(['fleetHeader.FleetId', 'fleetHeader.FleetType', 'fleetHeader.FleetSize', 'fleetHeader.ComprehensiveInsured', 'fleetHeader.SalePointCode', 'fleetHeader.CurrencyCode', 'fleetHeader.ProductCode'] as const).map((name) => (
                            <FormField key={name} control={form.control} name={name} render={({ field }) => (
                              <FormItem>
                                <FormLabel>{name}</FormLabel>
                                <FormControl><Input {...field} /></FormControl>
                                <FormMessage />
                              </FormItem>
                            )} />
                          ))}
                          <div className="md:col-span-2">
                            <SectionTitle title="Fleet entries" description="Scaffolded list of fleet members. Expand this into a table or drawer editor." />
                            <Textarea className="mt-3 min-h-32" readOnly value={JSON.stringify(form.getValues().fleetEntries, null, 2)} />
                          </div>
                        </div>
                      )}

                      {flow === 'non-motor' && (
                        <div className="space-y-4">
                          <FormField control={form.control} name="coverNoteNumber" render={({ field }) => (<FormItem><FormLabel>Cover Note Number</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                          <FormField control={form.control} name="coverNoteDesc" render={({ field }) => (<FormItem><FormLabel>Description</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>)} />
                          <FormField control={form.control} name="operativeClause" render={({ field }) => (<FormItem><FormLabel>Operative Clause</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>)} />
                        </div>
                      )}
                    </div>
                  )}

                  {step === 'risk' && (
                    <div className="space-y-6">
                      <SectionTitle title="Risks" description="Rows are stored as repeatable blocks in the TIRAMIS payload." />
                      {risks.fields.map((item, index) => (
                        <Card key={item.id}>
                          <CardContent className="grid gap-4 pt-6 md:grid-cols-2">
                            <FormField control={form.control} name={`risks.${index}.RiskCode`} render={({ field }) => (<FormItem><FormLabel>Risk Code</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>)} />
                            <FormField control={form.control} name={`risks.${index}.SumInsured`} render={({ field }) => (<FormItem><FormLabel>Sum Insured</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>)} />
                          </CardContent>
                        </Card>
                      ))}
                      <div className="flex flex-wrap gap-2">
                        <Button type="button" variant="outline" onClick={() => risks.append(createDefaultWizardValues(flow).risks[0])}>Add risk</Button>
                        <Button type="button" variant="outline" onClick={() => taxes.append({ TaxCode: '', IsTaxExempted: 'N', TaxExemptionType: '', TaxExemptionReference: '', TaxRate: '', TaxAmount: '' })}>Add tax</Button>
                        <Button type="button" variant="outline" onClick={() => subjectMatters.append({ SubjectMatterReference: '', SubjectMatterDesc: '' })}>Add subject matter</Button>
                        <Button type="button" variant="outline" onClick={() => addons.append({ AddonReference: '', AddonDesc: '', AddonAmount: '', AddonPremiumRate: '', PremiumExcludingTax: '', PremiumExcludingTaxEquivalent: '', PremiumIncludingTax: '' })}>Add addon</Button>
                      </div>
                    </div>
                  )}

                  {step === 'review' && (
                    <div className="space-y-4">
                      <SectionTitle title="Review the payload" description="This summary is what will be converted to the backend submission request." />
                      <Textarea className="min-h-[320px] font-mono text-xs" readOnly value={JSON.stringify(form.getValues(), null, 2)} />
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        <span className="text-sm text-slate-600">Draft contains {arraySummary(form.getValues()).join(' | ')}</span>
                      </div>
                    </div>
                  )}
                </div>
              </Form>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button className="w-full" variant="outline" onClick={handleValidateAndSave} disabled={submitMutation.isPending}>
                <Save className="mr-2 h-4 w-4" />
                Save Draft
              </Button>
              <Button className="w-full" variant="secondary" onClick={handleValidateAndSave} disabled={submitMutation.isPending}>
                Validate
              </Button>
              <Button className="w-full" onClick={handleSubmit} disabled={submitMutation.isPending}>
                <Send className="mr-2 h-4 w-4" />
                Submit to TIRAMIS
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Reference Data</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-slate-600">
              <p><span className="font-medium text-slate-900">Company:</span> {referenceData.companyCode || 'Not loaded'}</p>
              <p><span className="font-medium text-slate-900">Sale point:</span> {referenceData.salePointCode || 'Not loaded'}</p>
              <p><span className="font-medium text-slate-900">Callback:</span> {referenceData.callbackUrl}</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Loader2, SearchCheck } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { ErrorState, EmptyState } from '@/components/shared/ContentStates';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuthStore } from '@/modules/shared/auth/store/auth.store';
import { verificationsApi, type VerificationResult } from '../api';
import {
  coverNoteVerificationSchema,
  motorVerificationSchema,
  type CoverNoteVerificationForm,
  type MotorVerificationForm,
} from '../schemas';

function FieldError({ message }: { message?: string }) {
  return message ? <p className="text-xs text-red-600">{message}</p> : null;
}

function formatLabel(value: string) {
  return value
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function DetailValue({ value }: { value: unknown }) {
  if (value === null || value === undefined || value === '') {
    return <span className="text-slate-400">-</span>;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="text-slate-400">-</span>;
    return (
      <div className="space-y-3">
        {value.map((item, index) => (
          <div key={index} className="rounded-md border border-slate-200 p-3">
            <DetailValue value={item} />
          </div>
        ))}
      </div>
    );
  }

  if (typeof value === 'object') {
    return (
      <div className="overflow-hidden rounded-md border border-slate-200">
        {Object.entries(value as Record<string, unknown>).map(
          ([key, childValue]) => (
            <div
              key={key}
              className="grid gap-2 border-b border-slate-100 p-3 last:border-0 sm:grid-cols-[minmax(10rem,0.8fr)_minmax(0,2fr)]"
            >
              <p className="font-medium text-slate-600">{formatLabel(key)}</p>
              <div className="min-w-0 break-words text-slate-800">
                <DetailValue value={childValue} />
              </div>
            </div>
          ),
        )}
      </div>
    );
  }

  return <span>{String(value)}</span>;
}

type FriendlyField = {
  label: string;
  value: string | null;
};

type FriendlySection = {
  title: string;
  fields: FriendlyField[];
};

const motorDetailOrder = [
  'RegistrationNumber',
  'ChassisNumber',
  'Make',
  'Model',
  'ModelNumber',
  'BodyType',
  'Color',
  'EngineNumber',
  'EngineCapacity',
  'FuelUsed',
  'NumberOfAxles',
  'SittingCapacity',
  'YearOfManufacture',
  'TareWeight',
  'GrossWeight',
  'MotorUsage',
  'OwnerName',
  'OwnerCategory',
];

const coverNoteDetailOrder = [
  'CoverNoteTypeDesc',
  'CoverNoteNumber',
  'CoverNoteReferenceNumber',
  'InsurerCompanyCode',
  'InsurerCompanyName',
  'TransactionCompanyCode',
  'TransactionCompanyName',
  'CoverNoteIssueDate',
  'CoverNoteStartDate',
  'CoverNoteEndDate',
  'CoverNoteDesc',
  'OperativeClause',
  'CurrencyCode',
  'TotalPremiumExcludingTax',
  'TotalPremiumIncludingTax',
  'CommisionPaid',
  'CommisionRate',
  'ProductCode',
  'ProductName',
];

const riskCoveredOrder = [
  'RiskCode',
  'RiskName',
  'SumInsured',
  'PremiumRate',
  'PremiumBeforeDiscount',
  'PremiumAfterDiscount',
  'PremiumIncludingTax',
];

const taxChargedOrder = ['TaxCode', 'TaxRate', 'TaxAmount'];

const subjectMatterOrder = [
  'SubjectMatterReference',
  'SubjectMatterDesc',
  'SumInsured',
  'PremiumRate',
  'PremiumIncludingTax',
];

const policyHolderOrder = [
  'PolicyHolderName',
  'PolicyHolderBirthDate',
  'PolicyHolderType',
  'PolicyHolderIdType',
  'PolicyHolderIdNumber',
  'Gender',
  'CountryCode',
  'Region',
  'District',
  'Street',
  'Address',
  'MobileNumber',
  'EmailAddress',
];

const addonOrder = [
  'AddonCode',
  'AddonName',
  'AddonDesc',
  'SumInsured',
  'PremiumRate',
  'PremiumIncludingTax',
];

function directChild(element: Element, tagName: string) {
  return Array.from(element.children).find(
    (child) => child.tagName === tagName,
  );
}

function directChildren(element: Element, tagName: string) {
  return Array.from(element.children).filter(
    (child) => child.tagName === tagName,
  );
}

function directText(element: Element, tagName: string) {
  const child = directChild(element, tagName);
  return child?.textContent?.trim() || null;
}

function fieldsFromElement(element: Element, preferredOrder: string[]) {
  const ordered = preferredOrder.map((tagName) => ({
    label: formatLabel(tagName),
    value: directChild(element, tagName)
      ? directText(element, tagName) || 'N/A'
      : null,
  }));
  const orderedTags = new Set(preferredOrder);
  const extra = Array.from(element.children)
    .filter(
      (child) => child.children.length === 0 && !orderedTags.has(child.tagName),
    )
    .map((child) => ({
      label: formatLabel(child.tagName),
      value: child.textContent?.trim() || 'N/A',
    }));

  return [...ordered, ...extra].filter((field) => field.value !== null);
}

function sectionsFromChildren(params: {
  parent: Element;
  containerTag: string;
  itemTag: string;
  title: string;
  preferredOrder: string[];
}) {
  const container = directChild(params.parent, params.containerTag);
  if (!container) return [];

  return directChildren(container, params.itemTag)
    .map((item, index) => ({
      title: `${params.title}${index > 0 ? ` ${index + 1}` : ''}`,
      fields: fieldsFromElement(item, params.preferredOrder),
    }))
    .filter((section) => section.fields.length > 0);
}

function parseFriendlyXmlDetails(xml: string | null): FriendlySection[] {
  if (!xml) return [];

  const document = new DOMParser().parseFromString(xml, 'application/xml');
  if (document.querySelector('parsererror')) return [];

  const sections: FriendlySection[] = [];
  const verificationDetail = document.querySelector('VerificationDtl');
  if (verificationDetail) {
    sections.push({
      title: 'Vehicle verification details',
      fields: fieldsFromElement(verificationDetail, motorDetailOrder),
    });
  }

  const coverNoteDetail = document.querySelector('CoverNoteDtl');
  if (coverNoteDetail) {
    sections.push({
      title: 'Cover note details',
      fields: fieldsFromElement(coverNoteDetail, coverNoteDetailOrder),
    });

    const motorDetail = directChild(coverNoteDetail, 'MotorDtl');
    if (motorDetail) {
      sections.push({
        title: 'Vehicle details',
        fields: fieldsFromElement(motorDetail, motorDetailOrder),
      });
    }

    const riskSections = sectionsFromChildren({
      parent: coverNoteDetail,
      containerTag: 'RisksCovered',
      itemTag: 'RiskCovered',
      title: 'Risk covered',
      preferredOrder: riskCoveredOrder,
    });
    sections.push(...riskSections);

    riskSections.forEach((_riskSection, index) => {
      const risksContainer = directChild(coverNoteDetail, 'RisksCovered');
      const risk = risksContainer
        ? directChildren(risksContainer, 'RiskCovered')[index]
        : null;
      if (!risk) return;

      sections.push(
        ...sectionsFromChildren({
          parent: risk,
          containerTag: 'TaxesCharged',
          itemTag: 'TaxCharged',
          title: `Tax charged${index > 0 ? ` for risk ${index + 1}` : ''}`,
          preferredOrder: taxChargedOrder,
        }),
      );
    });

    sections.push(
      ...sectionsFromChildren({
        parent: coverNoteDetail,
        containerTag: 'SubjectMattersCovered',
        itemTag: 'SubjectMatter',
        title: 'Subject matter',
        preferredOrder: subjectMatterOrder,
      }),
      ...sectionsFromChildren({
        parent: coverNoteDetail,
        containerTag: 'PolicyHolders',
        itemTag: 'PolicyHolder',
        title: 'Policy holder',
        preferredOrder: policyHolderOrder,
      }),
      ...sectionsFromChildren({
        parent: coverNoteDetail,
        containerTag: 'CoverNoteAddons',
        itemTag: 'CoverNoteAddon',
        title: 'Cover note addon',
        preferredOrder: addonOrder,
      }),
    );
  }

  return sections.filter((section) => section.fields.length > 0);
}

function FriendlyDetails({ sections }: { sections: FriendlySection[] }) {
  return (
    <div className="space-y-4">
      {sections.map((section, index) => (
        <div key={`${section.title}-${index}`}>
          <p className="mb-2 text-sm font-medium">{section.title}</p>
          <div className="overflow-hidden rounded-md border border-slate-200">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50 hover:bg-slate-50">
                  <TableHead className="w-64">Field</TableHead>
                  <TableHead>Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {section.fields.map((field) => (
                  <TableRow key={`${section.title}-${field.label}`}>
                    <TableCell className="py-3 font-medium text-slate-600">
                      {field.label}
                    </TableCell>
                    <TableCell className="py-3 break-words text-slate-900">
                      {field.value || '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      ))}
    </div>
  );
}

function getErrorMessage(error: unknown) {
  if (typeof error === 'object' && error !== null) {
    const response = (error as { response?: { data?: { message?: unknown } } })
      .response;
    if (typeof response?.data?.message === 'string') {
      return response.data.message;
    }

    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string') {
      return message;
    }
  }

  return 'Verification failed. Please retry.';
}

function Result({ result }: { result: VerificationResult }) {
  const response = result.verifiedRecordDetails as {
    responseHeader?: Record<string, unknown> | null;
    details?: Record<string, unknown> | null;
    responseDetails?: Record<string, unknown> | null;
  } | null;
  const details =
    response?.details ??
    response?.responseDetails ??
    result.verifiedRecordDetails;
  const xml =
    result.xml ??
    (typeof result.fullResponse?.xml === 'string'
      ? result.fullResponse.xml
      : null);
  const friendlySections = parseFriendlyXmlDetails(xml);

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {result.verificationType === 'MOTOR'
            ? 'Motor verification details'
            : 'Cover note verification details'}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {friendlySections.length > 0 ? (
          <FriendlyDetails sections={friendlySections} />
        ) : details ? (
          <div>
            <p className="mb-2 text-sm font-medium">Verified record details</p>
            <DetailValue value={details} />
          </div>
        ) : (
          <EmptyState
            title={
              result.responseCode === 'TIRA007'
                ? 'No matching record found'
                : 'No verified record details'
            }
            description={
              result.responseMessage ||
              'TIRAMIS returned a response without record details.'
            }
          />
        )}
      </CardContent>
    </Card>
  );
}

export function VerificationsPage() {
  const permissions = useAuthStore((state) => state.user?.permissions ?? []);
  const canMotor = permissions.includes('verifications:motor:submit');
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState(canMotor ? 'motor' : 'cover-note');
  const motor = useForm<MotorVerificationForm>({
    resolver: zodResolver(motorVerificationSchema),
    defaultValues: {
      motorCategory: '1',
      motorRegistrationNumber: '',
      motorChassisNumber: '',
    },
  });
  const cover = useForm<CoverNoteVerificationForm>({
    resolver: zodResolver(coverNoteVerificationSchema),
    defaultValues: {
      coverNoteReferenceNumber: '',
      stickerNumber: '',
      motorRegistrationNumber: '',
      motorChassisNumber: '',
    },
  });
  const coverNoteFields: Array<{
    name: keyof CoverNoteVerificationForm;
    label: string;
    placeholder: string;
  }> = [
    {
      name: 'coverNoteReferenceNumber',
      label: 'Cover note reference number',
      placeholder: 'TIRA-CN-000001',
    },
    {
      name: 'stickerNumber',
      label: 'Sticker number',
      placeholder: 'STK000001',
    },
    {
      name: 'motorRegistrationNumber',
      label: 'Motor registration number',
      placeholder: 'T123ABC',
    },
    {
      name: 'motorChassisNumber',
      label: 'Motor chassis number',
      placeholder: 'Chassis number',
    },
  ];
  const pending = motor.formState.isSubmitting || cover.formState.isSubmitting;

  async function submitMotor(values: MotorVerificationForm) {
    setError(null);
    setResult(null);
    try {
      setResult(
        await verificationsApi.motor({
          motorCategory: Number(values.motorCategory) as 1 | 2,
          motorRegistrationNumber: values.motorRegistrationNumber || undefined,
          motorChassisNumber: values.motorChassisNumber || undefined,
        }),
      );
    } catch (error: unknown) {
      setError(getErrorMessage(error));
    }
  }

  async function submitCover(values: CoverNoteVerificationForm) {
    setError(null);
    setResult(null);
    try {
      setResult(
        await verificationsApi.coverNote(
          Object.fromEntries(
            Object.entries(values).map(([key, value]) => [
              key,
              value || undefined,
            ]),
          ),
        ),
      );
    } catch (error: unknown) {
      setError(getErrorMessage(error));
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Verifications"
        description="Verify motor and cover note records against TIRAMIS."
        breadcrumbs={['Operations', 'Verifications']}
      />
      <Tabs
        value={activeTab}
        onValueChange={(value) => {
          setActiveTab(value);
          setError(null);
        }}
      >
        <TabsList>
          <TabsTrigger value="motor">Motor Verification</TabsTrigger>
          <TabsTrigger value="cover-note">Cover Note Verification</TabsTrigger>
        </TabsList>
        <TabsContent value="motor">
          <Card>
            <CardHeader>
              <CardTitle>Motor verification</CardTitle>
            </CardHeader>
            <CardContent>
              <form
                className="grid gap-4 md:grid-cols-2"
                onSubmit={motor.handleSubmit(submitMotor)}
              >
                <div>
                  <Label>Motor category</Label>
                  <Select
                    value={motor.watch('motorCategory')}
                    onValueChange={(value) =>
                      motor.setValue('motorCategory', value as '1' | '2')
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">Motor vehicle</SelectItem>
                      <SelectItem value="2">Motorcycle</SelectItem>
                    </SelectContent>
                  </Select>
                  <FieldError
                    message={motor.formState.errors.motorCategory?.message}
                  />
                </div>
                <div>
                  <Label>Registration number</Label>
                  <Input
                    placeholder="T123ABC"
                    {...motor.register('motorRegistrationNumber')}
                  />
                  <FieldError
                    message={
                      motor.formState.errors.motorRegistrationNumber?.message
                    }
                  />
                </div>
                <div>
                  <Label>Chassis number</Label>
                  <Input
                    placeholder="Chassis number"
                    {...motor.register('motorChassisNumber')}
                  />
                  <FieldError
                    message={motor.formState.errors.motorChassisNumber?.message}
                  />
                </div>
                <div className="flex items-end">
                  <Button disabled={pending} type="submit">
                    {pending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <SearchCheck className="mr-2 h-4 w-4" />
                    )}
                    {pending ? 'Verifying...' : 'Verify motor'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="cover-note">
          <Card>
            <CardHeader>
              <CardTitle>Cover note verification</CardTitle>
            </CardHeader>
            <CardContent>
              <form
                className="grid gap-4 md:grid-cols-2"
                onSubmit={cover.handleSubmit(submitCover)}
              >
                {coverNoteFields.map(({ name, label, placeholder }) => (
                  <div key={name}>
                    <Label>{label}</Label>
                    <Input
                      placeholder={placeholder}
                      {...cover.register(name)}
                    />
                    <FieldError
                      message={cover.formState.errors[name]?.message}
                    />
                  </div>
                ))}
                <div className="flex items-end">
                  <Button disabled={pending} type="submit">
                    {pending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <SearchCheck className="mr-2 h-4 w-4" />
                    )}
                    {pending ? 'Verifying...' : 'Verify cover note'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      {error && (
        <Card className="border-red-200">
          <CardContent className="pt-6">
            <ErrorState
              title="Verification failed"
              description={error}
              onRetry={() =>
                activeTab === 'motor'
                  ? motor.handleSubmit(submitMotor)()
                  : cover.handleSubmit(submitCover)()
              }
            />
          </CardContent>
        </Card>
      )}
      {!error && !result && (
        <Card>
          <CardContent className="pt-6">
            <EmptyState
              title="No verification yet"
              description="Submit one of the forms to see the TIRAMIS verification result here."
            />
          </CardContent>
        </Card>
      )}
      {result && <Result result={result} />}
    </div>
  );
}

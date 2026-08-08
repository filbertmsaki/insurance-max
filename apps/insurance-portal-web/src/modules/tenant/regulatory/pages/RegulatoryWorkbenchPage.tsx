import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarClock, FileCheck2, Landmark, Scale } from 'lucide-react';

import { PageHeader } from '@/components/shared/PageHeader';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { phase16Api } from '../../phase16/api/phase16';

const currentYear = 2026;

function formatJson(value: unknown) {
  return JSON.stringify(value ?? {}, null, 2);
}

export function RegulatoryWorkbenchPage() {
  const queryClient = useQueryClient();
  const calendarQuery = useQuery({
    queryKey: ['phase16', 'regulatory', 'calendar'],
    queryFn: phase16Api.getRegulatoryCalendar,
  });
  const returnsQuery = useQuery({
    queryKey: ['phase16', 'regulatory', 'returns'],
    queryFn: phase16Api.getRegulatoryReturns,
  });
  const leviesQuery = useQuery({
    queryKey: ['phase16', 'regulatory', 'levies'],
    queryFn: phase16Api.getLevyAssessments,
  });
  const authoritiesQuery = useQuery({
    queryKey: ['phase16', 'regulatory', 'authorities'],
    queryFn: phase16Api.getAuthorities,
  });

  const [selectedReturnId, setSelectedReturnId] = useState('');
  const [submissionChannel, setSubmissionChannel] = useState('PORTAL');
  const [submissionReference, setSubmissionReference] = useState('');
  const [evidenceDocumentId, setEvidenceDocumentId] = useState('');
  const [ackReference, setAckReference] = useState('');
  const [ackCode, setAckCode] = useState('');
  const [ackMessage, setAckMessage] = useState('');

  const selectedReturn = useMemo(() => {
    return (
      returnsQuery.data?.find((record) => record.id === selectedReturnId) ??
      null
    );
  }, [returnsQuery.data, selectedReturnId]);

  const returnDetailQuery = useQuery({
    queryKey: ['phase16', 'regulatory', 'return', selectedReturnId],
    queryFn: () => phase16Api.getRegulatoryReturn(selectedReturnId),
    enabled: selectedReturnId.length > 0,
  });

  useEffect(() => {
    if (!selectedReturnId && returnsQuery.data?.length) {
      setSelectedReturnId(returnsQuery.data[0].id);
    }
  }, [returnsQuery.data, selectedReturnId]);

  const refreshRegulatoryViews = () => {
    queryClient.invalidateQueries({
      queryKey: ['phase16', 'regulatory', 'calendar'],
    });
    queryClient.invalidateQueries({
      queryKey: ['phase16', 'regulatory', 'returns'],
    });
    queryClient.invalidateQueries({
      queryKey: ['phase16', 'regulatory', 'levies'],
    });
    queryClient.invalidateQueries({
      queryKey: ['phase16', 'regulatory', 'return', selectedReturnId],
    });
  };

  const generateCalendarMutation = useMutation({
    mutationFn: () => phase16Api.generateRegulatoryCalendar(currentYear),
    onSuccess: refreshRegulatoryViews,
  });

  const returnActionMutation = useMutation({
    mutationFn: async (
      action:
        | 'validate'
        | 'reconcile'
        | 'submit-review'
        | 'approve'
        | 'correction',
    ) => {
      if (!selectedReturnId) {
        throw new Error('Select a regulatory return first');
      }

      switch (action) {
        case 'validate':
          return phase16Api.validateReturn(selectedReturnId);
        case 'reconcile':
          return phase16Api.reconcileReturn(selectedReturnId);
        case 'submit-review':
          return phase16Api.submitReturnForReview(selectedReturnId);
        case 'approve':
          return phase16Api.approveReturn(selectedReturnId);
        case 'correction':
          return phase16Api.createReturnCorrection(selectedReturnId);
      }
    },
    onSuccess: refreshRegulatoryViews,
  });

  const recordSubmissionMutation = useMutation({
    mutationFn: () => {
      if (!selectedReturnId) {
        throw new Error('Select a regulatory return first');
      }

      return phase16Api.recordSubmission(selectedReturnId, {
        submission_channel: submissionChannel,
        submission_reference: submissionReference || undefined,
        evidence_document_id: evidenceDocumentId || undefined,
        acknowledgement_reference: ackReference || undefined,
        acknowledgement_code: ackCode || undefined,
        acknowledgement_message: ackMessage || undefined,
      });
    },
    onSuccess: () => {
      refreshRegulatoryViews();
      setSubmissionReference('');
      setEvidenceDocumentId('');
      setAckReference('');
      setAckCode('');
      setAckMessage('');
    },
  });

  const activeReturn = returnDetailQuery.data ?? selectedReturn;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Phase 16"
        title="Regulatory Compliance"
        description="Monitor obligation periods, review return versions, and keep levy assessments and submission evidence in one company-scoped workspace."
        action={
          <Button
            variant="outline"
            onClick={() => generateCalendarMutation.mutate()}
            disabled={generateCalendarMutation.isPending}
          >
            <CalendarClock className="mr-2 h-4 w-4" />
            {generateCalendarMutation.isPending
              ? `Generating ${currentYear}...`
              : `Generate ${currentYear} calendar`}
          </Button>
        }
      />

      <Tabs defaultValue="calendar" className="space-y-4">
        <TabsList>
          <TabsTrigger value="calendar">Calendar</TabsTrigger>
          <TabsTrigger value="returns">Returns</TabsTrigger>
          <TabsTrigger value="levies">Levies</TabsTrigger>
          <TabsTrigger value="authorities">Authorities</TabsTrigger>
        </TabsList>

        <TabsContent value="calendar">
          <Card className="rounded-xl border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <CalendarClock className="h-4 w-4 text-blue-600" />
                Obligation Calendar
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Obligation</TableHead>
                    <TableHead>Authority</TableHead>
                    <TableHead>Period</TableHead>
                    <TableHead>Due</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Days remaining</TableHead>
                    <TableHead>Return</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(calendarQuery.data ?? []).map((record) => (
                    <TableRow key={record.id}>
                      <TableCell>
                        <div className="space-y-1">
                          <p className="font-medium text-slate-900">
                            {record.definition?.obligation_name ??
                              record.obligation_reference}
                          </p>
                          <p className="text-xs text-slate-500">
                            {record.definition?.obligation_code}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        {record.authority?.authority_name ?? '—'}
                      </TableCell>
                      <TableCell>
                        {record.period_start} to {record.period_end}
                      </TableCell>
                      <TableCell>{record.due_at}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{record.status}</Badge>
                      </TableCell>
                      <TableCell>{record.days_remaining ?? '—'}</TableCell>
                      <TableCell>
                        {record.active_return?.return_no ?? 'Not created'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="returns" className="space-y-6">
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_420px]">
            <Card className="rounded-xl border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <FileCheck2 className="h-4 w-4 text-blue-600" />
                  Regulatory Returns
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Return</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Reconciliation</TableHead>
                      <TableHead>Due date</TableHead>
                      <TableHead>Version</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(returnsQuery.data ?? []).map((record) => (
                      <TableRow
                        key={record.id}
                        className={
                          record.id === selectedReturnId
                            ? 'bg-slate-50'
                            : undefined
                        }
                        onClick={() => setSelectedReturnId(record.id)}
                      >
                        <TableCell>
                          <div className="space-y-1">
                            <p className="font-medium text-slate-900">
                              {record.return_no}
                            </p>
                            <p className="text-xs text-slate-500">
                              {record.report_definition_code ??
                                record.return_code ??
                                'Registered report'}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>{record.status}</TableCell>
                        <TableCell>{record.reconciliation_status}</TableCell>
                        <TableCell>{record.due_at ?? '—'}</TableCell>
                        <TableCell>{record.version_number}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card className="rounded-xl border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">Return Detail</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {activeReturn ? (
                  <>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-slate-500">Status</p>
                        <p className="font-medium text-slate-900">
                          {activeReturn.status}
                        </p>
                      </div>
                      <div>
                        <p className="text-slate-500">Reconciliation</p>
                        <p className="font-medium text-slate-900">
                          {activeReturn.reconciliation_status}
                        </p>
                      </div>
                      <div>
                        <p className="text-slate-500">Due date</p>
                        <p className="font-medium text-slate-900">
                          {activeReturn.due_at ??
                            activeReturn.obligation_instance?.due_at ??
                            '—'}
                        </p>
                      </div>
                      <div>
                        <p className="text-slate-500">Source cutoff</p>
                        <p className="font-medium text-slate-900">
                          {activeReturn.source_cutoff_at ?? 'Pending'}
                        </p>
                      </div>
                    </div>

                    {activeReturn.read_only && (
                      <Alert>
                        <AlertTitle>Submitted returns are read-only</AlertTitle>
                        <AlertDescription>
                          This version is locked for editing. Corrections create
                          version N + 1.
                        </AlertDescription>
                      </Alert>
                    )}

                    <div className="grid gap-2 sm:grid-cols-2">
                      <Button
                        variant="outline"
                        disabled={
                          returnActionMutation.isPending ||
                          activeReturn.read_only
                        }
                        onClick={() => returnActionMutation.mutate('validate')}
                      >
                        Validate
                      </Button>
                      <Button
                        variant="outline"
                        disabled={
                          returnActionMutation.isPending ||
                          activeReturn.read_only
                        }
                        onClick={() => returnActionMutation.mutate('reconcile')}
                      >
                        Reconcile
                      </Button>
                      <Button
                        variant="outline"
                        disabled={
                          returnActionMutation.isPending ||
                          activeReturn.read_only
                        }
                        onClick={() =>
                          returnActionMutation.mutate('submit-review')
                        }
                      >
                        Submit for review
                      </Button>
                      <Button
                        variant="outline"
                        disabled={
                          returnActionMutation.isPending ||
                          activeReturn.read_only
                        }
                        onClick={() => returnActionMutation.mutate('approve')}
                      >
                        Approve
                      </Button>
                      <Button
                        className="sm:col-span-2"
                        disabled={returnActionMutation.isPending}
                        onClick={() =>
                          returnActionMutation.mutate('correction')
                        }
                      >
                        Create correction version
                      </Button>
                    </div>

                    <div className="rounded-lg border border-slate-200 p-4">
                      <p className="text-sm font-medium text-slate-900">
                        Submission evidence
                      </p>
                      <div className="mt-4 space-y-3">
                        <div className="space-y-2">
                          <Label htmlFor="submission-channel">
                            Submission channel
                          </Label>
                          <Input
                            id="submission-channel"
                            value={submissionChannel}
                            onChange={(event) =>
                              setSubmissionChannel(event.target.value)
                            }
                            disabled={activeReturn.read_only}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="submission-reference">
                            Submission reference
                          </Label>
                          <Input
                            id="submission-reference"
                            value={submissionReference}
                            onChange={(event) =>
                              setSubmissionReference(event.target.value)
                            }
                            disabled={activeReturn.read_only}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="evidence-id">
                            Evidence document reference
                          </Label>
                          <Input
                            id="evidence-id"
                            value={evidenceDocumentId}
                            onChange={(event) =>
                              setEvidenceDocumentId(event.target.value)
                            }
                            disabled={activeReturn.read_only}
                          />
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="space-y-2">
                            <Label htmlFor="ack-reference">
                              Acknowledgement reference
                            </Label>
                            <Input
                              id="ack-reference"
                              value={ackReference}
                              onChange={(event) =>
                                setAckReference(event.target.value)
                              }
                              disabled={activeReturn.read_only}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="ack-code">
                              Acknowledgement code
                            </Label>
                            <Input
                              id="ack-code"
                              value={ackCode}
                              onChange={(event) =>
                                setAckCode(event.target.value)
                              }
                              disabled={activeReturn.read_only}
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="ack-message">
                            Acknowledgement message
                          </Label>
                          <Input
                            id="ack-message"
                            value={ackMessage}
                            onChange={(event) =>
                              setAckMessage(event.target.value)
                            }
                            disabled={activeReturn.read_only}
                          />
                        </div>
                        <Button
                          className="w-full"
                          disabled={
                            recordSubmissionMutation.isPending ||
                            activeReturn.read_only
                          }
                          onClick={() => recordSubmissionMutation.mutate()}
                        >
                          Record submission
                        </Button>
                      </div>
                    </div>

                    <div className="rounded-lg border border-slate-200 p-4">
                      <p className="text-sm font-medium text-slate-900">
                        Timeline and versions
                      </p>
                      <div className="mt-3 space-y-2">
                        {activeReturn.versions.map((version) => (
                          <div
                            key={version.id}
                            className="flex items-center justify-between text-sm"
                          >
                            <span>
                              {version.return_no} v{version.version_number}
                            </span>
                            <Badge variant="outline">{version.status}</Badge>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-lg border border-slate-200 p-4">
                      <p className="text-sm font-medium text-slate-900">
                        Validation and reconciliation
                      </p>
                      <pre className="mt-2 overflow-auto text-xs text-slate-600">
                        {formatJson({
                          validation_results: activeReturn.validation_results,
                          reconciliation_summary:
                            activeReturn.reconciliation_summary,
                        })}
                      </pre>
                    </div>

                    <div className="rounded-lg border border-slate-200 p-4">
                      <p className="text-sm font-medium text-slate-900">
                        Submissions
                      </p>
                      <div className="mt-3 space-y-3">
                        {activeReturn.submissions.length > 0 ? (
                          activeReturn.submissions.map((submission) => (
                            <div
                              key={submission.id}
                              className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-sm"
                            >
                              <div className="flex items-center justify-between gap-4">
                                <span className="font-medium text-slate-900">
                                  {submission.submission_no}
                                </span>
                                <Badge variant="outline">
                                  {submission.status}
                                </Badge>
                              </div>
                              <p className="mt-1 text-slate-600">
                                {submission.submission_channel} |{' '}
                                {submission.submitted_at}
                              </p>
                            </div>
                          ))
                        ) : (
                          <p className="text-sm text-slate-500">
                            No submission evidence recorded yet.
                          </p>
                        )}
                      </div>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-slate-500">
                    Select a return to inspect the lifecycle, evidence,
                    versions, validation, and reconciliation state.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="levies">
          <Card className="rounded-xl border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Scale className="h-4 w-4 text-blue-600" />
                Levy Assessments
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Assessment</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Assessed</TableHead>
                    <TableHead>Paid</TableHead>
                    <TableHead>Outstanding</TableHead>
                    <TableHead>Reconciliation</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(leviesQuery.data ?? []).map((assessment) => (
                    <TableRow key={assessment.id}>
                      <TableCell>{assessment.assessment_no}</TableCell>
                      <TableCell>{assessment.status}</TableCell>
                      <TableCell>
                        {assessment.currency_code} {assessment.assessed_amount}
                      </TableCell>
                      <TableCell>
                        {assessment.currency_code} {assessment.paid_amount}
                      </TableCell>
                      <TableCell>
                        {assessment.currency_code}{' '}
                        {assessment.outstanding_amount}
                      </TableCell>
                      <TableCell>{assessment.reconciliation_status}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="authorities">
          <Card className="rounded-xl border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Landmark className="h-4 w-4 text-blue-600" />
                Authority Profiles
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Authority</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Jurisdiction</TableHead>
                    <TableHead>Registration</TableHead>
                    <TableHead>Submission channel</TableHead>
                    <TableHead>Contact</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(authoritiesQuery.data ?? []).map((authority) => (
                    <TableRow key={authority.id}>
                      <TableCell>
                        <div className="space-y-1">
                          <p className="font-medium text-slate-900">
                            {authority.authority_name}
                          </p>
                          <p className="text-xs text-slate-500">
                            {authority.authority_code}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>{authority.authority_type}</TableCell>
                      <TableCell>{authority.jurisdiction_code}</TableCell>
                      <TableCell>
                        {authority.registration_reference ?? '—'}
                      </TableCell>
                      <TableCell>
                        {authority.submission_channel ?? '—'}
                      </TableCell>
                      <TableCell>{authority.contact_email ?? '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

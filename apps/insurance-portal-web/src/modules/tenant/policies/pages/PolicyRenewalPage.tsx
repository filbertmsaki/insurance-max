import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CheckCircle2, FileText, Send } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { getApiErrorMessage } from '@/lib/api-error';
import { policyKeys, useRenewalContext } from '../hooks';
import { usePolicyTransactionScope } from '../transaction-scope';

function Row({
  label,
  value,
}: {
  label: string;
  value: string | number | null | undefined;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-100 py-2 last:border-b-0">
      <span className="text-sm text-slate-500">{label}</span>
      <span className="max-w-[60%] text-right text-sm font-medium text-slate-900">
        {value ?? ' - '}
      </span>
    </div>
  );
}

export function PolicyRenewalPage() {
  const { policyId, renewalId } = useParams<{
    policyId: string;
    renewalId: string;
  }>();
  const navigate = useNavigate();
  const { api, paths } = usePolicyTransactionScope();
  const queryClient = useQueryClient();
  const { data: context } = useRenewalContext(renewalId);
  const renewal = context?.renewal;
  const quotation = context?.renewal_quotation;

  const refresh = () => {
    if (renewalId) {
      queryClient.invalidateQueries({
        queryKey: policyKeys.renewalContext(renewalId),
      });
    }
  };
  const createOffer = useMutation({
    mutationFn: () => api.createRenewalOffer(renewalId!),
    onSuccess: (created: { id: string }) => {
      refresh();
      navigate(paths.quotationWizardEdit(created.id));
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });
  const sendOffer = useMutation({
    mutationFn: () => api.sendRenewalOffer(renewalId!),
    onSuccess: () => {
      refresh();
      toast.success('Renewal offer sent');
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });
  const accept = useMutation({
    mutationFn: () => api.acceptRenewal(renewalId!),
    onSuccess: () => {
      refresh();
      toast.success('Customer acceptance recorded');
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });
  const decline = useMutation({
    mutationFn: () =>
      api.declineRenewal(renewalId!, 'Customer declined renewal offer'),
    onSuccess: () => {
      refresh();
      toast.success('Customer decline recorded');
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => {
            if (policyId) {
              navigate(paths.policyDetail(policyId));
              return;
            }
            navigate(-1);
          }}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-xl font-semibold text-slate-900">
            Policy Renewal
          </h1>
          <p className="text-sm text-slate-500">{renewal?.renewal_no}</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Renewal Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <Row label="Policy" value={context?.source_policy?.policy_no} />
            <Row
              label="Current Cover Note"
              value={renewal?.source_cover_note_reference}
            />
            <Row
              label="Current Expiry"
              value={context?.source_policy?.end_date}
            />
            <Row
              label="Renewal Period"
              value={
                renewal
                  ? `${renewal.renewal_start_date} to ${renewal.renewal_end_date}`
                  : null
              }
            />
            <Row label="Status" value={renewal?.renewal_status} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Renewal Offer</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {quotation ? (
              <>
                <Row label="Quotation" value={quotation.quotation_no} />
                <Row label="Quotation Status" value={quotation.status} />
                <Row
                  label="Payment"
                  value={
                    quotation.payment_status_v2 ?? quotation.payment_status
                  }
                />
                <Button
                  variant="outline"
                  onClick={() =>
                    navigate(paths.quotationWizardEdit(quotation.id))
                  }
                >
                  <FileText className="mr-1.5 h-3.5 w-3.5" />
                  View Renewal Quotation
                </Button>
              </>
            ) : (
              <Button
                disabled={createOffer.isPending}
                onClick={() => createOffer.mutate()}
              >
                Prepare Renewal Offer
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-base">
            Renewal Issuance
            {renewal?.renewal_status && (
              <StatusBadge status={renewal.renewal_status} />
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertTitle>Renewal Uses Standard Quotation Issuance</AlertTitle>
            <AlertDescription>
              The generated quotation carries CoverNoteType 2 and the previous
              cover-note reference. Approval, payment, and TIRAMIS issuance stay
              in the normal quotation workflow.
            </AlertDescription>
          </Alert>

          {renewal?.renewal_status === 'RENEWED' ? (
            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertTitle>Renewal Issued</AlertTitle>
              <AlertDescription>
                New policy: {renewal.renewed_policy_id ?? '-'}.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="flex flex-wrap gap-2">
              {quotation && (
                <Button
                  variant="outline"
                  disabled={sendOffer.isPending}
                  onClick={() => sendOffer.mutate()}
                >
                  <Send className="mr-1.5 h-3.5 w-3.5" />
                  Send Renewal Offer
                </Button>
              )}
              {renewal?.renewal_status === 'OFFER_SENT' && (
                <>
                  <Button
                    disabled={accept.isPending}
                    onClick={() => accept.mutate()}
                  >
                    Record Customer Acceptance
                  </Button>
                  <Button
                    variant="outline"
                    disabled={decline.isPending}
                    onClick={() => decline.mutate()}
                  >
                    Customer Declined
                  </Button>
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

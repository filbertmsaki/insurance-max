import { useNavigate } from 'react-router-dom';
import { ArrowRight, FileText, Play, Radar, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { PageHeader } from '@/components/shared/PageHeader';
import { underwritingPaths } from '../paths';

const workflowSteps = [
  {
    title: '1. Create the quotation',
    description: 'Capture the customer, product, risk, and premium data first.',
    action: underwritingPaths.quotationCreate,
    icon: FileText,
  },
  {
    title: '2. Submit to TIRAMIS',
    description: 'The quotation is handed off immediately after creation.',
    action: underwritingPaths.submissions,
    icon: Play,
  },
  {
    title: '3. Continue underwriting',
    description: 'Manage Motor and Non-Motor follow-up work in one place.',
    action: underwritingPaths.policies,
    icon: ShieldCheck,
  },
] as const;

const underwritingSections = [
  {
    title: 'Quotations',
    description: 'Start here to create, review, and submit quotations.',
    to: underwritingPaths.quotations,
  },
  {
    title: 'Policies',
    description: 'Track policy conversion and downstream policy records.',
    to: underwritingPaths.policies,
  },
  {
    title: 'Submission Tracking',
    description: 'See the TIRAMIS handoff and submission lifecycle.',
    to: underwritingPaths.submissions,
  },
  {
    title: 'Motor / Non-Motor Setup',
    description: 'Keep underwriting-specific motor and subject matter records together.',
    to: underwritingPaths.motorVehicles,
  },
] as const;

export function UnderwritingHomePage() {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Underwriting"
        description="A single workflow for quotation creation, TIRAMIS submission, and Motor / Non-Motor processing"
      />

      <Card className="border-slate-200 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-white shadow-xl">
        <CardContent className="grid gap-6 p-6 lg:grid-cols-[1.2fr_0.8fr] lg:p-8">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-slate-200">
              <Radar className="h-3.5 w-3.5" />
              New workflow entry point
            </div>
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Quotations first. TIRAMIS next. Underwriting owns the rest.
            </h2>
            <p className="max-w-2xl text-sm leading-6 text-slate-300">
              This view removes the duplicate Motor and Non-Motor top-level menus and keeps all
              underwriting actions under one workflow so users do not repeat review work in multiple places.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button onClick={() => navigate(underwritingPaths.quotationCreate)}>
                Create Quotation
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                className="border-white/15 bg-white/5 text-white hover:bg-white/10"
                onClick={() => navigate(underwritingPaths.submissions)}
              >
                Open Submission Tracking
              </Button>
            </div>
          </div>

          <div className="grid gap-3">
            {workflowSteps.map((step) => (
              <button
                key={step.title}
                type="button"
                onClick={() => navigate(step.action)}
                className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 text-left transition-colors hover:bg-white/10"
              >
                <div className="rounded-xl bg-white/10 p-2">
                  <step.icon className="h-4 w-4" />
                </div>
                <div className="space-y-1">
                  <div className="text-sm font-semibold">{step.title}</div>
                  <div className="text-xs leading-5 text-slate-300">{step.description}</div>
                </div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {underwritingSections.map((section) => (
          <Card key={section.title} className="border-slate-200">
            <CardContent className="flex h-full flex-col justify-between gap-4 p-5">
              <div className="space-y-1">
                <h3 className="text-base font-semibold text-slate-900">{section.title}</h3>
                <p className="text-sm text-slate-500">{section.description}</p>
              </div>
              <Button
                variant="ghost"
                className="w-fit px-0 text-blue-700 hover:bg-transparent hover:text-blue-800"
                onClick={() => navigate(section.to)}
              >
                Open section
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}


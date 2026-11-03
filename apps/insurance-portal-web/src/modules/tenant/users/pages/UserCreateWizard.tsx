import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Form } from '@/components/ui/form';
import { mapApiErrorsToForm } from '@/lib/api-error';
import { QuotationJourneyProgress } from '@/modules/tenant/quotations/wizard/QuotationJourneyProgress';
import type { UserAccessOptions } from '@/modules/tenant/users/api/users';
import { useCreateUser } from '@/modules/tenant/users/hooks';
import {
  EMPTY_ACCESS_VALUES,
  STEP_FIELDS,
  createUserSchema,
  createValuesToPayload,
  type CreateUserValues,
} from '@/modules/tenant/users/schemas/user-form.schema';
import { ProfileSection } from '@/modules/tenant/users/components/form/ProfileSection';
import { OrganisationSection } from '@/modules/tenant/users/components/form/OrganisationSection';
import { RolesSection } from '@/modules/tenant/users/components/form/RolesSection';
import { PermissionsSection } from '@/modules/tenant/users/components/form/PermissionsSection';
import { DataAccessSection } from '@/modules/tenant/users/components/form/DataAccessSection';
import { EffectivePermissionsPanel } from '@/modules/tenant/users/components/form/EffectivePermissionsPanel';
import { ReviewStep } from '@/modules/tenant/users/components/form/ReviewStep';

type StepId = keyof typeof STEP_FIELDS | 'review';

const STEP_META: Record<StepId, { label: string; description: string }> = {
  profile: { label: 'Profile', description: 'Name and sign-in details' },
  organisation: {
    label: 'Organisation',
    description: 'Branches and departments',
  },
  roles: { label: 'Roles', description: 'Main access' },
  permissions: { label: 'Permissions', description: 'Exceptions' },
  data_access: { label: 'Data access', description: 'Scope and channel' },
  review: { label: 'Review', description: 'Check and create' },
};

const CREATE_FIELD_MAP: Partial<
  Record<string, keyof CreateUserValues & string>
> = {
  first_name: 'first_name',
  last_name: 'last_name',
  email: 'email',
  phone: 'phone',
  password: 'password',
  officer_title: 'officer_title',
  branch_ids: 'branch_ids',
  active_branch_id: 'active_branch_id',
};

export function UserCreateWizard({ options }: { options: UserAccessOptions }) {
  const navigate = useNavigate();
  const createMutation = useCreateUser();
  const sections = options.sections.create;

  // Profile and organisation are always part of creating a user; the rest
  // appear only when the actor may manage them.
  const steps: StepId[] = [
    'profile',
    'organisation',
    ...(['roles', 'permissions', 'data_access'] as const).filter((section) =>
      sections.includes(section),
    ),
    'review',
  ];

  const [current, setCurrent] = useState<StepId>('profile');
  const [completed, setCompleted] = useState<StepId[]>([]);
  const index = steps.indexOf(current);
  const isLast = current === 'review';

  const form = useForm<CreateUserValues>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      first_name: '',
      last_name: '',
      email: '',
      phone: '',
      password: '',
      officer_title: 'Underwriter',
      ...EMPTY_ACCESS_VALUES,
      active_branch_id:
        options.branches.length === 1 ? options.branches[0].id : '',
      branch_ids: options.branches.length === 1 ? [options.branches[0].id] : [],
    },
  });

  const [roleIds, branchIds, departmentIds, grants, excludedIds] = useWatch({
    control: form.control,
    name: [
      'role_ids',
      'branch_ids',
      'department_ids',
      'permission_grants',
      'excluded_permission_ids',
    ],
  });

  const goTo = async (target: StepId) => {
    // Moving forward validates every step in between.
    const targetIndex = steps.indexOf(target);
    for (const step of steps.slice(index, targetIndex)) {
      if (step === 'review') continue;
      const valid = await form.trigger(
        STEP_FIELDS[step] as unknown as (keyof CreateUserValues)[],
      );
      if (!valid) {
        setCurrent(step);
        return;
      }
      setCompleted((done) => (done.includes(step) ? done : [...done, step]));
    }
    setCurrent(target);
  };

  const submit = form.handleSubmit((values) =>
    createMutation.mutate(createValuesToPayload(values, sections), {
      onSuccess: (created) => navigate(`/apps/users/${created.id}`),
      onError: (err) => {
        mapApiErrorsToForm(err, form.setError, CREATE_FIELD_MAP);
        const failedStep = steps.find(
          (step) =>
            step !== 'review' &&
            STEP_FIELDS[step].some(
              (field) =>
                form.getFieldState(field as keyof CreateUserValues).invalid,
            ),
        );
        if (failedStep) setCurrent(failedStep);
      },
    }),
  );

  return (
    <div className="space-y-4">
      <QuotationJourneyProgress
        steps={steps.map((id) => ({ id, ...STEP_META[id] }))}
        currentStep={current}
        completedSteps={completed}
        onStepClick={(step) => void goTo(step as StepId)}
        journeyLabel="New user"
      />

      <Form {...form}>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (isLast) void submit();
            else void goTo(steps[index + 1]);
          }}
        >
          <Card>
            <CardContent className="pt-6">
              {current === 'profile' && <ProfileSection mode="create" />}
              {current === 'organisation' && (
                <OrganisationSection options={options} />
              )}
              {current === 'roles' && <RolesSection options={options} />}
              {current === 'permissions' && (
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                  <div className="lg:col-span-2">
                    <PermissionsSection
                      options={options}
                      roleIds={roleIds}
                      assignedBranchIds={branchIds}
                      assignedDepartmentIds={departmentIds}
                    />
                  </div>
                  <EffectivePermissionsPanel
                    options={options}
                    roleIds={roleIds}
                    grants={grants}
                    excludedIds={excludedIds}
                  />
                </div>
              )}
              {current === 'data_access' && (
                <DataAccessSection options={options} />
              )}
              {current === 'review' && (
                <ReviewStep options={options} sections={sections} />
              )}

              <div className="mt-6 flex items-center justify-between gap-2 border-t border-slate-100 pt-4">
                <Button type="button" variant="ghost" asChild>
                  <Link to="/apps/users">Cancel</Link>
                </Button>
                <div className="flex gap-2">
                  {index > 0 && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setCurrent(steps[index - 1])}
                    >
                      Back
                    </Button>
                  )}
                  <Button type="submit" disabled={createMutation.isPending}>
                    {isLast
                      ? createMutation.isPending
                        ? 'Creating…'
                        : 'Create user'
                      : 'Next'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </form>
      </Form>
    </div>
  );
}

import { useParams } from 'react-router-dom';
import { EmptyState, ErrorState } from '@/components/shared/ContentStates';
import {
  useUser,
  useUserAccess,
  useUserAccessOptions,
} from '@/modules/tenant/users/hooks';
import { usePageTitle } from '@/modules/shared/meta/page-title';
import { UserCreateWizard } from './UserCreateWizard';
import { UserEditTabs } from './UserEditTabs';

/** /apps/users/new opens the create wizard; /apps/users/:id/edit the edit tabs. */
export function UserFormPage() {
  const { id } = useParams<{ id?: string }>();
  const isEdit = Boolean(id);

  const optionsQuery = useUserAccessOptions();
  const userQuery = useUser(id);
  const accessQuery = useUserAccess(id);
  const user = userQuery.data;

  usePageTitle(
    isEdit ? user && `Edit ${user.first_name} ${user.last_name}` : 'New User',
  );

  const queries = isEdit
    ? [optionsQuery, userQuery, accessQuery]
    : [optionsQuery];
  const failed = queries.find((query) => query.isError);

  if (failed) {
    return (
      <ErrorState
        description={
          isEdit
            ? 'This user could not be loaded for editing.'
            : 'The user form could not be loaded.'
        }
        onRetry={() => {
          void failed.refetch();
        }}
      />
    );
  }

  if (queries.some((query) => !query.data)) {
    return (
      <EmptyState
        title={isEdit ? 'Loading user' : 'Loading form'}
        description="The user form will appear in a moment."
      />
    );
  }

  return isEdit ? (
    <UserEditTabs
      user={user!}
      access={accessQuery.data!}
      options={optionsQuery.data!}
    />
  ) : (
    <UserCreateWizard options={optionsQuery.data!} />
  );
}

import { useFormContext } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Combobox } from '@/components/ui/combobox';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  STATUS_OPTIONS,
  type CreateProfileValues,
  type EditProfileValues,
} from '@/modules/tenant/users/schemas/user-form.schema';

type ProfileValues = CreateProfileValues & EditProfileValues;

export function ProfileSection({
  mode,
  lockedStatus,
}: {
  mode: 'create' | 'edit';
  /** Set when the user is locked or suspended; status is then read-only here. */
  lockedStatus?: string;
}) {
  const { control } = useFormContext<ProfileValues>();

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <FormField
        control={control}
        name="first_name"
        render={({ field }) => (
          <FormItem>
            <FormLabel>First name</FormLabel>
            <FormControl>
              <Input placeholder="John" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={control}
        name="last_name"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Last name</FormLabel>
            <FormControl>
              <Input placeholder="Doe" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      {mode === 'create' && (
        <FormField
          control={control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input type="email" placeholder="john@company.com" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      )}
      <FormField
        control={control}
        name="phone"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Phone</FormLabel>
            <FormControl>
              <Input placeholder="+255712345678" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      {mode === 'create' && (
        <FormField
          control={control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Password</FormLabel>
              <FormControl>
                <Input
                  type="password"
                  placeholder="Min 6 characters"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      )}
      {mode === 'edit' && lockedStatus && (
        <FormItem>
          <FormLabel>Status</FormLabel>
          <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm capitalize text-amber-800">
            {lockedStatus} — unlock or reactivate the user from the users list.
          </p>
        </FormItem>
      )}
      {mode === 'edit' && !lockedStatus && (
        <FormField
          control={control}
          name="status"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Status</FormLabel>
              <FormControl>
                <Combobox
                  options={STATUS_OPTIONS}
                  value={field.value}
                  onValueChange={field.onChange}
                  placeholder="Select status"
                  searchPlaceholder="Search statuses…"
                  emptyText="No statuses found"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      )}
      {mode === 'create' && (
        <FormField
          control={control}
          name="officer_title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Officer title</FormLabel>
              <FormControl>
                <Input placeholder="Underwriter" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      )}
    </div>
  );
}

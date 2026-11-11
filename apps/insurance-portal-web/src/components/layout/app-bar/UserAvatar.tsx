export interface AppBarUser {
  name: string;
  role: string;
  initials: string;
  avatarUrl?: string | null;
}

/** Round avatar: the photo when there is one, else white initials. */
export function UserAvatar({
  user,
  size = 32,
}: {
  user: AppBarUser;
  size?: number;
}) {
  return (
    <span
      aria-hidden
      className="inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--color-primary-600)] font-semibold text-white"
      style={{ width: size, height: size, fontSize: size >= 40 ? 14 : 12 }}
    >
      {user.avatarUrl ? (
        <img
          src={user.avatarUrl}
          alt=""
          className="h-full w-full object-cover"
        />
      ) : (
        user.initials
      )}
    </span>
  );
}

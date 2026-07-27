interface Props {
  errors: string[];
  className?: string;
}

export function PricingErrorDisplay({ errors, className }: Props) {
  if (errors.length === 0) {
    return null;
  }

  return (
    <ul className={className ?? 'list-disc space-y-0.5 pl-4 text-red-600'}>
      {errors.map((message) => (
        <li key={message}>{message}</li>
      ))}
    </ul>
  );
}

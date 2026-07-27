interface Props {
  warnings: string[];
  className?: string;
}

export function PricingWarningDisplay({ warnings, className }: Props) {
  if (warnings.length === 0) {
    return null;
  }

  return (
    <ul className={className ?? 'list-disc space-y-0.5 pl-4 text-amber-700'}>
      {warnings.map((message) => (
        <li key={message}>{message}</li>
      ))}
    </ul>
  );
}

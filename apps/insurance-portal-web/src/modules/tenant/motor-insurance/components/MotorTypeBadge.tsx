import { Badge } from '@/components/ui/badge';

/** Single Motor / Fleet indicator, derived from the stored line or flow. */
export function MotorTypeBadge({ fleet }: { fleet: boolean }) {
  return (
    <Badge variant={fleet ? 'primary' : 'muted'} className="text-[11px]">
      {fleet ? 'Fleet' : 'Single'}
    </Badge>
  );
}

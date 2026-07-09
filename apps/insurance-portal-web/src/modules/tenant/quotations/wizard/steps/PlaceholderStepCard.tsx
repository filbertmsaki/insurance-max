import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function PlaceholderStepCard({ title, note }: { title: string; note: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-slate-500">{note}</p>
      </CardContent>
    </Card>
  );
}

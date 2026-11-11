import * as React from 'react';
import { Button } from './button';
import { Checkbox } from './checkbox';
import { Combobox } from './combobox';
import { DatePicker, DateRangePicker } from './date-picker';
import { FormField } from './form-field';
import { Input } from './input';
import { MultiSelect } from './multi-select';
import { SegmentedControl } from './radio';
import { SearchInput } from './search-input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './select';
import { Switch } from './switch';
import { Textarea } from './textarea';
import { TextInput } from './text-input';

const options = [
  { value: 'motor', label: 'Motor' },
  { value: 'property', label: 'Property' },
];
export function ControlShowcase() {
  const [search, setSearch] = React.useState('');
  const [choice, setChoice] = React.useState('');
  const [selected, setSelected] = React.useState<string[]>([]);
  const [date, setDate] = React.useState('2026-11-09');
  const [range, setRange] = React.useState({
    start: '2026-11-09',
    end: '2026-12-08',
  });
  const [kind, setKind] = React.useState('single');
  return (
    <main className="mx-auto max-w-5xl space-y-8 p-6 text-[var(--color-text)]">
      <div>
        <h1 className="text-2xl font-semibold">Form controls</h1>
        <p className="text-[var(--color-text-muted)]">
          Shared controls and their common states.
        </p>
      </div>
      <section className="grid gap-5 md:grid-cols-2">
        <FormField
          id="demo-text"
          label="Text"
          required
          helperText="A short helper message."
        >
          <Input placeholder="Enter a value" />
        </FormField>
        <FormField id="demo-error" label="Error" error="A value is required.">
          <Input />
        </FormField>
        <FormField id="demo-disabled" label="Disabled">
          <Input disabled value="Unavailable" />
        </FormField>
        <FormField id="demo-readonly" label="Read-only">
          <Input readOnly value="Read-only value" />
        </FormField>
        <FormField id="demo-password" label="Password">
          <TextInput type="password" />
        </FormField>
        <FormField id="demo-search" label="Search">
          <SearchInput
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onClear={() => setSearch('')}
          />
        </FormField>
        <div>
          <label
            htmlFor="demo-select"
            className="mb-1 block text-[length:var(--label-font-size)] font-semibold"
          >
            Select
          </label>
          <Select value={choice} onValueChange={setChoice}>
            <SelectTrigger id="demo-select">
              <SelectValue placeholder="Select a product" />
            </SelectTrigger>
            <SelectContent>
              {options.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <FormField id="demo-combobox" label="Combobox">
          <Combobox
            value={choice}
            onValueChange={setChoice}
            options={options}
          />
        </FormField>
        <FormField id="demo-multi" label="Multiple products">
          <MultiSelect
            value={selected}
            onChange={setSelected}
            options={options}
          />
        </FormField>
        <FormField id="demo-date" label="Date">
          <DatePicker value={date} onChange={setDate} />
        </FormField>
        <div>
          <p className="mb-1 text-[length:var(--label-font-size)] font-semibold">
            Date range
          </p>
          <DateRangePicker value={range} onChange={setRange} />
        </div>
        <FormField id="demo-textarea" label="Description">
          <Textarea showCount maxLength={100} />
        </FormField>
      </section>
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Selections</h2>
        <div className="flex flex-wrap items-center gap-5">
          <label className="flex items-center gap-2">
            <Checkbox /> Checkbox
          </label>
          <label className="flex items-center gap-2">
            <Switch /> Switch
          </label>
          <SegmentedControl
            aria-label="Quotation type"
            name="showcase-kind"
            value={kind}
            onChange={setKind}
            options={[
              { value: 'single', label: 'Single' },
              { value: 'fleet', label: 'Fleet' },
            ]}
          />
        </div>
      </section>
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Buttons</h2>
        <div className="flex flex-wrap gap-2">
          {(
            [
              'primary',
              'secondary',
              'outline',
              'ghost',
              'danger',
              'danger-outline',
              'link',
            ] as const
          ).map((variant) => (
            <Button key={variant} variant={variant}>
              {variant}
            </Button>
          ))}
          <Button disabled>Disabled</Button>
          <Button loading>Loading</Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm">Small</Button>
          <Button>Medium</Button>
          <Button size="lg">Large</Button>
        </div>
      </section>
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Field sizes</h2>
        <div className="grid gap-3 md:grid-cols-3">
          <Input
            aria-label="Small field"
            controlSize="sm"
            placeholder="Small"
          />
          <Input aria-label="Medium field" placeholder="Medium" />
          <Input
            aria-label="Large field"
            controlSize="lg"
            placeholder="Large"
          />
        </div>
      </section>
    </main>
  );
}

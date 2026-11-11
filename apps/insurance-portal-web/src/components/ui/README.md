# Shared form controls

The web app's control tokens live in `src/tokens.css`. Shared React components are in `src/components/ui`. In development, sign in and open `/apps/control-showcase` for examples.

Use `FormField` for a label and a helper or error message. Its child must forward `id`, `aria-describedby`, `aria-invalid`, and `aria-required` to the actual focusable control. For React Hook Form, the existing `FormField`, `FormControl`, and `FormMessage` exports in `ui/form.tsx` provide the corresponding integration.

`Input` accepts `controlSize="sm" | "md" | "lg"`; the default is `md`. `TextInput` adds prefix, suffix and password visibility. `SearchInput` accepts an `onClear` action. `Select`, `Combobox`, and `AsyncCombobox` use their existing `onValueChange` interfaces; `MultiSelect` accepts an array of values and `onChange`.

`DatePicker` is controlled with an ISO `value` and an ISO `onChange`. It displays `DD/MM/YY`, accepts two- or four-digit years when typed, rejects invalid dates, and uses 2000–2099 for newly entered two-digit years. For dates where the century is ambiguous, enter four digits. `DateRangePicker` accepts `{ start, end }` ISO values. Native calendar behavior depends on the browser.

Use `Button` with a semantic variant and size; `loading` disables it and displays a spinner. `ButtonGroup` wraps actions with a consistent gap. `SegmentedControl` uses native radio inputs and requires a group name and accessible label.

The migration of existing pages to these components is ongoing; a component's presence in this directory does not mean every page uses it yet.

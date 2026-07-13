export const SELECT_NONE_VALUE = 'none';

export function toSelectValue(value: string | null | undefined) {
  return value && value.trim() ? value : SELECT_NONE_VALUE;
}

export function fromSelectValue(value: string) {
  return value === SELECT_NONE_VALUE ? '' : value;
}

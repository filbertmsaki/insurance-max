import { validateRiskData, type RiskFieldDefinition } from './risk-field.types';

const field = (
  overrides: Partial<RiskFieldDefinition> &
    Pick<RiskFieldDefinition, 'field_key'>,
): RiskFieldDefinition => ({
  label: overrides.field_key,
  data_type: 'TEXT',
  is_required: false,
  options: null,
  validation_rules: null,
  ...overrides,
});

const schema: RiskFieldDefinition[] = [
  field({
    field_key: 'construction',
    data_type: 'SELECT',
    is_required: true,
    options: [
      { value: 'CONCRETE', label: 'Concrete' },
      { value: 'TIMBER', label: 'Timber' },
    ],
  }),
  field({
    field_key: 'floors',
    data_type: 'INTEGER',
    validation_rules: { min: 1, max: 60 },
  }),
  field({ field_key: 'sprinklers', data_type: 'BOOLEAN' }),
  field({ field_key: 'survey_date', data_type: 'DATE' }),
  field({
    field_key: 'perils',
    data_type: 'MULTI_SELECT',
    options: [
      { value: 'FIRE', label: 'Fire' },
      { value: 'FLOOD', label: 'Flood' },
    ],
  }),
  field({
    field_key: 'plot_no',
    validation_rules: { max_length: 10, pattern: '^[A-Z0-9/-]+$' },
  }),
];

describe('validateRiskData', () => {
  it('normalises well-typed values and drops keys outside the schema', () => {
    const result = validateRiskData(
      schema,
      {
        construction: 'CONCRETE',
        floors: '4',
        sprinklers: 'true',
        survey_date: '2026-09-01',
        perils: ['FIRE', 'FIRE', 'FLOOD'],
        plot_no: ' 12/B ',
        injected: 'ignored',
      },
      { enforceRequired: true },
    );

    expect(result.errors).toEqual([]);
    expect(result.data).toEqual({
      construction: 'CONCRETE',
      floors: 4,
      sprinklers: true,
      survey_date: '2026-09-01',
      perils: ['FIRE', 'FLOOD'],
      plot_no: '12/B',
    });
  });

  it('lets drafts omit required fields but not finalized quotations', () => {
    expect(
      validateRiskData(schema, {}, { enforceRequired: false }).errors,
    ).toEqual([]);
    expect(
      validateRiskData(schema, {}, { enforceRequired: true }).errors,
    ).toEqual([
      { field_key: 'construction', message: 'construction is required' },
    ]);
  });

  it('reports type, range, option and format errors per field', () => {
    const { errors } = validateRiskData(
      schema,
      {
        construction: 'STRAW',
        floors: '2.5',
        sprinklers: 'maybe',
        survey_date: '01/09/2026',
        perils: ['QUAKE'],
        plot_no: 'lower case',
      },
      { enforceRequired: false },
    );

    expect(errors.map((error) => error.field_key)).toEqual([
      'construction',
      'floors',
      'sprinklers',
      'survey_date',
      'perils',
      'plot_no',
    ]);
  });

  it('applies numeric bounds', () => {
    const { errors } = validateRiskData(
      schema,
      { floors: 0 },
      { enforceRequired: false },
    );
    expect(errors).toEqual([
      { field_key: 'floors', message: 'floors must be at least 1' },
    ]);
  });
});

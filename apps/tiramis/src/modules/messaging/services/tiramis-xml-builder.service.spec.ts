import {
  emptyMissingValues,
  TiramisXmlBuilderService,
} from './tiramis-xml-builder.service';

describe('TiramisXmlBuilderService missing values', () => {
  const builder = new TiramisXmlBuilderService();

  it('sends empty elements instead of null, undefined, NULL or NONE', () => {
    const xml = builder.buildCompactContentXml('MotorDtl', {
      FuelUsed: null,
      ModelNumber: undefined,
      Color: 'NULL',
      BodyType: ' none ',
      Owner: 'Null',
      Make: 'TOYOTA',
      NumberOfAxles: 0,
      Risks: [{ RiskCode: 'undefined' }],
    });

    expect(xml).not.toMatch(/null|none|undefined/i);
    expect(xml).toContain('<FuelUsed></FuelUsed>');
    expect(xml).toContain('<Color></Color>');
    expect(xml).toContain('<Make>TOYOTA</Make>');
    expect(xml).toContain('<NumberOfAxles>0</NumberOfAxles>');
  });

  it('applies the same rule to signed messages', () => {
    const xml = builder.buildTiraMessage({
      rootName: 'CoverNoteRefReq',
      payload: { FuelUsed: 'NONE', Make: 'ISUZU' },
      signature: 'sig',
    });
    expect(xml).toContain('<FuelUsed></FuelUsed>');
    expect(xml).toContain('<Make>ISUZU</Make>');
  });

  it('keeps real values untouched', () => {
    expect(emptyMissingValues({ A: 'Nonesuch', B: false, C: 12 })).toEqual({
      A: 'Nonesuch',
      B: false,
      C: 12,
    });
  });
});

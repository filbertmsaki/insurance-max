import { ProductDefinitionHashService } from './product-definition-hash.service';

describe('ProductDefinitionHashService', () => {
  const service = new ProductDefinitionHashService();

  describe('hashDefinition', () => {
    it('produces a deterministic SHA-256 hash', () => {
      const definition = { a: 1, b: 'text' };
      expect(service.hashDefinition(definition)).toBe(
        service.hashDefinition(definition),
      );
      expect(service.hashDefinition(definition)).toMatch(/^[0-9a-f]{64}$/);
    });

    it('is independent of key order', () => {
      const a = { productCode: 'MOTOR-COMP', coverNoteType: 3 };
      const b = { coverNoteType: 3, productCode: 'MOTOR-COMP' };
      expect(service.hashDefinition(a)).toBe(service.hashDefinition(b));
    });

    it('is independent of key order in nested arrays of objects', () => {
      const a = {
        addons: [
          { code: 'A', name: 'Addon A' },
          { code: 'B', name: 'Addon B' },
        ],
      };
      const b = {
        addons: [
          { name: 'Addon A', code: 'A' },
          { name: 'Addon B', code: 'B' },
        ],
      };
      expect(service.hashDefinition(a)).toBe(service.hashDefinition(b));
    });

    it('normalizes trailing whitespace and CRLF line endings in string values', () => {
      const a = { text: 'Line one\r\nLine two  ' };
      const b = { text: 'Line one\nLine two' };
      expect(service.hashDefinition(a)).toBe(service.hashDefinition(b));
    });

    it('produces different hashes for materially different content', () => {
      const a = { operativeClause: 'Fire and Allied Perils' };
      const b = { operativeClause: 'Marine cargo cover' };
      expect(service.hashDefinition(a)).not.toBe(service.hashDefinition(b));
    });
  });

  describe('hashText', () => {
    it('treats null and undefined the same as an empty string', () => {
      expect(service.hashText(null)).toBe(service.hashText(undefined));
      expect(service.hashText(null)).toBe(service.hashText(''));
    });

    it('normalizes internal whitespace runs and trims', () => {
      expect(service.hashText('  Fire   and Allied Perils  ')).toBe(
        service.hashText('Fire and Allied Perils'),
      );
    });

    it('distinguishes materially different wording', () => {
      expect(service.hashText('Standard cover')).not.toBe(
        service.hashText('Non-standard cover'),
      );
    });
  });
});

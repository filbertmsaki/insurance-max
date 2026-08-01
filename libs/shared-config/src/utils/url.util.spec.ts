import { buildUrl, normalizeBaseUrl } from './url.util';

describe('URL utilities', () => {
  it('normalizes trailing slashes and joins path segments', () => {
    expect(
      buildUrl('https://api.example.com///', '/api/', '/files/report.pdf'),
    ).toBe('https://api.example.com/api/files/report.pdf');
  });

  it('adds encoded query parameters without duplicate separators', () => {
    expect(
      buildUrl('https://portal.example.com', 'reset-password', {
        token: 'a token',
        used: false,
        omitted: undefined,
      }),
    ).toBe(
      'https://portal.example.com/reset-password?token=a+token&used=false',
    );
  });

  it('normalizes an already configured base URL', () => {
    expect(normalizeBaseUrl(' https://api.example.com/// ')).toBe(
      'https://api.example.com',
    );
  });
});

import { describe, expect, it } from 'vitest';
import {
  getLexicHref,
  isLexicTermUrl,
  parseLexicTermUrl,
  toLexicLanguage,
} from './lexic-url';

describe('parseLexicTermUrl', () => {
  it('parses a Chronostratigraphy URL', () => {
    const result = parseLexicTermUrl(
      'https://dev-lexic.swissgeol.ch/Chronostratigraphy/LateBurdigalian',
    );
    expect(result).toEqual({
      vocabularyId: 'chronostratigraphy',
      normalizedTermUrl:
        'https://dev-lexic.swissgeol.ch/Chronostratigraphy/LateBurdigalian',
    });
  });

  it('parses a TectonicUnits URL', () => {
    const result = parseLexicTermUrl(
      'https://dev-lexic.swissgeol.ch/TectonicUnits/InternalFoldedJuraAndForelandPlateau',
    );
    expect(result).toEqual({
      vocabularyId: 'tectonic-units',
      normalizedTermUrl:
        'https://dev-lexic.swissgeol.ch/TectonicUnits/InternalFoldedJuraAndForelandPlateau',
    });
  });

  it('parses a Lithostratigraphy URL', () => {
    const result = parseLexicTermUrl(
      'https://dev-lexic.swissgeol.ch/Lithostratigraphy/StGallenFormation',
    );
    expect(result).toEqual({
      vocabularyId: 'lithostratigraphy',
      normalizedTermUrl:
        'https://dev-lexic.swissgeol.ch/Lithostratigraphy/StGallenFormation',
    });
  });

  it('parses a Lithology URL', () => {
    const result = parseLexicTermUrl(
      'https://dev-lexic.swissgeol.ch/Lithology/SandstoneGlauconite',
    );
    expect(result).toEqual({
      vocabularyId: 'lithology',
      normalizedTermUrl:
        'https://dev-lexic.swissgeol.ch/Lithology/SandstoneGlauconite',
    });
  });

  it('accepts dev-lexic.swissgeol.ch URLs', () => {
    const result = parseLexicTermUrl(
      'https://dev-lexic.swissgeol.ch/Lithology/Marlstone',
    );
    expect(result).not.toBeNull();
    expect(result!.vocabularyId).toBe('lithology');
  });

  it('accepts int-lexic.swissgeol.ch URLs', () => {
    const result = parseLexicTermUrl(
      'https://int-lexic.swissgeol.ch/Lithology/Marlstone',
    );
    expect(result).not.toBeNull();
    expect(result!.vocabularyId).toBe('lithology');
  });

  it('accepts lexic.swissgeol.ch (production) URLs', () => {
    const result = parseLexicTermUrl(
      'https://lexic.swissgeol.ch/Lithology/Marlstone',
    );
    expect(result).toEqual({
      vocabularyId: 'lithology',
      normalizedTermUrl: 'https://lexic.swissgeol.ch/Lithology/Marlstone',
    });
  });

  it('strips query parameters from the normalized URL', () => {
    const result = parseLexicTermUrl(
      'https://dev-lexic.swissgeol.ch/Lithology/SandstoneGlauconite?lang=de',
    );
    expect(result).toEqual({
      vocabularyId: 'lithology',
      normalizedTermUrl:
        'https://dev-lexic.swissgeol.ch/Lithology/SandstoneGlauconite',
    });
  });

  it('strips hash from the normalized URL', () => {
    const result = parseLexicTermUrl(
      'https://dev-lexic.swissgeol.ch/Lithology/SandstoneGlauconite#section',
    );
    expect(result).toEqual({
      vocabularyId: 'lithology',
      normalizedTermUrl:
        'https://dev-lexic.swissgeol.ch/Lithology/SandstoneGlauconite',
    });
  });

  it('strips both query and hash from the normalized URL', () => {
    const result = parseLexicTermUrl(
      'https://dev-lexic.swissgeol.ch/Lithology/SandstoneGlauconite?lang=de#section',
    );
    expect(result).toEqual({
      vocabularyId: 'lithology',
      normalizedTermUrl:
        'https://dev-lexic.swissgeol.ch/Lithology/SandstoneGlauconite',
    });
  });

  it('strips trailing slash from path', () => {
    const result = parseLexicTermUrl(
      'https://dev-lexic.swissgeol.ch/Lithology/SandstoneGlauconite/',
    );
    expect(result).toEqual({
      vocabularyId: 'lithology',
      normalizedTermUrl:
        'https://dev-lexic.swissgeol.ch/Lithology/SandstoneGlauconite',
    });
  });

  it('returns null for non-Lexic URLs', () => {
    expect(parseLexicTermUrl('https://example.com/foo')).toBeNull();
    expect(
      parseLexicTermUrl('https://other-lexic.swissgeol.ch/Lithology/X'),
    ).toBeNull();
  });

  it('returns null for unsupported vocabulary path segments', () => {
    expect(
      parseLexicTermUrl('https://dev-lexic.swissgeol.ch/UnknownVocab/Term'),
    ).toBeNull();
  });

  it('returns null for invalid URLs', () => {
    expect(parseLexicTermUrl('not a url')).toBeNull();
    expect(parseLexicTermUrl('')).toBeNull();
  });

  it('returns null for Lexic URLs with only one path segment', () => {
    expect(
      parseLexicTermUrl('https://dev-lexic.swissgeol.ch/Lithology'),
    ).toBeNull();
  });

  it('returns null for Lexic URLs with no path', () => {
    expect(parseLexicTermUrl('https://dev-lexic.swissgeol.ch/')).toBeNull();
    expect(parseLexicTermUrl('https://dev-lexic.swissgeol.ch')).toBeNull();
  });
});

describe('getLexicHref', () => {
  it('appends lang parameter to a URL without query', () => {
    const href = getLexicHref(
      'https://dev-lexic.swissgeol.ch/Lithostratigraphy/StGallenFormation',
      'de',
    );
    expect(href).toBe(
      'https://dev-lexic.swissgeol.ch/Lithostratigraphy/StGallenFormation?lang=de',
    );
  });

  it('replaces existing lang parameter', () => {
    const href = getLexicHref(
      'https://dev-lexic.swissgeol.ch/Lithostratigraphy/StGallenFormation?lang=en',
      'fr',
    );
    expect(href).toBe(
      'https://dev-lexic.swissgeol.ch/Lithostratigraphy/StGallenFormation?lang=fr',
    );
  });

  it('preserves other query parameters', () => {
    const href = getLexicHref(
      'https://dev-lexic.swissgeol.ch/Lithostratigraphy/StGallenFormation?foo=bar',
      'it',
    );
    expect(href).toContain('foo=bar');
    expect(href).toContain('lang=it');
  });
});

describe('isLexicTermUrl', () => {
  it('returns true for valid Lexic term URLs', () => {
    expect(
      isLexicTermUrl(
        'https://dev-lexic.swissgeol.ch/Chronostratigraphy/Albian',
      ),
    ).toBe(true);
    expect(
      isLexicTermUrl(
        'https://dev-lexic.swissgeol.ch/TectonicUnits/InternalFoldedJuraAndForelandPlateau',
      ),
    ).toBe(true);
    expect(
      isLexicTermUrl(
        'https://dev-lexic.swissgeol.ch/Lithostratigraphy/StGallenFormation',
      ),
    ).toBe(true);
    expect(
      isLexicTermUrl(
        'https://dev-lexic.swissgeol.ch/Lithology/SandstoneGlauconite',
      ),
    ).toBe(true);
  });

  it('returns false for non-Lexic URLs', () => {
    expect(isLexicTermUrl('https://example.com/foo')).toBe(false);
  });

  it('returns false for plain strings', () => {
    expect(isLexicTermUrl('hello world')).toBe(false);
  });

  it('returns false for unsupported vocabulary paths', () => {
    expect(isLexicTermUrl('https://dev-lexic.swissgeol.ch/Unknown/Term')).toBe(
      false,
    );
  });
});

describe('toLexicLanguage', () => {
  it('returns de for de', () => {
    expect(toLexicLanguage('de')).toBe('de');
  });

  it('returns en for en', () => {
    expect(toLexicLanguage('en')).toBe('en');
  });

  it('returns fr for fr', () => {
    expect(toLexicLanguage('fr')).toBe('fr');
  });

  it('returns it for it', () => {
    expect(toLexicLanguage('it')).toBe('it');
  });

  it('handles BCP47 locale tags (e.g. de-CH)', () => {
    expect(toLexicLanguage('de-CH')).toBe('de');
    expect(toLexicLanguage('fr-FR')).toBe('fr');
    expect(toLexicLanguage('en-US')).toBe('en');
  });

  it('falls back to en for unsupported languages', () => {
    expect(toLexicLanguage('ja')).toBe('en');
    expect(toLexicLanguage('es')).toBe('en');
    expect(toLexicLanguage('zh')).toBe('en');
  });

  it('falls back to en for empty string', () => {
    expect(toLexicLanguage('')).toBe('en');
  });
});

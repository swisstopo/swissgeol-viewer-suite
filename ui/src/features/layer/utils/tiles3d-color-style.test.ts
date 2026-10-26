import { describe, expect, it, vi } from 'vitest';
import type { Cesium3DTileset } from 'cesium';

vi.mock('cesium', () => ({
  BlendOption: { OPAQUE: 0, TRANSLUCENT: 1 },
  Cesium3DTileStyle: class {
    constructor(public readonly style: unknown) {}
  },
}));

import {
  applyHexColorStyleIfAvailable,
  updateHexColorStyleOpacity,
  hasHexColorInTilesetMetadata,
  getUnitKey,
  setUnitHighlight,
} from 'src/features/layer/utils/tiles3d-color-style';

type Listener = (tile: unknown) => void;

const makeTileset = (extra: Record<string, unknown> = {}) => {
  const listeners: Listener[] = [];
  const tileset = {
    style: undefined,
    tileLoad: {
      addEventListener: (fn: Listener) => {
        listeners.push(fn);
        return () => listeners.splice(listeners.indexOf(fn), 1);
      },
    },
    ...extra,
  };
  return {
    tileset: tileset as unknown as Cesium3DTileset,
    listeners,
    raw: tileset,
  };
};

const styleColor = (raw: { style?: unknown }): string =>
  (raw.style as { style: { color: string } }).style.color;

const schemaWith = (property: string) => ({
  metadata: {
    schema: { classes: { feature: { properties: { [property]: {} } } } },
  },
});

describe('hasHexColorInTilesetMetadata', () => {
  it('detects Hex_color in the schema', () => {
    expect(
      hasHexColorInTilesetMetadata(
        makeTileset(schemaWith('Hex_color')).tileset,
      ),
    ).toBe(true);
  });

  it('detects Hex_color in batch table properties', () => {
    expect(
      hasHexColorInTilesetMetadata(
        makeTileset({ properties: { Hex_color: {} } }).tileset,
      ),
    ).toBe(true);
  });

  it('returns false without the property or metadata', () => {
    expect(
      hasHexColorInTilesetMetadata(makeTileset(schemaWith('Name')).tileset),
    ).toBe(false);
    expect(hasHexColorInTilesetMetadata(makeTileset().tileset)).toBe(false);
  });
});

describe('applyHexColorStyleIfAvailable', () => {
  it('styles immediately when the schema has Hex_color', () => {
    const { tileset, raw } = makeTileset(schemaWith('Hex_color'));
    applyHexColorStyleIfAvailable(tileset, () => 0.5);
    expect(raw.style).toBeDefined();
  });

  it('styles after the first tile if its features have Hex_color', () => {
    const { tileset, raw, listeners } = makeTileset();
    applyHexColorStyleIfAvailable(tileset, () => 0.5);
    expect(raw.style).toBeUndefined();
    listeners[0]({
      hasRenderableContent: true,
      content: {
        featuresLength: 1,
        getFeature: () => ({ hasProperty: (n: string) => n === 'Hex_color' }),
      },
    });
    expect(raw.style).toBeDefined();
    expect(listeners).toHaveLength(0);
  });

  it('styles vector tiles via their batch tables', () => {
    const { tileset, raw, listeners } = makeTileset();
    applyHexColorStyleIfAvailable(tileset, () => 0.5);
    listeners[0]({
      hasRenderableContent: true,
      content: {
        batchTables: [
          {
            featuresLength: 2,
            hasProperty: (_: number, n: string) => n === 'Hex_color',
          },
        ],
      },
    });
    expect(raw.style).toBeDefined();
  });

  it('styles glTF vector tiles via their structural metadata', () => {
    const { tileset, raw, listeners } = makeTileset();
    applyHexColorStyleIfAvailable(tileset, () => 0.5);
    listeners[0]({
      hasRenderableContent: true,
      content: {
        batchTables: [{ featuresLength: 2 }],
        _model: {
          structuralMetadata: {
            propertyTables: [
              { propertyExists: (n: string) => n === 'Hex_color' },
            ],
          },
        },
      },
    });
    expect(raw.style).toBeDefined();
  });

  it('includes the opacity in the style and updates it', () => {
    const { tileset, raw } = makeTileset(schemaWith('Hex_color'));
    applyHexColorStyleIfAvailable(tileset, () => 0.5);
    expect(styleColor(raw)).toContain(', 0.5)');
    updateHexColorStyleOpacity(tileset, 0.2);
    expect(styleColor(raw)).toContain(', 0.2)');
  });

  it('does not touch the style of unstyled tilesets on opacity changes', () => {
    const { tileset, raw } = makeTileset();
    updateHexColorStyleOpacity(tileset, 0.2);
    expect(raw.style).toBeUndefined();
  });

  it('ignores tiles without renderable content', () => {
    const { tileset, raw, listeners } = makeTileset();
    applyHexColorStyleIfAvailable(tileset, () => 0.5);
    listeners[0]({ hasRenderableContent: false, content: {} });
    expect(listeners).toHaveLength(1);
    expect(raw.style).toBeUndefined();
  });

  it('does not style tilesets without Hex_color', () => {
    const { tileset, raw, listeners } = makeTileset();
    applyHexColorStyleIfAvailable(tileset, () => 0.5);
    listeners[0]({
      hasRenderableContent: true,
      content: {
        featuresLength: 1,
        getFeature: () => ({ hasProperty: () => false }),
      },
    });
    expect(raw.style).toBeUndefined();
  });
});

describe('unit highlight', () => {
  const styled = () => {
    const t = makeTileset(schemaWith('Hex_color'));
    applyHexColorStyleIfAvailable(t.tileset, () => 0.5);
    return t;
  };

  it('reads the unit of a feature only on styled tilesets', () => {
    const feature = {
      getProperty: (n: string) => (n === 'CS_ID' ? 'P1' : 123),
    };
    expect(getUnitKey(styled().tileset, feature)).toEqual({
      profile: 'P1',
      geolCode: 123,
    });
    expect(getUnitKey(makeTileset().tileset, feature)).toBeNull();
    expect(
      getUnitKey(styled().tileset, { getProperty: () => undefined }),
    ).toBeNull();
  });

  it('highlights the unit by CS_ID and GeolCode and keeps the opacity', () => {
    const { tileset, raw } = styled();
    setUnitHighlight(tileset, { profile: "it's", geolCode: 7 }, '#B3FF30');
    expect(styleColor(raw)).toBe(
      "(${CS_ID} === 'it\\'s' && ${GeolCode} === 7) ? color('#B3FF30', 0.5) : color('${Hex_color}', 0.5)",
    );
    setUnitHighlight(tileset, null);
    expect(styleColor(raw)).toBe("color('${Hex_color}', 0.5)");
  });

  it('keeps the highlight when the opacity changes', () => {
    const { tileset, raw } = styled();
    setUnitHighlight(tileset, { profile: 'a', geolCode: 1 }, '#fff');
    updateHexColorStyleOpacity(tileset, 0.2);
    expect(styleColor(raw)).toContain("color('#fff', 0.2)");
  });

  it('ignores tilesets that are not styled', () => {
    const { tileset, raw } = makeTileset();
    setUnitHighlight(tileset, { profile: 'a', geolCode: 1 });
    expect(raw.style).toBeUndefined();
  });
});

describe('vector blend option', () => {
  it('is opaque at full opacity and translucent below', () => {
    const { tileset, raw } = makeTileset(schemaWith('Hex_color'));
    applyHexColorStyleIfAvailable(tileset, () => 1);
    expect(raw['vectorBlendOption']).toBe(0);
    updateHexColorStyleOpacity(tileset, 0.9);
    expect(raw['vectorBlendOption']).toBe(1);
    updateHexColorStyleOpacity(tileset, 1);
    expect(raw['vectorBlendOption']).toBe(0);
  });
});

import { describe, expect, it, vi } from 'vitest';
import type { Cesium3DTileset } from 'cesium';

vi.mock('cesium', () => ({
  Cesium3DTileStyle: class {
    constructor(public readonly style: unknown) {}
  },
}));

import {
  applyHexColorStyleIfAvailable,
  updateHexColorStyleOpacity,
  hasHexColorInTilesetMetadata,
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

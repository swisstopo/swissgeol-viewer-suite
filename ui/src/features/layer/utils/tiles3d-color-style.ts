import {
  BlendOption,
  Cesium3DTile,
  Cesium3DTileset,
  Cesium3DTileStyle,
} from 'cesium';

export const HEX_COLOR_PROPERTY = 'Hex_color';

export const UNIT_PROPERTIES = { profile: 'CS_ID', geolCode: 'GeolCode' };

/** Identifies all pieces of one geological unit on one profile. */
export interface UnitKey {
  profile: string | number;
  geolCode: string | number;
}

interface StyleState {
  opacity: number;
  highlight: UnitKey | null;
  highlightColor: string;
}

const styleStates = new WeakMap<Cesium3DTileset, StyleState>();

const toExpressionLiteral = (value: string | number): string =>
  typeof value === 'number'
    ? String(value)
    : `'${value.replace(/\\/g, String.raw`\\`).replace(/'/g, String.raw`\'`)}'`;

// Vector tiles ignore custom shaders, so the layer opacity has to be part of the style.
const makeHexColorStyle = ({
  opacity,
  highlight,
  highlightColor,
}: StyleState): Cesium3DTileStyle => {
  const base = `color('\${${HEX_COLOR_PROPERTY}}', ${opacity})`;
  if (highlight === null) {
    return new Cesium3DTileStyle({ color: base });
  }
  const isInUnit =
    `\${${UNIT_PROPERTIES.profile}} === ${toExpressionLiteral(highlight.profile)}` +
    ` && \${${UNIT_PROPERTIES.geolCode}} === ${toExpressionLiteral(highlight.geolCode)}`;
  return new Cesium3DTileStyle({
    color: `(${isInUnit}) ? color('${highlightColor}', ${opacity}) : ${base}`,
  });
};

// Fully opaque vector tiles must not be drawn in the translucent pass, or they blend with what lies behind them.
const updateBlendOption = (tileset: Cesium3DTileset, opacity: number): void => {
  tileset.vectorBlendOption =
    opacity >= 1 ? BlendOption.OPAQUE : BlendOption.TRANSLUCENT;
};

const applyHexColorStyle = (
  tileset: Cesium3DTileset,
  opacity: number,
): void => {
  const state: StyleState = {
    opacity,
    highlight: null,
    highlightColor: '#ffffff',
  };
  styleStates.set(tileset, state);
  tileset.style = makeHexColorStyle(state);
  updateBlendOption(tileset, opacity);
};

/**
 * Updates the opacity of a tileset that has been colored by `applyHexColorStyleIfAvailable`.
 * Does nothing for any other tileset.
 */
export const updateHexColorStyleOpacity = (
  tileset: Cesium3DTileset,
  opacity: number,
): void => {
  const state = styleStates.get(tileset);
  if (state !== undefined) {
    state.opacity = opacity;
    tileset.style = makeHexColorStyle(state);
    updateBlendOption(tileset, opacity);
  }
};

/**
 * Reads the unit of a feature of a tileset colored by `Hex_color`.
 * Returns `null` if the tileset is not styled or the feature lacks `CS_ID` or `GeolCode`.
 */
export const getUnitKey = (
  tileset: Cesium3DTileset,
  feature: { getProperty(name: string): unknown },
): UnitKey | null => {
  if (!styleStates.has(tileset)) {
    return null;
  }
  const profile = feature.getProperty(UNIT_PROPERTIES.profile);
  const geolCode = feature.getProperty(UNIT_PROPERTIES.geolCode);
  const isValid = (it: unknown): it is string | number =>
    typeof it === 'string' || typeof it === 'number';
  return isValid(profile) && isValid(geolCode) ? { profile, geolCode } : null;
};

/**
 * Highlights all features of the given unit (or removes the highlight if `unit` is `null`).
 * Does nothing for tilesets that are not colored by `Hex_color`.
 */
export const setUnitHighlight = (
  tileset: Cesium3DTileset,
  unit: UnitKey | null,
  highlightColor = '#ffffff',
): void => {
  const state = styleStates.get(tileset);
  if (state === undefined) {
    return;
  }
  state.highlight = unit;
  state.highlightColor = highlightColor;
  tileset.style = makeHexColorStyle(state);
};

interface SchemaLike {
  classes?: Record<
    string,
    { properties?: Record<string, unknown> } | undefined
  >;
}

const schemaHasHexColor = (schema: SchemaLike | undefined): boolean =>
  Object.values(schema?.classes ?? {}).some(
    (it) => it?.properties?.[HEX_COLOR_PROPERTY] !== undefined,
  );

/**
 * Checks the tileset's metadata schema (3D Tiles 1.1) and its batch table
 * properties (legacy) for a `Hex_color` property.
 */
export const hasHexColorInTilesetMetadata = (
  tileset: Cesium3DTileset,
): boolean => {
  const { metadata, properties } = tileset as unknown as {
    metadata?: { schema?: SchemaLike };
    properties?: Record<string, unknown>;
  };
  if (schemaHasHexColor(metadata?.schema)) {
    return true;
  }
  return properties?.[HEX_COLOR_PROPERTY] !== undefined;
};

interface PropertyTableLike {
  propertyExists?: (name: string) => boolean;
}

interface BatchTableLike {
  featuresLength?: number;
  hasProperty?: (batchId: number, name: string) => boolean;
}

interface TileContentLike {
  // Private in Cesium, but the only way to reach the glTF metadata of vector tiles.
  _model?: unknown;
  model?: unknown;
  batchTables?: BatchTableLike[];
  featuresLength?: number;
  getFeature?: (id: number) => { hasProperty(n: string): boolean } | undefined;
}

const hasHexColorInTileContent = (tile: Cesium3DTile): boolean => {
  const content = tile.content as unknown as TileContentLike | undefined;
  if (content === undefined) {
    return false;
  }

  // Tiles with glTF content (including vector tiles) carry their metadata in the glTF.
  const model = (content._model ?? content.model) as
    | {
        structuralMetadata?: {
          schema?: SchemaLike;
          propertyTables?: PropertyTableLike[];
        };
      }
    | undefined;
  const metadata = model?.structuralMetadata;
  if (
    schemaHasHexColor(metadata?.schema) ||
    metadata?.propertyTables?.some((it) =>
      it.propertyExists?.(HEX_COLOR_PROPERTY),
    ) === true
  ) {
    return true;
  }

  // Legacy batch tables.
  if (
    content.batchTables?.some(
      (it) =>
        (it.featuresLength ?? 0) > 0 &&
        it.hasProperty?.(0, HEX_COLOR_PROPERTY) === true,
    ) === true
  ) {
    return true;
  }
  return (
    (content.featuresLength ?? 0) > 0 &&
    content.getFeature?.(0)?.hasProperty(HEX_COLOR_PROPERTY) === true
  );
};

/**
 * Colors the features of a tileset by their `Hex_color` property, if it has one.
 * Tilesets without that property (e.g. models carrying their own colors) are left untouched.
 *
 * The property may be declared on the tileset itself or only inside the tile contents (glTF metadata),
 * so if the tileset metadata doesn't tell, the first loaded tile is inspected instead.
 */
export const applyHexColorStyleIfAvailable = (
  tileset: Cesium3DTileset,
  getOpacity: () => number,
): void => {
  if (hasHexColorInTilesetMetadata(tileset)) {
    applyHexColorStyle(tileset, getOpacity());
    return;
  }

  const remove = tileset.tileLoad.addEventListener((tile) => {
    // Skip tiles without content of their own, such as an empty root tile.
    if (!tile.hasRenderableContent) {
      return;
    }
    remove();
    try {
      if (hasHexColorInTileContent(tile)) {
        applyHexColorStyle(tileset, getOpacity());
      }
    } catch (error) {
      console.warn('Failed to detect Hex_color in tile content', error);
    }
  });
};

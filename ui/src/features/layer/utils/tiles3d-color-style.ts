import { Cesium3DTile, Cesium3DTileset, Cesium3DTileStyle } from 'cesium';

export const HEX_COLOR_PROPERTY = 'Hex_color';

// Vector tiles ignore custom shaders, so the layer opacity has to be part of the style.
const makeHexColorStyle = (opacity: number): Cesium3DTileStyle =>
  new Cesium3DTileStyle({
    color: `color('\${${HEX_COLOR_PROPERTY}}', ${opacity})`,
  });

const styledTilesets = new WeakSet<Cesium3DTileset>();

const applyHexColorStyle = (
  tileset: Cesium3DTileset,
  opacity: number,
): void => {
  tileset.style = makeHexColorStyle(opacity);
  styledTilesets.add(tileset);
};

/**
 * Updates the opacity of a tileset that has been colored by `applyHexColorStyleIfAvailable`.
 * Does nothing for any other tileset.
 */
export const updateHexColorStyleOpacity = (
  tileset: Cesium3DTileset,
  opacity: number,
): void => {
  if (styledTilesets.has(tileset)) {
    tileset.style = makeHexColorStyle(opacity);
  }
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

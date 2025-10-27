import {
  BaseLayerController,
  mapLayerSourceToResource,
} from 'src/features/layer/new/controllers/layer.controller';
import {
  FilterOperator,
  LayerType,
  VoxelItemMapping,
  VoxelLayer,
  VoxelLayerMappingType,
  VoxelRangeMapping,
} from 'src/features/layer';
import {
  Cartesian4,
  Cesium3DTilesVoxelProvider,
  CustomShader,
  UniformSpecifier,
  UniformType,
  VoxelPrimitive,
} from 'cesium';
import { OBJECT_HIGHLIGHT_NORMALIZED_RGB } from 'src/constants';
import { sleep } from 'src/utils/fn.utils';

export class VoxelLayerController extends BaseLayerController<VoxelLayer> {
  private _primitive!: VoxelPrimitive;

  private knownKeys!: string[];

  get type(): LayerType.Voxel {
    return LayerType.Voxel;
  }

  get primitive(): VoxelPrimitive {
    return this._primitive;
  }

  zoomIntoView(): void {
    this.viewer.scene.camera.flyToBoundingSphere(
      this._primitive.boundingSphere,
    );
  }

  moveToTop(): void {
    this.viewer.scene.primitives.raiseToTop(this._primitive);
  }

  protected reactToChanges(): void {
    this.watch(this.layer.source);

    // Apply opacity to the Cesium layer.
    this.watch(this.layer.opacity, (opacity) => {
      this._primitive.customShader.setUniform('u_alpha', opacity);
    });

    // Show or hide the Cesium layer.
    this.watch(this.layer.isVisible, (isVisible) => {
      this._primitive.show = isVisible;
    });

    this.watch(this.layer.filterOperator, (operator) => {
      this.primitive.customShader.setUniform(
        'u_filterOperator',
        Object.values(FilterOperator).indexOf(operator),
      );
    });

    for (const mapping of this.layer.mappings) {
      const i = this.knownKeys?.indexOf(mapping.key) ?? -1;
      switch (mapping.type) {
        case VoxelLayerMappingType.Item:
          this.watch(mapping.items, () => {
            this.primitive.customShader.setUniform(
              `u_mapping${i}_enabledItemFlags`,
              makeItemMappingFlags(mapping),
            );
          });
          break;
        case VoxelLayerMappingType.Range:
          this.watch(mapping.enabledRange, (enabledRange) => {
            this.primitive.customShader.setUniform(
              `u_mapping${i}_enabledRange_min`,
              enabledRange[0],
            );
            this.primitive.customShader.setUniform(
              `u_mapping${i}_enabledRange_max`,
              enabledRange[1],
            );
          });
          this.watch(
            mapping.isUndefinedAlwaysEnabled,
            (isUndefinedAlwaysEnabled) => {
              this.primitive.customShader.setUniform(
                `u_mapping${i}_isUndefinedAlwaysEnabled`,
                isUndefinedAlwaysEnabled,
              );
            },
          );
          break;
      }
    }
  }

  protected async addToViewer(): Promise<void> {
    // Extract the keys supported by the layer.
    // These are important to be sorted the same, always,
    // as we use a key's index to communicate its state to the layer's shader.
    this.knownKeys = this.layer.mappings.map((it) => it.key);
    this.knownKeys.sort();

    // Our shader uses its key's index within `knownKeys` as identifier.
    // This means that there needs to be a 1:1 relation between keys and mappings.
    if (this.knownKeys.length !== new Set(this.knownKeys).size) {
      throw new Error(
        `Layer ${this.layer.id} contains multiple mappings referencing the same key`,
      );
    }

    // Create the voxel primitive.
    const resource = await mapLayerSourceToResource(this.layer.source);
    const provider = await Cesium3DTilesVoxelProvider.fromUrl(resource);
    const primitive = new VoxelPrimitive({
      provider: provider,
    });
    primitive.nearestSampling = true;
    primitive.depthTest = true;
    primitive.customShader = this.createShader();

    // Hide the layer until its ready.
    primitive.show = false;

    // Extract the step size from the url.
    // The step size defines how detailed/coarse the voxels are sampled.
    // Smaller means finer, providing accuracy at the cost of performance.
    const searchParams = new URLSearchParams(location.search);
    if (searchParams.has('stepSize')) {
      primitive.stepSize = parseFloat(searchParams.get('stepSize') ?? '1');
    }

    // Workaround to make exaggeration work on the voxel primitive.
    const maxExaggerationFactor = 10;
    primitive.maxClippingBounds.z =
      primitive.maxBounds.z * maxExaggerationFactor;

    const { primitives } = this.viewer.scene;
    const i =
      this._primitive === null
        ? null
        : this.findIndexInPrimitives(this._primitive);
    if (i === null) {
      // Add a new Cesium layer.
      primitives.add(primitive);
    } else {
      // Replace an existing Cesium layer.
      this.removeFromViewer();
      primitives.add(primitive, i);
    }
    this._primitive = primitive;

    // Wait for the primitive to become ready, then make it visible.
    while (!primitive.ready) {
      await sleep(100);
    }
    primitive.show = this.layer.isVisible;
  }

  protected removeFromViewer(): void {
    const { primitive } = this;
    if (primitive === undefined) {
      return;
    }
    // TODO There is currently an issue where removing a VoxelPrimitive *always* throws an error in the next render cycle.
    //      I'm assuming this has something to do with the new, non-experimental voxel types.
    //      For now, we just hide the layer instead of removing it.
    //      DVA, 2025-06-11
    primitive.show = false;
    this._primitive = undefined as unknown as VoxelPrimitive;
  }

  /**
   * Creates a custom shader for the layer.
   *
   * Note that this function is written so that the generated shader code will be
   * the same for all layers containing the exact same `mapping` field.
   * This makes it so that the source only has to be compiled once for such layers.
   * @private
   */
  private createShader(): CustomShader {
    const { layer, knownKeys } = this;

    // Find the mapping that should be displayed.
    const display = layer.mappings.find((it) => it.key === layer.dataKey);
    if (display === undefined) {
      throw new Error(
        `Can't create shader, no mapping found for data key '${layer.dataKey}'`,
      );
    }

    // Find the index of the displayed key.
    const displayKeyIndex = knownKeys.indexOf(display.key);

    // Generate the shader code for each mapping.
    const mappingFunctions = layer.mappings.map((mapping) => {
      const i = knownKeys.indexOf(mapping.key);
      return mapping.type === VoxelLayerMappingType.Item
        ? this.makeShaderFunctionsForItemMapping(mapping, i)
        : this.makeShaderFunctionsForRangeMapping(mapping, i);
    });

    // Generate the if-else statement that generates the color from the currently selected value.
    const colorGenerationStatements = knownKeys.map(
      (_key, i) =>
        `${i === 0 ? 'if' : 'else if'} (u_displayKeyIndex == ${i}) color = getColorForValue${i}(value);`,
    );

    // Generate the if-else statement that filters based on enabled mappings.
    const matchCondition = {
      [FilterOperator.And]: `matchCount == ${layer.mappings.length}`,
      [FilterOperator.Or]: 'matchCount > 0',
      [FilterOperator.Xor]: 'matchCount == 1',
    };
    const matchCode = Object.values(FilterOperator).map(
      (key, i) =>
        `${i === 0 ? 'if' : 'else if'} (u_filterOperator == ${i}) { if (!(${matchCondition[key]})) { return; }}`,
    );

    const code = `
      const float NO_DATA_VALUE = ${mapFloatToShader(layer.values.noData)};
      const float UNDEFINED_VALUE = ${mapFloatToShader(layer.values.undefined)};

      const vec4 TRANSPARENT = vec4(0.0, 0.0, 0.0, 0.0);

      bool isUndefined(float value) {
        return abs(value - UNDEFINED_VALUE) < 0.0001;
      }

      bool isNoData(float value) {
        return abs(value - NO_DATA_VALUE) < 0.0001;
      }

      ${mappingFunctions.map(([shader]) => shader).join('\n')}

      void fragmentMain(FragmentInput fsInput, inout czm_modelMaterial material)
      {
        // Filter out tiles that don't contain any values.
        bool areAllValuesUndefined = ${knownKeys.map((key) => `isUndefined(fsInput.metadata.${key})`).join(' && ')};
        if (areAllValuesUndefined) {
           return;
        }

        float values[${knownKeys.length}] = float[](
            ${knownKeys.map((key) => `fsInput.metadata.${key}`).join(',')}
        );

        // Select the currently displayed value.
        float value = values[u_displayKeyIndex];

        // Filter out nodata values.
        if (isNoData(value)) {
          return;
        }

        // Apply mapping filters.
        // For this, we count the number of matching mappings,
        // and then analyze that result via the selected filter operator.
        int matchCount = ${knownKeys.map((key, i) => `int(isMatching${i}(fsInput.metadata.${key}) ? 1 : 0)`).join(' + ')};
        ${matchCode.join('\n')}

        // Apply light to the material. This gives it depth.
        float diffuse = max(0.0, dot(fsInput.attributes.normalEC, czm_lightDirectionEC));
        float lighting = 0.5 + 0.5 * diffuse;

        // Highlight the tile if its currently selected.
        if (fsInput.voxel.tileIndex == u_selectedTile && fsInput.voxel.sampleIndex == u_selectedSample) {
          material.diffuse = vec3(${OBJECT_HIGHLIGHT_NORMALIZED_RGB}) * lighting;
          material.alpha = u_alpha;
          return;
        }

        vec4 color;
        ${colorGenerationStatements.join('\n')}

        material.diffuse = color.rgb * lighting;
        material.alpha = color.a * u_alpha;
      }
    `;
    return new CustomShader({
      fragmentShaderText: code,
      uniforms: {
        // The index within `knownKeys` of the key that should be displayed.
        u_displayKeyIndex: {
          type: UniformType.INT,
          value: displayKeyIndex,
        },

        // The alpha applied to the displayed material.
        u_alpha: {
          type: UniformType.FLOAT,
          value: layer.opacity,
        },

        // The index of the currently highlighted tile.
        u_selectedTile: {
          type: UniformType.INT,
          value: -1.0,
        },

        // The index of the currently highlighted sample.
        u_selectedSample: {
          type: UniformType.INT,
          value: -1.0,
        },

        u_filterOperator: {
          type: UniformType.INT,
          value: Object.values(FilterOperator).indexOf(layer.filterOperator),
        },

        ...mappingFunctions.reduce(
          (acc, [_shader, uniforms]) => ({ ...acc, ...uniforms }),
          {} as ShaderUniforms,
        ),
      },
    });
  }

  private makeShaderFunctionsForItemMapping(
    mapping: VoxelItemMapping,
    mappingIndex: number,
  ): [string, ShaderUniforms] {
    const prefix = `mapping${mappingIndex}`;
    const values = mapping.items.map((it) => mapFloatToShader(it.value));
    const colors = mapping.items.map((it) => mapColorToShader(it.color));
    const shader = `
      const int ${prefix}_ITEM_COUNT = ${mapping.items.length};
      const float ${prefix}_VALUES[${prefix}_ITEM_COUNT] = float[](
        ${values.join(',')}
      );
      const vec3 ${prefix}_COLORS[${prefix}_ITEM_COUNT] = vec3[](
        ${colors.join(',')}
      );

      int ${prefix}_findIndex(float value) {
        for (int i = 0; i < ${prefix}_ITEM_COUNT; i++) {
          if (abs(value - ${prefix}_VALUES[i]) < 0.0001) {
            return i;
          }
        }
        return -1;
      }

      vec4 getColorForValue${mappingIndex}(float value) {
        int index = ${prefix}_findIndex(value);
        return index < 0
          ? TRANSPARENT
          : vec4(${prefix}_COLORS[index], 1.0);
      }

      bool isMatching${mappingIndex}(float value) {
        int index = ${prefix}_findIndex(value);
        if (index < 0 || index > ${prefix}_ITEM_COUNT) {
          return false;
        }

        // 'w' is the index of the value within the int flag array (0 <= w <= 3).
        int w = index / 32;

        // 'b' is the index of the bit on the int flag defined by 'w' (0 <= b <= 31).
        int b = index % 32;

        // 'word' is the int flag defined by 'w' which contains the bit defined by 'b'.
        int word = u_${prefix}_enabledItemFlags[w];

        // Check if the bit defined by 'b' is set.
        return ((word >> b) & 1) != 0;
      }
    `;
    return [
      shader,
      {
        [`u_${prefix}_enabledItemFlags`]: {
          type: UniformType.INT_VEC4,
          value: makeItemMappingFlags(mapping),
        },
      },
    ];
  }

  private makeShaderFunctionsForRangeMapping(
    mapping: VoxelRangeMapping,
    mappingIndex: number,
  ): [string, ShaderUniforms] {
    const prefix = `mapping${mappingIndex}`;
    const colors = mapping.colors.map(mapColorToShader);
    const shader = `
      const int ${prefix}_COLOR_COUNT = ${colors.length};
      const vec3 ${prefix}_COLORS[${prefix}_COLOR_COUNT] = vec3[](
        ${colors.join(',')}
      );

      const float ${prefix}_MIN = ${mapFloatToShader(mapping.range[0])};
      const float ${prefix}_MAX = ${mapFloatToShader(mapping.range[1])};

      vec4 getColorForValue${mappingIndex}(float value) {
        if (value < ${prefix}_MIN || value > ${prefix}_MAX) {
          return TRANSPARENT;
        }

        float denom = max(${prefix}_MAX - ${prefix}_MIN, 1e-6);
        float t = clamp((value - ${prefix}_MIN) / denom, 0.0, 1.0);

        float x = t * float(${prefix}_COLOR_COUNT - 1);
        int i = int(floor(x));
        int j = min(i + 1, ${prefix}_COLOR_COUNT - 1);
        float f = fract(x);

        vec3 c = mix(${prefix}_COLORS[i], ${prefix}_COLORS[j], f);
        return vec4(c, 1.0);
      }

      bool isMatching${mappingIndex}(float value) {
        return
          // Match if the value is within the enabled range.
          (u_${prefix}_enabledRange_min <= value && value <= u_${prefix}_enabledRange_max);
      }
    `;

    return [
      shader,
      {
        [`u_${prefix}_enabledRange_min`]: {
          type: UniformType.FLOAT,
          value: mapping.enabledRange[0],
        },
        [`u_${prefix}_enabledRange_max`]: {
          type: UniformType.FLOAT,
          value: mapping.enabledRange[1],
        },
        [`u_${prefix}_isUndefinedAlwaysEnabled`]: {
          type: UniformType.BOOL,
          value: mapping.isUndefinedAlwaysEnabled,
        },
      },
    ];
  }
}

const mapColorToShader = (color: string): string => {
  const [r, g, b] = color
    .match(/\d+/g)!
    .map((it) => mapFloatToShader(Number(it) / 255));
  return `vec3(${r}, ${g}, ${b})`;
};

const mapFloatToShader = (value: number): string => {
  const str = `${value}`;
  const decimalIndex = str.indexOf('.');
  if (decimalIndex < 0) {
    return `${str}.0`;
  }
  const decimalCount = str.length - decimalIndex - 1;
  if (decimalCount > 6) {
    return value.toFixed(6);
  }
  return str;
};

interface ShaderUniforms {
  [key: string]: UniformSpecifier;
}

const makeItemMappingFlags = (mapping: VoxelItemMapping): Cartesian4 => {
  const itemCount = mapping.items.length;
  if (itemCount > 128) {
    // We pass the item mappings to the shader via an `ivec4`, which consists of exactly 4 ints.
    // Each int contains 32 bits, setting the upper limit of 128 flags supported by this method.
    // If we ever want to support more, we need to switch to LUD texture lookups.
    throw new Error('Item mapping supports a maximum of 128 items.');
  }

  // `words` is an array of four integers, each representing the state of up to 32 items.
  const words = new Int32Array(4);

  // Set the flag for each item.
  for (let i = 0; i < itemCount; i++) {
    if (mapping.items[i].isEnabled) {
      words[i >> 5] |= 1 << (i & 31);
    }
  }

  // Fill the remaining, unused words with 0.
  for (let i = Math.ceil(itemCount / 32); i < 4; i++) {
    words[i] = 0;
  }

  // Ensure that each flag is an integer.
  return Cartesian4.fromArray(Array.from(words.map((flag) => flag | 0)));
};

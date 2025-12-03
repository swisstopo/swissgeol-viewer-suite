# Voxel Layer Config
The following is an overview of the properties that are available to the `Voxel` layer type.
In addition to these properties, the [shared properties](./shared-layer-config.md) are also available.
Voxel layers are layers that display data in the voxel 3dtiles format.
> For the `source` field, see [`LayerSource`](./layer-source-config.md).
```json5
{
  // The layer's type, defining it as a Voxel layer.
  //
  // @type 'Voxel'
  // @required
  type: 'Voxel',
  
  // @type LayerSource
  // @required
  source: {},

  // The key that contains the data displayed by this layer.
  // Voxel tilesets can contain multiple keys per datapoint,
  // and this field defines which of these keys is displayed.
  //
  // @type string
  // @required
  data_key: 'the-data-key',
  
  // @required
  values: {
    // The value which signifies that a datapoint is absent.
    // "Absence" here means that it doesn't exist, and does not need to be displayed.
    //
    // @type integer
    // @required
    no_data: 1,

    // The value that represents a datapoint without a value.
    // The datapoint still exists and should be displayed, it just isn't backed by a meaningful value.
    //
    // The main use of undefined values is for datapoints that are only meaningful for specific mappings.
    // If a datapoint is undefined on all mapped keys, it may be treated as `no_data`.
    //
    // @type integer
    // @required
    undefined: 2, 
  },

  /// The layer's value mappings.
  /// This determines how the layer can be rendered and otherwise displayed to the user.
  //
  // @type VoxelLayerMapping
  // @required
  mappings: [],
}
```

## The `VoxelLayerMapping` type
The mappings of a Voxel layer define how the layer's data can be displayed and filtered.
There exist two types of mappings: item mappings and range mappings.

### Item Mappings
An item mapping represents a discrete set of values.
It can be used when the layer contains a known set of values, where each value has a specific meaning.
```json5
{
  // The key of the property that contains the data points.
  // This is the same type of key as on the config's top-level `data-key` property.
  //
  // @type string
  // @required
  key: 'the-data-key',

  /// The mapping's items.
  /// Each item represents a unique value.
  //
  // @type string
  // @required
  items: [
    // A single item is represented as an array with two elements.
    // The first element is the item's value, the second its label and color.
    [1, {
      // The translation key providing the display name for the item.
      //
      // @type string
      // @required
      label: 'the-label-translation-key',

      /// The color in which this value is displayed.
      //
      // @type string
      // @required
      color: 'rgb(1, 2, 3)',
    }],
  ],
}
```

### Range Mappings
A range mapping defines a range of values with a fixed upper and lower bound.
```json5
{
  // The key of the property that contains the data points.
  // This is the same type of key as on the config's top-level `data-key` property.
  //
  // @type string
  // @required
  key: 'the-data-key',

  /// The minimum and maximum values of the data points.
  ///
  /// @type [integer, integer]
  /// @required
  range: [0, 1],

  /// The colors with which the range is displayed.
  ///
  /// If this has the same length as `range`, each value gets its own, specific value.
  /// If there are fewer colors than values, the colors are interpreted as a gradient on which the values can be placed.
  //
  // @type string[]
  // @required
  colors: [
    'rgb(1, 2, 3)',
    'rgb(2, 3, 1)',
    'rgb(3, 1, 2)',
  ],
}
```

## Simple Configuration Example
A simple Voxel layer configuration:
```json5
{
  type: 'Voxel',
  id: 'my-layer-id',
  source: {
    type: 'Url',
    url: 'https://my-voxel.ch/source'
  },
  values: {
    no_data: -99999,
    undefined: -9999,
  },
  data_key: 'Index',
  mappings: [
    {
      key: 'Index',
      items: [
        [3, { label: 'my-voxel.Index.3', color: 'rgb(3, 3, 3)' }],
        [4, { label: 'my-voxel.Index.4', color: 'rgb(4, 4, 4)' }],
      ],
    },
    {
      key: 'logk',
      range: [0, 10],
      colors: ['rgb(1, 1, 1)', 'rgb(2, 2, 2)', 'rgb(3, 3, 3)']
    },
  ],
  download_url: 'https://my-download-url.com',
  geocat_id: 'my-geocat-id',
}
```

## Reusing `mappings`
The values used within the `mappings` are are often the same across multiple layers.
To not have to repeat the same configuration multiple times,
the mappings can be defined at the top-level of the `layertree.json`,
and then be referenced by name in your `mappings` array.
```json5
// layertree.json5
{
  // This is a top-level collection containing reusable `mappings` elements.
  voxel_mappings: {
    my_shared_mapping: {
      key: 'logk',
      range: [0, 10],
      colors: ['rgb(1, 1, 1)', 'rgb(2, 2, 2)', 'rgb(3, 3, 3)']
    }
  },
  
  layers: [
    {
      type: 'Voxel',
      id: 'my-first-layer',
      mappings: ['my_shared_mapping'], // Reference the shared element by its key.
      
      // Other properties...
    },
    {
      type: 'Voxel',
      id: 'my-second-layer',
      mappings: ['my_shared_mapping'], // Reference the shared element by its key.
      
      // Other properties...
    },
  ],
}
```
> The top-level `voxel_mappings` is available to the file itself, as well as any files included by it.
> Files that include another file with `voxel_mappings` do not inherit these values.
> In other words, `voxel_mappings` works top-down -
> you get it if you're further down, but not if you're further up the include chain.
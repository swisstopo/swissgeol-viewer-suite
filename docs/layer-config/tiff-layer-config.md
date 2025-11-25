# Voxel Tiff Config
The following is an overview of the properties that are available to the `Tiff` layer type.
In addition to these properties, the [shared properties](./shared-layer-config.md) are also available.
Tiff layers are layers that display data in the geoTIFF format.
> For the `source` field, see [`LayerSource`](./layer-source-config.md).
```json5
{
  // The layer's type, defining it as a Tiff layer.
  //
  // @type 'Tiff'
  // @required
  type: 'Tiff',
  
  // @type LayerSource
  // @required
  source: {},

  // The width and height of each of the TIFF's cells, in meters.
  //
  // @type integer
  // @required
  cell_size: 1,
  
  //  Configurations for the Tiff's bands.
  //
  // @type TiffLayerBand[]
  // @required
  bands: []
}
```

## The `TiffLayerBand` type
A Tiff can contain multiple bands, each containing different values.
Each band has to be configured via a `TiffLayerBand` to be available in the application.
```json5
{
  // The band's index within the Tiff file.
  //
  // @type integer
  // @required
  index: 1,

  // The band's name.
  // To translate this name, it will be treated as a property of the layer,
  // e.g. `layers:properties.{my-layer-id}.{my-band-name}`.
  //
  // @type string
  // @required
  name: 'my-band-name',

  // The unit of the band's values.
  // This is used to format and annotate the band's legend and picks.
  // If this is left out, then the band values will be shown as-is.
  //
  // @type 'Meters' | 'MetersAboveSeaLevel' | null
  // @default null
  unit: null,

  // The band's display configuration, defining how the band is rendered.
  // If is this left out, then the band can't be displayed individually.
  //
  // @type TiffLayerBandDisplay | null
  // @default null
  display: null,
}
```

## The `TiffLayerBandDisplay` type
To define how a band is displayed, its configuration has to contain a `TiffLayerBandDisplay` object.
```json5
{
  // The lower and upper bounds of displayed values.
  //
  // @type [integer, integer]
  // @required
  bounds: [0, 1],

  // The value that represents the absence of data on this band.
  // Tiles matching that value will not be rendered.
  //
  // @type integer | null
  // @default null
  no_data: null,
  
  // The color map with which the band is rendered.
  //
  // @type string
  // @required
  color_map: 'color-map-name',
  
  // Custom steps that are shown on the band's colored legend.
  // If left out, these steps will be calculated from `bounds`.,
  //
  // @type TiffLayerBandSteps
  // @default null
  steps: null,
}
```

## The `TiffLayerBandSteps` type
A `TiffLayerBandSteps` object defines the steps displayed on a Tiff's legend.
There are three ways to define these steps: as evenly separated labels, as simple step values, or as labelled step values.
To calculate the steps' positions, the band's `bounds` are used.

### Evenly Separated Labels
When `steps` is a simple string array, the labels will be spread evenly across the layer's legend.
```json5
["first-step", "second-step", "third-step"]
```

### Simple Step Values
When `steps` is a simple integer array, each step will be labelled with its own value,
and be positioned relative to the band's bounds.
For example, if `bounds: [0, 100]`, a step of value `50` would be positioned right in the middle of the legend.
```json5
[0, 25, 50, 75, 100]
```

### Labelled Step Values
When `steps` is an array of objects, each object's `value` defines its position,
while its `label` defines its display label.
```json5
[
  { value: 0, label: 'Start' },
  { value: 50, label: 'Middle' },
  { value: 100, label: 'End' },
]
```
Labelled step values can be mixed with simple step values:
```json5
[0, { value: 50, label: 'Middle' }, 100]
```

## Simple Configuration Example
A simple Tiff layer configuration:
```json5
{
  type: 'Tiff',
  id: 'my-layer-id',
  source: {
    type: 'Url',
    url: 'https://my-voxel.ch/source'
  },
  cell_size: 10,
  bands: [
    {
      index: 1,
      name: 'MyBand',
      unit: 'Meters',
      display: {
        bounds: [0, 10],
        no_data: 0,
        color_map: 'swissBEDROCK_TMUD',
        steps: [0, 2, 5, 8, 10],
      }
    }
  ],
  download_url: 'https://my-download-url.com',
  geocat_id: 'my-geocat-id',
}
```

## Reusing `display` Configurawtion
The values used within the `display` are are often the same across multiple layers.
To not have to repeat the same configuration multiple times,
the mappings can be defined at the top-level of the `layertree.json`,
and then be referenced by name in your `bands` array.
```json5
// layertree.json5
{
  // This is a top-level collection containing reusable `mappings` elements.
  tiff_displays: {
    my_shared_display: {
      bounds: [0, 10],
      no_data: 0,
      color_map: 'swissBEDROCK_TMUD',
      steps: [0, 2, 5, 8, 10],
    }
  },
  
  layers: [
    {
      type: 'Tiff',
      id: 'my-first-layer',
      display: 'my_shared_display' // Reference the shared value by its key.
      
      // Other properties...
    },
    {
      type: 'Tiff',
      id: 'my-second-layer',
      display: 'my_shared_display' // Reference the shared value by its key.

      // Other properties...
    },
  ],
}
```
> The top-level `tiff_displays` is available to the file itself, as well as any files included by it.
> Files that include another file with `tiff_displays` do not inherit these values.
> In other words, `tiff_displays` works top-down -
> you get it if you're further down, but not if you're further up the include chain.
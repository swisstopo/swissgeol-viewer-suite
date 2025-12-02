# Shared Layer Configs
The following is an overview of the properties that are available to all layer configurations,
independent of their layer type.
```json5
{
  // The layer's type.
  // This defines the layer's format, as well as additional configuration properties.
  //
  // @type 'Wmts' | 'Tiles3d' | 'Voxel' | 'Tiff' | 'Earthquakes'
  // @required
  type: '{required}',
  
  // The layer's id.
  // This must be unique across all configured layer.
  //
  // @type string
  // @required
  id: 'the-layer-id',
  
  // A value from 0 to 1 that defines the layer's default opacity.
  // Can be set to `Disabled` to fix the layer at an opacity of 1.
  //
  // @type 0..1 | 'Disabled'
  // @default 1
  opacity: 1,
  
  // The id of the layer on https://geocat.ch, if available.
  // If left out, then the layer will not link to geocat.
  //
  // @type string | null
  // @default null
  geocat_id: null,
  
  // The url at which the layer (or a representation of it) can be downloaded.
  // If left out, no such download will be available.
  //
  // @type string | { de: string, en: string, fr: string, it: string } | null
  // @default null
  download_url: null,
  
  // The id of the legend image to display.
  // Can be set to `true` to instead fetch a WMTS HTML legend based on the layer's id.
  // If left out, no legend will be available for the layer.
  //
  // @type string | true | null
  // @default null
  legend: null,
  
  // A JSON object containing custom properties.
  // These properties are appended to the layer's normal properties when picking.
  // 
  // @type { [key: string]: string }
  // @default null
  custom_properties: {},
  
  // A JSON object defining who has access to this layer.
  // If left out, the layer is publicly available.
  //
  // @default null
  access: {
    // A list of cognito groups.
    // Access is granted if the current user belongs to at least one of these groups.
    // If empty, no group is required.
    //
    // @type string[]
    // @default []
    groups: [],

    // A list of environment names.
    // Access is granted if the app is running within one of these environments.
    // If empty, the layer is shown an all environments.
    //
    // @type Array<'local' | 'dev' | 'int' | 'prod'>
    // @default []
    env: []
  }
}
```

# Earthquakes Layer Config
The following is an overview of the properties that are available to the `Earthquakes` layer type.
In addition to these properties, the [shared properties](./shared-layer-config.md) are also available.

Earthquakes layers are layers that display earthquake epicenters.
> For the `source` field, see [`LayerSource`](./layer-source-config.md).
```json5
{
  // The layer's type, defining it as an Earthquakes layer.
  //
  // @type 'Earthquakes'
  // @required
  type: 'Earthquakes',

  // @type LayerSource
  // @required
  source: {},
}
```

## Simple Configuration Example
A simple Earthquakes layer configuration:
```json5
{
  type: 'Wmts',
  id: 'my-layer-id',
  source: {
    type: 'Url',
    url: 'https://my-voxel.ch/source'
  },
  download_url: 'https://my-download-url.com',
  geocat_id: 'my-geocat-id',
}
```

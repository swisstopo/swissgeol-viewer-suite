# Wmts Layer Config
The following is an overview of the properties that are available to the `Wmts` layer type.
In addition to these properties, the [shared properties](./shared-layer-config.md) are also available.

Wmts layers are layers that pull data from the geoadmin WMS and WMTS services.
```json5
{
  // The layer's type, defining it as a WMTS layer.
  //
  // @type 'Wmts'
  // @required
  type: 'Wmts',

  // The layer's id.
  // This must be unique across all configured layer.
  // For Wmts layers, this is also the id on the WM(T)S service.
  //
  // @type string
  // @required
  id: 'ch.swisstopo.the-layer-id',

  // The zoom level (zoomed in) from which on no higher resolution tiles will be fetched.
  // Instead, this level's tiles will be scaled up to fit higher zoom levels.
  // If left out, then there is no limit on the zoom level.
  // 
  // @type integer
  // @default null
  max_level: null,
}
```

## Simple Configuration Example
A simple Wmts layer configuration:
```json5
{
  type: 'Wmts',
  id: 'my-layer-id',
  opacity: 0.7,
  download_url: 'https://my-download-url.com',
  geocat_id: 'my-geocat-id',
  legend: true,
}
```

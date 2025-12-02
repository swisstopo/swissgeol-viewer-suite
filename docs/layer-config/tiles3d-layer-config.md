# Tiles3d Layer Config
The following is an overview of the properties that are available to the `Tiles3d` layer type.
In addition to these properties, the [shared properties](./shared-layer-config.md) are also available.
Tiles3d layers are layers that display data in the 3dtiles format.
> For the `source` field, see [`LayerSource`](./layer-source-config.md).
```json5
{
  // The layer's type, defining it as a Tiles3d layer.
  //
  // @type 'Tiles3d'
  // @required
  type: 'Tiles3d',
  
  // @type LayerSource
  // @required
  source: {},

  // The order in which the layer's properties are sorted when displayed.
  // Keys that are left out will be sorted below any sorted ones, in default order.
  //
  // @type string[]
  // @default []
  order_of_properties: [],
}
```

## Simple Configuration Example
A simple Tiles3d layer configuration:
```json5
{
  type: 'Tiles3d',
  id: 'my-layer-id',
  source: {
    type: 'CesiumIon',
    asset_id: 1234,
  },
  order_of_properties: ['a', 'b', 'c'],
  download_url: 'https://my-download-url.com',
  geocat_id: 'my-geocat-id',
}
```

## Reusing `order_of_properties`
The `order_of_properties` array is often the same for multiple, adjacent layers.
To not have to repeat the same array multiple times,
your `order_of_properties` can be defined at the top-level of the `layertree.json5`
and then be referenced by name in your `layers` array.
```json5
// layertree.json5
{
  // This is a top-level collection containing reusable `order_of_properties` values.
  order_of_properties: {
    my_shared_properties: ['a', 'b', 'c']
  },
  
  layers: [
    {
      type: 'Tiles3d',
      id: 'my-first-layer',
      order_of_properties: 'my_shared_properties', // Reference the shared value by its key.
      
      // Other properties...
    },
    {
      type: 'Tiles3d',
      id: 'my-second-layer',
      order_of_properties: 'my_shared_properties', // Reference the shared value by its key.
      
      // Other properties...
    },
  ],
}
```
> The top-level `order_of_properties` is available to the file itself, as well as any files included by it.
> Files that include another file with `order_of_properties` do not inherit these values.
> In other words, `order_of_properties` works top-down -
> you get it if you're further down, but not if you're further up the include chain.
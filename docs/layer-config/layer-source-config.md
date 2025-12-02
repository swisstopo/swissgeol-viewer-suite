# LayerSource Config Type
In the following, all possible structures for the `LayerSource` type are described.
You can use any of them wherever a `LayerSource` object is required.

## `CesiumIon` source
The `CesiumIon` source links to a Cesium Ion asset.
```json5
{
  type: 'CesiumIon',
  
  // The id of the asset in Cesium Ion.
  //
  // @type integer
  // @required
  asset_id: 1,
}
```

## `Url` source
The `CesiumIon` source links to a fully customizable, static HTTP url.
```json5
{
  type: 'Url',
  
  // The url at which the data can be found.
  //
  // @type string
  // @required
  url: 'https://example.com'
}
```

## `S3` source
The `S3` source links to an S3 object, identified by its bucket and the key within that bucket.
```json5
{
  type: 'S3',
  
  // The name of the bucket.
  //
  // @type string
  // @required
  bucket: 'the-bucket-name',

  // The key at which the object is stored.
  //
  // @type string
  // @required
  key: 'the-key'
}
```

## `Ogc` source
The `Ogc` source links to an OGC API collection.
> Currently, The `Ogc` source is only supported on S3 tiles.
```json5
{
  type: 'Ogc',
  
  // The id of the ogc collection.
  //
  // @type integer
  // @required
  id: 1,

  // The id of the style with which the data is displayed.
  //
  // @type integer | null
  // @default null
  style_id: null,
  
  // An optional source that will be used instead of Ogc when displaying the layer.
  // When this is set, the OGC API will only be used for layer exports.
  //
  // @type LayerSource | null
  // @default null
  display_source: null,
}
```


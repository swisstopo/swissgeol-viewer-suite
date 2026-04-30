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
  url: 'https://example.com',
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
  key: 'the-key',
}
```

## `Ogc` source

The `Ogc` source links to an OGC API collection.

> Currently, The `Ogc` source is only supported on 3D tiles.

```json5
{
  type: 'Ogc',
  // The OGC source configuration object.
  //
  // @type object
  // @required
  ogc_source: {
    // The type of OGC source.
    // Possible values: 'gst', 'stac', 'fdsn', 'wms'
    //
    // @type string
    // @required
    ogcType: 'gst',
    // For 'gst' type only:
    // The id of the ogc collection.
    //
    // @type integer
    // @required (for gst)
    id: 1,
    // For 'gst' type only:
    // The id of the style with which the data is displayed.
    //
    // @type integer | null
    // @default null
    style_id: null,
    // For 'stac' type only:
    // The collection identifier.
    //
    // @type string
    // @required (for stac)
    collection: 'ch.swisstopo.collection_name',
  },
  // An optional source that will be used instead of Ogc when displaying the layer.
  // When this is set, the OGC API will only be used for layer exports.
  //
  // @type LayerSource | null
  // @default null
  display_source: null,
}
```

### OGC Source Types

#### GST (GeoScience Tiles)

Used for accessing 3D tile collections from the GST service.

```json5
{
  type: 'Ogc',
  ogc_source: {
    ogcType: 'gst',
    id: 13327,
    style_id: 5,
    // optional
  },
}
```

#### STAC (SpatioTemporal Asset Catalog)

Used for accessing STAC collections.

```json5
{
  type: 'Ogc',
  ogc_source: {
    ogcType: 'stac',
    collection: 'ch.swisstopo.swissbuildings3d_2',
  },
  display_source: {
    type: 'Url',
    url: 'https://example.com/tileset.json',
  },
}
```

#### FDSN & WMS

Reserved for future use. Not yet implemented.

```json5
{
  type: 'Ogc',
  ogc_source: {
    ogcType: 'fdsn',
    // or 'wms'
  },
}
```

# Layers

_Layers_ are visual data sources that are rendered on the Viewer's map.
They represent the application's core data and are subject to most of its functions.

## Configuration

Layers are configured in [layers/layers.json5](../../layers/layers.json5) and exposed via the API.

## Types of Layers

A layer's type defines how it is defined, fetched, displayed, as well as what can be done with it.
Layers are divided into the following types:

- `Swisstopo` layers are [WMS](https://www.geo.admin.ch/de/wms-verfuegbare-dienste-und-daten/) or
  [WMTS](https://www.geo.admin.ch/de/wmts-verfuegbare-dienste-und-daten/) layers fetched from their respective `geo.admin.ch` API.
  They are flat map overlays.
- `Tiff` layers are [GeoTIFF](https://www.earthdata.nasa.gov/about/esdis/esco/standards-practices/geotiff) files.
  They are flat map overlays that support multiple datasets on a single layer.
- `Tiles3d` layers are [3D Tiles](https://cesium.com/why-cesium/3d-tiles/).
  These support displaying of 3d shapes of varying numbers, types, shapes and sizes.
- `Voxel` layers are collections of 3d voxel tiles.

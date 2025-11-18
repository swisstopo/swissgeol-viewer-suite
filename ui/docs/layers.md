# Layers

_Layers_ are visual data sources that are rendered on the Viewer's map.
They represent the application's core data and are subject to most of its functions.

## Configuration

Layers are configured in [layers/layers.json5](../../layers/layers.json5) and exposed via the API.

> The structure of layers within the application can differ from
> how they are defined within their configuration files.

## Types of Layers

A layer's type defines how it is defined, fetched, displayed, as well as what can be done with it.
Layers are divided into the following types:

- `Wmts` layers are [WMS](https://www.geo.admin.ch/de/wms-verfuegbare-dienste-und-daten/) or
  [WMTS](https://www.geo.admin.ch/de/wmts-verfuegbare-dienste-und-daten/) layers fetched from their respective `geo.admin.ch` API.
  They are flat map overlays.
- `Tiff` layers are [GeoTIFF](https://www.earthdata.nasa.gov/about/esdis/esco/standards-practices/geotiff) files.
  They are flat map overlays that support multiple datasets on a single layer.
- `Tiles3d` layers are [3D Tiles](https://cesium.com/why-cesium/3d-tiles/).
  These support displaying of 3d shapes of varying numbers, types, shapes and sizes.
- `Voxel` layers are collections of 3d voxel tiles.
- `Kml` layers are layers created from KML files.
  Note that unlike most other layers, KMLs can only be uploaded at runtime and cannot be defined in the app's configuration.

There is another type of layer, `Background`, which represents the base layer, i.e. the terrain and the map draped right on top of it.
The background behaves a bit differently from most other layers.
Above all else, only a single `Background` does and will ever exist during the lifetime of the application.
The background is configured and managed directly inside the application.
Most of the time, neither users nor developers need to actually worry about differentiating between "normal" layers
and the background, although knowing that it's there doesn't hurt.

## Layer Groups and the Catalog

All configured and exposed layers are categorized within at least one _layer group_.
Such a group is simply a name associated with a collection of layers.
Optionally, a group may also contain other groups, meaning that layer groups can be nested within each other.

All layers and their groups together result in a tree-like structure which we call the _layer catalog_.
That catalog is how layers are made available to the user within the web app.
The groups that are not nested within another sit at the top of the catalog.
These are the _root groups_ and represent the catalog's entry points.

## Implementation

The following section details how the layers are implemented inside the application.
Note that with "application", we mostly refer to the `ui/` web app here.
The API backend does parse and expose the layer configuration, but is not involved any further than that.

### Implementation: Types

All layers are defined as subtypes of [`BaseLayer`](../src/features/layer/models/layer.model.ts).
It defines the attributes shared between all layer types, including `Background`.

Concrete subtypes of `BaseLayer` are referred to as "layer types",
while their instances are simply called "layers".
These layers are simple, immutable data objects.
They represent state, without providing actual behavior.

When typing layers, you should not use `BaseLayer` itself.
If you want to refer to multiple layer types at once, use the `Layer` type,
which is a union of all layer types, excluding `Background`.
This is almost always what you actually want, and gives you nice typings for most situations.
In cases where you're sure that you also want to include `Background`,
there is `AnyLayer`, which extends `Layer` with the `BackgroundLayer` type.

To give an overview of all relevant types:

- `BaseLayer` is the base type for all layers.
- `Layer` is a type made up of all _normal_ layer types, which are:
  - `WmtsLayer`
  - `TiffLayer`
  - `Tiles3dLayer`
  - `VoxelLayer`
- `AnyLayer` is a type made up of all _available_ layer types,
  which essentially means `Layer` + `BackgroundLayer`.

### Implementation: Visibility, Activeness and other State

### Implementation: `LayerService`

The [`LayerService`](../src/features/layer/layer.service.ts) is the central hub for
accessing and managing the application's layers.
It is the central, single source of truth for all layer instances and
connects the simple `Layer` instances with the more complex parts of the Viewer.

The following will give a few quick examples on how to use the `LayerService`.
Note that the service uses polymorphic typing based on `AnyLayer` and `Id`.
This means that signatures of methods adjusts based on the type of layer
you're working with, providing the best typing possible for many situations.
For the following examples, consider that in most places where you read `Layer`,
you can get more specialized behavior when using a more concrete type.

Given a value `layerId: Id<Layer>`.

#### Loading Layer Configurations

After the application has been initialized, the `LayerService` will fetch the layer configuration from the API
by way of the [`LayerApiService`](../src/features/layer/layer-api.service.ts).
You can check if all required data has been loaded at least once via the `layerService.ready` promise.

> The layer configuration may be reloaded if specific events happen.
> As an example, a sign in will trigger a reload, as the session may give access to additional layers.

#### Accessing Layers

Read a layer's current value:

> Layer values are read-only and represent a momentary snapshot of a layer's state that may already have been changed.

```ts
// Get the current value of a layer.
const layer: Layer = layerService.layer(layerId);

// Emit the most recent value of a layer.
const layers$: Observable<Layer> = layerService.layer$(layerId);
```

Check active layers:

```ts
// A list of the ids of all currently active layers.
// The order of the array represents the order in which they are rendered.
const ids: Array<Id<Layer>> = layerService.activeLayerIds;

// Emit the most recent value of the above list.
const ids$: Observable<Array<Id<Layer>>> = layerService.activeLayerIds$;

// Check whether a specific layer is active.
const isLayerActive: boolean = layerService.isLayerActive(layerId);

// Emit whether a specific layer is active.
const isLayerActive$: Observable<boolean> =
  layerService.isLayerActive$(layerId);

// Emit whenever a layer changes from inactive to active.
const activated$: Observable<Id<Layer>> = layerService.layerActivated$;

// Emit whenever a layer changes from active to inactive.
const deactivated$: Observable<Id<Layer>> = layerService.layerDeactivated$;
```

#### Updating Layers

Change a layer's value:

> Updating layers is synchronous and immediate, but it may take some time to propagate changes to the entire application.

```ts
// Overwrite a partial selection of the layer.
layerService.update(layerId, { opacity: 0.75 });

// Reference the current value when updating, without having to load the layer yourself.
layerService.update(layerId, (layer) => ({ opacity: layer.opacity * 0.5 }));

// The fields that can be updated adapt based on the type of the id.
const tiffLayerId: Id<TiffLayer> = makeId("my.awesome.tiff");
layerService.update(tiffLayerId, { bandIndex: 2 });
```

Activate or deactivate layers:

```ts
layerService.activate(layerId);
layerService.deactivate(layerId);
```

Change the order in which layers are rendered:

> Lower renders later, higher renders earlier. The active layer list is thus rendered in reverse, i.e. last to first.
> This corresponds with how the layers are displayed to the user,
> with the topmost active layer rendered at the top of the active layer list.

```ts
// Move a layer down by one, making it render earlier.
layerService.move(layerId, -1);

// Move a layer up by two, making it render later.
layerService.move(layerId, 2);
```

## Glossary

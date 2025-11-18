# Adding new Layer Types
The following describes how you can add new layer types to the application.
Note that this just covers the most basic setup, additional steps may be necessary based on your needs.

## 1. Define Backend Types
Go to `api/src/layers` and add a new file `{myformat}.rs`. 
Define the layer type within it, for example:
```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields, rename_all(serialize = "camelCase"))]
pub struct MyFormatLayer {
    /// The layer's source, defining where the layer is loaded from.
    source: LayerSource,

    // A custom option.
    my_custom_option: bool,
    
    // Add any other fields that you require.
}
```
Open `api/src/layers/mod.rs` and add your new layer file:
```rust
mod myformat;
pub use myformat::*;
```
Within the same file, extend the `LayerDetail` enum.
```rust
pub enum LayerDetail {
    // A new variant for your layer type.
    // Note that the name of this variant defines the `type` field in the layer configuration.
    MyFormat(MyFormatLayer),
    
    // Keep all other variants as-is.
}
```

## 2. Add a Layer Configuration
Within `layers/`, open or create the file that should contain your new layer's configuration.
Add at least one such configuration for testing purposes:
```json5
{
  layers: [
    {
      type: 'MyFormat',
      id: 'my-new-layer-id',
      source: {
        type: 'Url',
        url: 'http://example.com/a-source-file.myformat',
      },
      my_custom_option: true,
    }
  ]
}
```
Remember to also add the layer to a group, as it won't be visible in the UI otherwise.

## 3. Define Frontend Types
Go to `ui/src/features/layer/models` and add a new file `layer-{myformat}.model.ts`.
Define the layer type within it.
Note that you do not have to match the backend type, as you will add a custom parser in the next step. 
```ts
export interface MyFormatLayer extends BaseLayer {
  type: LayerType.MyFormat,

  source: LayerSource;
  
  myCustomOption: boolean
}
```
Open `ui/src/features/layers/index.ts` and export the new layer type from it:
```ts
export * from './layer-myformat.model';
```
Open `ui/src/features/layer/layer.model.ts` and add the new layer type to the `Layer` union:
```ts
export type Layer =
  | MyFormatLayer
  // Leave other members as-is.
```
Within the same file, extend the `LayerType` enum.
```ts
export enum LayerType {
  MyFormat = 'MyFormat',
  // Leave other variants as-is.
}
```

### 4. Parse the Backend Configuration to your Frontend Type
Go to `ui/src/features/layer/layer-api.service.ts` and navigate to the method `mapConfigToLayer`.
You will find a `switch (type)` statement, which is now incomplete, as its missing the new `LayerType.MyFormat`.
Add a new case with your format, within which you map the backend's configuration to your frontend type:
```ts
export class LayerApiService {
  private mapConfigToLayer(config: DynamicObject): Layer | null {
    // ...

    switch (type) {
      // ...
      case LayerType.MyFormat:
        return {
          ...config.apply(this.mapConfigToMyFormat),
          ...base,
          id: base.id as Id<MyFormatLayer>,
          type,
        } satisfies MyFormatLayer;
    }
  }

  // Add a mapping method to the class
  private readonly mapConfigToMyFormatLayer = (
    config: DynamicObject,
  ): Specific<MyFormatLayer> => ({
    source: config.takeObject('source').apply(this.mapConfigToSource),
    myCustomOption: config.take('myCustomOption'),
  });
}
```

### 5. Implement your Controller
The `LayerController` is the heart of a layer's functionality.
To implement it, go to `ui/src/features/layer/controllers` and add a new file `layer-{myformat}.controller.ts`.
Within it, implement your new type `MyLayerController`.
Check `BaseLayerService` on the exact implementation details.

When you're done with your initial implementation, go to `ui/src/features/layer/controllers/layer.controller.ts`
and add your new controller to the `LayerController` union:
```ts
export type LayerController =
  | MyFormatController
// Leave other members as-is.
```

### 6. Register your Controller
Open `ui/src/features/layer/layer.service.ts` and navigate to the `makeController` method.
In it, add a mapping for your layer type's controller:
```ts
export class LayerService {
  private makeController(layer: Layer): LayerController {
    switch (layer.type) {
      // ...
      case LayerType.MyFormat:
        return new MyFormatController(layer);
    }
  }
  
}
```
That's it, you are done.

### Next Actions
With the above steps, you have defined and implemented the basic structure for a new layer type.
You can now extend it as you see fit.
Consider adding picking to it, see `src/features/layer/layer-info.service.ts`.

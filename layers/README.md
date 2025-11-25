# Layers Configuration
The `layers/layertree.json5` is the main configuration file for all layers that are available in the Viewer application.
In the following, the file's structure is explained,
including how to configure groups and the differing layer types.

The layers file has to contain a single JSON object in the [JSON5](https://json5.org/) format.
Not that **every** top-level key is optional, i.e. you can leave out everything you don't need.

## Configuring Layers
Layers are configured within the `layers` array.
Every layer has to configure _at least_ a `type` and an `id`.
The `type` defines the layer's actual format,
while the `id` must be a unique string that identifies the layer across the application.
All other layer properties are either optional or depend on the layer's type.
```json5
{
  layers: [
    {
      type: 'MyLayerType',
      id: 'my-layer-id',
      // other properties...
    },
    // other layers...
  ],
}
```
A full overview of the configuration properties that are available to all layers can be found [here](../docs/layer-config/shared-layer-config.md).
To see the specific properties of each layer type, see the respective documentation:
- [Wmts](../docs/layer-config/wmts-layer-config.md)
- [Tiles3d](../docs/layer-config/tiles3d-layer-config.md)
- [Voxel](../docs/layer-config/voxel-layer-config.md)
- [Tiff](../docs/layer-config/tiff-layer-config.md)
- [Earthquakes](../docs/layer-config/earthquakes-layer-config.md)

## Configuring Groups
Groups define where the layers are shown to the user.
Each group can contain layers and subgroups.
A layer needs to be present in at least one group to be visible to users.

Groups are defined in the `groups` array.
The elements of this array are called "root groups", and define the layer catalog's top level elements.
Each groups needs a unique `id` with which it is uniquely identified across the entire application.
```json5
{
  groups: [
    {
      id: 'my-group-id',
      children: [
        // Add a layer to the group:
        'my-layer-id',
        
        // Add a subgroup:
        { 
          id: 'my-subgroup-id',
          children: [
            //...
          ],
        },
        
        // Other children...
      ]
    },
    // Other groups...
  ],
}
```

## Using Multiple Configuration Files
While `layertree.json5` is the configuration's main file,
it is also possible to move specific configurations into other files.
To do so, simply create another configuration file (e.g. `other-file.json5`) and configure layers and groups within it.
You can use the exact same format that `layertree.json5` follows.
```json5
// other-file.json5
{
  layers: [
    {
      id: 'my-external-layer',
      // ...
    }
  ],
  groups: [
    {
      id: 'my-external-group',
      children: [
        'my-external-layer',
      ]
    }
  ]
}
```
The file can then be included into `layertree.json5` via the `includes` array:
```json5
// layertree.json5
{
  includes: [
    './other-file.json5'
  ],
}
```
> Note that within the `includes` array, the `.json5` extension is optional and could simply be left out.

Including a file brings all layers and groups into `layertree.json5`.
> Every other top-level key, e.g. `voxel_mappings` or `order_of_properties`, does not get included,
> although they of course stil apply to the layers defined within their own file.

Groups are not automatically merged into `groups` when included - they are simply "made available".
To use them, reference their id in the `groups` array without defining children for them:
```json5
{
  groups: [
    { id: 'my-external-group' }
  ]
}
```
You can also add an external layer to a new group:
```json5
{
  groups: [
    {
      id: 'my-local-group',
      children: [
        'my-external-layer',
      ]
    }
  ]
}
```

Lastly, as previously stated, every configuration file follows the *exact same* format as `layertree.json5`.
This of course also means that `includes` is available to every such file, enabling you to split your configurations
across how many files you would want.
```json5
// a.json5
{
  layers: [
    {
      id: 'my-layer-from-a',
      // other fields...
    }
  ]
}
```
```json5
// b.json5
{
  includes: ['./a.json5'],
  groups: [
    {
      id: 'my-group-from-b',
      children: [
        'my-layer-from-a'
      ]
    }
  ]
}
```
```json5
// layertree.json5
{
  includes: ['./b.json5']
  groups: [
    {
      id: 'my-local-group',
      children: [
        'my-layer-from-a',
        { id: 'my-group-from-b' }
      ]
    }
  ]
}
```

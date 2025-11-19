# The `layers` locale namespace
`layers` contains translations for displaying layer-specific data.

## Important Categories
The following top-level keys contain nested translations that are important to mention:

- `values` contains translations for static layer values, such as `undefined` or `noData`.
- `layers` contains the name for each layer, mapped by their ids.
- `groups` contains the name for each group, mapped by their ids.
- `properties` contains property name translations, see [Translating Layer Properties](#translating-layer-properties)

## Translating Layer Properties
Some layers contain properties that are made visible to the user by picking on the map.
The names of these properties often need to be translated, which is done via the `properties` object.
It provides three distinct ways to define a translation.

> Translations are prioritized in descending order, from #3 > #2 > #1.
> In other words, the most specific translation will be used.

### 1. Name-Only Translations
A name-only translation matches the property of _any_ layer,
as long as the property name matches the translation key.
The following example defines a translation for every property named `propertyByName`:
```json
{
  "properties": {
    "propertyByName": "the translated name"
  }
}
```

### 2. LayerType-Specific Translations
A LayerType-specific translation matches the property name of layers with a specific type.
The following example defines a translation that matches every property named `propertyForType`
as long as that property appears on a `Tiles3d` layer:
```json
{
  "properties": {
    "Tiles3d": {
      "propertyForType": "the translated name"
    }
  }
}
```

### 3. Layer-Specific Translations
A layer-specific translation matches only a specific layer, which is identified by its id.
The following example defines a translation that matches the property `propertyForLayer`
only for the layer with the id `my_layer_id`:
```json
{
  "properties": {
    "my_layer_id": {
      "propertyForLayer": "the translated name"
    }
  }
}
```
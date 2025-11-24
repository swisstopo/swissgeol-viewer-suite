# Locales

The files in the subfolders of `ui/locales/` contain localized translations for the Viewer application.
Currently, we support German, English, French and Italian locales.
The files are parsed using [i18next](https://www.i18next.com/).

## Format

Each locale folder `{namespace}` contains files named `{namespace}.{locale}.json`,
where `{locale}` is one of `de`, `en`, `fr` and `it`.

The files contain JSON objects, which map an application string to its localized version.
For example, `app.de.json` may contain something like this:

```json
{
  "accept": "Akzeptieren"
}
```

The files may contain deeply nested objects:

```json
{
  "outer": {
    "middle": {
      "first": "Eins",
      "second": "Zwei"
    }
  }
}
```

The mapped values may contain interpolated values, which will be provided by the application:

```json
{
  "hello": "Hello, {{name}}"
}
```

## Namespaces

Each translation folder describes a unique **namespace**.
Keys within namespaces are isolated from each other,
so the key `value` in the namespace `layers` is different from the key `value` in the namespace `catalog`.

Currently, the following namespaces are defined:

- `app` contains app-wide translations, which can be used at separate, unrelated locations within the application.
- `assets` contains translations for layer properties.
- `catalog` contains translations used by the catalog ui panel.
- [`layers`](./layers/README.md) contain layer-related translations. This ranges from unit translations to layer-specific attributes.
- `layout` contains translations for general ui elements like the navigation or search bar.

> The namespaces `app` and `assets` contain legacy keys.
> They are (partially) formatted differently from more recent files and are actively being refactored.
> Especially `assets` is due to be replaced by the keys within the `layers` namespace.

## Naming Conventions

Translation keys should ideally be in `snake_case`, with the following exceptions:

- Enum cases can be translated directly, e.g. `MyEnumCase`
- External values or internal ids can be used as-is, e.g. `ch.swisstopo.swissbedrock-geotiff` or `prev_Uncertainty`.

There are no explicit conventions about how custom keys are named.
However, it should be clear from their name and position within the translation files alone what they are referring to.

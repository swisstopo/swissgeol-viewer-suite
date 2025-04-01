// node scripts/transform-qgis-colormap.js path/to/color-map.txt
//
// Transforms a TXT color map as used in QGIS into a JSON that can be used by TiTiler.
//
// QGIS color maps define a range of possible values (e.g. `10,{color1}`, `14,{color2}`, and so on).
// The application will then interpolate between these colors. (e.g. 12 would use the color exactly in the middle of `color1` and `color2`).
// TiTiler does not support this, as it expects the values themselves to be adjusted to lie on 0 to 255 - they are meant to represent single-channel color values.
// With TiTiler's color maps, you can then transform a single-channel color value into a multi-channel one (e.g. `"128": {color1}, "127": {color2}`, for every color from 0 up to 255).
// To transform a QGIS color map to a TiTiler color map, we have to do the following:
// - Scale the QGIS color map values (min - max) to 0 - 255.
// - For each integer from 0 to 255, interpolate its value on that scale.
// - Write this mapping of single-channel color value to RGB(A) as a TiTiler color map.
//
// The resulting json will be written to the same location as the input txt,
// but with `.json` appended to the file's extension.
//
// Be aware that the concept of transparency isn't handled all that well in TiTiler color maps.
// To get optimal results, it is recommended to either drop the alpha channel, or just fix it at a constant value of 255.
// If you want transparency, use an external solution to change the alpha channel of the resulting image (e.g. the alpha attribute of cesium layers).
// If you want values outside the given range to be invisible, use TiTiler `noData` query parameter.
// For QGIS, every value outside the given range is transparent, while for TiTiler, they will be rendered in black.
// However, `noData` only allows to hide a single, specific value (e.g. `0`), so if that isn't enough for your use case,
// you will have to explore alternative solutions (e.g. TiTiler plugins, or just adjusting your value range).
// Also, to get your data into the 0 to 255, range you will most likely want to use TiTiler's `rescale` query parameter anyways.

import { readFile, writeFile } from 'node:fs/promises';

const lerp = (a, b, alpha) => a + alpha * (b - a);

const parseQGISLine = (line) => {
  const [value, r, g, b, a, label] = line.split(',');
  return {
    value: parseFloat(value),
    color: [r, g, b, a].map((it) => parseInt(it)),
    label,
  };
};

const inputFile = process.argv[2];
const input = await readFile(inputFile, 'utf-8');
let entries = input
  .split('\n')
  .filter((it) => !it.startsWith('#') && it.length !== 0)
  .slice(1)
  .map(parseQGISLine);

const min = entries[0].value;
const max = entries[entries.length - 1].value;

const mapTo255 = (value) => {
  return ((value - min) / (max - min)) * 255;
};

entries = entries.map((it) => ({
  ...it,
  rgb: mapTo255(it.value),
}));

const mapping = {};
let entryIndex = 0;
for (let i = 0; i <= 255; i++) {
  const from = entries[entryIndex];
  const to = entries[entryIndex + 1];
  if (to.rgb < i) {
    entryIndex += 1;
    i -= 1;
    continue;
  }

  const t = (i - from.rgb) / (to.rgb - from.rgb);
  const color = Array.from({ length: 4 }).map((_, i) => {
    return Math.round(lerp(from.color[i], to.color[i], t));
  });

  mapping[`${i}`] = color;
}

const outputFile = `${inputFile}.json`;
await writeFile(outputFile, JSON.stringify(mapping, null, 2));

console.log(`ColorMap written to ${outputFile}.`);

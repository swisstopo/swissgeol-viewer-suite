import { BaseService } from 'src/utils/base.service';
import { language$ } from 'src/i18n';
import {
  LayerType,
  SwisstopoLayer,
  SwisstopoLayerSource,
} from 'src/features/layer';
import i18next from 'i18next';
import { Id, makeId } from 'src/models/id.model';
import { map, Observable, shareReplay, switchMap } from 'rxjs';

export class WmtsService extends BaseService {
  private readonly _layers$: Observable<
    Map<Id<SwisstopoLayer>, SwisstopoLayer>
  >;

  constructor() {
    super();

    this._layers$ = language$.pipe(
      switchMap(() => this.load()),
      shareReplay(1),
    );
  }

  get layers$(): Observable<SwisstopoLayer[]> {
    return this._layers$.pipe(map((layers) => [...layers.values()]));
  }

  layer$(id: Id<SwisstopoLayer>): Observable<SwisstopoLayer | null> {
    return this._layers$.pipe(map((layers) => layers.get(id) ?? null));
  }

  private async load(): Promise<Map<Id<SwisstopoLayer>, SwisstopoLayer>> {
    const [wms, wmts] = await Promise.all([
      this.fetchWmsCapabilities(),
      this.fetchWmtsCapabilities(),
    ]);
    const map = new Map<Id<SwisstopoLayer>, SwisstopoLayer>();
    for (const layers of [wms, wmts]) {
      for (const layer of layers) {
        map.set(layer.id, layer);
      }
    }
    return map;
  }

  private async fetchWmsCapabilities(): Promise<SwisstopoLayer[]> {
    const xml = await this.fetchCapabilitiesXml({
      host: 'https://wms.geo.admin.ch/',
      params: {
        SERVICE: 'WMS',
        REQUEST: 'GetCapabilities',
        VERSION: '1.3.0',
        lang: i18next.language,
      },
    });
    if (xml === null) {
      return [];
    }
    return this.parseWmsCapabilities(xml);
  }

  parseWmsCapabilities(xml: Document): SwisstopoLayer[] {
    const configs: SwisstopoLayer[] = [];
    const layers = xml.querySelectorAll('Layer');
    for (const layer of layers.values()) {
      const layerTitle = layer.querySelector('Title')?.textContent;
      const layerName = layer.querySelector('Name')?.textContent;
      if (!layerName) {
        continue;
      }

      const format = layer.querySelector('LegendURL > Format')?.textContent;
      if (!format) {
        continue;
      }

      const defaultTimestamp = layer
        .querySelector('Dimension')
        ?.getAttribute('default');

      const timestamps =
        layer.querySelector('Dimension')?.textContent?.split(',') || [];

      configs.push({
        type: LayerType.Swisstopo,
        id: makeId(`${layerName}`),
        label: layerTitle ?? null,
        source: SwisstopoLayerSource.WMTS,
        opacity: 1,
        canUpdateOpacity: true,
        isVisible: true,
        geocatId: null,
        downloadUrl: null,
        maxLevel: null,
        hasLegend: false,
        format,
        credit: layerName.split('.')[1],
        dimension:
          defaultTimestamp == null &&
          (timestamps == null || timestamps.length === 0)
            ? null
            : {
                current: defaultTimestamp ?? timestamps[0],
                all: timestamps ?? [defaultTimestamp],
              },
      });
    }
    return configs;
  }

  private async fetchWmtsCapabilities(): Promise<SwisstopoLayer[]> {
    const xml = await this.fetchCapabilitiesXml({
      host: 'https://wmts.geo.admin.ch/EPSG/3857/1.0.0/WMTSCapabilities.xml',
      params: {
        lang: i18next.language,
      },
    });
    if (xml === null) {
      return [];
    }
    return this.parseWmtsCapabilities(xml);
  }

  private parseWmtsCapabilities(xml: Document): SwisstopoLayer[] {
    const configs: SwisstopoLayer[] = [];
    const layers = xml.querySelectorAll('Layer');
    const owsNamespace = 'http://www.opengis.net/ows/1.1';
    for (const layer of layers.values()) {
      const identifiers = layer.getElementsByTagNameNS(
        owsNamespace,
        'Identifier',
      );
      const titles = layer.getElementsByTagNameNS(owsNamespace, 'Title');
      Array.from(identifiers).forEach((identifier) => {
        // check for ch. to exclude Time identifier
        if (!identifier?.textContent?.includes('ch.')) {
          return;
        }

        const layerName = identifier.textContent;
        const defaultTimestamp = layer.querySelector(
          'Dimension > Default',
        )?.textContent;
        const format = layer.querySelector('Format')?.textContent;
        const tileMatrixSet = layer
          .querySelector('TileMatrixSet')
          ?.textContent?.split('_');
        if (!format) {
          return;
        }

        const title =
          titles && titles[0]?.textContent ? titles[0].textContent : layerName;

        const timestamps = Array.from(
          layer.querySelectorAll('Dimension > Value'),
        ).map((time) => time.textContent!);

        configs.push({
          type: LayerType.Swisstopo,
          id: makeId(`${layerName}`),
          source: SwisstopoLayerSource.WMTS,
          label: title,
          opacity: 1,
          canUpdateOpacity: true,
          isVisible: true,
          geocatId: null,
          downloadUrl: null,
          maxLevel: tileMatrixSet == null ? null : Number(tileMatrixSet[1]),
          hasLegend: false,
          format: format.split('/')[1],
          credit: layerName.split('.')[1],
          dimension:
            defaultTimestamp == null &&
            (timestamps == null || timestamps.length === 0)
              ? null
              : {
                  current: defaultTimestamp ?? timestamps[0],
                  all: timestamps,
                },
        });
      });
    }
    return configs;
  }

  private async fetchCapabilitiesXml(options: {
    host: string;
    params: Record<string, string>;
  }): Promise<Document | null> {
    const params = new URLSearchParams(options.params);
    const url = `${options.host}?${params}`;
    const res = await fetch(url);
    if (!res.ok) {
      console.error(`Failed to fetch capabilities from "${options.host}"`);
      return null;
    }

    const parser = new DOMParser();
    return parser.parseFromString(await res.text(), 'text/xml');
  }
}

import { BaseService } from 'src/utils/base.service';
import { language$ } from 'src/i18n';
import {
  LayerType,
  WmtsLayer,
  WmtsLayerTimes,
  WmtsLayerSource,
} from 'src/features/layer';
import i18next from 'i18next';
import { Id, makeId } from 'src/models/id.model';
import { BehaviorSubject, filter, map, Observable, switchMap } from 'rxjs';

export class WmtsService extends BaseService {
  private readonly _layers$ = new BehaviorSubject(
    new Map<Id<WmtsLayer>, WmtsLayer>(),
  );

  constructor() {
    super();
    language$
      .pipe(switchMap(() => this.load()))
      .subscribe((mapping) => this._layers$.next(mapping));
  }

  get ready$(): Observable<void> {
    return this._layers$.pipe(
      filter((it) => it.size !== 0),
      map(() => {}),
    );
  }

  get layers$(): Observable<WmtsLayer[]> {
    return this._layers$.pipe(map((layers) => [...layers.values()]));
  }

  layer(id: Id<WmtsLayer>): WmtsLayer | null {
    return this._layers$.value.get(id) ?? null;
  }

  layer$(id: Id<WmtsLayer>): Observable<WmtsLayer | null> {
    return this._layers$.pipe(map((layers) => layers.get(id) ?? null));
  }

  exists(id: Id<WmtsLayer>): boolean {
    return this._layers$.value.has(id);
  }

  private async load(): Promise<Map<Id<WmtsLayer>, WmtsLayer>> {
    const [wms, wmts] = await Promise.all([
      this.fetchWmsCapabilities(),
      this.fetchWmtsCapabilities(),
    ]);
    const map = new Map<Id<WmtsLayer>, WmtsLayer>();
    for (const layers of [wms, wmts]) {
      for (const layer of layers) {
        map.set(layer.id, layer);
      }
    }
    return map;
  }

  private async fetchWmsCapabilities(): Promise<WmtsLayer[]> {
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

  parseWmsCapabilities(xml: Document): WmtsLayer[] {
    const configs: WmtsLayer[] = [];
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

      const defaultTimestamp =
        layer.querySelector('Dimension')?.getAttribute('default') ?? null;

      const timestamps =
        layer.querySelector('Dimension')?.textContent?.split(',') || [];

      configs.push({
        type: LayerType.Wmts,
        id: makeId(`${layerName}`),
        label: layerTitle ?? null,
        source: WmtsLayerSource.WMTS,
        opacity: 1,
        canUpdateOpacity: true,
        isVisible: true,
        geocatId: null,
        downloadUrl: null,
        maxLevel: null,
        legend: null,
        format,
        credit: layerName.split('.')[1],
        times: this.makeTimes(defaultTimestamp, timestamps),
      });
    }
    return configs;
  }

  private async fetchWmtsCapabilities(): Promise<WmtsLayer[]> {
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

  private parseWmtsCapabilities(xml: Document): WmtsLayer[] {
    const configs: WmtsLayer[] = [];
    const layers = xml.querySelectorAll('Layer');
    const owsNamespace = 'http://www.opengis.net/ows/1.1';
    for (const layer of layers.values()) {
      const identifiers = layer.getElementsByTagNameNS(
        owsNamespace,
        'Identifier',
      );
      const titles = layer.getElementsByTagNameNS(owsNamespace, 'Title');
      for (const identifier of Array.from(identifiers)) {
        // check for ch. to exclude Time identifier
        if (!identifier?.textContent?.includes('ch.')) {
          continue;
        }

        const layerName = identifier.textContent;
        const defaultTimestamp =
          layer.querySelector('Dimension > Default')?.textContent ?? null;
        const format = layer.querySelector('Format')?.textContent;
        const tileMatrixSet = layer
          .querySelector('TileMatrixSet')
          ?.textContent?.split('_');
        if (!format) {
          continue;
        }

        const timestamps = Array.from(
          layer.querySelectorAll('Dimension > Value'),
        ).map((time) => time.textContent!);

        configs.push({
          type: LayerType.Wmts,
          id: makeId(`${layerName}`),
          source: WmtsLayerSource.WMTS,
          label: titles?.[0]?.textContent ?? layerName,
          opacity: 1,
          canUpdateOpacity: true,
          isVisible: true,
          geocatId: null,
          downloadUrl: null,
          maxLevel: tileMatrixSet == null ? null : Number(tileMatrixSet[1]),
          legend: null,
          format,
          credit: layerName.split('.')[1],
          times: this.makeTimes(defaultTimestamp, timestamps),
        });
      }
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

  private makeTimes(
    current: string | null,
    all: string[] | null,
  ): WmtsLayerTimes | null {
    const isDefaultCurrent = current === null || current === 'current';
    const isDefaultAll =
      all === null ||
      all.length === 0 ||
      (all.length === 1 && all[0] === 'current');
    if (isDefaultAll && isDefaultCurrent) {
      return null;
    }
    const currentValue = current ?? all?.[0] ?? 'current';
    return {
      current: currentValue,
      all: all ?? [currentValue],
    };
  }
}

import {
  DEFAULT_WMTS_SERVICE,
  WMTS_CAPABILITIES_BY_SERVICE,
  WmtsCapabilitiesLinks,
} from 'src/constants';
import {
  LayerType,
  WmtsLayer,
  WmtsLayerTimes,
  WmtsLayerSource,
} from 'src/features/layer';
import { language$ } from 'src/i18n';
import { Id, makeId } from 'src/models/id.model';
import { BaseService } from 'src/services/base.service';
import i18next from 'i18next';
import { BehaviorSubject, filter, map, Observable, switchMap } from 'rxjs';

export class WmtsService extends BaseService {
  private readonly _layersByService$ = new BehaviorSubject(
    new Map<string, Map<Id<WmtsLayer>, WmtsLayer>>(),
  );

  constructor() {
    super();
    language$
      .pipe(switchMap(() => this.load()))
      .subscribe((mapping) => this._layersByService$.next(mapping));
  }

  get ready$(): Observable<void> {
    return this._layersByService$.pipe(
      filter((it) => it.size !== 0),
      map(() => {}),
    );
  }

  get layers$(): Observable<WmtsLayer[]> {
    return this._layersByService$.pipe(
      map((services) =>
        [...services.values()].flatMap((layers) => [...layers.values()]),
      ),
    );
  }

  layer(id: Id<WmtsLayer>, service: string | null = null): WmtsLayer | null {
    const resolvedService = this.resolveServiceName(service);
    return this._layersByService$.value.get(resolvedService)?.get(id) ?? null;
  }

  layer$(
    id: Id<WmtsLayer>,
    service: string | null = null,
  ): Observable<WmtsLayer | null> {
    const resolvedService = this.resolveServiceName(service);
    return this._layersByService$.pipe(
      map((services) => services.get(resolvedService)?.get(id) ?? null),
    );
  }

  exists(id: Id<WmtsLayer>, service: string | null = null): boolean {
    const resolvedService = this.resolveServiceName(service);
    return this._layersByService$.value.get(resolvedService)?.has(id) ?? false;
  }

  private resolveServiceName(service: string | null): string {
    const serviceName = service ?? DEFAULT_WMTS_SERVICE;
    if (serviceName in WMTS_CAPABILITIES_BY_SERVICE) {
      return serviceName;
    }
    console.error(
      `Unknown WM(T)S service "${serviceName}", falling back to "${DEFAULT_WMTS_SERVICE}"`,
    );
    return DEFAULT_WMTS_SERVICE;
  }

  private async load(): Promise<Map<string, Map<Id<WmtsLayer>, WmtsLayer>>> {
    const byServiceEntries = await Promise.all(
      Object.entries(WMTS_CAPABILITIES_BY_SERVICE).map(
        async ([service, links]) => {
          const [wms, wmts] = await Promise.all([
            this.fetchWmsCapabilities(service, links),
            this.fetchWmtsCapabilities(service, links),
          ]);
          const layers = new Map<Id<WmtsLayer>, WmtsLayer>();
          for (const layer of [...wms, ...wmts]) {
            layers.set(layer.id, layer);
          }
          return [service, layers] as const;
        },
      ),
    );

    const byService = new Map<string, Map<Id<WmtsLayer>, WmtsLayer>>();
    for (const [service, layers] of byServiceEntries) {
      byService.set(service, layers);
    }
    return byService;
  }

  private async fetchWmsCapabilities(
    service: string,
    links: WmtsCapabilitiesLinks,
  ): Promise<WmtsLayer[]> {
    const xml = await this.fetchCapabilitiesXml({
      host: links.wms,
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
    return this.parseWmsCapabilities(xml, service);
  }

  private parseWmsCapabilities(xml: Document, service: string): WmtsLayer[] {
    const configs: WmtsLayer[] = [];
    const layers = xml.querySelectorAll('Layer');
    const format = this.resolvePreferredWmsGetMapFormat(xml);
    const serviceUrl = this.resolveWmsGetMapUrl(xml);

    for (const layer of layers.values()) {
      const layerTitle = layer.querySelector('Title')?.textContent;
      const layerName = layer.querySelector('Name')?.textContent;
      if (!layerName) {
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
        source: WmtsLayerSource.WMS,
        service,
        serviceUrl,
        opacity: 1,
        canUpdateOpacity: true,
        isVisible: true,
        geocatId: null,
        downloadUrl: null,
        maxLevel: null,
        infoBox: null,
        format,
        credit: layerName.split('.')[1],
        times: this.makeTimes(defaultTimestamp, timestamps),
        customProperties: {},
        ogcSource: null,
      });
    }
    return configs;
  }

  private async fetchWmtsCapabilities(
    service: string,
    links: WmtsCapabilitiesLinks,
  ): Promise<WmtsLayer[]> {
    const xml = await this.fetchCapabilitiesXml({
      host: links.wmts,
      params: {
        lang: i18next.language,
      },
    });
    if (xml === null) {
      return [];
    }
    return this.parseWmtsCapabilities(xml, service);
  }

  private parseWmtsCapabilities(xml: Document, service: string): WmtsLayer[] {
    const configs: WmtsLayer[] = [];
    const layers = xml.querySelectorAll('Layer');
    const getTileBaseUrl = this.resolveWmtsGetTileBaseUrl(xml);

    for (const layer of layers.values()) {
      const layerName = this.getDirectChildText(layer, 'Identifier');
      if (layerName === null) {
        continue;
      }
      const title = this.getDirectChildText(layer, 'Title');
      const defaultTimestamp =
        layer.querySelector('Dimension > Default')?.textContent ?? null;
      const format = this.getDirectChildText(layer, 'Format');
      const tileMatrixSet = this.resolveWmtsTileMatrixSet(layer);
      const style = this.resolveWmtsStyle(layer);
      if (!format) {
        continue;
      }

      const timestamps = Array.from(
        layer.querySelectorAll('Dimension > Value'),
      ).map((time) => time.textContent!);

      const tileTemplate = this.resolveWmtsTileTemplate({
        layer,
        getTileBaseUrl,
        layerName,
        format,
        style,
        tileMatrixSet: tileMatrixSet ?? undefined,
        hasTimeDimension: timestamps.length > 0,
      });

      configs.push({
        type: LayerType.Wmts,
        id: makeId(`${layerName}`),
        source: WmtsLayerSource.WMTS,
        service,
        serviceUrl: tileTemplate,
        label: title ?? layerName,
        opacity: 1,
        canUpdateOpacity: true,
        isVisible: true,
        geocatId: null,
        downloadUrl: null,
        maxLevel: this.resolveMaxLevel(tileMatrixSet),
        infoBox: null,
        format,
        credit: this.resolveCredit(layerName),
        times: this.makeTimes(defaultTimestamp, timestamps),
        customProperties: {
          wmtsStyle: style,
          tileMatrixSet: tileMatrixSet ?? 'EPSG:3857',
        },
        ogcSource: null,
      });
    }
    return configs;
  }

  private resolvePreferredWmsGetMapFormat(xml: Document): string {
    const getMap = this.findRequestOperation(xml, 'GetMap');
    const formats = this.getDirectChildTexts(getMap, 'Format');
    const preferred = formats.find(
      (value) => value.toLowerCase() === 'image/png',
    );
    return preferred ?? formats[0] ?? 'image/png';
  }

  private resolveWmsGetMapUrl(xml: Document): string | null {
    const getMap = this.findRequestOperation(xml, 'GetMap');
    const candidate = getMap?.getElementsByTagNameNS('*', 'OnlineResource')[0];
    return this.getHref(candidate);
  }

  private resolveWmtsGetTileBaseUrl(xml: Document): string | null {
    const getTileOperation = Array.from(
      xml.getElementsByTagNameNS('*', 'Operation'),
    ).find((operation) => operation.getAttribute('name') === 'GetTile');
    const get =
      Array.from(getTileOperation?.children ?? [])
        .find((child) => child.localName === 'DCP')
        ?.getElementsByTagNameNS('*', 'Get')?.[0] ?? null;
    return this.getHref(get);
  }

  private resolveWmtsStyle(layer: Element): string {
    const styles = layer.getElementsByTagNameNS('*', 'Style');
    const preferred = Array.from(styles).find(
      (style) => style.getAttribute('isDefault') === 'true',
    );
    const selected = preferred ?? styles[0] ?? null;
    return this.getDirectChildText(selected, 'Identifier') ?? 'default';
  }

  private resolveWmtsTileMatrixSet(layer: Element): string | null {
    const matrixSets = Array.from(
      layer.getElementsByTagNameNS('*', 'TileMatrixSet'),
    )
      .map((node) => (node.textContent ?? '').trim())
      .filter((value) => value.length > 0);
    const preferred =
      matrixSets.find((value) => value === 'EPSG:3857') ??
      matrixSets.find((value) => value === 'EPSG:900913');
    return preferred ?? matrixSets[0] ?? null;
  }

  private resolveMaxLevel(tileMatrixSet: string | null): number | null {
    if (tileMatrixSet === null) {
      return null;
    }
    const bySuffix = Number(tileMatrixSet.split('_')[1] ?? Number.NaN);
    return Number.isNaN(bySuffix) ? null : bySuffix;
  }

  private resolveWmtsTileTemplate(options: {
    layer: Element;
    getTileBaseUrl: string | null;
    layerName: string;
    format: string;
    style: string;
    tileMatrixSet: string | undefined;
    hasTimeDimension: boolean;
  }): string | null {
    const resourceUrl = options.layer
      .querySelector('ResourceURL[resourceType="tile"]')
      ?.getAttribute('template');
    if (resourceUrl && resourceUrl.length > 0) {
      return resourceUrl;
    }
    if (options.getTileBaseUrl === null) {
      return null;
    }

    const params = [
      ['SERVICE', 'WMTS'],
      ['REQUEST', 'GetTile'],
      ['VERSION', '1.0.0'],
      ['LAYER', options.layerName],
      ['STYLE', options.style],
      ['TILEMATRIXSET', options.tileMatrixSet ?? 'EPSG:3857'],
      ['TILEMATRIX', '{TileMatrix}'],
      ['TILEROW', '{TileRow}'],
      ['TILECOL', '{TileCol}'],
      ['FORMAT', options.format],
    ];

    if (options.hasTimeDimension) {
      params.push(['TIME', '{Time}']);
    }

    const query = params.map(([key, value]) => `${key}=${value}`).join('&');
    return options.getTileBaseUrl.includes('?')
      ? `${options.getTileBaseUrl}&${query}`
      : `${options.getTileBaseUrl}?${query}`;
  }

  private findRequestOperation(
    xml: Document,
    operationName: string,
  ): Element | null {
    const request = xml.getElementsByTagNameNS('*', 'Request')[0];
    if (!request) {
      return null;
    }
    return (
      Array.from(request.children).find(
        (child) => child.localName === operationName,
      ) ?? null
    );
  }

  private getDirectChildTexts(
    node: Element | null,
    childName: string,
  ): string[] {
    if (node === null) {
      return [];
    }
    return Array.from(node.children)
      .filter((child) => child.localName === childName)
      .map((child) => (child.textContent ?? '').trim())
      .filter((value) => value.length > 0);
  }

  private getDirectChildText(
    node: Element | null,
    childName: string,
  ): string | null {
    return this.getDirectChildTexts(node, childName)[0] ?? null;
  }

  private getHref(node: Element | null | undefined): string | null {
    if (node == null) {
      return null;
    }
    const href =
      node.getAttribute('xlink:href') ??
      node.getAttribute('href') ??
      node.getAttributeNS('http://www.w3.org/1999/xlink', 'href') ??
      null;
    return href === '' ? null : href;
  }

  private resolveCredit(layerName: string): string {
    const dotted = layerName.split('.')[1]?.trim();
    if (dotted) {
      return dotted;
    }
    const namespaced = layerName.split(':')[0]?.trim();
    if (namespaced) {
      return namespaced;
    }
    return layerName;
  }

  private async fetchCapabilitiesXml(options: {
    host: string;
    params: Record<string, string>;
  }): Promise<Document | null> {
    const params = new URLSearchParams(options.params);
    const hasQuery = options.host.includes('?');
    const url = hasQuery
      ? `${options.host}&${params}`
      : `${options.host}?${params}`;
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

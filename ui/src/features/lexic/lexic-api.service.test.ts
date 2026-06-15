import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LexicApiService } from './lexic-api.service';
import { LexicLayersResponse, LexicWmsResponse } from './lexic-api.model';

describe('LexicApiService', () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  it('adds language query when requesting layers', async () => {
    const service = new LexicApiService();

    const payload: LexicLayersResponse = {
      webmapId: 'SwissTopoMap',
      layers: [],
    };
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify(payload), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const result = await service.getLayers('de');

    expect(result).toEqual(payload);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, request] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/layers?lang=de');

    const headers = new Headers(request.headers);
    expect(headers.get('Accept')).toBe('application/json');
  });

  it('works without API key', async () => {
    const service = new LexicApiService();

    const payload: LexicLayersResponse = {
      webmapId: 'SwissTopoMap',
      layers: [],
    };
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify(payload), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await expect(service.getLayers()).resolves.toEqual(payload);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('posts payload for WMS request generation', async () => {
    const service = new LexicApiService();

    const responsePayload: LexicWmsResponse = {
      url: 'https://example.test/wms',
      body: 'REQUEST=GetMap',
      mimeType: 'image/png',
      note: 'mock',
    };

    fetchMock.mockResolvedValue(
      new Response(JSON.stringify(responsePayload), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await service.generateWmsRequest({
      webmapId: 'SwissTopoMap',
      layerId: 'gc_bedrock',
      filters: [
        {
          filterId: 'f-lithology-term',
          parameters: {
            term: 'https://dev-lexic.swissgeol.ch/Lithology/Amphibolite',
            includeNarrowers: true,
          },
        },
      ],
    });

    const [url, request] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/generateWmsRequest');
    expect(request.method).toBe('POST');
    expect(request.body).toBe(
      '{"webmapId":"SwissTopoMap","layerId":"gc_bedrock","filters":[{"filterId":"f-lithology-term","parameters":{"term":"https://dev-lexic.swissgeol.ch/Lithology/Amphibolite","includeNarrowers":true}}]}',
    );

    const headers = new Headers(request.headers);
    expect(headers.get('Content-Type')).toBe('application/json');
  });
});

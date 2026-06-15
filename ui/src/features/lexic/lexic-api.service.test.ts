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

  it('adds API key and language query when requesting layers', async () => {
    const service = new LexicApiService();
    service.configure({
      apiKey: 'test-key',
      baseUrl: 'https://example.test',
    });

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
    expect(url).toBe('https://example.test/layers?lang=de');

    const headers = new Headers(request.headers);
    expect(headers.get('Accept')).toBe('application/json');
    expect(headers.get('X-API-Key')).toBe('test-key');
  });

  it('throws when API key is missing', async () => {
    const service = new LexicApiService();
    service.configure({ baseUrl: 'https://example.test' });

    await expect(service.getLayers()).rejects.toThrow(
      'Lexic API key is not configured',
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('posts payload for WMS request generation', async () => {
    const service = new LexicApiService();
    service.configure({
      apiKey: 'test-key',
      baseUrl: 'https://example.test',
    });

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
    expect(url).toBe('https://example.test/generateWmsRequest');
    expect(request.method).toBe('POST');
    expect(request.body).toBe(
      '{"webmapId":"SwissTopoMap","layerId":"gc_bedrock","filters":[{"filterId":"f-lithology-term","parameters":{"term":"https://dev-lexic.swissgeol.ch/Lithology/Amphibolite","includeNarrowers":true}}]}',
    );

    const headers = new Headers(request.headers);
    expect(headers.get('Content-Type')).toBe('application/json');
    expect(headers.get('X-API-Key')).toBe('test-key');
  });
});

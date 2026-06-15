import { BaseService } from 'src/services/base.service';
import {
  LexicDefaultFiltersResponse,
  LexicLanguage,
  LexicLayerAttributesResponse,
  LexicLayerFiltersResponse,
  LexicLayersResponse,
  LexicVocabulariesResponse,
  LexicVocabularyLayersResponse,
  LexicVocabularyTermsResponse,
  LexicWmsRequest,
  LexicWmsResponse,
} from './lexic-api.model';

const LEXIC_API_BY_PAGE_HOST: Record<string, string> = {
  'localhost:8000': 'https://dev-webmap-api.swissgeol.ch',
  'dev-viewer.swissgeol.ch': 'https://dev-webmap-api.swissgeol.ch',
  'int-viewer.swissgeol.ch': 'https://int-webmap-api.swissgeol.ch',
  'swissgeol.ch': 'https://webmap-api.swissgeol.ch',
  'viewer.swissgeol.ch': 'https://webmap-api.swissgeol.ch',
};

const DEFAULT_BASE_URL = 'https://dev-webmap-api.swissgeol.ch';

export class LexicApiService extends BaseService {
  private apiKey: string | null = null;
  private baseUrl: string;

  constructor() {
    super();
    this.baseUrl = LEXIC_API_BY_PAGE_HOST[this.getHost()] ?? DEFAULT_BASE_URL;
  }

  configure(config: { apiKey?: string | null; baseUrl?: string }): void {
    if (config.apiKey !== undefined) {
      this.apiKey = config.apiKey;
    }
    if (config.baseUrl !== undefined) {
      this.baseUrl = trimTrailingSlash(config.baseUrl);
    }
  }

  async getLayers(lang: LexicLanguage = 'en'): Promise<LexicLayersResponse> {
    return this.getJson('/layers', { lang });
  }

  async getLayerFilters(
    layerId: string,
    lang: LexicLanguage = 'en',
  ): Promise<LexicLayerFiltersResponse> {
    return this.getJson(`/layers/${encodeURIComponent(layerId)}/filters`, {
      lang,
    });
  }

  async getLayerDefaultFilters(
    layerId: string,
    term: string,
  ): Promise<LexicDefaultFiltersResponse> {
    return this.getJson(
      `/layers/${encodeURIComponent(layerId)}/defaultFilters`,
      {
        term,
      },
    );
  }

  async getLayerAttributes(
    layerId: string,
  ): Promise<LexicLayerAttributesResponse> {
    return this.getJson(`/layers/${encodeURIComponent(layerId)}/attributeList`);
  }

  async getVocabularies(
    lang: LexicLanguage = 'en',
  ): Promise<LexicVocabulariesResponse> {
    return this.getJson('/vocabularies', { lang });
  }

  async getVocabularyTerms(
    vocabularyId: string,
    lang: LexicLanguage = 'en',
  ): Promise<LexicVocabularyTermsResponse> {
    return this.getJson(
      `/vocabularies/${encodeURIComponent(vocabularyId)}/terms`,
      { lang },
    );
  }

  async getVocabularyLayers(
    vocabularyId: string,
  ): Promise<LexicVocabularyLayersResponse> {
    return this.getJson(
      `/vocabularies/${encodeURIComponent(vocabularyId)}/layers`,
    );
  }

  async generateWmsRequest(
    payload: LexicWmsRequest,
  ): Promise<LexicWmsResponse> {
    return this.postJson('/generateWmsRequest', payload);
  }

  private async getJson<T>(
    path: string,
    query?: Record<string, string>,
  ): Promise<T> {
    return this.request<T>(path, {
      method: 'GET',
      query,
    });
  }

  private async postJson<T>(path: string, body: object): Promise<T> {
    return this.request<T>(path, {
      method: 'POST',
      body,
    });
  }

  // Keep all transport and auth details in one place so callers remain API-agnostic.
  private async request<T>(
    path: string,
    options: {
      method: 'GET' | 'POST';
      query?: Record<string, string>;
      body?: object;
    },
  ): Promise<T> {
    const apiKey = this.apiKey;
    if (apiKey === null || apiKey.trim().length === 0) {
      throw new Error(
        'Lexic API key is not configured. Call LexicApiService.configure({ apiKey }) first.',
      );
    }

    const url = new URL(this.baseUrl + path);
    for (const [key, value] of Object.entries(options.query ?? {})) {
      url.searchParams.set(key, value);
    }

    const headers = new Headers({
      Accept: 'application/json',
      'X-API-Key': apiKey,
    });

    const body =
      options.body === undefined ? undefined : JSON.stringify(options.body);
    if (body !== undefined) {
      headers.set('Content-Type', 'application/json');
    }

    const response = await fetch(url.toString(), {
      method: options.method,
      headers,
      body,
    });

    if (!response.ok) {
      throw new Error(
        `Failed to call Lexic API (${options.method} ${path}): [HTTP ${response.status}] ${await response.text()}`,
      );
    }

    return (await response.json()) as T;
  }

  private getHost(): string {
    if (typeof globalThis.location === 'undefined') {
      return 'localhost:8000';
    }
    return globalThis.location.host;
  }
}

function trimTrailingSlash(value: string): string {
  return value.endsWith('/') ? value.slice(0, -1) : value;
}

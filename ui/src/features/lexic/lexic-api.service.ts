import { BaseService } from 'src/services/base.service';
import { LEXIC_API_BY_PAGE_HOST } from 'src/constants';
import {
  getLayers,
  getLayersLayerIdAttributeList,
  getLayersLayerIdDefaultFilters,
  getLayersLayerIdFilters,
  getVocabularies,
  getVocabulariesChronostratigraphyLayers,
  getVocabulariesChronostratigraphyTerms,
  getVocabulariesLithologyLayers,
  getVocabulariesLithologyTerms,
  getVocabulariesLithostratigraphyLayers,
  getVocabulariesLithostratigraphyTerms,
  getVocabulariesTectonicUnitsLayers,
  getVocabulariesTectonicUnitsTerms,
  postGenerateWmsRequest,
} from './generated/lexic-api';
import { configureLexicClient } from './lexic-orval.mutator';
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

const DEFAULT_BASE_URL = 'https://dev-webmap-api.swissgeol.ch';

export class LexicApiService extends BaseService {
  private baseUrl: string;

  constructor() {
    super();
    this.baseUrl = LEXIC_API_BY_PAGE_HOST[this.getHost()] ?? DEFAULT_BASE_URL;
    this.configureGeneratedClient();
  }

  async getLayers(lang: LexicLanguage = 'en'): Promise<LexicLayersResponse> {
    const response = await getLayers({ lang });
    return this.getData(response);
  }

  async getLayerFilters(
    layerId: string,
    lang: LexicLanguage = 'en',
  ): Promise<LexicLayerFiltersResponse> {
    const response = await getLayersLayerIdFilters(
      encodeURIComponent(layerId),
      {
        lang,
      },
    );
    return this.getData(response);
  }

  async getLayerDefaultFilters(
    layerId: string,
    term: string,
  ): Promise<LexicDefaultFiltersResponse> {
    const response = await getLayersLayerIdDefaultFilters(
      encodeURIComponent(layerId),
      { term },
    );
    return this.getData(response);
  }

  async getLayerAttributes(
    layerId: string,
  ): Promise<LexicLayerAttributesResponse> {
    const response = await getLayersLayerIdAttributeList(
      encodeURIComponent(layerId),
    );
    return this.getData(response);
  }

  async getVocabularies(
    lang: LexicLanguage = 'en',
  ): Promise<LexicVocabulariesResponse> {
    const response = await getVocabularies({ lang });
    return this.getData(response);
  }

  async getVocabularyTerms(
    vocabularyId: string,
    lang: LexicLanguage = 'en',
  ): Promise<LexicVocabularyTermsResponse> {
    const vocabulary = vocabularyId.toLowerCase();
    switch (vocabulary) {
      case 'chronostratigraphy':
        return this.getData(
          await getVocabulariesChronostratigraphyTerms({ lang }),
        );
      case 'tectonic-units':
      case 'tectonicunits':
        return this.getData(await getVocabulariesTectonicUnitsTerms({ lang }));
      case 'lithostratigraphy':
        return this.getData(
          await getVocabulariesLithostratigraphyTerms({ lang }),
        );
      case 'lithology':
        return this.getData(await getVocabulariesLithologyTerms({ lang }));
      default:
        throw new Error(`Unsupported Lexic vocabulary id: ${vocabularyId}`);
    }
  }

  async getVocabularyLayers(
    vocabularyId: string,
  ): Promise<LexicVocabularyLayersResponse> {
    const vocabulary = vocabularyId.toLowerCase();
    switch (vocabulary) {
      case 'chronostratigraphy':
        return this.getData(await getVocabulariesChronostratigraphyLayers());
      case 'tectonic-units':
      case 'tectonicunits':
        return this.getData(await getVocabulariesTectonicUnitsLayers());
      case 'lithostratigraphy':
        return this.getData(await getVocabulariesLithostratigraphyLayers());
      case 'lithology':
        return this.getData(await getVocabulariesLithologyLayers());
      default:
        throw new Error(`Unsupported Lexic vocabulary id: ${vocabularyId}`);
    }
  }

  async generateWmsRequest(
    payload: LexicWmsRequest,
  ): Promise<LexicWmsResponse> {
    const response = await postGenerateWmsRequest(payload);
    return this.getData(response);
  }

  private getData<T>(response: { data: unknown }): T {
    return response.data as T;
  }

  private configureGeneratedClient(): void {
    configureLexicClient({
      baseUrl: this.baseUrl,
    });
  }

  private getHost(): string {
    if (typeof globalThis.location === 'undefined') {
      return 'localhost:8000';
    }
    return globalThis.location.host;
  }
}


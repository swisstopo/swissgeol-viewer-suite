export type LexicLanguage = 'en' | 'it' | 'de' | 'fr';

export type LexicFilterId =
  | 'f-chronostrat-term'
  | 'f-tectonic-term'
  | 'f-lithostrat-term'
  | 'f-lithology-term'
  | 'f-byAttribute';

export interface LexicFilter {
  id: LexicFilterId | string;
  name: string;
  title: string;
  description: string;
}

export interface LexicLayer {
  id: string;
  name: string;
  filterable: boolean;
  availableFilters: LexicFilter[];
}

export interface LexicLayersResponse {
  webmapId: string;
  layers: LexicLayer[];
}

export interface LexicLayerFiltersResponse {
  layerId: string;
  filters: LexicFilter[];
}

export interface LexicLayerAttributesResponse {
  layerId: string;
  attributes: string[];
}

export interface LexicVocabulariesResponse {
  vocabularies: LexicVocabularyDescriptor[];
}

export interface LexicVocabularyDescriptor {
  id: string;
  name: string;
}

export interface LexicVocabularyTermsResponse {
  terms: LexicVocabularyTerm[];
}

export interface LexicVocabularyTerm {
  term: string;
  label: string;
  description: string;
  breadcrumbs: Record<string, string>;
}

export interface LexicVocabularyLayersResponse {
  layers: LexicVocabularyLayer[];
}

export interface LexicVocabularyLayer {
  id: string;
  name: string;
}

export interface LexicChronostratigraphyFilterParameter {
  type: 'Younger' | 'From-To' | 'Older';
  from?: string;
  to?: string;
}

export interface LexicTermFilterParameter {
  term: string;
  includeNarrowers?: boolean;
}

export interface LexicByAttributeFilterParameter {
  attribute: string;
  value: string | number | boolean;
}

export type LexicFilterParameter =
  | LexicChronostratigraphyFilterParameter
  | LexicTermFilterParameter
  | LexicByAttributeFilterParameter;

export interface LexicWmsRequestFilter {
  filterId: LexicFilterId | string;
  parameters: LexicFilterParameter;
}

export interface LexicWmsRequest {
  webmapId: string;
  layerId: string;
  filters?: LexicWmsRequestFilter[];
}

export interface LexicWmsResponse {
  url: string;
  body: string;
  mimeType: string;
  note: string;
}

export interface LexicDefaultFiltersResponse {
  layerId: string;
  filters: LexicWmsRequestFilter[];
}

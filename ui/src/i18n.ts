import i18next, {
  LanguageDetectorModule,
  InitOptions,
  Services,
  FallbackLng,
} from 'i18next';
import locI18next from 'loc-i18next';
import Backend from 'i18next-http-backend';
import { LitElement } from 'lit';
import { SUPPORTED_LANGUAGES } from './constants';
import { getURLSearchParams, setURLSearchParams } from './utils';
import { BehaviorSubject, filter } from 'rxjs';

class LanguageDetector implements LanguageDetectorModule {
  readonly async = false;
  readonly type = 'languageDetector';
  static readonly type = 'languageDetector';

  private languageUtils!: any;
  private fallbackLng!: false | FallbackLng | undefined;

  init(services: Services, _options: object, i18nextOptions: InitOptions) {
    this.languageUtils = services.languageUtils;
    this.fallbackLng = i18nextOptions.fallbackLng;
  }

  detect() {
    let language: false | FallbackLng | undefined | null = this.fallbackLng;

    const lang = getURLSearchParams().get('lang');
    // get language from url
    if (this.languageUtils.isSupportedCode(lang)) {
      language = lang;
    } else {
      // fallback to browser's language
      const languages: string[] = [];
      if (navigator.languages) {
        languages.push(...navigator.languages);
      } else if (navigator.language) {
        languages.push(navigator.language);
      }
      for (const l of languages) {
        if (this.languageUtils.isSupportedCode(l)) {
          language = l;
          break;
        }
      }
    }
    return this.languageUtils.getLanguagePartFromCode(language);
  }

  cacheUserLanguage(lang) {
    const params = getURLSearchParams();
    params.set('lang', lang);
    setURLSearchParams(params);
  }
}

export function setupI18n() {
  const promise = i18next
    .use(Backend)
    .use(LanguageDetector)
    .init({
      ns: ['app', 'assets', 'layers', 'layout', 'catalog'],
      defaultNS: 'app',
      supportedLngs: SUPPORTED_LANGUAGES,
      nonExplicitSupportedLngs: true,
      returnEmptyString: false,
      fallbackLng: 'en',
      debug: false,
      backend: {
        loadPath: 'locales/{{ns}}/{{ns}}.{{lng}}.json',
      },
    });

  const localize = locI18next.init(i18next);

  i18next.on('languageChanged', (lang) => {
    document.documentElement.lang = lang;
    localize('[data-i18n]');
  });
  return promise;
}

/**
 * @param {import('lit-element').LitElement} Base
 */
export class LitElementI18n extends LitElement {
  private i18nLanguageChangedCallback_?: () => void;

  connectedCallback() {
    this.i18nLanguageChangedCallback_ = () => this.requestUpdate();
    i18next.on('languageChanged', this.i18nLanguageChangedCallback_);
    super.connectedCallback();
  }

  disconnectedCallback() {
    i18next.off('languageChanged', this.i18nLanguageChangedCallback_);
    super.disconnectedCallback();
  }
}

export function toLocaleDateString(dateString: string): string {
  const date = new Date(dateString);

  return date.toLocaleDateString(`${i18next.language}-CH`, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function translated(property: string | object): string {
  return typeof property === 'string' ? property : property[i18next.language];
}

export enum Language {
  German = 'de',
  English = 'en',
  French = 'fr',
  Italian = 'it',
}

const languageSubject = new BehaviorSubject(i18next.language as Language);
i18next.on('languageChanged', () => {
  languageSubject.next(i18next.language as Language);
});

export const language$ = languageSubject
  .asObservable()
  .pipe(filter((it) => it !== undefined));

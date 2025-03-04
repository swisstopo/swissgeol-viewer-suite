import { BaseService } from 'src/utils/base.service';
import { ToolService } from 'src/features/tool/tool.service';
import { Feature } from 'src/features/tool/tool.model';
import MainStore from 'src/store/main';
import { filter, take } from 'rxjs';

export class ToolPersistenceService extends BaseService {
  constructor(toolService: ToolService) {
    super();

    const features = this.readFeatures();
    MainStore.viewer
      .pipe(
        filter((it) => it !== null),
        take(1),
      )
      .subscribe(() => {
        toolService.addFeatures(features);
        toolService.features$.subscribe((features) => {
          // TODO ensure that we respect projectEditMode / update projects via API. See `NgmToolbox`.
          this.writeFeatures(features);
        });
      });
  }

  private writeFeatures(features: Feature[]): void {
    if (features.length === 0) {
      this.clearFeatures();
      return;
    }

    localStorage.setItem(FEATURES_KEY, JSON.stringify(features));
    localStorage.setItem(VERSION_KEY, `${SERIAL_VERSION}`);
  }

  private readFeatures(): Feature[] {
    const value = localStorage.getItem(FEATURES_KEY);
    const version = parseInt(localStorage.getItem(VERSION_KEY) ?? '');
    if (value === null || isNaN(version) || version !== SERIAL_VERSION) {
      this.clearFeatures();
      return [];
    }
    try {
      return JSON.parse(value);
    } catch (_e) {
      this.clearFeatures();
      return [];
    }
  }

  private clearFeatures(): void {
    localStorage.removeItem(FEATURES_KEY);
    localStorage.removeItem(VERSION_KEY);
  }
}

/**
 * A number that is saved alongside the features.
 * This enables use to check that a stored value if compatible with
 * the application's current version.
 *
 * If {@link Feature} is changed in a way that makes previously serialized
 * values incompatible with it, this value should be increased by one.
 */
const SERIAL_VERSION = 1;

const FEATURES_KEY = 'swissgeol-viewer/features';
const VERSION_KEY = 'swissgeol-viewer/features.serial_version';

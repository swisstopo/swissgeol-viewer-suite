import { BaseService } from 'src/utils/base.service';
import { SessionService } from 'src/features/session';
import { BehaviorSubject, switchMap } from 'rxjs';
import { LayerApiService } from 'src/features/layer/new/layer-api.service';
import { Id } from 'src/models/id.model';
import { Layer } from 'src/features/layer';

export class LayerService extends BaseService {
  private layerApiService!: LayerApiService;

  private layerDefinitions = new Map<Id<Layer>, Layer>();

  private layers = new Map<Id<Layer>, BehaviorSubject<Layer>>();

  private tree = new BehaviorSubject();

  constructor() {
    super();

    this.inject(LayerApiService).subscribe((service) => {
      this.layerApiService = service;
    });

    this.inject(SessionService)
      .pipe(
        switchMap((service) =>
          service.initialized$.pipe(switchMap(() => service.user$)),
        ),
      )
      .subscribe(() => this.loadLayers());
  }

  private async loadLayers() {
    const layers = await this.layerApiService.fetchLayers();
    console.log(layers);
  }
}

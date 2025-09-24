import { BaseService } from 'src/utils/base.service';
import { SessionService } from 'src/features/session';
import { switchMap } from 'rxjs';
import { LayerApiService } from 'src/features/layer/new/layer-api.service';

export class LayerService extends BaseService {
  private layerApiService!: LayerApiService;

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

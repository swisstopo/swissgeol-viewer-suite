import { BaseService } from 'src/services/base.service';
import { BehaviorSubject, Observable } from 'rxjs';
import { Control2dController } from 'src/features/controls/controls/control2d.controller';
import { CesiumService } from 'src/services/cesium.service';

export class ControlsService extends BaseService {
  private readonly is2DActiveSubject = new BehaviorSubject(false);

  constructor() {
    super();

    CesiumService.inject().then((cesiumService) => {
      const { viewer } = cesiumService;
      const control2d = new Control2dController(viewer);
      this.is2DActive$.subscribe(control2d.toggle);
    });
  }

  get is2DActive$(): Observable<boolean> {
    return this.is2DActiveSubject.asObservable();
  }

  get is2DActive(): boolean {
    return this.is2DActiveSubject.value;
  }

  set2DActive(isActive: boolean): void {
    this.is2DActiveSubject.next(isActive);
  }
}

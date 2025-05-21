import { BaseService } from 'src/utils/base.service';
import { BehaviorSubject, Observable } from 'rxjs';
import MainStore from 'src/store/main';
import { Control2dController } from 'src/features/controls/controls/control2d.controller';

export class ControlsService extends BaseService {
  private readonly is2DActiveSubject = new BehaviorSubject(false);

  constructor() {
    super();

    MainStore.viewer.subscribe((viewer) => {
      if (viewer === null) {
        return;
      }
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

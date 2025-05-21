import { BaseService } from 'src/utils/base.service';
import { BehaviorSubject, Observable } from 'rxjs';

export class ControlsService extends BaseService {
  private is2DActiveSubject = new BehaviorSubject(false);

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

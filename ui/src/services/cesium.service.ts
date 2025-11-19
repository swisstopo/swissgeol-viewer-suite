import { BaseService } from 'src/services/base.service';
import { Viewer } from 'cesium';
import { BehaviorSubject, filter, firstValueFrom, map, Observable } from 'rxjs';

export class CesiumService extends BaseService {
  private readonly viewerSubject = new BehaviorSubject<Viewer | null>(null);

  constructor() {
    super();
  }

  initialize(viewer: Viewer) {
    if (this.viewerSubject.value !== null) {
      throw new Error('Service has already been initialized.');
    }
    this.viewerSubject.next(viewer);
  }

  get ready(): Promise<void> {
    return firstValueFrom(this.viewer$.pipe(map(() => {})));
  }

  get viewer$(): Observable<Viewer> {
    return this.viewerSubject.pipe(filter((viewer) => viewer !== null));
  }

  get viewer(): Viewer {
    const viewer = this.viewerSubject.value;
    if (viewer === null) {
      throw new Error('Viewer has not been initialized yet');
    }
    return viewer;
  }

  get viewerOrNull(): Viewer | null {
    return this.viewerSubject.value;
  }
}

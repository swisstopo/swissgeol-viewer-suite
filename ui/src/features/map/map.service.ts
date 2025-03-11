import { BaseService } from 'src/utils/base.service';
import { createContext } from '@lit/context';
import { BehaviorSubject, filter, Observable } from 'rxjs';

export class MapService extends BaseService {
  static readonly elementContext = createContext<HTMLElement>('MapService.element');

  private readonly _element$ = new BehaviorSubject<HTMLElement | null>(null);

  get element$(): Observable<HTMLElement> {
    return this._element$.asObservable().pipe(filter((it) => it !== null));
  }

  setElement(element: HTMLElement): void {
    this._element$.next(element);
  }
}

import { BehaviorSubject } from 'rxjs';
import { getCesiumToolbarParam } from '../permalink';

export default class MainStore {
  static readonly isDebugActive$ = new BehaviorSubject(getCesiumToolbarParam());
}

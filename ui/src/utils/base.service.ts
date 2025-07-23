import { Context, ContextConsumer, createContext } from '@lit/context';
import { LitElement } from 'lit';
import { Subject } from 'rxjs';

const classToContext = new Map<
  typeof BaseService,
  ServiceContext<BaseService>
>();

export type ServiceContext<T extends BaseService> = Context<
  AnyBaseServiceType<T>,
  T
>;

export type AnyBaseServiceType<T extends BaseService = BaseService> =
  typeof BaseService & (new () => T);

export abstract class BaseService {
  private static bufferedInjections: Array<(element: LitElement) => void> = [];

  constructor() {}

  static context<T extends BaseService>(
    this: AnyBaseServiceType<T>,
  ): ServiceContext<T> {
    const existingContext = classToContext.get(this);
    if (existingContext != null) {
      return existingContext as ServiceContext<T>;
    }

    const context = createContext<T, typeof this>(
      this,
    ) as unknown as ServiceContext<T>;
    classToContext.set(this, context);
    return context;
  }

  protected inject<T extends BaseService>(
    service: AnyBaseServiceType<T>,
  ): Subject<T> {
    const subject = new Subject<T>();
    BaseService.bufferedInjections.push((host) => {
      new ContextConsumer(host, {
        context: service.context(),
        callback: (instance) => {
          subject.next(instance);
        },
      });
    });
    return subject;
  }

  static initializeWith(host: LitElement): void {
    for (const injection of BaseService.bufferedInjections) {
      injection(host);
    }
  }
}

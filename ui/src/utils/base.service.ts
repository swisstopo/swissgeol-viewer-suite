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
  private static host: LitElement | null = null;

  private static readonly bufferedInjections: Array<
    (element: LitElement) => void
  > = [];

  private static readonly initializers: Array<() => void> = [];

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

  static inject<T extends BaseService>(this: AnyBaseServiceType<T>): Subject<T>;

  static inject<T>(context: Context<unknown, T>): Subject<T>;

  static inject<T extends BaseService>(
    service: AnyBaseServiceType<T>,
  ): Subject<T>;

  static inject<T>(
    serviceOrContext?: AnyBaseServiceType | Context<unknown, T>,
  ): Subject<T> {
    if (serviceOrContext == null) {
      return BaseService.inject(this as any);
    }

    const subject = new Subject<T>();
    const context: Context<unknown, T> | ServiceContext<BaseService> =
      typeof serviceOrContext === 'object' &&
      'prototype' in serviceOrContext &&
      serviceOrContext.prototype instanceof BaseService
        ? (serviceOrContext as unknown as AnyBaseServiceType).context()
        : (serviceOrContext as Context<unknown, T>);
    BaseService.injectHostWhenReady((host) => {
      new ContextConsumer(host, {
        context,
        callback: (instance) => {
          subject.next(instance as T);
        },
      });
    });
    return subject;
  }

  static onReady(callback: () => void): void {
    if (this.host === null) {
      BaseService.initializers.push(callback);
      return;
    }
    callback();
  }

  static initializeWith(host: LitElement): void {
    this.host = host;
    for (const injection of BaseService.bufferedInjections) {
      injection(host);
    }
    for (const initialize of BaseService.initializers) {
      initialize();
    }
  }

  private static injectHostWhenReady(
    inject: (element: LitElement) => void,
  ): void {
    if (this.host === null) {
      BaseService.bufferedInjections.push(inject);
      return;
    }
    inject(this.host);
  }
}

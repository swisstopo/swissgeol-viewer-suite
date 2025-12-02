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

  static inject$<T extends BaseService>(
    this: AnyBaseServiceType<T>,
  ): Subject<T>;

  static inject$<T>(context: Context<unknown, T>): Subject<T>;

  static inject$<T extends BaseService>(
    service: AnyBaseServiceType<T>,
  ): Subject<T>;

  static inject$<T>(
    serviceOrContext?: AnyBaseServiceType | Context<unknown, T>,
  ): Subject<T> {
    const subject = new Subject<T>();
    const context = this.getContext(serviceOrContext);
    BaseService.injectHostWhenReady((host) => {
      new ContextConsumer(host, {
        context,
        callback: (instance) => {
          subject.next(instance as T);
          subject.complete();
        },
      });
    });
    return subject;
  }

  static inject<T extends BaseService>(this: AnyBaseServiceType<T>): Promise<T>;

  static inject<T>(context: Context<unknown, T>): Promise<T>;

  static inject<T extends BaseService>(
    service: AnyBaseServiceType<T>,
  ): Promise<T>;

  static inject<T>(
    serviceOrContext?: AnyBaseServiceType | Context<unknown, T>,
  ): Promise<T> {
    const context = this.getContext(serviceOrContext);
    return new Promise((resolve) => {
      BaseService.injectHostWhenReady((host) => {
        new ContextConsumer(host, {
          context,
          callback: (instance) => {
            resolve(instance as T);
          },
          subscribe: false,
        });
      });
    });
  }

  static get<T extends BaseService>(this: AnyBaseServiceType<T>): T;

  static get<T>(context: Context<unknown, T>): T;

  static get<T extends BaseService>(service: AnyBaseServiceType<T>): T;

  static get<T>(
    serviceOrContext?: AnyBaseServiceType | Context<unknown, T>,
  ): T {
    const context = this.getContext(serviceOrContext);
    if (this.host === null) {
      throw new Error(
        'Cannot get service before the context root has been initialized.',
      );
    }
    let value: T | null = null;
    const consumer = new ContextConsumer(this.host, {
      context,
      callback: (instance) => {
        value = instance as T;
      },
      subscribe: false,
    });
    consumer.hostDisconnected();
    if (value === null) {
      throw new Error(
        `Service not found: ${this.getContextName(serviceOrContext)}`,
      );
    }
    return value;
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

  private static getContext<T>(
    serviceOrContext?: AnyBaseServiceType | Context<unknown, T>,
  ): Context<unknown, T> | ServiceContext<BaseService> {
    serviceOrContext ??= this as AnyBaseServiceType;
    return isBaseService(serviceOrContext)
      ? serviceOrContext.context()
      : serviceOrContext;
  }

  private static getContextName(
    serviceOrContext?: AnyBaseServiceType | Context<unknown, unknown>,
  ): string {
    serviceOrContext ??= this as AnyBaseServiceType;
    return isBaseService(serviceOrContext)
      ? serviceOrContext.name
      : String(serviceOrContext);
  }
}

const isBaseService = <T>(
  serviceOrContext: AnyBaseServiceType | Context<unknown, T>,
): serviceOrContext is AnyBaseServiceType =>
  typeof serviceOrContext === 'object' &&
  'prototype' in serviceOrContext &&
  serviceOrContext.prototype instanceof BaseService;

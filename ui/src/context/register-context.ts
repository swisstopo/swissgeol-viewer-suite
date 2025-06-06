import { LitElement } from 'lit';
import { Context, ContextProvider } from '@lit/context';
import { ClientConfig } from '../api/client-config';
import {
  apiClientContext,
  authServiceContext,
  clientConfigContext,
  gstServiceContext,
} from './client-config.context';
import { ApiClient } from '../api/api-client';
import AuthService from '../authService';
import {
  AnyBaseServiceType,
  BaseService,
  ServiceContext,
} from 'src/utils/base.service';
import { BackgroundLayerService } from 'src/features/background/background-layer.service';
import { GstService } from 'src/gst.service';
import { ControlsService } from 'src/features/controls/controls.service';

type AppContext = ContextProvider<Context<unknown, unknown>, LitElement>;
export const registerAppContext = (
  element: LitElement,
  clientConfig: ClientConfig,
): AppContext[] => {
  const makeProvider = makeProviderForElement(element);

  const contexts: AppContext[] = [];

  const authService = new AuthService();
  authService.clientConfig = clientConfig;
  authService.initialize();

  contexts.push(
    new ContextProvider(element, {
      context: clientConfigContext,
      initialValue: clientConfig,
    }),
    new ContextProvider(element, {
      context: authServiceContext,
      initialValue: authService,
    }),
  );

  const apiClient = new ApiClient(authService);
  contexts.push(
    new ContextProvider(element, {
      context: apiClientContext,
      initialValue: apiClient,
    }),
  );

  const gstService = new GstService(clientConfig);
  contexts.push(
    new ContextProvider(element, {
      context: gstServiceContext,
      initialValue: gstService,
    }),
  );

  contexts.push(makeProvider(BackgroundLayerService));
  contexts.push(makeProvider(ControlsService));
  return contexts;
};

interface MakeProvider {
  <T extends typeof BaseService & (new () => InstanceType<T>)>(
    serviceType: T,
  ): ContextProvider<ServiceContext<T>, LitElement>;

  <T extends typeof BaseService>(
    service: InstanceType<T>,
  ): ContextProvider<ServiceContext<T>, LitElement>;
}

const makeProviderForElement =
  (element: LitElement): MakeProvider =>
  (serviceOrType: unknown): ContextProvider<never, LitElement> => {
    if (serviceOrType instanceof BaseService) {
      const context = (
        serviceOrType.constructor as AnyBaseServiceType
      ).context();
      const initialValue = serviceOrType as never;
      return new ContextProvider(element, { context, initialValue });
    } else {
      const context = (serviceOrType as AnyBaseServiceType).context();
      const initialValue =
        new (serviceOrType as new () => BaseService)() as never;
      return new ContextProvider(element, { context, initialValue });
    }
  };

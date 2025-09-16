import { LitElement } from 'lit';
import { Context, ContextProvider } from '@lit/context';
import { ClientConfig } from '../api/client-config';
import {
  clientConfigContext,
  gstServiceContext,
} from './client-config.context';
import { ApiClient } from '../api/api-client';
import {
  AnyBaseServiceType,
  BaseService,
  ServiceContext,
} from 'src/utils/base.service';
import { BackgroundLayerService } from 'src/features/background/background-layer.service';
import { GstService } from 'src/gst.service';
import { ControlsService } from 'src/features/controls/controls.service';
import { LayerInfoService } from 'src/features/layer/info/layer-info.service';
import { LayerService } from 'src/features/layer/layer.service';
import { GestureControlsService } from 'src/features/controls/gestures/gesture-controls.service';
import { SessionService } from 'src/features/session/session.service';

type AppContext = ContextProvider<Context<unknown, unknown>, LitElement>;
export const registerAppContext = (
  element: LitElement,
  clientConfig: ClientConfig,
): AppContext[] => {
  const makeProvider = makeProviderForElement(element);

  const contexts: AppContext[] = [];

  contexts.push(
    new ContextProvider(element, {
      context: clientConfigContext,
      initialValue: clientConfig,
    }),
  );

  const gstService = new GstService(clientConfig);
  contexts.push(
    new ContextProvider(element, {
      context: gstServiceContext,
      initialValue: gstService,
    }),
  );

  contexts.push(makeProvider(ApiClient));
  contexts.push(makeProvider(SessionService));
  contexts.push(makeProvider(BackgroundLayerService));
  contexts.push(makeProvider(ControlsService));
  contexts.push(makeProvider(LayerService));
  contexts.push(makeProvider(LayerInfoService));
  contexts.push(makeProvider(GestureControlsService));

  return contexts;
};

interface MakeProvider {
  <T extends typeof BaseService>(
    serviceType: T,
  ): ContextProvider<ServiceContext<InstanceType<T>>, LitElement>;

  <T extends typeof BaseService>(
    service: InstanceType<T>,
  ): ContextProvider<ServiceContext<InstanceType<T>>, LitElement>;
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

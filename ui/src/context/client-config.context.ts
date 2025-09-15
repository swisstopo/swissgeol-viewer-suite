import { createContext } from '@lit/context';
import { ClientConfig } from '../api/client-config';
import { GstService } from 'src/gst.service';

export const clientConfigContext = createContext<ClientConfig>('clientConfig');
export const gstServiceContext = createContext<GstService>('gstService');

import { createContext } from '@lit/context';
import { Viewer } from 'cesium';

export const viewerContext = createContext<Viewer | null>('Viewer');

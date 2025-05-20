import '@swisstopo/swissgeol-ui-core/import';

import './jquery.polyfill';
import './style/index.css';
import { ReactiveElement } from 'lit';

import './ngm-app-boot';

ReactiveElement.enableWarning?.('migration');

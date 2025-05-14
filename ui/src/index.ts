import './jquery.polyfill';
import './style/index.css';
import { ReactiveElement } from 'lit';
import { defineCustomElements } from '@swisstopo/swissgeol-ui-core/loader';

defineCustomElements();
import './ngm-app-boot';

ReactiveElement.enableWarning?.('migration');

import { JSDOM } from 'jsdom';

// Provide only the DOM globals needed by jQuery/fomantic-ui while keeping Node's native fetch, Blob and ArrayBuffer.
const { window } = new JSDOM('<!doctype html><html><body></body></html>');
Object.assign(globalThis, {
  window,
  document: window.document,
  HTMLElement: window.HTMLElement,
});

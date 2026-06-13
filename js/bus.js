/* Render bus — lets views request a full re-render without importing app.js */
let renderFn = null;
export function setRenderer(fn) { renderFn = fn; }
export function requestRender() { if (renderFn) renderFn(); }

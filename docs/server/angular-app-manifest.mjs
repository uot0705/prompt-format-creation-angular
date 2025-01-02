
export default {
  bootstrap: () => import('./main.server.mjs').then(m => m.default),
  inlineCriticalCss: true,
  baseHref: 'prompt-format-creation-angular',
  locale: undefined,
  routes: [
  {
    "renderMode": 2,
    "route": "/prompt-format-creation-angular"
  }
],
  assets: {
    'index.csr.html': {size: 540, hash: '280d177c6d5c4cc710ac1f464e70e8229c85cbd16b7380721c344ca577ca7e4b', text: () => import('./assets-chunks/index_csr_html.mjs').then(m => m.default)},
    'index.server.html': {size: 1053, hash: 'ee45c941e85fe30540cfce9474149db8681e2498a42b7ef8c261c69a47464455', text: () => import('./assets-chunks/index_server_html.mjs').then(m => m.default)},
    'index.html': {size: 6044, hash: 'c29b14600ffdbfd0424d7e0483d399835a8cef1ba5637734b6895a0f45b5ae08', text: () => import('./assets-chunks/index_html.mjs').then(m => m.default)},
    'styles-5INURTSO.css': {size: 0, hash: 'menYUTfbRu8', text: () => import('./assets-chunks/styles-5INURTSO_css.mjs').then(m => m.default)}
  },
};

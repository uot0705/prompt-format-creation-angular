
export default {
  bootstrap: () => import('./main.server.mjs').then(m => m.default),
  inlineCriticalCss: true,
  baseHref: '/prompt-format-creation-angular/',
  locale: undefined,
  routes: [
  {
    "renderMode": 2,
    "route": "/prompt-format-creation-angular"
  }
],
  assets: {
    'index.csr.html': {size: 542, hash: '074d2410c7abd149f94be29638ee0f9e2e04d09a7ca64f39cf76f0c6ddf49242', text: () => import('./assets-chunks/index_csr_html.mjs').then(m => m.default)},
    'index.server.html': {size: 1055, hash: '4b854a5a4b819ca7e5210f7bc206bc9023b93cdd466e41d1357f491302b07aa2', text: () => import('./assets-chunks/index_server_html.mjs').then(m => m.default)},
    'index.html': {size: 6046, hash: '35232ab6b8e13caf50461186316682f3f4f05741d6de41eedc9a09921c996c0e', text: () => import('./assets-chunks/index_html.mjs').then(m => m.default)},
    'styles-5INURTSO.css': {size: 0, hash: 'menYUTfbRu8', text: () => import('./assets-chunks/styles-5INURTSO_css.mjs').then(m => m.default)}
  },
};

import { onRequestPost } from './functions/ai-proxy.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Keep the AI endpoint as a Worker route while all normal requests
    // are served from the Vite-built static assets.
    if (url.pathname === '/ai-proxy') {
      return onRequestPost({ request, env, ctx });
    }

    return env.ASSETS.fetch(request);
  },
};

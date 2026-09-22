import { onRequestPost as onAiRequestPost } from './functions/ai-proxy.js';
import { onRequestPost as onCreateUserRequestPost } from './functions/create-user.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Keep the AI endpoint as a Worker route while all normal requests
    // are served from the Vite-built static assets.
    if (url.pathname === '/ai-proxy') {
      return onAiRequestPost({ request, env, ctx });
    }

    if (url.pathname === '/create-user' && request.method === 'POST') {
      return onCreateUserRequestPost({ request, env, ctx });
    }

    return env.ASSETS.fetch(request);
  },
};

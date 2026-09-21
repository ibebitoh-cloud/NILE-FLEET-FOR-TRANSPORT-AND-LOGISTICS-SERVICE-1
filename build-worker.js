const fs = require('fs');
const path = require('path');

const worker = `import { onRequestPost } from '../functions/ai-proxy.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === '/ai-proxy') {
      return onRequestPost({ request, env, ctx });
    }

    return env.ASSETS.fetch(request);
  },
};
`;

const output = path.join(process.cwd(), 'dist', 'worker.js');
fs.writeFileSync(output, worker, 'utf8');
console.log('Generated Cloudflare Worker entrypoint:', output);

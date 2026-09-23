/**
 * localLLM.ts
 * Runs a small, quantized, open-source language model entirely in the
 * browser via Transformers.js — no server call, no API key, no per-request
 * cost. WebGPU is used when available (fast); falls back to WASM (CPU)
 * automatically otherwise, so it works on any device.
 *
 * Model: Qwen2.5-0.5B-Instruct — chosen specifically because Qwen has
 * genuinely useful Arabic + English support at a small (0.5B parameter)
 * size that's practical to download and run in a browser tab.
 *
 * OFFLINE / SELF-HOSTED DEPLOYMENT:
 * To ship this fully offline (no download from Hugging Face at all), place
 * the model's files under /public/models/onnx-community/Qwen2.5-0.5B-Instruct/
 * (same folder structure Hugging Face uses) and set ALLOW_REMOTE_MODELS to
 * false below. With that flag off, the library will only ever look in
 * /models/ and will never contact the network.
 */

// Dynamically imported so the (~20MB) ONNX Runtime Web bundle is only ever
// downloaded when an AI feature is actually used — not as part of the main
// app bundle that every visitor loads on every page view.
let transformersModule: typeof import('@huggingface/transformers') | null = null;
async function getTransformers() {
  if (!transformersModule) {
    transformersModule = await import('@huggingface/transformers');
    transformersModule.env.allowRemoteModels = ALLOW_REMOTE_MODELS;
    transformersModule.env.localModelPath = '/models/';
    transformersModule.env.useBrowserCache = true;
  }
  return transformersModule;
}

const MODEL_ID = 'onnx-community/Qwen2.5-0.5B-Instruct';

// Flip to false once model files are bundled under /public/models/ for a
// fully offline deployment. When true (default), the model downloads from
// Hugging Face on first use and is cached by the browser afterward.
const ALLOW_REMOTE_MODELS = true;

let pipelinePromise: Promise<any> | null = null;
let loadedDevice: 'webgpu' | 'wasm' | null = null;

export type ModelLoadProgress = {
  status: string;
  file?: string;
  progress?: number; // 0-100
};

async function hasWebGPU(): Promise<boolean> {
  try {
    const nav = navigator as any;
    if (!nav.gpu) return false;
    const adapter = await nav.gpu.requestAdapter();
    return !!adapter;
  } catch {
    return false;
  }
}

/**
 * Loads the local model (once — subsequent calls reuse the same pipeline).
 * Reports download/compile progress via onProgress, useful for a loading bar
 * the first time a device runs this (model is a few hundred MB).
 */
export async function loadLocalModel(onProgress?: (p: ModelLoadProgress) => void): Promise<any> {
  if (pipelinePromise) return pipelinePromise;

  pipelinePromise = (async () => {
    const { pipeline } = await getTransformers();
    const useWebGPU = await hasWebGPU();
    loadedDevice = useWebGPU ? 'webgpu' : 'wasm';

    const pipe = await pipeline('text-generation', MODEL_ID, {
      device: loadedDevice,
      dtype: loadedDevice === 'webgpu' ? 'q4f16' : 'q4',
      progress_callback: (p: any) => {
        if (!onProgress) return;
        if (p.status === 'progress') {
          onProgress({ status: 'downloading', file: p.file, progress: p.progress });
        } else {
          onProgress({ status: p.status, file: p.file });
        }
      },
    });

    return pipe;
  })();

  return pipelinePromise;
}

export function getLoadedDevice(): 'webgpu' | 'wasm' | null {
  return loadedDevice;
}

export function isModelLoaded(): boolean {
  return pipelinePromise !== null;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * Runs a chat-style generation locally. This is the ONLY way free-form text
 * leaves the model in this app — callers are responsible for including any
 * grounding data (real numbers from the database) directly in the messages,
 * since the model itself has no way to look anything up on its own. See
 * aiTools.ts for the deterministic data lookups used to ground responses.
 */
export async function generateLocally(
  messages: ChatMessage[],
  options?: { maxNewTokens?: number; onProgress?: (p: ModelLoadProgress) => void }
): Promise<string> {
  const generator = await loadLocalModel(options?.onProgress);
  const output: any = await generator(messages as any, {
    max_new_tokens: options?.maxNewTokens ?? 512,
    do_sample: false,
    temperature: 0.3,
  });

  const generated = output?.[0]?.generated_text;
  if (Array.isArray(generated)) {
    const last = generated[generated.length - 1];
    return (last?.content || '').trim();
  }
  return String(generated || '').trim();
}

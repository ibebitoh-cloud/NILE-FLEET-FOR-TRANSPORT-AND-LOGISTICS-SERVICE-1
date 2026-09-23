# Fully offline AI deployment

By default, this app downloads its local AI model (`onnx-community/Qwen2.5-0.5B-Instruct`)
from Hugging Face the first time an AI feature is used, then caches it in the
browser (IndexedDB) so it's only fetched once per device.

To ship this app **fully offline** — with zero network calls for AI, ever —
follow these steps:

## 1. Download the model files

On a machine with internet access:

```bash
pip install huggingface_hub
huggingface-cli download onnx-community/Qwen2.5-0.5B-Instruct \
  --local-dir ./onnx-community/Qwen2.5-0.5B-Instruct
```

## 2. Place them here

Copy the downloaded folder into this directory so the structure looks like:

```
public/models/onnx-community/Qwen2.5-0.5B-Instruct/
  config.json
  tokenizer.json
  tokenizer_config.json
  onnx/
    model_q4.onnx        (or model_q4f16.onnx for WebGPU)
    ...
```

## 3. Flip the flag

In `services/localLLM.ts`, change:

```ts
const ALLOW_REMOTE_MODELS = true;
```

to:

```ts
const ALLOW_REMOTE_MODELS = false;
```

Rebuild and redeploy. From then on, the app will ONLY ever load the model
from `/models/` and will never contact Hugging Face or any external server —
fully self-contained, fully offline-capable.

## Note on size

The quantized model is roughly 300-500MB depending on the dtype you bundle
(`q4` for WASM/CPU, `q4f16` for WebGPU). This will increase your deployed
site's size accordingly — that's expected and is the tradeoff for a fully
offline, zero-cost AI feature.

# Gemma 3:1B Local Inference Setup Guide

NETRA AI is strictly designed to use **Gemma 3:1B** as its only AI model. Ollama is explicitly NOT used. This guide explains how to run Gemma 3:1B locally using `llama.cpp` or Hugging Face `transformers`.

---

## Option 1: llama.cpp Server (Recommended for High Performance)

`llama.cpp` provides an ultra-fast, lightweight C/C++ inference runtime for Gemma 3:1B GGUF weights with zero external cloud dependencies.

### Step 1: Download llama.cpp binary
Download the latest `llama.cpp` release for Windows from:
https://github.com/ggerganov/llama.cpp/releases (e.g. `llama-bXXXX-bin-win-cuda-cu12.4-x64.zip` or CPU build `llama-bXXXX-bin-win-cpu-x64.zip`).

### Step 2: Download Gemma 3:1B GGUF Weights
Obtain official quantized Gemma 3:1B Instruct weights from Hugging Face:
- Repository: `google/gemma-3-1b-it` or `bartowski/gemma-3-1b-it-GGUF`
- Recommended quantization file: `gemma-3-1b-it.Q4_K_M.gguf` (~1.2 GB)

Place the model file inside a local directory, for example:
```
C:\models\gemma-3-1b-it.Q4_K_M.gguf
```

### Step 3: Launch llama-server
Run the local HTTP completion server on port 8080:
```bash
llama-server.exe -m C:\models\gemma-3-1b-it.Q4_K_M.gguf --port 8080 -c 4096 --temp 0.1
```

Once started, `llama-server` provides an OpenAI-compatible REST API at `http://127.0.0.1:8080/v1/chat/completions`.

---

## Option 2: Python Transformers (Alternative)

If you have a Python environment with PyTorch and Hugging Face Transformers:

```bash
pip install torch transformers accelerate
```

Create a simple runner `gemma_server.py`:
```python
from fastapi import FastAPI
from pydantic import BaseModel
from transformers import AutoTokenizer, AutoModelForCausalLM
import torch

app = FastAPI()
model_id = "google/gemma-3-1b-it"

tokenizer = AutoTokenizer.from_pretrained(model_id)
model = AutoModelForCausalLM.from_pretrained(
    model_id,
    torch_dtype=torch.bfloat16,
    device_map="auto"
)

class Request(BaseModel):
    messages: list

@app.post("/v1/chat/completions")
def chat(req: Request):
    prompt = req.messages[0]["content"]
    inputs = tokenizer(prompt, return_tensors="pt").to(model.device)
    outputs = model.generate(**inputs, max_new_tokens=500, temperature=0.1)
    response_text = tokenizer.decode(outputs[0][inputs.input_ids.shape[1]:], skip_special_tokens=True)
    return {
        "choices": [{"message": {"content": response_text}}]
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8080)
```

---

## Configuration in NETRA AI

NETRA AI connects to Gemma 3:1B through environment variables configured in `backend/src/config.js` or `.env`:

```env
PORT=3000
HOST=127.0.0.1
GEMMA3_ENDPOINT=http://127.0.0.1:8080/v1/chat/completions
GEMMA3_MODEL_NAME=gemma-3-1b-it
GEMMA3_TIMEOUT_MS=6000
```

### Transparent Adapter Fallback Behavior
When `llama-server` is not running on port 8080, NETRA AI automatically switches to **Transparent Contract Adapter Mode**:
- `engine_status`: `"gemma_3_1b_simulated (local llama.cpp weights not loaded)"`
- Analysis output conforms 100% to the Gemma 3:1B JSON schema contract.
- Deterministic explainable rules ensure accurate threat assessment without misleading users about live weights.

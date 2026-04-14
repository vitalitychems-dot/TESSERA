# Modal Remote Compute — Tessera Sovereign System

Python-based remote compute functions that run on Modal cloud workers.

## Setup

1. Get a Modal token from https://modal.com/settings#tokens
2. Set `MODAL_TOKEN_ID` and `MODAL_TOKEN_SECRET` as Replit secrets
3. Run: `modal token set --token-id "$MODAL_TOKEN_ID" --token-secret "$MODAL_TOKEN_SECRET"`

## Files

- `get_started.py` — Basic square/cube functions to verify Modal works
- `tesseract_secret.py` — Reads the "Tesseract" secret from Modal
- `sovereign_compute.py` — Sacred mathematics (Fibonacci, numerology, sacred alignment)

## Usage

```bash
modal run modal/get_started.py
modal run modal/tesseract_secret.py
modal run modal/sovereign_compute.py
```

## Adding New Functions

Create a new `.py` file in this directory with:

```python
import modal

app = modal.App("tessera-your-function-name")

@app.function()
def your_function(args):
    return result

@app.local_entrypoint()
def main():
    result = your_function.remote(args)
    print(result)
```

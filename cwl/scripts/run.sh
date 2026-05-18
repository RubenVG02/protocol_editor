#!/bin/bash
set -euo pipefail

PDF_PATH=""
MODEL_ID="datalab-to/chandra-ocr-2"
LOCAL_MODEL_DIR=""
METHOD="hf"
USE_GGUF="false"
GGUF_MODEL_PATH=""
GGUF_REPO="prithivMLmods/chandra-ocr-2-GGUF"
GGUF_FILE="chandra-ocr-2.F32.gguf"
GGUF_MMPROJ_PATH=""
GGUF_MMPROJ_REPO="prithivMLmods/chandra-ocr-2-GGUF"
GGUF_MMPROJ_FILE=""
PROMPT_TYPE="ocr_layout"
MAX_NEW_TOKENS="8192"
GGUF_CTX="32768"
DPI="220"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --pdf)
      PDF_PATH="$2"
      shift 2
      ;;
    --model-id)
      MODEL_ID="$2"
      shift 2
      ;;
    --local-model-dir)
      LOCAL_MODEL_DIR="$2"
      shift 2
      ;;
    --use-gguf)
      USE_GGUF="$2"
      shift 2
      ;;
    --gguf-model)
      GGUF_MODEL_PATH="$2"
      shift 2
      ;;
    --gguf-repo)
      GGUF_REPO="$2"
      shift 2
      ;;
    --gguf-file)
      GGUF_FILE="$2"
      shift 2
      ;;
    --gguf-mmproj)
      GGUF_MMPROJ_PATH="$2"
      shift 2
      ;;
    --gguf-mmproj-repo)
      GGUF_MMPROJ_REPO="$2"
      shift 2
      ;;
    --gguf-mmproj-file)
      GGUF_MMPROJ_FILE="$2"
      shift 2
      ;;
    --prompt-type)
      PROMPT_TYPE="$2"
      shift 2
      ;;
    --max-new-tokens)
      MAX_NEW_TOKENS="$2"
      shift 2
      ;;
    --gguf-ctx)
      GGUF_CTX="$2"
      shift 2
      ;;
    --dpi)
      DPI="$2"
      shift 2
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

if [[ -z "$PDF_PATH" || ! -s "$PDF_PATH" ]]; then
  echo "Input PDF is required and must be non-empty." >&2
  exit 1
fi

if [[ -n "$LOCAL_MODEL_DIR" && ! -d "$LOCAL_MODEL_DIR" ]]; then
  echo "Local model directory does not exist: $LOCAL_MODEL_DIR" >&2
  exit 1
fi

if [[ -n "$GGUF_MODEL_PATH" && ! -s "$GGUF_MODEL_PATH" ]]; then
  echo "GGUF model file does not exist: $GGUF_MODEL_PATH" >&2
  exit 1
fi

if [[ -n "$GGUF_MMPROJ_PATH" && ! -s "$GGUF_MMPROJ_PATH" ]]; then
  echo "GGUF mmproj file does not exist: $GGUF_MMPROJ_PATH" >&2
  exit 1
fi

export PIP_ROOT_USER_ACTION=ignore
python3 -m pip install --no-cache-dir --upgrade pip >/dev/null
python3 -m pip install --no-cache-dir "chandra-ocr[hf]>=0.2.0" >/dev/null

if [[ "$USE_GGUF" == "true" || -n "$GGUF_MODEL_PATH" || -n "$GGUF_MMPROJ_PATH" ]]; then
  echo "Warning: GGUF arguments are ignored in simplified mode. Using official Chandra CLI with --method hf." >&2
fi

if [[ -n "$LOCAL_MODEL_DIR" ]]; then
  export MODEL_CHECKPOINT="$LOCAL_MODEL_DIR"
else
  export MODEL_CHECKPOINT="$MODEL_ID"
fi

mkdir -p ocr_results
chandra "$PDF_PATH" ocr_results --method "$METHOD" --max-output-tokens "$MAX_NEW_TOKENS"

PDF_BASENAME="`basename "$PDF_PATH"`"
PDF_STEM="`printf '%s\n' "$PDF_BASENAME" | sed 's/\.[^.]*$//'`"
DOC_DIR="ocr_results/$PDF_STEM"
MD_PATH="$DOC_DIR/$PDF_STEM.md"
HTML_PATH="$DOC_DIR/$PDF_STEM.html"
META_PATH="$DOC_DIR/$PDF_STEM"_metadata.json
ORIGINAL_PDF_PATH="$DOC_DIR/original.pdf"
FAITHFUL_HTML_PATH="$DOC_DIR/pdf_faithful_view.html"

mkdir -p "$DOC_DIR"
cp "$PDF_PATH" "$ORIGINAL_PDF_PATH"

cat > "$FAITHFUL_HTML_PATH" <<'HTML'
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Faithful PDF View</title>
  <style>
    html, body {
      margin: 0;
      padding: 0;
      width: 100%;
      height: 100%;
      background: #111;
    }
    iframe {
      border: 0;
      width: 100%;
      height: 100%;
      display: block;
    }
  </style>
</head>
<body>
  <iframe src="original.pdf" title="Faithful PDF View"></iframe>
</body>
</html>
HTML

python3 - "$PDF_BASENAME" "$METHOD" "$MODEL_CHECKPOINT" "$MAX_NEW_TOKENS" "$LOCAL_MODEL_DIR" "$DOC_DIR" "$MD_PATH" "$HTML_PATH" "$META_PATH" "$USE_GGUF" "$ORIGINAL_PDF_PATH" "$FAITHFUL_HTML_PATH" <<'PY'
import json
import os
import sys

pdf_name = sys.argv[1]
method = sys.argv[2]
model_checkpoint = sys.argv[3]
max_output_tokens = int(sys.argv[4])
local_model_dir = sys.argv[5]
doc_dir = sys.argv[6]
md_path = sys.argv[7]
html_path = sys.argv[8]
meta_path = sys.argv[9]
use_gguf = sys.argv[10].lower() == "true"
original_pdf_path = sys.argv[11]
faithful_view_path = sys.argv[12]

outputs = [
  p
  for p in (md_path, html_path, meta_path, original_pdf_path, faithful_view_path)
  if os.path.exists(p)
]

run_log = {
    "input_pdf": pdf_name,
    "ocr_mode": method,
    "model_checkpoint": model_checkpoint,
    "local_model_dir_used": bool(local_model_dir),
    "max_output_tokens": max_output_tokens,
    "gguf_requested": use_gguf,
    "output_dir": doc_dir,
    "original_pdf_copy": original_pdf_path,
    "faithful_view_html": faithful_view_path,
    "outputs": outputs,
}

with open("run_log.json", "w", encoding="utf-8") as f:
    json.dump(run_log, f, indent=2, ensure_ascii=False)
PY

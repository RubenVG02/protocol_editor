#!/usr/bin/env python3
import argparse
import base64
import io
import json
import time
from pathlib import Path

import markdown as md
import pypdfium2 as pdfium
import torch
from chandra.model.hf import generate_hf
from chandra.model.schema import BatchInputItem
from chandra.output import parse_markdown
from transformers import AutoModelForImageTextToText, AutoProcessor


def pdf_pages_as_images(pdf_path: Path, dpi: int):
    pdf = pdfium.PdfDocument(str(pdf_path))
    images = []
    scale = dpi / 72.0
    for i in range(len(pdf)):
        page = pdf[i]
        bitmap = page.render(scale=scale)
        images.append(bitmap.to_pil().convert("RGB"))
    return images


def run_hf(images, args):
    dtype = torch.bfloat16 if torch.cuda.is_available() else torch.float32
    model_source = args.local_model_dir if args.local_model_dir else args.model_id
    local_only = bool(args.local_model_dir)

    t_model = time.time()
    model = AutoModelForImageTextToText.from_pretrained(
        model_source,
        torch_dtype=dtype,
        device_map="cpu",
        local_files_only=local_only,
    )
    model.eval()
    model.processor = AutoProcessor.from_pretrained(
        model_source,
        local_files_only=local_only,
    )
    model.processor.tokenizer.padding_side = "left"
    model_init_sec = time.time() - t_model

    pages = []
    t_infer = time.time()
    for page_num, image in enumerate(images, start=1):
        batch = [BatchInputItem(image=image, prompt_type=args.prompt_type)]
        result = generate_hf(batch, model, max_new_tokens=args.max_new_tokens)[0]
        page_md = parse_markdown(result.raw)
        pages.append({"page": page_num, "markdown": page_md, "raw": result.raw})

    return {
        "mode": "hf",
        "model_source": model_source,
        "mmproj_source": "",
        "chat_handler": "",
        "model_init_sec": round(model_init_sec, 2),
        "inference_sec": round(time.time() - t_infer, 2),
        "pages": pages,
    }


def extract_chat_text(response):
    choices = response.get("choices", [])
    if not choices:
        return ""

    choice = choices[0]
    message = choice.get("message", {})
    content = message.get("content", "")

    if isinstance(content, list):
        pieces = []
        for part in content:
            if isinstance(part, dict):
                pieces.append(str(part.get("text", "")))
            else:
                pieces.append(str(part))
        return "\n".join(pieces).strip()

    if content is not None:
        return str(content).strip()

    text = choice.get("text", "")
    return str(text).strip()


def run_gguf(images, args):
    if not args.gguf_model:
        raise SystemExit("GGUF mode enabled but no GGUF model path was provided.")
    if not args.gguf_mmproj:
        raise SystemExit("GGUF mode enabled but no GGUF mmproj path was provided.")

    gguf_model_path = Path(args.gguf_model)
    gguf_mmproj_path = Path(args.gguf_mmproj)
    if not gguf_model_path.is_file():
        raise SystemExit(f"GGUF model path does not exist: {gguf_model_path}")
    if not gguf_mmproj_path.is_file():
        raise SystemExit(f"GGUF mmproj path does not exist: {gguf_mmproj_path}")

    try:
        from llama_cpp import Llama
    except Exception as exc:
        raise SystemExit(f"Failed to import llama_cpp for GGUF mode: {exc}")

    try:
        from llama_cpp.llama_chat_format import Qwen25VLChatHandler

        chat_handler = Qwen25VLChatHandler(
            clip_model_path=str(gguf_mmproj_path),
            verbose=False,
        )
        chat_handler_name = "Qwen25VLChatHandler"
    except Exception:
        try:
            from llama_cpp.llama_chat_format import Llava15ChatHandler

            chat_handler = Llava15ChatHandler(
                clip_model_path=str(gguf_mmproj_path),
                verbose=False,
            )
            chat_handler_name = "Llava15ChatHandler"
        except Exception as fallback_exc:
            raise SystemExit(
                "Failed to initialize llama-cpp multimodal runtime with mmproj. "
                f"Error: {fallback_exc}"
            )

    t_model = time.time()
    llm = Llama(
        model_path=str(gguf_model_path),
        n_ctx=args.gguf_ctx,
        n_gpu_layers=0,
        chat_handler=chat_handler,
        verbose=False,
    )
    model_init_sec = time.time() - t_model

    safe_max_tokens = min(args.max_new_tokens, max(512, args.gguf_ctx - 1024))

    pages = []
    t_infer = time.time()
    for page_num, image in enumerate(images, start=1):
        buf = io.BytesIO()
        image.save(buf, format="JPEG", quality=95)
        b64_img = base64.b64encode(buf.getvalue()).decode("ascii")
        data_url = f"data:image/jpeg;base64,{b64_img}"

        response = llm.create_chat_completion(
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": (
                                "Extract this PDF page with maximum OCR fidelity. "
                                "Return ONLY markdown. Preserve headings, lists, "
                                "tables, reading order, and layout semantics."
                            ),
                        },
                        {"type": "image_url", "image_url": {"url": data_url}},
                    ],
                }
            ],
            max_tokens=safe_max_tokens,
            temperature=0.0,
            top_p=1.0,
        )

        page_md = extract_chat_text(response)
        pages.append({"page": page_num, "markdown": page_md, "raw": page_md})

    return {
        "mode": "gguf",
        "model_source": str(gguf_model_path),
        "mmproj_source": str(gguf_mmproj_path),
        "chat_handler": chat_handler_name,
        "model_init_sec": round(model_init_sec, 2),
        "inference_sec": round(time.time() - t_infer, 2),
        "pages": pages,
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--pdf", required=True)
    parser.add_argument("--model-id", default="datalab-to/chandra-ocr-2")
    parser.add_argument("--local-model-dir", default="")
    parser.add_argument("--use-gguf", default="false")
    parser.add_argument("--gguf-model", default="")
    parser.add_argument("--gguf-mmproj", default="")
    parser.add_argument("--prompt-type", default="ocr_layout")
    parser.add_argument("--max-new-tokens", type=int, default=8192)
    parser.add_argument("--gguf-ctx", type=int, default=32768)
    parser.add_argument("--dpi", type=int, default=220)
    args = parser.parse_args()

    if args.prompt_type != "ocr_layout":
        raise SystemExit("For best fidelity, Prompt_Type should be 'ocr_layout'.")
    if args.max_new_tokens < 512 or args.max_new_tokens > 32768:
        raise SystemExit("Max_New_Tokens must be between 512 and 32768.")
    if args.dpi < 120 or args.dpi > 400:
        raise SystemExit("Render_DPI must be between 120 and 400.")
    if args.gguf_ctx < 4096:
        raise SystemExit("GGUF_Ctx must be >= 4096.")

    use_gguf = str(args.use_gguf).lower() == "true"
    if use_gguf and not args.gguf_model:
        raise SystemExit("GGUF mode requires --gguf-model.")
    if use_gguf and not args.gguf_mmproj:
        raise SystemExit("GGUF mode requires --gguf-mmproj.")

    t0 = time.time()
    input_pdf = Path(args.pdf)
    stem = input_pdf.stem
    out_dir = Path("ocr_results")
    out_dir.mkdir(parents=True, exist_ok=True)

    images = pdf_pages_as_images(input_pdf, args.dpi)
    if not images:
        raise SystemExit("PDF has no pages.")

    result = run_gguf(images, args) if use_gguf else run_hf(images, args)
    pages = result["pages"]

    merged_md = []
    for item in pages:
        merged_md.append(f"\n\n<!-- PAGE {item['page']} -->\n")
        merged_md.append(item["markdown"].strip())

    markdown_text = "\n".join(merged_md).strip() + "\n"
    html_body = md.markdown(markdown_text, extensions=["tables", "fenced_code", "md_in_html"])
    html_text = (
        "<!doctype html><html><head><meta charset='utf-8'><title>OCR Output</title></head>"
        f"<body>{html_body}</body></html>\n"
    )

    md_path = out_dir / f"{stem}.md"
    html_path = out_dir / f"{stem}.html"
    json_path = out_dir / f"{stem}.json"

    md_path.write_text(markdown_text, encoding="utf-8")
    html_path.write_text(html_text, encoding="utf-8")
    json_path.write_text(
        json.dumps(
            {
                "input_pdf": input_pdf.name,
                "ocr_mode": result["mode"],
                "model_id": args.model_id,
                "model_source": result["model_source"],
                "gguf_mmproj": args.gguf_mmproj,
                "local_model_dir": args.local_model_dir,
                "gguf_model": args.gguf_model,
                "chat_handler": result.get("chat_handler", ""),
                "prompt_type": args.prompt_type,
                "render_dpi": args.dpi,
                "max_new_tokens": args.max_new_tokens,
                "gguf_ctx": args.gguf_ctx,
                "page_count": len(pages),
                "pages": pages,
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )

    run_log = {
        "input_pdf": input_pdf.name,
        "ocr_mode": result["mode"],
        "model_source": result["model_source"],
        "mmproj_source": result.get("mmproj_source", ""),
        "chat_handler": result.get("chat_handler", ""),
        "local_model_dir_used": bool(args.local_model_dir),
        "gguf_model_used": bool(args.gguf_model),
        "gguf_mmproj_used": bool(args.gguf_mmproj),
        "prompt_type": args.prompt_type,
        "render_dpi": args.dpi,
        "max_new_tokens": args.max_new_tokens,
        "gguf_ctx": args.gguf_ctx,
        "pages": len(pages),
        "model_init_sec": result["model_init_sec"],
        "inference_sec": result["inference_sec"],
        "total_sec": round(time.time() - t0, 2),
        "outputs": [str(md_path), str(html_path), str(json_path)],
    }

    Path("run_log.json").write_text(
        json.dumps(run_log, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )


if __name__ == "__main__":
    main()
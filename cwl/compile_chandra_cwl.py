#!/usr/bin/env python3
import json
from pathlib import Path


def main() -> None:
    base_dir = Path(__file__).resolve().parent
    template_path = base_dir / "chandra_pdf_ocr_sbg.template.cwl"
    run_sh_path = base_dir / "scripts" / "run.sh"
    ocr_py_path = base_dir / "scripts" / "ocr_pdf.py"
    output_path = base_dir.parent / "chandra_pdf_ocr_sbg.cwl"

    template_obj = json.loads(template_path.read_text(encoding="utf-8"))
    run_sh_text = run_sh_path.read_text(encoding="utf-8")
    ocr_py_text = ocr_py_path.read_text(encoding="utf-8")

    listing = template_obj["steps"][0]["run"]["requirements"][0]["listing"]
    for item in listing:
        if item.get("entry") == "__RUN_SH__":
            item["entry"] = run_sh_text
        elif item.get("entry") == "__OCR_PY__":
            item["entry"] = ocr_py_text

    output_path.write_text(json.dumps(template_obj, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Compiled CWL written to: {output_path}")


if __name__ == "__main__":
    main()

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

import fitz
from playwright.sync_api import sync_playwright


def _strip_svg_preamble(svg: str) -> str:
    svg = re.sub(r"^\s*<\?xml[^>]*>\s*", "", svg, flags=re.IGNORECASE)
    svg = re.sub(r"^\s*<!DOCTYPE[^>]*>\s*", "", svg, flags=re.IGNORECASE)
    return svg.strip()


def _namespace_svg_ids(svg: str, prefix: str) -> str:
    ids = re.findall(r'\bid="([^"]+)"', svg)
    if not ids:
        return svg

    id_map = {old_id: f"{prefix}_{old_id}" for old_id in ids}

    svg = re.sub(
        r'\bid="([^"]+)"',
        lambda m: f'id="{id_map.get(m.group(1), m.group(1))}"',
        svg,
    )
    svg = re.sub(
        r'(\b(?:href|xlink:href)=["\'])#([^"\']+)(["\'])',
        lambda m: f"{m.group(1)}#{id_map.get(m.group(2), m.group(2))}{m.group(3)}",
        svg,
    )
    svg = re.sub(
        r'(url\(#)([^)]+)(\))',
        lambda m: f"{m.group(1)}{id_map.get(m.group(2), m.group(2))}{m.group(3)}",
        svg,
    )
    return svg


def pdf_to_html(pdf_path: Path, html_path: Path, text_as_path: bool = True) -> None:
    doc = fitz.open(pdf_path)
    try:
        if doc.page_count == 0:
            raise ValueError(f"The PDF contains no pages: {pdf_path}")

        first_rect = doc[0].rect
        page_blocks: list[str] = []

        for index, page in enumerate(doc, start=1):
            rect = page.rect
            svg = _strip_svg_preamble(page.get_svg_image(text_as_path=text_as_path))
            svg = _namespace_svg_ids(svg, prefix=f"p{index}")
            page_blocks.append(
                "\n".join(
                    [
                        f'<section class="page" data-page="{index}" style="--page-width:{rect.width:.3f}pt; --page-height:{rect.height:.3f}pt;">',
                        svg,
                        "</section>",
                    ]
                )
            )

        html = "\n".join(
            [
                "<!doctype html>",
                '<html lang="en">',
                "<head>",
                '  <meta charset="utf-8" />',
                '  <meta name="viewport" content="width=device-width, initial-scale=1" />',
                f"  <title>{pdf_path.name}</title>",
                "  <style>",
                "    :root {",
                "      color-scheme: light;",
                "    }",
                "    * {",
                "      box-sizing: border-box;",
                "    }",
                "    html, body {",
                "      margin: 0;",
                "      padding: 0;",
                "      background: #cfd6dd;",
                "    }",
                "    main {",
                "      display: flex;",
                "      flex-direction: column;",
                "      align-items: center;",
                "      gap: 24px;",
                "      padding: 24px 12px 36px;",
                "    }",
                "    .page {",
                "      width: var(--page-width);",
                "      height: var(--page-height);",
                "      background: #fff;",
                "      box-shadow: 0 8px 30px rgba(0, 0, 0, 0.2);",
                "      overflow: hidden;",
                "      break-after: page;",
                "      page-break-after: always;",
                "    }",
                "    .page:last-child {",
                "      break-after: auto;",
                "      page-break-after: auto;",
                "    }",
                "    .page > svg {",
                "      width: 100%;",
                "      height: 100%;",
                "      display: block;",
                "    }",
                "    @media print {",
                f"      @page {{ size: {first_rect.width:.3f}pt {first_rect.height:.3f}pt; margin: 0; }}",
                "      html, body {",
                "        background: #fff;",
                "      }",
                "      main {",
                "        padding: 0;",
                "        gap: 0;",
                "      }",
                "      .page {",
                "        box-shadow: none;",
                "      }",
                "    }",
                "  </style>",
                "</head>",
                "<body>",
                "  <main>",
                *[f"    {line}" for line in page_blocks],
                "  </main>",
                "</body>",
                "</html>",
            ]
        )

        html_path.parent.mkdir(parents=True, exist_ok=True)
        html_path.write_text(html, encoding="utf-8")
    finally:
        doc.close()


def html_to_pdf(html_path: Path, pdf_path: Path) -> None:
    html_url = html_path.resolve().as_uri()
    pdf_path.parent.mkdir(parents=True, exist_ok=True)

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.goto(html_url, wait_until="networkidle")
        page.emulate_media(media="print")
        page.evaluate("() => (document.fonts ? document.fonts.ready : Promise.resolve())")
        page.wait_for_timeout(300)
        page.pdf(
            path=str(pdf_path),
            print_background=True,
            prefer_css_page_size=True,
            margin={"top": "0in", "right": "0in", "bottom": "0in", "left": "0in"},
        )
        browser.close()


def _default_html_path(pdf_path: Path) -> Path:
    return pdf_path.with_suffix(".from_pdf.html")


def _default_pdf_path(html_path: Path) -> Path:
    return html_path.with_suffix(".from_html.pdf")


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="High-fidelity PDF <-> HTML conversion (Windows friendly)."
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    pdf2html = subparsers.add_parser("pdf2html", help="Convert PDF to HTML")
    pdf2html.add_argument("input_pdf", type=Path, help="Input PDF path")
    pdf2html.add_argument(
        "output_html",
        type=Path,
        nargs="?",
        help="Output HTML path (optional)",
    )
    pdf2html.add_argument(
        "--keep-text",
        action="store_true",
        help="Keep text as SVG text (more editable, slightly less font-faithful)",
    )

    html2pdf = subparsers.add_parser("html2pdf", help="Convert HTML to PDF")
    html2pdf.add_argument("input_html", type=Path, help="Input HTML path")
    html2pdf.add_argument(
        "output_pdf",
        type=Path,
        nargs="?",
        help="Output PDF path (optional)",
    )

    roundtrip = subparsers.add_parser(
        "roundtrip", help="PDF -> HTML -> PDF with default output names"
    )
    roundtrip.add_argument("input_pdf", type=Path, help="Input PDF path")
    roundtrip.add_argument(
        "output_html",
        type=Path,
        nargs="?",
        help="Intermediate HTML path (optional)",
    )
    roundtrip.add_argument(
        "output_pdf",
        type=Path,
        nargs="?",
        help="Final PDF path (optional)",
    )
    roundtrip.add_argument(
        "--keep-text",
        action="store_true",
        help="Keep text as SVG text (more editable, slightly less font-faithful)",
    )

    return parser


def main(argv: list[str] | None = None) -> int:
    parser = _build_parser()
    args = parser.parse_args(argv)

    try:
        if args.command == "pdf2html":
            input_pdf: Path = args.input_pdf
            output_html: Path = args.output_html or _default_html_path(input_pdf)
            pdf_to_html(input_pdf, output_html, text_as_path=not args.keep_text)
            print(f"OK PDF->HTML: {output_html}")
            return 0

        if args.command == "html2pdf":
            input_html: Path = args.input_html
            output_pdf: Path = args.output_pdf or _default_pdf_path(input_html)
            html_to_pdf(input_html, output_pdf)
            print(f"OK HTML->PDF: {output_pdf}")
            return 0

        if args.command == "roundtrip":
            input_pdf: Path = args.input_pdf
            output_html: Path = args.output_html or _default_html_path(input_pdf)
            output_pdf: Path = args.output_pdf or output_html.with_suffix(".roundtrip.pdf")
            pdf_to_html(input_pdf, output_html, text_as_path=not args.keep_text)
            html_to_pdf(output_html, output_pdf)
            print(f"OK PDF->HTML: {output_html}")
            print(f"OK HTML->PDF: {output_pdf}")
            return 0

        parser.print_help()
        return 2
    except Exception as exc:  # pragma: no cover
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())

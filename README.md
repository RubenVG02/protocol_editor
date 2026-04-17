# Scomix Protocol Studio

A single-file web app for applying conditional rules to lab protocols while
preserving the original PDF layout, and exporting a client-ready document.

## How to use

Just open **`index.html`** in any modern browser. No install, no server.

That's it. Share the file with the team — double-clicking it works on macOS,
Windows and Linux.

## Files in this repo

- `index.html` — **the app**. Everything is inlined: UI, styles, JS and the
  high-fidelity AbSeq base template (SVG).
- `protocol_hifi.html` — standalone copy of the base AbSeq template. Useful for
  QA / regenerating `index.html`; not required at runtime.
- `convert_pdf_html.py` — optional Python helper for PDF ↔ HTML conversion and
  HTML → PDF export via Chromium. Only needed if you want bit-perfect PDF
  output rather than using the browser's "Print to PDF".
- `23-24262(01)_AbSeqAbOligo1-40plex-ruo (2).pdf` — reference PDF the AbSeq
  template was generated from.

## Recommended workflow

1. Open `index.html`.
2. In the left panel, configure the case (panel size, N antibodies, optional
   steps, sample flags).
3. Click **Apply** — the preview updates in place.
4. Click **Export HTML** (or **Print / PDF**) to save the final document.
5. (Optional, for highest-fidelity PDF) Run `convert_pdf_html.py html2pdf <file>.html <file>.pdf`.

## Keyboard shortcuts

- `T` — Explore Templates
- `I` — Import PDF
- `E` — Focus / unfocus preview
- `A` — Apply
- `Esc` — Close overlay

## AbSeq conditional rules

- **MasterMix math** driven by N: `BD Stain Buffer = 100 − 2·N / 130 − 2.6·N / 260 − 5.2·N (µL)`.
- **Panel size selector** locks N to 10/20/40 or lets you enter a custom value (1-40).
- **Fc Block section** — include or hide.
- **Low-abundance note** (<20,000 cells) — include or hide.
- **Red blood cell contamination lysis note** — include or hide.

All region coordinates used to redraw SVG content live in the `ABSEQ_COORDS`
constant near the bottom of `index.html`. Edit there if the base template
changes.

## PDF Import Lab

The "Import PDF" panel loads `pdf.js` from `cdnjs.cloudflare.com` the first
time it's opened. If the machine is offline or the CDN is blocked, the app
keeps working for every other feature and shows a clear error in that panel.

## Regenerating / editing the base template

The embedded AbSeq template lives inside
`<script id="protocolTemplate-abseq" type="text/plain">…</script>` in
`index.html`. To update it, replace the contents of that tag with the new
vectorized HTML (you can re-run the PDF → HTML step via `convert_pdf_html.py`
and paste the result).

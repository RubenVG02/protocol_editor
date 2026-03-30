# BD AbSeq Protocol Studio

## Goal
Apply conditional rules to a protocol converted to HTML while preserving the base PDF layout, then generate a final client-ready document.

## Main files
- protocol_hifi.html: high-fidelity base protocol (text vectorized into SVG paths).
- protocol_editable.html: text-editable variant (useful for debugging, lower typography fidelity).
- protocol_studio.html: web UI for case parameterization.
- studio.css: app visual styles.
- studio.js: conditional logic (N, optional steps, overlays).
- convert_pdf_html.py: PDF <-> HTML conversion and HTML -> PDF export using Chromium.

## How to open the web app (recommended)
1. Open a terminal in this folder.
2. Start a local server:
   c:/Users/ruben/Desktop/pdf_to_html/.venv/Scripts/python.exe -m http.server 8765
3. Open in your browser:
   http://127.0.0.1:8765/protocol_studio.html

## Recommended workflow
1. Configure the case in the left column of the app.
2. Click "Apply changes".
3. Click "Download final HTML".
4. Convert that HTML to PDF with Chromium rendering (high fidelity):
   c:/Users/ruben/Desktop/pdf_to_html/.venv/Scripts/python.exe c:/Users/ruben/Desktop/pdf_to_html/convert_pdf_html.py html2pdf "client_protocol_xxx.html" "client_protocol_xxx.pdf"

## Implemented conditional rules
- Conditional MasterMix row calculation using N ($100 - 2.0N$, $130 - 2.6N$, $260 - 5.2N$).
- All "Examples" blocks are always kept visible.
- Inclusion/exclusion of the optional Fc Block section.
- Inclusion/exclusion of the optional third-wash step.
- Inclusion/exclusion of low-abundance note (<20,000).
- Inclusion/exclusion of red blood cell contamination lysis note.

## Fidelity note
For final PDF output, prefer converting the final HTML with convert_pdf_html.py (Chromium) instead of relying only on manual browser printing.
The app uses protocol_hifi.html as base to preserve the original PDF typography and appearance.

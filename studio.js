const protocolSource = "protocol_hifi.html";

const defaults = {
  panelType: "20",
  antibodyCount: 20,
  washCount: 2,
  includeFcBlock: true,
  lowAbundance: false,
  rbcContamination: false,
};

const state = { ...defaults };
let pendingState = null;

const refs = {
  panelType: document.getElementById("panelType"),
  antibodyCount: document.getElementById("antibodyCount"),
  washCount: document.getElementById("washCount"),
  includeFcBlock: document.getElementById("includeFcBlock"),
  lowAbundance: document.getElementById("lowAbundance"),
  rbcContamination: document.getElementById("rbcContamination"),
  applyBtn: document.getElementById("applyBtn"),
  resetBtn: document.getElementById("resetBtn"),
  downloadHtmlBtn: document.getElementById("downloadHtmlBtn"),
  printPdfBtn: document.getElementById("printPdfBtn"),
  calcLine1: document.getElementById("calcLine1"),
  calcLine2: document.getElementById("calcLine2"),
  calcLine3: document.getElementById("calcLine3"),
  status: document.getElementById("status"),
  frame: document.getElementById("previewFrame"),
};

init();

function init() {
  bindEvents();
  syncNInputLock();
  applyFromForm();
}

function bindEvents() {
  refs.applyBtn.addEventListener("click", applyFromForm);
  refs.resetBtn.addEventListener("click", onReset);
  refs.downloadHtmlBtn.addEventListener("click", downloadCurrentHtml);
  refs.printPdfBtn.addEventListener("click", printCurrentPreview);

  refs.panelType.addEventListener("change", () => {
    syncNInputLock();
    applyFromForm();
  });

  refs.antibodyCount.addEventListener("change", applyFromForm);
  refs.washCount.addEventListener("change", applyFromForm);
  refs.includeFcBlock.addEventListener("change", applyFromForm);
  refs.lowAbundance.addEventListener("change", applyFromForm);
  refs.rbcContamination.addEventListener("change", applyFromForm);

  refs.frame.addEventListener("load", () => {
    if (!pendingState) {
      return;
    }

    try {
      const doc = refs.frame.contentDocument;
      applyProtocolRules(doc, pendingState);
      setStatus("Preview updated. You can print or download the final HTML.");
    } catch (error) {
      setStatus(`Error applying rules: ${error.message}`);
    } finally {
      pendingState = null;
    }
  });
}

function syncNInputLock() {
  if (refs.panelType.value === "custom") {
    refs.antibodyCount.disabled = false;
    return;
  }
  refs.antibodyCount.value = refs.panelType.value;
  refs.antibodyCount.disabled = true;
}

function onReset() {
  refs.panelType.value = defaults.panelType;
  refs.antibodyCount.value = defaults.antibodyCount;
  refs.washCount.value = String(defaults.washCount);
  refs.includeFcBlock.checked = defaults.includeFcBlock;
  refs.lowAbundance.checked = defaults.lowAbundance;
  refs.rbcContamination.checked = defaults.rbcContamination;
  syncNInputLock();
  applyFromForm();
}

function applyFromForm() {
  const panelType = refs.panelType.value;
  let antibodyCount = Number.parseInt(refs.antibodyCount.value, 10);
  if (panelType !== "custom") {
    antibodyCount = Number.parseInt(panelType, 10);
    refs.antibodyCount.value = String(antibodyCount);
  }
  antibodyCount = clamp(antibodyCount, 1, 40);

  state.panelType = panelType;
  state.antibodyCount = antibodyCount;
  state.washCount = Number.parseInt(refs.washCount.value, 10) === 3 ? 3 : 2;
  state.includeFcBlock = refs.includeFcBlock.checked;
  state.lowAbundance = refs.lowAbundance.checked;
  state.rbcContamination = refs.rbcContamination.checked;

  updateCalculatedSummary(state);

  pendingState = { ...state };
  setStatus("Loading base protocol and applying changes...");
  refs.frame.src = `${protocolSource}?v=${Date.now()}`;
}

function updateCalculatedSummary(current) {
  const n = current.antibodyCount;
  const v1 = Math.max(0, 100 - 2.0 * n);
  const v2 = Math.max(0, 130 - 2.6 * n);
  const v3 = Math.max(0, 260 - 5.2 * n);

  refs.calcLine1.textContent = `N = ${n} antibodies`;
  refs.calcLine2.textContent = `BD Stain Buffer: ${toFixed1(v1)} / ${toFixed1(v2)} / ${toFixed1(v3)} uL`;
  refs.calcLine3.textContent = `Column totals: 100.0 / 130.0 / 260.0 uL`;
}

function applyProtocolRules(doc, current) {
  const page4 = getPageSvg(doc, 4);
  const page5 = getPageSvg(doc, 5);
  const page6 = getPageSvg(doc, 6);
  const page7 = getPageSvg(doc, 7);

  if (!page5 || !page6 || !page7 || !page4) {
    throw new Error("Not all expected pages were found in the base HTML.");
  }

  applyMasterMixCalculations(page5, current.antibodyCount);
  applyPlexFiltering(page5, current.panelType);
  applyFcBlockToggle(page6, current.includeFcBlock);
  applyWashesToggle(page7, current.washCount);
  applyLowAbundanceToggle(page7, current.lowAbundance);
  applyRbcToggle(page4, current.rbcContamination);
}

function applyMasterMixCalculations(page5Svg, n) {
  // In high-fidelity mode the original values are vector paths, so we cover and repaint only those cells.
  addCoverRect(page5Svg, { x: 221, y: 423, width: 63, height: 13 });
  addCoverRect(page5Svg, { x: 293, y: 423, width: 66, height: 13 });
  addCoverRect(page5Svg, { x: 415, y: 423, width: 80, height: 13 });

  const v1 = Math.max(0, 100 - 2.0 * n);
  const v2 = Math.max(0, 130 - 2.6 * n);
  const v3 = Math.max(0, 260 - 5.2 * n);

  addPdfText(page5Svg, { x: 291, y: -478.96, text: toFixed1(v1) });
  addPdfText(page5Svg, { x: 387, y: -478.96, text: toFixed1(v2) });
  addPdfText(page5Svg, { x: 555, y: -478.96, text: toFixed1(v3) });
}

function applyPlexFiltering(page5Svg, panelType) {
  // Keep all "Examples" blocks visible regardless of selected panel type.
  void page5Svg;
  void panelType;
}

function applyFcBlockToggle(page6Svg, includeFcBlock) {
  if (includeFcBlock) {
    return;
  }

  addCoverRect(page6Svg, {
    x: 72,
    y: 112,
    width: 468,
    height: 266,
  });
}

function applyWashesToggle(page7Svg, washCount) {
  // In high-fidelity vector mode, step 7 and step 8 are too tightly packed.
  // Masking step 7 introduces visible clipping artifacts in step 8, so we keep the original block intact.
  void page7Svg;
  void washCount;
}

function applyLowAbundanceToggle(page7Svg, lowAbundance) {
  if (lowAbundance) {
    return;
  }

  addCoverRect(page7Svg, {
    x: 72,
    y: 337,
    width: 468,
    height: 42,
  });
}

function applyRbcToggle(page4Svg, rbcContamination) {
  if (rbcContamination) {
    return;
  }

  addCoverRect(page4Svg, {
    x: 72,
    y: 654,
    width: 468,
    height: 24,
  });
}

function addPdfText(svg, input) {
  const textEl = document.createElementNS("http://www.w3.org/2000/svg", "text");
  textEl.setAttribute("xml:space", "preserve");
  textEl.setAttribute("transform", "matrix(.75 0 -0 .75 0 792)");
  textEl.setAttribute("font-size", "12");
  textEl.setAttribute("font-family", "Helvetica, Arial, sans-serif");
  textEl.setAttribute("fill", "#111111");
  textEl.setAttribute("font-weight", "600");

  const tspan = document.createElementNS("http://www.w3.org/2000/svg", "tspan");
  tspan.setAttribute("y", String(input.y));
  tspan.setAttribute("x", String(input.x));
  tspan.textContent = input.text;

  textEl.appendChild(tspan);
  svg.querySelector("g").appendChild(textEl);
}

function addCoverRect(svg, input) {
  const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  rect.setAttribute("x", String(input.x));
  rect.setAttribute("y", String(input.y));
  rect.setAttribute("width", String(input.width));
  rect.setAttribute("height", String(input.height));
  rect.setAttribute("fill", "#ffffff");
  svg.querySelector("g").appendChild(rect);
}

function getPageSvg(doc, pageNumber) {
  return doc.querySelector(`section.page[data-page="${pageNumber}"] svg`);
}

function downloadCurrentHtml() {
  const doc = refs.frame.contentDocument;
  if (!doc) {
    return;
  }

  const html = `<!doctype html>\n${doc.documentElement.outerHTML}`;
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  const timestamp = new Date().toISOString().replace(/[.:]/g, "-");

  anchor.href = url;
  anchor.download = `client_protocol_${timestamp}.html`;
  anchor.click();

  URL.revokeObjectURL(url);
}

function printCurrentPreview() {
  const win = refs.frame.contentWindow;
  if (!win) {
    return;
  }
  win.focus();
  win.print();
}

function setStatus(text) {
  refs.status.textContent = text;
}

function clamp(value, min, max) {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.min(max, Math.max(min, value));
}

function toFixed1(value) {
  return Number.parseFloat(value.toFixed(1)).toFixed(1);
}

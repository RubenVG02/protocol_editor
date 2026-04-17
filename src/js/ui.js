const embeddedTemplateIds = getEmbeddedTemplateIds();
const protocolCatalog = createProtocolCatalog();
const protocolById = Object.fromEntries(protocolCatalog.map((protocol) => [protocol.id, protocol]));
const protocolCatalogOrder = new Map(protocolCatalog.map((protocol, index) => [protocol.id, index]));
const catalogNameCollator = new Intl.Collator(undefined, { sensitivity: "base", numeric: true });

const state = {
  sourceFilter: "all",
  searchText: "",
  sortMode: "recommended",
  readyOnly: false,
  selectedProtocolId: protocolCatalog[0] ? protocolCatalog[0].id : "",
  activeProtocolId: "",
  loadedProtocolId: "",
  loadingProtocolId: "",
  templatePreviewProtocolId: "",
  activeOverlay: "",
  overlayReturnFocus: null,
  pendingState: null,
  fieldRefs: {},
  rawValues: {},
  previewMode: "fit",
  previewRefreshTimer: 0,
  pdfLab: {
    pdfDoc: null,
    fileName: "",
    pageNumber: 1,
    pageCount: 0,
    scale: 1.2,
    viewportWidth: 1,
    viewportHeight: 1,
    fields: [],
    selectedFieldId: "",
    nextFieldNumber: 1,
    renderToken: 0,
  },
};

let pdfJsLoadingPromise = null;
let marketPreviewObserver = null;

function rebuildProtocolCatalogOrder() {
  protocolCatalogOrder.clear();
  protocolCatalog.forEach((protocol, index) => {
    if (protocol && protocol.id) {
      protocolCatalogOrder.set(protocol.id, index);
    }
  });
}

const refs = {
  workspace: document.getElementById("workspace"),
  exploreTemplatesBtn: document.getElementById("exploreTemplatesBtn"),
  openPdfLabBtn: document.getElementById("openPdfLabBtn"),
  focusPreviewBtn: document.getElementById("focusPreviewBtn"),

  marketplacePanel: document.getElementById("marketplacePanel"),
  closeMarketplaceBtn: document.getElementById("closeMarketplaceBtn"),
  catalogSearch: document.getElementById("catalogSearch"),
  catalogSort: document.getElementById("catalogSort"),
  catalogReadyOnly: document.getElementById("catalogReadyOnly"),
  clearCatalogFiltersBtn: document.getElementById("clearCatalogFiltersBtn"),
  catalogCount: document.getElementById("catalogCount"),
  catalogStats: document.getElementById("catalogStats"),
  catalogList: document.getElementById("catalogList"),
  templatePreviewPanel: document.getElementById("templatePreviewPanel"),
  closeTemplatePreviewBtn: document.getElementById("closeTemplatePreviewBtn"),
  templatePreviewKicker: document.getElementById("templatePreviewKicker"),
  templatePreviewTitle: document.getElementById("templatePreviewTitle"),
  templatePreviewDescription: document.getElementById("templatePreviewDescription"),
  templatePreviewSourceLine: document.getElementById("templatePreviewSourceLine"),
  templatePreviewReadinessLine: document.getElementById("templatePreviewReadinessLine"),
  templatePreviewMeta: document.getElementById("templatePreviewMeta"),
  templatePreviewHighlights: document.getElementById("templatePreviewHighlights"),
  templatePreviewTags: document.getElementById("templatePreviewTags"),
  templatePreviewFrame: document.getElementById("templatePreviewFrame"),
  templatePreviewUseBtn: document.getElementById("templatePreviewUseBtn"),

  pdfLabPanel: document.getElementById("pdfLabPanel"),
  closePdfLabBtn: document.getElementById("closePdfLabBtn"),
  pdfUploadInput: document.getElementById("pdfUploadInput"),
  pdfPrevPageBtn: document.getElementById("pdfPrevPageBtn"),
  pdfNextPageBtn: document.getElementById("pdfNextPageBtn"),
  pdfZoomOutBtn: document.getElementById("pdfZoomOutBtn"),
  pdfZoomInBtn: document.getElementById("pdfZoomInBtn"),
  pdfPageIndicator: document.getElementById("pdfPageIndicator"),
  pdfCanvasWrap: document.getElementById("pdfCanvasWrap"),
  pdfCanvas: document.getElementById("pdfCanvas"),
  pdfOverlay: document.getElementById("pdfOverlay"),
  pdfStatus: document.getElementById("pdfStatus"),
  autoSuggestFieldsBtn: document.getElementById("autoSuggestFieldsBtn"),
  clearPdfFieldsBtn: document.getElementById("clearPdfFieldsBtn"),
  pdfFieldsList: document.getElementById("pdfFieldsList"),
  pdfFieldEditor: document.getElementById("pdfFieldEditor"),
  fieldKeyInput: document.getElementById("fieldKeyInput"),
  fieldLabelInput: document.getElementById("fieldLabelInput"),
  fieldTypeSelect: document.getElementById("fieldTypeSelect"),
  fieldDefaultInput: document.getElementById("fieldDefaultInput"),
  fieldEditableInput: document.getElementById("fieldEditableInput"),
  saveFieldBtn: document.getElementById("saveFieldBtn"),
  deleteFieldBtn: document.getElementById("deleteFieldBtn"),
  publishPdfTemplateBtn: document.getElementById("publishPdfTemplateBtn"),

  editorTitle: document.getElementById("editorTitle"),
  editorSubtitle: document.getElementById("editorSubtitle"),
  activeProtocolMeta: document.getElementById("activeProtocolMeta"),
  protocolControls: document.getElementById("protocolControls"),
  applyBtn: document.getElementById("applyBtn"),
  resetBtn: document.getElementById("resetBtn"),

  downloadHtmlBtn: document.getElementById("downloadHtmlBtn"),
  printPdfBtn: document.getElementById("printPdfBtn"),
  fitPreviewBtn: document.getElementById("fitPreviewBtn"),
  actualPreviewBtn: document.getElementById("actualPreviewBtn"),
  openMarketplaceFromPreviewBtn: document.getElementById("openMarketplaceFromPreviewBtn"),

  summaryTitle: document.getElementById("summaryTitle"),
  calcLine1: document.getElementById("calcLine1"),
  calcLine2: document.getElementById("calcLine2"),
  calcLine3: document.getElementById("calcLine3"),

  previewProtocolName: document.getElementById("previewProtocolName"),
  status: document.getElementById("status"),
  frameWrap: document.getElementById("frameWrap"),
  frame: document.getElementById("previewFrame"),
};

const pdfDrawState = {
  isDrawing: false,
  pointerId: null,
  startX: 0,
  startY: 0,
  draftBox: null,
};

init();

function init() {
  bindEvents();
  syncMarketplaceDensity();
  syncCatalogControls();
  renderSourceFilterChips();
  renderCatalog();
  setSummary("Calculated values", ["", "", ""]);
  syncPreviewButtons();

  if (protocolCatalog.length === 0) {
    setStatus("No templates registered.", true);
    return;
  }

  const firstLoadable = protocolCatalog.find((protocol) => protocolCanLoad(protocol));
  if (!firstLoadable) {
    selectProtocol(protocolCatalog[0].id);
    setStatus("Catalog loaded. No template marked as ready yet.", true);
    return;
  }

  selectProtocol(firstLoadable.id);
  loadProtocol(firstLoadable.id);
}

function bindEvents() {
  safeOn(refs.exploreTemplatesBtn, "click", () => {
    setOverlayState("marketplace", true);
  });

  safeOn(refs.openPdfLabBtn, "click", () => {
    setOverlayState("pdf-lab", true);
  });

  safeOn(refs.closeMarketplaceBtn, "click", () => {
    setOverlayState("marketplace", false);
  });
  safeOn(refs.closeTemplatePreviewBtn, "click", () => {
    setOverlayState("template-preview", false);
  });

  safeOn(refs.closePdfLabBtn, "click", () => {
    setOverlayState("pdf-lab", false);
  });

  document.querySelectorAll("[data-close-overlay]").forEach((node) => {
    node.addEventListener("click", () => {
      const target = node.dataset.closeOverlay;
      if (target === "marketplace") {
        setOverlayState("marketplace", false);
      }
      if (target === "template-preview") {
        setOverlayState("template-preview", false);
      }
      if (target === "pdf-lab") {
        setOverlayState("pdf-lab", false);
      }
    });
  });

  safeOn(refs.catalogSearch, "input", () => {
    state.searchText = refs.catalogSearch.value.trim().toLowerCase();
    renderCatalog();
  });

  safeOn(refs.catalogSort, "change", () => {
    state.sortMode = normalizeCatalogSortMode(refs.catalogSort.value);
    renderCatalog();
  });

  safeOn(refs.catalogReadyOnly, "change", () => {
    state.readyOnly = Boolean(refs.catalogReadyOnly.checked);
    renderCatalog();
  });

  safeOn(refs.clearCatalogFiltersBtn, "click", clearCatalogFilters);

  const sourceFilterButtons = Array.from(document.querySelectorAll("[data-source-filter]"));
  sourceFilterButtons.forEach((button, index) => {
    button.addEventListener("click", () => {
      state.sourceFilter = button.dataset.sourceFilter || "all";
      renderSourceFilterChips();
      renderCatalog();
    });

    button.addEventListener("keydown", (event) => {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
        return;
      }

      event.preventDefault();
      let targetIndex = index;

      if (event.key === "ArrowRight") {
        targetIndex = (index + 1) % sourceFilterButtons.length;
      } else if (event.key === "ArrowLeft") {
        targetIndex = (index - 1 + sourceFilterButtons.length) % sourceFilterButtons.length;
      } else if (event.key === "Home") {
        targetIndex = 0;
      } else if (event.key === "End") {
        targetIndex = sourceFilterButtons.length - 1;
      }

      sourceFilterButtons[targetIndex]?.focus();
    });
  });

  safeOn(refs.catalogList, "click", onCatalogListClick);
  safeOn(refs.catalogList, "keydown", onCatalogListKeydown);
  safeOn(refs.templatePreviewUseBtn, "click", useTemplateFromPreview);

  safeOn(refs.focusPreviewBtn, "click", focusPreview);

  safeOn(refs.fitPreviewBtn, "click", () => {
    state.previewMode = "fit";
    syncPreviewButtons();
    queuePreviewRefresh();
  });

  safeOn(refs.actualPreviewBtn, "click", () => {
    state.previewMode = "actual";
    syncPreviewButtons();
    queuePreviewRefresh();
  });

  safeOn(refs.openMarketplaceFromPreviewBtn, "click", () => {
    setOverlayState("marketplace", true);
  });

  safeOn(refs.applyBtn, "click", applyFromForm);
  safeOn(refs.resetBtn, "click", resetActiveProtocol);
  safeOn(refs.downloadHtmlBtn, "click", downloadCurrentHtml);
  safeOn(refs.printPdfBtn, "click", printCurrentPreview);

  safeOn(refs.frame, "load", handlePreviewFrameLoaded);
  safeOn(refs.templatePreviewFrame, "load", () => {
    fitMarketPreviewFrame(refs.templatePreviewFrame);
  });

  window.addEventListener("resize", () => {
    queuePreviewRefresh();
    if (state.pdfLab.pdfDoc) {
      syncPdfOverlaySize();
      renderPdfOverlayBoxes();
    }
  });

  document.addEventListener("keydown", onGlobalKeydown);

  bindPdfLabEvents();
}

function focusPreview() {
  if (!refs.workspace || !refs.focusPreviewBtn) return;
  refs.workspace.classList.toggle("is-preview-focus");
  refs.focusPreviewBtn.textContent = refs.workspace.classList.contains("is-preview-focus")
    ? "Show Editor"
    : "Focus Preview";
  queuePreviewRefresh();
}

function getTopVisibleOverlay() {
  if (!refs.templatePreviewPanel.hidden) {
    return "template-preview";
  }
  if (!refs.pdfLabPanel.hidden) {
    return "pdf-lab";
  }
  if (!refs.marketplacePanel.hidden) {
    return "marketplace";
  }
  return "";
}

function onGlobalKeydown(event) {
  if (event.key === "Escape") {
    if (event.repeat) {
      event.preventDefault();
      return;
    }

    const topOverlay = getTopVisibleOverlay();
    if (topOverlay) {
      event.preventDefault();
      event.stopPropagation();
      setOverlayState(topOverlay, false);
    }
    return;
  }

  // Don't swallow shortcuts while the user is typing in a form field.
  if (event.metaKey || event.ctrlKey || event.altKey) return;
  const target = event.target;
  if (target && target instanceof HTMLElement) {
    const tag = target.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable) {
      return;
    }
  }

  // Ignore shortcuts while an overlay is open (the user is already in a modal
  // context). They should feel like "quick access" actions from the main app.
  const overlayOpen = !refs.pdfLabPanel.hidden || !refs.marketplacePanel.hidden || !refs.templatePreviewPanel.hidden;
  if (overlayOpen) return;

  switch (event.key.toLowerCase()) {
    case "t":
      event.preventDefault();
      setOverlayState("marketplace", true);
      break;
    case "i":
      event.preventDefault();
      setOverlayState("pdf-lab", true);
      break;
    case "e":
      event.preventDefault();
      focusPreview();
      break;
    case "a":
      event.preventDefault();
      if (refs.applyBtn) refs.applyBtn.click();
      break;
    default:
      break;
  }
}

function bindPdfLabEvents() {
  safeOn(refs.pdfUploadInput, "change", onPdfSelected);

  safeOn(refs.pdfPrevPageBtn, "click", () => {
    renderPdfPage(state.pdfLab.pageNumber - 1);
  });

  safeOn(refs.pdfNextPageBtn, "click", () => {
    renderPdfPage(state.pdfLab.pageNumber + 1);
  });

  safeOn(refs.pdfZoomOutBtn, "click", () => {
    state.pdfLab.scale = clamp(Number((state.pdfLab.scale - 0.15).toFixed(2)), 0.5, 2.4);
    renderPdfPage(state.pdfLab.pageNumber);
  });

  safeOn(refs.pdfZoomInBtn, "click", () => {
    state.pdfLab.scale = clamp(Number((state.pdfLab.scale + 0.15).toFixed(2)), 0.5, 2.4);
    renderPdfPage(state.pdfLab.pageNumber);
  });

  safeOn(refs.autoSuggestFieldsBtn, "click", async () => {
    await autoSuggestFieldsForCurrentPage(false);
  });

  safeOn(refs.clearPdfFieldsBtn, "click", () => {
    state.pdfLab.fields = [];
    state.pdfLab.selectedFieldId = "";
    renderPdfFieldsList();
    renderPdfOverlayBoxes();
    syncPdfFieldEditor();
    setPdfStatus("Fields cleared.");
  });

  safeOn(refs.pdfFieldsList, "click", (event) => {
    const item = event.target.closest("[data-pdf-field-id]");
    if (!item) {
      return;
    }
    selectPdfField(item.dataset.pdfFieldId || "");
  });

  safeOn(refs.saveFieldBtn, "click", saveSelectedPdfField);
  safeOn(refs.deleteFieldBtn, "click", deleteSelectedPdfField);
  safeOn(refs.publishPdfTemplateBtn, "click", publishPdfTemplateToMarketplace);

  safeOn(refs.pdfOverlay, "pointerdown", onPdfOverlayPointerDown);
  window.addEventListener("pointermove", onPdfOverlayPointerMove);
  window.addEventListener("pointerup", onPdfOverlayPointerUp);
}

function safeOn(node, eventName, handler) {
  if (!node) {
    return;
  }
  node.addEventListener(eventName, handler);
}

function setOverlayState(name, isOpen) {
  const panel =
    name === "marketplace"
      ? refs.marketplacePanel
      : name === "template-preview"
        ? refs.templatePreviewPanel
        : refs.pdfLabPanel;
  if (!panel) {
    return;
  }

  if (isOpen) {
    state.activeOverlay = name;
    state.overlayReturnFocus =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    panel.hidden = false;

    window.requestAnimationFrame(() => {
      if (name === "marketplace") {
        refs.catalogSearch?.focus();
      } else if (name === "template-preview") {
        refs.templatePreviewUseBtn?.focus();
      } else {
        refs.pdfUploadInput?.focus();
      }
    });
  } else {
    panel.hidden = true;

    if (name === "marketplace" && !refs.templatePreviewPanel.hidden) {
      refs.templatePreviewPanel.hidden = true;
      state.templatePreviewProtocolId = "";
    } else if (name === "template-preview") {
      state.templatePreviewProtocolId = "";
      refs.templatePreviewUseBtn.classList.remove("is-loading");
      refs.templatePreviewUseBtn.textContent = "Use Template";
      if (refs.templatePreviewFrame) {
        refs.templatePreviewFrame.removeAttribute("src");
        refs.templatePreviewFrame.srcdoc = "";
        refs.templatePreviewFrame.dataset.previewKind = "";
      }
    }

    if (state.activeOverlay === name) {
      const returnFocus = state.overlayReturnFocus;
      state.activeOverlay = "";
      state.overlayReturnFocus = null;
      if (returnFocus && document.contains(returnFocus)) {
        returnFocus.focus();
      }
    }
  }

  const anyOpen = !refs.marketplacePanel.hidden || !refs.templatePreviewPanel.hidden || !refs.pdfLabPanel.hidden;
  document.body.style.overflow = anyOpen ? "hidden" : "";
  syncOverlayHierarchy();
}

function syncOverlayHierarchy() {
  const marketplaceVisible = !refs.marketplacePanel.hidden;
  const previewVisible = !refs.templatePreviewPanel.hidden;
  refs.marketplacePanel.classList.toggle("is-underlay", marketplaceVisible && previewVisible);
}

function normalizeCatalogSortMode(mode) {
  const normalized = String(mode || "").trim().toLowerCase();
  if (normalized === "name-asc" || normalized === "name-az" || normalized === "a-z") {
    return "name-asc";
  }
  if (normalized === "name-desc" || normalized === "name-za" || normalized === "z-a") {
    return "name-desc";
  }
  return "recommended";
}

function syncCatalogControls() {
  const normalizedSortMode = normalizeCatalogSortMode(state.sortMode);
  if (state.sortMode !== normalizedSortMode) {
    state.sortMode = normalizedSortMode;
  }

  if (refs.catalogSearch && refs.catalogSearch.value !== state.searchText) {
    refs.catalogSearch.value = state.searchText;
  }

  if (refs.catalogSort) {
    refs.catalogSort.value = normalizedSortMode;
  }

  if (refs.catalogReadyOnly) {
    refs.catalogReadyOnly.checked = Boolean(state.readyOnly);
  }

  renderSourceFilterChips();
}

// Hide advanced filters (sort / ready-only toggle / clear / stats) while the
// catalog is small. They add noise without adding value for <= 4 templates.
function syncMarketplaceDensity() {
  const compact = protocolCatalog.length <= 4;
  const controlRow = document.querySelector("#marketplacePanel .market-control-row");
  if (controlRow) {
    controlRow.hidden = compact;
  }
  if (refs.catalogStats) {
    refs.catalogStats.hidden = compact;
  }
}

function clearCatalogFilters() {
  state.searchText = "";
  state.sourceFilter = "all";
  state.sortMode = "recommended";
  state.readyOnly = false;

  if (refs.catalogSearch) {
    refs.catalogSearch.value = "";
  }

  syncCatalogControls();
  renderCatalog();
}

function onCatalogListClick(event) {
  if (!(event.target instanceof Element)) {
    return;
  }

  const selectBtn = event.target.closest("[data-select-protocol]");
  if (selectBtn) {
    openTemplatePreview(selectBtn.dataset.selectProtocol || "");
    return;
  }

  const loadBtn = event.target.closest("[data-load-protocol]");
  if (loadBtn) {
    loadProtocol(loadBtn.dataset.loadProtocol || "");
    return;
  }

  const card = event.target.closest("[data-card-select-protocol]");
  if (card && !event.target.closest("button")) {
    openTemplatePreview(card.dataset.cardSelectProtocol || "");
  }
}

function onCatalogListKeydown(event) {
  if (!(event.target instanceof Element)) {
    return;
  }

  if (!["Enter", " "].includes(event.key)) {
    return;
  }

  if (event.target.closest("button")) {
    return;
  }

  const card = event.target.closest("[data-card-select-protocol]");
  if (!card) {
    return;
  }

  event.preventDefault();
  openTemplatePreview(card.dataset.cardSelectProtocol || "");
}

function openTemplatePreview(protocolId) {
  const protocol = protocolById[protocolId];
  if (!protocol) return;
  state.templatePreviewProtocolId = protocol.id;
  renderTemplatePreviewOverlay(protocol);
  setOverlayState("template-preview", true);
}

function useTemplateFromPreview() {
  const protocolId = state.templatePreviewProtocolId || state.selectedProtocolId;
  if (!protocolId) return;

  const protocol = protocolById[protocolId];
  if (!protocol || !protocolCanLoad(protocol)) return;

  const sheet = refs.templatePreviewPanel?.querySelector(".template-preview-sheet");
  refs.templatePreviewUseBtn.disabled = true;
  refs.templatePreviewUseBtn.classList.add("is-loading");
  refs.templatePreviewUseBtn.textContent = "Applying Template...";
  if (sheet) {
    sheet.classList.add("is-committing");
  }

  window.setTimeout(() => {
    if (sheet) {
      sheet.classList.remove("is-committing");
    }
    refs.templatePreviewUseBtn.classList.remove("is-loading");
    refs.templatePreviewUseBtn.textContent = "Use Template";
    setOverlayState("template-preview", false);
    loadProtocol(protocolId);
  }, 240);
}

function renderSourceFilterChips() {
  document.querySelectorAll("[data-source-filter]").forEach((button) => {
    const isActive = (button.dataset.sourceFilter || "all") === state.sourceFilter;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("role", "tab");
    button.setAttribute("aria-selected", String(isActive));
    button.tabIndex = isActive ? 0 : -1;
  });
}

function renderCatalog() {
  syncCatalogControls();

  const filtered = getFilteredCatalog();
  const filterSummary = [];

  if (state.sourceFilter !== "all") {
    filterSummary.push(state.sourceFilter === "official" ? "Official" : "Internal");
  }

  if (state.readyOnly) {
    filterSummary.push("Ready only");
  }

  if (state.searchText) {
    filterSummary.push(`Search: "${state.searchText}"`);
  }

  refs.catalogCount.textContent = `${filtered.length} template${filtered.length === 1 ? "" : "s"}${
    filterSummary.length ? ` · ${filterSummary.join(" · ")}` : ""
  }`;

  renderCatalogStats(filtered);

  if (marketPreviewObserver) {
    marketPreviewObserver.disconnect();
  }

  refs.catalogList.innerHTML = "";
  refs.catalogList.setAttribute("aria-busy", "true");

  if (filtered.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";

    const hasFilters =
      state.searchText.length > 0 ||
      state.sourceFilter !== "all" ||
      state.readyOnly ||
      state.sortMode !== "recommended";

    empty.textContent = hasFilters
      ? "No templates match the current filters. Try broader keywords or clear filters."
      : "No templates are available in the current catalog.";

    if (hasFilters) {
      const clearBtn = document.createElement("button");
      clearBtn.type = "button";
      clearBtn.className = "btn btn-soft";
      clearBtn.textContent = "Reset filters";
      clearBtn.addEventListener("click", clearCatalogFilters);
      clearBtn.style.marginTop = "10px";
      empty.appendChild(document.createElement("br"));
      empty.appendChild(clearBtn);
    }

    refs.catalogList.appendChild(empty);
    refs.catalogList.setAttribute("aria-busy", "false");
    return;
  }

  const fragment = document.createDocumentFragment();
  filtered.forEach((protocol) => {
    fragment.appendChild(createMarketCard(protocol));
  });

  refs.catalogList.appendChild(fragment);
  refs.catalogList.setAttribute("aria-busy", "false");
}

function renderCatalogStats(filtered) {
  if (!refs.catalogStats) {
    return;
  }

  refs.catalogStats.innerHTML = "";

  const stats = [
    { label: "Visible", value: filtered.length },
    {
      label: "Ready",
      value: filtered.filter((protocol) => protocol.availability === "ready").length,
    },
    {
      label: "Planned",
      value: filtered.filter((protocol) => protocol.availability !== "ready").length,
    },
  ];

  stats.forEach((stat) => {
    const node = document.createElement("span");
    node.className = "market-stat";
    node.textContent = `${stat.label}: ${stat.value}`;
    refs.catalogStats.appendChild(node);
  });
}

function renderTemplatePreviewOverlay(protocol) {
  if (!protocol) return;

  refs.templatePreviewKicker.textContent =
    protocol.source === "official" ? "Official Template" : "Internal Template";
  refs.templatePreviewTitle.textContent = protocol.label;
  refs.templatePreviewDescription.textContent = protocol.description;
  refs.templatePreviewSourceLine.textContent = `Source: ${
    protocol.source === "official" ? "Official (Scomix)" : "Internal"
  }`;
  refs.templatePreviewReadinessLine.textContent = `Availability: ${
    protocol.availability === "ready" ? "Ready to use" : "Planned / coming soon"
  }`;

  refs.templatePreviewMeta.innerHTML = "";
  [
    `Owner: ${protocol.owner}`,
    `Version: ${protocol.version}`,
    `Status: ${protocol.availability === "ready" ? "Ready" : "Planned"}`,
    `Editable fields: ${protocol.parameters ? protocol.parameters.length : 0}`,
  ].forEach((line) => {
    const pill = document.createElement("span");
    pill.className = "template-preview-pill";
    pill.textContent = line;
    refs.templatePreviewMeta.appendChild(pill);
  });

  refs.templatePreviewHighlights.innerHTML = "";
  const highlights = [
    protocol.availability === "ready"
      ? "Fully available in the workspace."
      : "Preview available; template is not yet loadable.",
    protocol.parameters && protocol.parameters.length > 0
      ? `${protocol.parameters.length} editable parameters available.`
      : "No editable parameters in this template.",
    protocol.tags && protocol.tags.length
      ? `Primary tags: ${protocol.tags.slice(0, 3).join(", ")}.`
      : "General-purpose workflow template.",
  ];
  highlights.forEach((line) => {
    const item = document.createElement("li");
    item.textContent = line;
    refs.templatePreviewHighlights.appendChild(item);
  });

  refs.templatePreviewTags.innerHTML = "";
  protocol.tags.slice(0, 6).forEach((tag) => {
    const tagNode = document.createElement("span");
    tagNode.className = "market-tag";
    tagNode.textContent = tag;
    refs.templatePreviewTags.appendChild(tagNode);
  });

  const canLoad = protocolCanLoad(protocol);
  refs.templatePreviewUseBtn.disabled = !canLoad;
  refs.templatePreviewUseBtn.textContent = canLoad ? "Use Template" : "Template Not Available Yet";
  refs.templatePreviewUseBtn.classList.remove("is-loading");

  const source = getMarketPreviewSource(protocol);
  refs.templatePreviewFrame.dataset.previewKind = source.kind;
  if (source.kind === "src") {
    refs.templatePreviewFrame.removeAttribute("srcdoc");
    refs.templatePreviewFrame.src = source.value || "";
  } else {
    refs.templatePreviewFrame.removeAttribute("src");
    refs.templatePreviewFrame.srcdoc = source.value || "";
  }
}

function getFilteredCatalog() {
  let filtered =
    state.sourceFilter === "all"
      ? [...protocolCatalog]
      : protocolCatalog.filter((protocol) => protocol.source === state.sourceFilter);

  if (state.readyOnly) {
    filtered = filtered.filter((protocol) => protocol.availability === "ready");
  }

  if (state.searchText) {
    filtered = filtered.filter((protocol) => {
      const haystack = [protocol.label, protocol.description, protocol.owner, protocol.version, ...protocol.tags]
        .join(" ")
        .toLowerCase();
      return haystack.includes(state.searchText);
    });
  }

  return sortCatalog(filtered);
}

function sortCatalog(protocols) {
  const sorted = [...protocols];
  const sortMode = normalizeCatalogSortMode(state.sortMode);

  const compareByLabel = (left, right) => {
    const leftLabel = String(left?.label || left?.id || "");
    const rightLabel = String(right?.label || right?.id || "");
    const byLabel = catalogNameCollator.compare(leftLabel, rightLabel);
    if (byLabel !== 0) {
      return byLabel;
    }
    return catalogNameCollator.compare(String(left?.id || ""), String(right?.id || ""));
  };

  if (sortMode === "name-asc") {
    return sorted.sort(compareByLabel);
  }

  if (sortMode === "name-desc") {
    return sorted.sort((left, right) => compareByLabel(right, left));
  }

  return sorted.sort((left, right) => {
    const leftReadyRank = left.availability === "ready" ? 0 : 1;
    const rightReadyRank = right.availability === "ready" ? 0 : 1;
    if (leftReadyRank !== rightReadyRank) {
      return leftReadyRank - rightReadyRank;
    }

    const leftSourceRank = left.source === "official" ? 0 : 1;
    const rightSourceRank = right.source === "official" ? 0 : 1;
    if (leftSourceRank !== rightSourceRank) {
      return leftSourceRank - rightSourceRank;
    }

    const leftOrder = protocolCatalogOrder.has(left.id)
      ? protocolCatalogOrder.get(left.id)
      : Number.MAX_SAFE_INTEGER;
    const rightOrder = protocolCatalogOrder.has(right.id)
      ? protocolCatalogOrder.get(right.id)
      : Number.MAX_SAFE_INTEGER;

    if (leftOrder !== rightOrder) {
      return leftOrder - rightOrder;
    }

    return compareByLabel(left, right);
  });
}

function createMarketCard(protocol) {
  const card = document.createElement("article");
  card.className = "market-card";
  card.classList.add(protocol.availability === "ready" ? "is-ready" : "is-planned");
  if (state.selectedProtocolId === protocol.id) {
    card.classList.add("is-selected");
  }

  card.tabIndex = 0;
  card.dataset.cardSelectProtocol = protocol.id;
  card.setAttribute(
    "aria-label",
    `${protocol.label}. ${protocol.availability === "ready" ? "Ready" : "Planned"}. ${
      protocol.source === "official" ? "Official" : "Internal"
    } template.`
  );

  const previewShell = document.createElement("div");
  previewShell.className = "market-card-preview-shell";

  const miniPreview = document.createElement("div");
  miniPreview.className = "market-mini-preview";

  const miniHead = document.createElement("div");
  miniHead.className = "market-mini-preview-head";

  const miniTitle = document.createElement("p");
  miniTitle.className = "market-mini-preview-title";
  miniTitle.textContent =
    protocol.label.length > 42 ? `${protocol.label.slice(0, 39)}...` : protocol.label;

  const miniVersion = document.createElement("p");
  miniVersion.className = "market-mini-preview-version";
  miniVersion.textContent = protocol.version;
  miniHead.appendChild(miniTitle);
  miniHead.appendChild(miniVersion);

  const miniLines = document.createElement("div");
  miniLines.className = "market-mini-preview-lines";
  ["wide", "mid", "wide", "short"].forEach((sizeClass) => {
    const line = document.createElement("span");
    line.className = `market-mini-preview-line ${sizeClass}`;
    miniLines.appendChild(line);
  });

  const miniFooter = document.createElement("div");
  miniFooter.className = "market-mini-preview-footer";
  const miniSource = document.createElement("span");
  miniSource.className = "market-mini-chip";
  miniSource.textContent = protocol.source === "official" ? "Official" : "Internal";
  const miniState = document.createElement("span");
  miniState.className = "market-mini-chip";
  miniState.textContent = protocol.availability === "ready" ? "Ready" : "Planned";
  miniFooter.appendChild(miniSource);
  miniFooter.appendChild(miniState);

  const previewOverlay = document.createElement("div");
  previewOverlay.className = "market-card-preview-overlay";
  previewOverlay.textContent = "Quick preview";

  miniPreview.appendChild(miniHead);
  miniPreview.appendChild(miniLines);
  miniPreview.appendChild(miniFooter);
  previewShell.appendChild(miniPreview);
  previewShell.appendChild(previewOverlay);

  const head = document.createElement("div");
  head.className = "market-card-head";

  const titleBox = document.createElement("div");
  titleBox.className = "market-card-title-wrap";
  const title = document.createElement("h3");
  title.className = "market-card-title";
  title.textContent = protocol.label;

  const owner = document.createElement("p");
  owner.className = "market-card-owner";
  owner.textContent = `${protocol.owner} · ${protocol.version}`;

  const submeta = document.createElement("p");
  submeta.className = "market-card-submeta";
  submeta.textContent = protocol.tags.slice(0, 2).join(" · ") || "Template";

  titleBox.appendChild(title);
  titleBox.appendChild(owner);
  titleBox.appendChild(submeta);

  const sourceBadge = document.createElement("span");
  sourceBadge.className = `market-badge market-badge-${protocol.source}`;
  sourceBadge.textContent = protocol.source === "official" ? "Official" : "Internal";

  head.appendChild(titleBox);
  head.appendChild(sourceBadge);

  const description = document.createElement("p");
  description.className = "market-card-description";
  description.textContent = protocol.description;

  const tags = document.createElement("div");
  tags.className = "market-tags";

  protocol.tags.slice(0, 3).forEach((tag) => {
    const tagNode = document.createElement("span");
    tagNode.className = "market-tag";
    tagNode.textContent = tag;
    tags.appendChild(tagNode);
  });

  const readiness = document.createElement("span");
  readiness.className = `market-badge market-badge-${protocol.availability}`;
  readiness.textContent = protocol.availability === "ready" ? "Ready" : "Planned";
  tags.appendChild(readiness);

  const actions = document.createElement("div");
  actions.className = "market-card-actions";

  const exploreBtn = document.createElement("button");
  exploreBtn.type = "button";
  exploreBtn.className = "btn btn-soft";
  exploreBtn.dataset.selectProtocol = protocol.id;
  if (state.selectedProtocolId === protocol.id) {
    exploreBtn.textContent = "Selected";
    exploreBtn.disabled = true;
  } else {
    exploreBtn.textContent = "Explore";
  }

  const loadBtn = document.createElement("button");
  loadBtn.type = "button";
  loadBtn.dataset.loadProtocol = protocol.id;

  if (protocolCanLoad(protocol)) {
    if (state.activeProtocolId === protocol.id) {
      loadBtn.className = "btn btn-soft";
      loadBtn.textContent = "Active";
      loadBtn.disabled = true;
    } else {
      loadBtn.className = "btn btn-primary";
      loadBtn.textContent = "Load";
    }
  } else {
    loadBtn.className = "btn btn-soft";
    loadBtn.disabled = true;
    loadBtn.textContent = "Coming soon";
  }

  actions.appendChild(exploreBtn);
  actions.appendChild(loadBtn);

  card.appendChild(previewShell);
  card.appendChild(head);
  card.appendChild(description);
  card.appendChild(tags);
  card.appendChild(actions);

  return card;
}

function queueMarketPreviewFrame(frame, source) {
  if (!frame) {
    return;
  }

  frame.dataset.previewKind = source?.kind === "src" ? "src" : "srcdoc";
  frame.dataset.previewValue = source?.value || "";
  frame.dataset.previewHydrated = "false";

  if (typeof IntersectionObserver === "undefined") {
    hydrateMarketPreviewFrame(frame);
    return;
  }

  ensureMarketPreviewObserver();
  marketPreviewObserver.observe(frame);
}

function ensureMarketPreviewObserver() {
  if (marketPreviewObserver || typeof IntersectionObserver === "undefined") {
    return;
  }

  marketPreviewObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) {
          return;
        }

        const frame = entry.target;
        if (frame instanceof HTMLIFrameElement) {
          hydrateMarketPreviewFrame(frame);
          marketPreviewObserver.unobserve(frame);
        }
      });
    },
    {
      root: refs.catalogList,
      rootMargin: "180px 0px",
      threshold: 0.05,
    }
  );
}

function hydrateMarketPreviewFrame(frame) {
  if (frame.dataset.previewHydrated === "true") {
    return;
  }

  if (frame.dataset.previewKind === "src") {
    frame.src = frame.dataset.previewValue || "";
  } else {
    frame.srcdoc = frame.dataset.previewValue || "";
  }

  frame.dataset.previewHydrated = "true";
}

function fitMarketPreviewFrame(frame) {
  if (!canAccessPreviewFrameDocument(frame)) {
    return;
  }

  try {
    const doc = frame.contentDocument;
    if (!doc || !doc.body) {
      return;
    }
    const isTemplatePreview = frame.id === "templatePreviewFrame";

    const primarySurface = isolateMarketPreviewFirstPage(doc);
    ensureMarketPreviewHostStyle(doc);

    doc.body.style.zoom = "1";
    if (isTemplatePreview) {
      doc.documentElement.style.overflow = "hidden";
      doc.body.style.overflow = "hidden";
    }

    const surfaceWidth = getPreviewSurfaceWidth(primarySurface);
    const surfaceHeight = getPreviewSurfaceHeight(primarySurface);
    const contentWidth = isTemplatePreview
      ? Math.max(surfaceWidth || doc.documentElement.scrollWidth || doc.body.scrollWidth, 680)
      : Math.max(surfaceWidth, doc.documentElement.scrollWidth, doc.body.scrollWidth, 680);
    const contentHeight = isTemplatePreview
      ? Math.max(surfaceHeight || doc.documentElement.scrollHeight || doc.body.scrollHeight, 520)
      : Math.max(surfaceHeight, doc.documentElement.scrollHeight, doc.body.scrollHeight, 520);

    const availableWidth = Math.max(120, frame.clientWidth - (isTemplatePreview ? 6 : 8));
    const availableHeight = Math.max(78, frame.clientHeight - (isTemplatePreview ? 6 : 8));
    const baseZoom = clamp(Math.min(availableWidth / contentWidth, availableHeight / contentHeight), 0.12, 1);
    const scaledZoom = isTemplatePreview ? baseZoom * 1.06 : baseZoom;
    const zoom = clamp(scaledZoom, 0.12, isTemplatePreview ? 1.08 : 1);

    doc.body.style.zoom = String(zoom);
    doc.body.style.transformOrigin = "top center";

    if (frame.contentWindow) {
      frame.contentWindow.scrollTo(0, 0);
    }
  } catch {
    // Some browser+origin combinations can block iframe document access.
  }
}

function canAccessPreviewFrameDocument(frame) {
  if (!frame) {
    return false;
  }

  if (frame.dataset.previewKind !== "src") {
    return true;
  }

  const srcValue = frame.getAttribute("src") || frame.src || "";
  if (!srcValue) {
    return false;
  }

  try {
    const srcUrl = new URL(srcValue, window.location.href);
    if (srcUrl.protocol === "file:") {
      return false;
    }
    return srcUrl.origin === window.location.origin;
  } catch {
    return false;
  }
}

function isolateMarketPreviewFirstPage(doc) {
  const pages = Array.from(doc.querySelectorAll("section.page, section.pdf-page, .pdf-page"));
  if (pages.length === 0) {
    return null;
  }

  pages.forEach((node, index) => {
    if (!(node instanceof HTMLElement)) {
      return;
    }

    node.style.display = index === 0 ? "" : "none";
    if (index === 0) {
      node.style.margin = "0 auto";
    }
  });

  return pages[0] instanceof HTMLElement ? pages[0] : null;
}

function getPreviewSurfaceWidth(surface) {
  if (!(surface instanceof HTMLElement)) {
    return 0;
  }

  return Math.max(surface.scrollWidth || 0, surface.offsetWidth || 0, surface.clientWidth || 0);
}

function getPreviewSurfaceHeight(surface) {
  if (!(surface instanceof HTMLElement)) {
    return 0;
  }

  return Math.max(surface.scrollHeight || 0, surface.offsetHeight || 0, surface.clientHeight || 0);
}

function ensureMarketPreviewHostStyle(doc) {
  if (doc.getElementById("studio-market-preview-style")) {
    return;
  }

  const style = doc.createElement("style");
  style.id = "studio-market-preview-style";
  style.textContent = [
    "@media screen {",
    "  html, body { margin: 0 !important; padding: 0 !important; overflow: hidden !important; background: #eef3fb !important; }",
    "  body { display: block !important; }",
    "  main { margin: 0 auto !important; padding: 0 !important; gap: 0 !important; display: block !important; }",
    "  section.page, section.pdf-page, .pdf-page { margin: 0 auto !important; }",
    "}",
  ].join("\n");

  if (doc.head) {
    doc.head.appendChild(style);
  }
}

function getMarketPreviewSource(protocol) {
  if (protocol.availability === "planned") {
    if (typeof protocol.marketPreviewHtml === "function") {
      return {
        kind: "srcdoc",
        value: protocol.marketPreviewHtml(protocol),
      };
    }

    if (typeof protocol.marketPreviewHtml === "string") {
      return {
        kind: "srcdoc",
        value: protocol.marketPreviewHtml,
      };
    }

    return {
      kind: "srcdoc",
      value: createPlannedPreviewHtml(protocol.label),
    };
  }

  const inlineSource = getInlineTemplateSource(protocol);
  if (inlineSource) {
    return {
      kind: "srcdoc",
      value: inlineSource,
    };
  }

  if (protocolCanLoad(protocol) && protocol.templateFile) {
    return {
      kind: "src",
      value: getTemplatePreviewUrl(protocol),
    };
  }

  if (typeof protocol.marketPreviewHtml === "function") {
    return {
      kind: "srcdoc",
      value: protocol.marketPreviewHtml(protocol),
    };
  }

  if (typeof protocol.marketPreviewHtml === "string") {
    return {
      kind: "srcdoc",
      value: protocol.marketPreviewHtml,
    };
  }

  return {
    kind: "srcdoc",
    value: createDefaultPreviewHtml(protocol.label),
  };
}

function getTemplatePreviewUrl(protocol) {
  const basePath = String(protocol?.templateFile || "").trim();
  if (!basePath) {
    return "";
  }

  const joiner = basePath.includes("?") ? "&" : "?";
  return `${basePath}${joiner}preview=${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function selectProtocol(protocolId) {
  const protocol = protocolById[protocolId];
  if (!protocol) {
    return;
  }

  state.selectedProtocolId = protocol.id;
  renderCatalog();
  renderEditorHeader();
  syncActionButtons();
}

function renderEditorHeader() {
  const selectedProtocol = getSelectedProtocol();
  if (!selectedProtocol) {
    refs.editorTitle.textContent = "Select a template";
    refs.editorSubtitle.textContent = "Open Explore Templates to load a protocol.";
    refs.activeProtocolMeta.innerHTML = "";
    refs.previewProtocolName.textContent = "Live Preview";
    return;
  }

  refs.editorTitle.textContent = selectedProtocol.label;

  const readiness = selectedProtocol.availability === "ready" ? "Ready to load." : "Planned template.";
  const loaded =
    state.activeProtocolId === selectedProtocol.id
      ? "Loaded in workspace."
      : state.activeProtocolId
        ? "Select Load to switch the active template."
        : "Not loaded yet.";

  refs.editorSubtitle.textContent = `${selectedProtocol.description} ${readiness} ${loaded}`;

  refs.activeProtocolMeta.innerHTML = "";
  [
    `Source: ${selectedProtocol.source === "official" ? "Official (Scomix)" : "Internal"}`,
    `Owner: ${selectedProtocol.owner}`,
    `Version: ${selectedProtocol.version}`,
    `Status: ${selectedProtocol.availability === "ready" ? "Ready" : "Planned"}`,
  ].forEach((line) => {
    const pill = document.createElement("span");
    pill.className = "meta-pill";
    pill.textContent = line;
    refs.activeProtocolMeta.appendChild(pill);
  });

  const activeProtocol = getActiveProtocol();
  refs.previewProtocolName.textContent = activeProtocol
    ? `${activeProtocol.label} · Live Preview`
    : "Live Preview";
}

function loadProtocol(protocolId) {
  const protocol = protocolById[protocolId];
  if (!protocol) {
    return;
  }

  if (!protocolCanLoad(protocol)) {
    setStatus(`Template ${protocol.label} is not ready yet.`, true);
    return;
  }

  state.selectedProtocolId = protocol.id;
  state.activeProtocolId = protocol.id;
  state.rawValues = createRawValuesFromDefaults(protocol);

  renderProtocolControls(protocol, state.rawValues);
  syncProtocolUi();
  renderCatalog();
  renderEditorHeader();
  syncActionButtons();
  applyFromForm();
  setOverlayState("marketplace", false);
}

function createRawValuesFromDefaults(protocol) {
  const defaults = protocol.defaults || {};
  const next = {};

  protocol.parameters.forEach((parameter) => {
    const value = defaults[parameter.key];
    if (parameter.type === "checkbox") {
      next[parameter.key] = Boolean(value);
      return;
    }

    next[parameter.key] = value === undefined || value === null ? "" : String(value);
  });

  return next;
}

function renderProtocolControls(protocol, values) {
  refs.protocolControls.innerHTML = "";
  state.fieldRefs = {};

  if (!protocol.parameters || protocol.parameters.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "This template does not have editable parameters yet.";
    refs.protocolControls.appendChild(empty);
    return;
  }

  protocol.parameters.forEach((parameter) => {
    const field = createField(parameter, values[parameter.key]);
    state.fieldRefs[parameter.key] = field;
    refs.protocolControls.appendChild(field.wrapper);
  });
}

function createField(parameter, initialValue) {
  if (parameter.type === "checkbox") {
    const wrapper = document.createElement("label");
    wrapper.className = "check-row";
    wrapper.setAttribute("for", parameter.key);

    const input = document.createElement("input");
    input.id = parameter.key;
    input.name = parameter.key;
    input.type = "checkbox";
    input.checked = Boolean(initialValue);
    input.addEventListener("change", onEditorFieldChange);

    wrapper.appendChild(input);
    wrapper.appendChild(document.createTextNode(parameter.label));

    return { wrapper, input };
  }

  const wrapper = document.createElement("div");
  wrapper.className = "form-field";

  const label = document.createElement("label");
  label.setAttribute("for", parameter.key);
  label.textContent = parameter.label;

  let input;
  if (parameter.type === "select") {
    input = document.createElement("select");
    parameter.options.forEach((optionData) => {
      const option = document.createElement("option");
      option.value = String(optionData.value);
      option.textContent = optionData.label;
      input.appendChild(option);
    });
    input.value = String(initialValue ?? parameter.options[0]?.value ?? "");
  } else {
    input = document.createElement("input");
    input.type = parameter.type || "text";
    if (parameter.min !== undefined) {
      input.min = String(parameter.min);
    }
    if (parameter.max !== undefined) {
      input.max = String(parameter.max);
    }
    if (parameter.step !== undefined) {
      input.step = String(parameter.step);
    }
    input.value = String(initialValue ?? "");
  }

  input.id = parameter.key;
  input.name = parameter.key;
  input.addEventListener("change", onEditorFieldChange);

  wrapper.appendChild(label);
  wrapper.appendChild(input);

  if (parameter.hint) {
    const hint = document.createElement("p");
    hint.className = "hint";
    hint.textContent = parameter.hint;
    wrapper.appendChild(hint);
  }

  return { wrapper, input };
}

function onEditorFieldChange() {
  state.rawValues = collectRawValues();
  syncProtocolUi();
  applyFromForm();
}

function collectRawValues() {
  const protocol = getActiveProtocol();
  if (!protocol) {
    return {};
  }

  const values = {};
  protocol.parameters.forEach((parameter) => {
    const field = state.fieldRefs[parameter.key]?.input;
    if (!field) {
      return;
    }

    if (parameter.type === "checkbox") {
      values[parameter.key] = field.checked;
      return;
    }

    values[parameter.key] = field.value;
  });

  return values;
}

function syncProtocolUi() {
  const protocol = getActiveProtocol();
  if (!protocol || typeof protocol.syncUi !== "function") {
    return;
  }

  const controls = Object.fromEntries(
    Object.entries(state.fieldRefs).map(([key, ref]) => [key, ref.input])
  );

  protocol.syncUi(state.rawValues, controls);
}

function resetActiveProtocol() {
  const protocol = getActiveProtocol();
  if (!protocol) {
    return;
  }

  state.rawValues = createRawValuesFromDefaults(protocol);
  renderProtocolControls(protocol, state.rawValues);
  syncProtocolUi();
  applyFromForm();
}

function applyFromForm() {
  const protocol = getActiveProtocol();
  if (!protocol) {
    return;
  }

  const normalizedValues =
    typeof protocol.normalize === "function"
      ? protocol.normalize({ ...state.rawValues })
      : { ...state.rawValues };

  state.rawValues = normalizeValuesForUi(protocol, state.rawValues, normalizedValues);
  syncProtocolUi();
  updateSummaryForProtocol(protocol, normalizedValues);

  state.pendingState = {
    protocolId: protocol.id,
    values: { ...normalizedValues },
  };

  setStatus(`Loading ${protocol.label}...`);
  loadBaseProtocol(protocol);
}

function normalizeValuesForUi(protocol, currentRawValues, normalizedValues) {
  const nextValues = {};

  protocol.parameters.forEach((parameter) => {
    const normalized = normalizedValues[parameter.key];
    const current = currentRawValues[parameter.key];

    if (parameter.type === "checkbox") {
      nextValues[parameter.key] = Boolean(normalized !== undefined ? normalized : current);
      return;
    }

    const valueToWrite = normalized !== undefined && normalized !== null ? normalized : current;
    nextValues[parameter.key] = valueToWrite === undefined || valueToWrite === null ? "" : String(valueToWrite);
  });

  return nextValues;
}

function updateSummaryForProtocol(protocol, normalizedValues) {
  if (typeof protocol.updateSummary === "function") {
    protocol.updateSummary(normalizedValues);
    return;
  }

  const lines = Object.entries(normalizedValues)
    .slice(0, 3)
    .map(([key, value]) => `${humanizeKey(key)}: ${formatSummaryValue(value)}`);

  setSummary("Calculated values", [
    lines[0] || "No derived values for this template yet.",
    lines[1] || "",
    lines[2] || "",
  ]);
}

function loadBaseProtocol(protocol) {
  // Fast path: the iframe is already showing this template. Re-apply the
  // rules on the live document instead of reloading the whole iframe. This
  // keeps scroll position and avoids re-parsing the ~2 MB embedded SVG on
  // every parameter change.
  if (state.loadedProtocolId === protocol.id) {
    const doc = refs.frame.contentDocument;
    if (doc && doc.readyState !== "loading") {
      applyRulesInPlace(protocol, doc);
      return;
    }
  }

  // Already fetching this same template? Let the in-flight load complete; the
  // frame-loaded handler will pick up the latest pendingState values.
  if (state.loadingProtocolId === protocol.id) {
    return;
  }

  state.loadedProtocolId = "";
  state.loadingProtocolId = protocol.id;

  const inlineSource = getInlineTemplateSource(protocol);
  if (inlineSource) {
    refs.frame.srcdoc = inlineSource;
    return;
  }

  if (protocol.templateFile) {
    refs.frame.src = `${protocol.templateFile}?v=${Date.now()}`;
    return;
  }

  state.loadingProtocolId = "";
  setStatus(`No template source found for ${protocol.label}.`, true);
}

function applyRulesInPlace(protocol, doc) {
  const pending = state.pendingState;
  state.pendingState = null;

  try {
    clearStudioOverlays(doc);
    if (typeof protocol.applyRules === "function") {
      protocol.applyRules(doc, pending ? pending.values : {});
    }
    setStatus(`Preview updated: ${protocol.label}.`);
  } catch (error) {
    setStatus(`Error applying template rules: ${error.message}`, true);
  }

  queuePreviewRefresh();
}

function getInlineTemplateSource(protocol) {
  const embeddedSource = getEmbeddedProtocolSource(protocol.id);
  if (embeddedSource) {
    return embeddedSource;
  }

  if (typeof protocol.inlineTemplate === "function") {
    return protocol.inlineTemplate();
  }

  if (typeof protocol.inlineTemplate === "string" && protocol.inlineTemplate.trim().length > 0) {
    return protocol.inlineTemplate;
  }

  return "";
}

function getEmbeddedProtocolSource(protocolId) {
  const primaryNode = document.getElementById(`protocolTemplate-${protocolId}`);
  const fallbackNode = protocolId === "abseq" ? document.getElementById("protocolHtml") : null;
  const templateNode = primaryNode || fallbackNode;
  if (!templateNode) {
    return "";
  }

  const source = templateNode.textContent || "";
  return source.trim().length > 0 ? source : "";
}

function handlePreviewFrameLoaded() {
  state.loadingProtocolId = "";

  const doc = refs.frame.contentDocument;
  if (!doc) {
    return;
  }

  if (!state.pendingState) {
    queuePreviewRefresh();
    return;
  }

  const pending = state.pendingState;
  state.pendingState = null;

  try {
    const protocol = protocolById[pending.protocolId];
    if (!protocol) {
      throw new Error("Template is no longer available.");
    }

    clearStudioOverlays(doc);
    if (typeof protocol.applyRules === "function") {
      protocol.applyRules(doc, pending.values);
    }

    state.loadedProtocolId = protocol.id;
    setStatus(`Preview ready: ${protocol.label}.`);
  } catch (error) {
    state.loadedProtocolId = "";
    setStatus(`Error applying template rules: ${error.message}`, true);
  }

  queuePreviewRefresh();
}

function queuePreviewRefresh() {
  window.clearTimeout(state.previewRefreshTimer);
  state.previewRefreshTimer = window.setTimeout(refreshPreviewLayout, 60);
}

function refreshPreviewLayout() {
  const doc = refs.frame.contentDocument;
  if (!doc || !doc.body || !refs.frameWrap) {
    return;
  }

  ensurePreviewHostStyle(doc);

  const zoom = state.previewMode === "fit" ? computePreviewFitZoom(doc) : 1;
  doc.body.style.zoom = String(zoom);

  const contentHeight = Math.max(doc.documentElement.scrollHeight, doc.body.scrollHeight);
  // Do not manipulate iframe height. Allow CSS flex context to constrain it
  // and trigger native iframe scrollbars instead.
}

function ensurePreviewHostStyle(doc) {
  if (doc.getElementById("studio-preview-host-style")) {
    return;
  }

  const style = doc.createElement("style");
  style.id = "studio-preview-host-style";
  style.textContent = [
    "@media screen {",
    "  html { background: #ecf2fb; }",
    "  body { margin: 0 auto; }",
    "}",
  ].join("\n");

  if (doc.head) {
    doc.head.appendChild(style);
  }
}

function computePreviewFitZoom(doc) {
  const previousZoom = doc.body.style.zoom;
  doc.body.style.zoom = "1";

  const contentWidth = Math.max(doc.documentElement.scrollWidth, doc.body.scrollWidth, 840);
  const availableWidth = Math.max(360, refs.frameWrap.clientWidth - 18);

  doc.body.style.zoom = previousZoom;

  return clamp(availableWidth / contentWidth, 0.45, 1.35);
}

function syncPreviewButtons() {
  const fitActive = state.previewMode === "fit";
  refs.fitPreviewBtn.classList.toggle("btn-primary", fitActive);
  refs.fitPreviewBtn.classList.toggle("btn-soft", !fitActive);

  refs.actualPreviewBtn.classList.toggle("btn-primary", !fitActive);
  refs.actualPreviewBtn.classList.toggle("btn-soft", fitActive);
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
  const activeProtocol = getActiveProtocol();
  const protocolName = activeProtocol ? activeProtocol.id : "protocol";
  const timestamp = new Date().toISOString().replace(/[.:]/g, "-");

  anchor.href = url;
  anchor.download = `client_${protocolName}_${timestamp}.html`;
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

function syncActionButtons() {
  const hasActive = Boolean(getActiveProtocol());

  refs.applyBtn.disabled = !hasActive;
  refs.resetBtn.disabled = !hasActive;
  refs.downloadHtmlBtn.disabled = !hasActive;
  refs.printPdfBtn.disabled = !hasActive;
  refs.fitPreviewBtn.disabled = !hasActive;
  refs.actualPreviewBtn.disabled = !hasActive;

  const selected = getSelectedProtocol();
  refs.openMarketplaceFromPreviewBtn.disabled = !selected;
}

function setSummary(title, lines) {
  refs.summaryTitle.textContent = title;
  refs.calcLine1.textContent = lines[0] || "";
  refs.calcLine2.textContent = lines[1] || "";
  refs.calcLine3.textContent = lines[2] || "";
}

function setStatus(text, isError = false) {
  refs.status.textContent = text;
  refs.status.classList.toggle("is-error", isError);
}

function formatSummaryValue(value) {
  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }
  return String(value);
}

function humanizeKey(value) {
  return String(value)
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (character) => character.toUpperCase())
    .trim();
}

function getSelectedProtocol() {
  return protocolById[state.selectedProtocolId] || null;
}

function getActiveProtocol() {
  return protocolById[state.activeProtocolId] || null;
}

function protocolCanLoad(protocol) {
  if (!protocol || protocol.availability !== "ready") {
    return false;
  }

  if (embeddedTemplateIds.has(protocol.id)) {
    return true;
  }

  if (typeof protocol.inlineTemplate === "function") {
    return true;
  }

  if (typeof protocol.inlineTemplate === "string" && protocol.inlineTemplate.trim().length > 0) {
    return true;
  }

  return Boolean(protocol.templateFile);
}

function getEmbeddedTemplateIds() {
  const ids = new Set();
  document.querySelectorAll('script[id^="protocolTemplate-"]').forEach((node) => {
    ids.add(node.id.replace("protocolTemplate-", ""));
  });

  if (document.getElementById("protocolHtml")) {
    ids.add("abseq");
  }

  return ids;
}

async function onPdfSelected(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) {
    return;
  }

  setPdfStatus("Loading PDF and generating workspace...");

  try {
    const pdfjsLib = await ensurePdfJs();
    const buffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: buffer });
    const pdfDoc = await loadingTask.promise;

    state.pdfLab.pdfDoc = pdfDoc;
    state.pdfLab.fileName = file.name;
    state.pdfLab.pageNumber = 1;
    state.pdfLab.pageCount = pdfDoc.numPages;
    state.pdfLab.scale = 1.2;
    state.pdfLab.fields = [];
    state.pdfLab.selectedFieldId = "";
    state.pdfLab.nextFieldNumber = 1;

    await renderPdfPage(1);
    await autoSuggestFieldsForCurrentPage(true);
    setPdfStatus("PDF ready. Draw regions or refine auto-suggested fields.");
  } catch (error) {
    if (error && error.code === "PDFJS_UNAVAILABLE") {
      setPdfStatus(
        "Could not load pdf.js (required to parse PDFs). Check your internet connection or unblock cdnjs.cloudflare.com and try again.",
        true,
      );
      return;
    }
    setPdfStatus(`Could not load PDF: ${error.message}`, true);
  }
}

async function ensurePdfJs() {
  if (window.pdfjsLib) {
    window.pdfjsLib.GlobalWorkerOptions.workerSrc =
      "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
    return window.pdfjsLib;
  }

  if (pdfJsLoadingPromise) {
    return pdfJsLoadingPromise;
  }

  pdfJsLoadingPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
    script.async = true;

    const fail = (message) => {
      const err = new Error(message);
      err.code = "PDFJS_UNAVAILABLE";
      // Reset so a future attempt (e.g. after reconnecting) can retry.
      pdfJsLoadingPromise = null;
      reject(err);
    };

    script.onload = () => {
      if (!window.pdfjsLib) {
        fail("pdf.js loaded but did not initialize.");
        return;
      }

      window.pdfjsLib.GlobalWorkerOptions.workerSrc =
        "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
      resolve(window.pdfjsLib);
    };

    script.onerror = () => {
      fail("Unable to load pdf.js from CDN.");
    };

    document.head.appendChild(script);
  });

  return pdfJsLoadingPromise;
}

async function renderPdfPage(requestedPageNumber) {
  const pdfDoc = state.pdfLab.pdfDoc;
  if (!pdfDoc) {
    return;
  }

  const pageNumber = clamp(Math.trunc(requestedPageNumber), 1, state.pdfLab.pageCount);
  state.pdfLab.pageNumber = pageNumber;

  const token = ++state.pdfLab.renderToken;
  const page = await pdfDoc.getPage(pageNumber);
  const viewport = page.getViewport({ scale: state.pdfLab.scale });

  const canvas = refs.pdfCanvas;
  const context = canvas.getContext("2d", { alpha: false });

  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);

  await page.render({ canvasContext: context, viewport }).promise;
  if (token !== state.pdfLab.renderToken) {
    return;
  }

  state.pdfLab.viewportWidth = viewport.width;
  state.pdfLab.viewportHeight = viewport.height;

  updatePdfPageIndicator();
  syncPdfOverlaySize();
  renderPdfOverlayBoxes();
  renderPdfFieldsList();
  syncPdfFieldEditor();
}

function updatePdfPageIndicator() {
  refs.pdfPageIndicator.textContent = `Page ${state.pdfLab.pageNumber} / ${state.pdfLab.pageCount}`;
}

function setPdfStatus(text, isError = false) {
  refs.pdfStatus.textContent = text;
  refs.pdfStatus.classList.toggle("is-error", isError);
}

function syncPdfOverlaySize() {
  const canvas = refs.pdfCanvas;
  const overlay = refs.pdfOverlay;
  if (!canvas || !overlay) {
    return;
  }

  overlay.style.left = `${canvas.offsetLeft}px`;
  overlay.style.top = `${canvas.offsetTop}px`;
  overlay.style.width = `${canvas.clientWidth}px`;
  overlay.style.height = `${canvas.clientHeight}px`;
}

function onPdfOverlayPointerDown(event) {
  if (!state.pdfLab.pdfDoc) {
    return;
  }

  const fieldBox = event.target.closest("[data-box-field-id]");
  if (fieldBox) {
    selectPdfField(fieldBox.dataset.boxFieldId || "");
    return;
  }

  const overlayRect = refs.pdfOverlay.getBoundingClientRect();
  if (overlayRect.width <= 0 || overlayRect.height <= 0) {
    return;
  }

  const x = clamp(event.clientX - overlayRect.left, 0, overlayRect.width);
  const y = clamp(event.clientY - overlayRect.top, 0, overlayRect.height);

  pdfDrawState.isDrawing = true;
  pdfDrawState.pointerId = event.pointerId;
  pdfDrawState.startX = x;
  pdfDrawState.startY = y;

  const draft = document.createElement("div");
  draft.className = "pdf-field-box draft";
  draft.style.left = `${x}px`;
  draft.style.top = `${y}px`;
  draft.style.width = "0px";
  draft.style.height = "0px";

  refs.pdfOverlay.appendChild(draft);
  pdfDrawState.draftBox = draft;
}

function onPdfOverlayPointerMove(event) {
  if (!pdfDrawState.isDrawing || !pdfDrawState.draftBox) {
    return;
  }

  const rect = refs.pdfOverlay.getBoundingClientRect();
  const currentX = clamp(event.clientX - rect.left, 0, rect.width);
  const currentY = clamp(event.clientY - rect.top, 0, rect.height);

  const left = Math.min(pdfDrawState.startX, currentX);
  const top = Math.min(pdfDrawState.startY, currentY);
  const width = Math.abs(currentX - pdfDrawState.startX);
  const height = Math.abs(currentY - pdfDrawState.startY);

  pdfDrawState.draftBox.style.left = `${left}px`;
  pdfDrawState.draftBox.style.top = `${top}px`;
  pdfDrawState.draftBox.style.width = `${width}px`;
  pdfDrawState.draftBox.style.height = `${height}px`;
}

function onPdfOverlayPointerUp() {
  if (!pdfDrawState.isDrawing) {
    return;
  }

  pdfDrawState.isDrawing = false;

  const draft = pdfDrawState.draftBox;
  pdfDrawState.draftBox = null;

  if (!draft) {
    return;
  }

  const width = parseFloat(draft.style.width || "0");
  const height = parseFloat(draft.style.height || "0");

  if (width < 12 || height < 12) {
    draft.remove();
    return;
  }

  const overlayWidth = refs.pdfOverlay.clientWidth;
  const overlayHeight = refs.pdfOverlay.clientHeight;

  const field = {
    id: `pdf_field_${state.pdfLab.nextFieldNumber}`,
    key: `field_${state.pdfLab.nextFieldNumber}`,
    label: `Field ${state.pdfLab.nextFieldNumber}`,
    type: "text",
    defaultValue: "",
    editable: true,
    pageNumber: state.pdfLab.pageNumber,
    xPct: clamp(parseFloat(draft.style.left || "0") / overlayWidth, 0, 1),
    yPct: clamp(parseFloat(draft.style.top || "0") / overlayHeight, 0, 1),
    wPct: clamp(width / overlayWidth, 0.01, 1),
    hPct: clamp(height / overlayHeight, 0.01, 1),
  };

  state.pdfLab.nextFieldNumber += 1;
  state.pdfLab.fields.push(field);

  draft.remove();
  selectPdfField(field.id);
  renderPdfFieldsList();
  renderPdfOverlayBoxes();
  setPdfStatus(`Field ${field.label} created. Configure its behavior on the right.`);
}

function renderPdfOverlayBoxes() {
  const overlay = refs.pdfOverlay;
  if (!overlay) {
    return;
  }

  overlay.querySelectorAll(".pdf-field-box:not(.draft)").forEach((node) => node.remove());

  if (!state.pdfLab.pdfDoc) {
    return;
  }

  const overlayWidth = overlay.clientWidth;
  const overlayHeight = overlay.clientHeight;

  state.pdfLab.fields
    .filter((field) => field.pageNumber === state.pdfLab.pageNumber)
    .forEach((field) => {
      const box = document.createElement("div");
      box.className = "pdf-field-box";
      if (!field.editable) {
        box.classList.add("is-locked");
      }
      if (field.id === state.pdfLab.selectedFieldId) {
        box.classList.add("is-selected");
      }

      box.dataset.boxFieldId = field.id;
      box.style.left = `${field.xPct * overlayWidth}px`;
      box.style.top = `${field.yPct * overlayHeight}px`;
      box.style.width = `${field.wPct * overlayWidth}px`;
      box.style.height = `${field.hPct * overlayHeight}px`;
      box.title = `${field.label} (${field.key})`;
      overlay.appendChild(box);
    });
}

function renderPdfFieldsList() {
  refs.pdfFieldsList.innerHTML = "";
  if (!state.pdfLab.fields.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "No fields yet. Draw a region or click Auto Suggest Fields.";
    refs.pdfFieldsList.appendChild(empty);
    return;
  }

  state.pdfLab.fields.forEach((field) => {
    const item = document.createElement("div");
    item.className = "pdf-field-item";
    if (field.id === state.pdfLab.selectedFieldId) {
      item.classList.add("is-selected");
    }

    item.dataset.pdfFieldId = field.id;

    const title = document.createElement("p");
    title.className = "pdf-field-item-title";
    title.textContent = `${field.label} · ${field.key}`;

    const meta = document.createElement("p");
    meta.className = "pdf-field-item-meta";
    meta.textContent = `Page ${field.pageNumber} · ${field.type} · ${field.editable ? "editable" : "locked"}`;

    item.appendChild(title);
    item.appendChild(meta);
    refs.pdfFieldsList.appendChild(item);
  });
}

function selectPdfField(fieldId) {
  const exists = state.pdfLab.fields.some((field) => field.id === fieldId);
  state.pdfLab.selectedFieldId = exists ? fieldId : "";
  renderPdfFieldsList();
  renderPdfOverlayBoxes();
  syncPdfFieldEditor();
}

function syncPdfFieldEditor() {
  const field = getSelectedPdfField();
  if (!field) {
    refs.pdfFieldEditor.hidden = true;
    return;
  }

  refs.pdfFieldEditor.hidden = false;
  refs.fieldKeyInput.value = field.key;
  refs.fieldLabelInput.value = field.label;
  refs.fieldTypeSelect.value = field.type;
  refs.fieldDefaultInput.value = String(field.defaultValue || "");
  refs.fieldEditableInput.checked = field.editable;
}

function getSelectedPdfField() {
  return state.pdfLab.fields.find((field) => field.id === state.pdfLab.selectedFieldId) || null;
}

function saveSelectedPdfField() {
  const field = getSelectedPdfField();
  if (!field) {
    return;
  }

  const proposedKey = sanitizeFieldKey(refs.fieldKeyInput.value || field.key);
  if (!proposedKey) {
    setPdfStatus("Field key cannot be empty.", true);
    return;
  }

  const uniqueKey = ensureUniqueFieldKey(proposedKey, field.id);
  field.key = uniqueKey;
  field.label = refs.fieldLabelInput.value.trim() || uniqueKey;
  field.type = refs.fieldTypeSelect.value || "text";
  field.defaultValue = refs.fieldDefaultInput.value;
  field.editable = refs.fieldEditableInput.checked;

  renderPdfFieldsList();
  renderPdfOverlayBoxes();
  syncPdfFieldEditor();
  setPdfStatus(`Field ${field.label} saved.`);
}

function deleteSelectedPdfField() {
  const selectedId = state.pdfLab.selectedFieldId;
  if (!selectedId) {
    return;
  }

  state.pdfLab.fields = state.pdfLab.fields.filter((field) => field.id !== selectedId);
  state.pdfLab.selectedFieldId = "";

  renderPdfFieldsList();
  renderPdfOverlayBoxes();
  syncPdfFieldEditor();
  setPdfStatus("Field removed.");
}

async function autoSuggestFieldsForCurrentPage(silent) {
  const pdfDoc = state.pdfLab.pdfDoc;
  if (!pdfDoc) {
    return;
  }

  const pageNumber = state.pdfLab.pageNumber;
  const page = await pdfDoc.getPage(pageNumber);
  const viewport = page.getViewport({ scale: state.pdfLab.scale });
  const textContent = await page.getTextContent();

  const candidates = textContent.items
    .map((item) => buildSuggestionCandidate(item, viewport, pageNumber))
    .filter(Boolean)
    .sort((left, right) => right.score - left.score);

  const maxNew = 12;
  let created = 0;

  for (const candidate of candidates) {
    if (created >= maxNew) {
      break;
    }

    if (
      hasSimilarFieldOnPage(
        pageNumber,
        candidate.xPct,
        candidate.yPct,
        candidate.wPct,
        candidate.hPct,
        candidate.keyBase
      )
    ) {
      continue;
    }

    const field = {
      id: `pdf_field_${state.pdfLab.nextFieldNumber}`,
      key: ensureUniqueFieldKey(candidate.keyBase || `field_${state.pdfLab.nextFieldNumber}`),
      label: candidate.label,
      type: candidate.type,
      defaultValue: candidate.type === "checkbox" ? "false" : "",
      editable: true,
      pageNumber,
      xPct: candidate.xPct,
      yPct: candidate.yPct,
      wPct: candidate.wPct,
      hPct: candidate.hPct,
    };

    state.pdfLab.nextFieldNumber += 1;
    state.pdfLab.fields.push(field);
    created += 1;
  }

  if (created > 0) {
    state.pdfLab.selectedFieldId = state.pdfLab.fields[state.pdfLab.fields.length - 1].id;
    renderPdfFieldsList();
    renderPdfOverlayBoxes();
    syncPdfFieldEditor();
    setPdfStatus(`${created} suggested field${created === 1 ? "" : "s"} created automatically.`);
    return;
  }

  if (!silent) {
    setPdfStatus("No suitable text blocks were found for auto-suggestions.", true);
  }
}

function buildSuggestionCandidate(item, viewport) {
  const rawText = String(item.str || "").replace(/\s+/g, " ").trim();
  if (rawText.length < 3 || rawText.length > 68) {
    return null;
  }

  if (!/[A-Za-z0-9]/.test(rawText)) {
    return null;
  }

  if (isBoilerplateSuggestionText(rawText)) {
    return null;
  }

  const label = normalizeSuggestionLabel(rawText);
  if (!label) {
    return null;
  }

  const anchor = viewport.convertToViewportPoint(item.transform[4], item.transform[5]);
  const textWidth = Math.max(34, item.width * state.pdfLab.scale);
  const textHeight = Math.max(14, Math.abs(item.transform[3]) * state.pdfLab.scale * 1.2);

  const labelLike = isLikelyLabelText(rawText);
  const type = inferFieldTypeFromLabel(label, rawText);

  let boxX = anchor[0];
  let boxY = anchor[1] - textHeight;
  let boxWidth = Math.max(86, textWidth);
  let boxHeight = Math.max(16, textHeight * 1.22);

  if (labelLike) {
    boxX = anchor[0] + textWidth + 7;
    boxWidth = Math.min(260, Math.max(110, viewport.width * 0.22));

    if (boxX + boxWidth > viewport.width - 6) {
      boxX = Math.max(6, anchor[0] - boxWidth - 9);
    }
  }

  boxX = clamp(boxX, 2, Math.max(2, viewport.width - 8));
  boxY = clamp(boxY, 2, Math.max(2, viewport.height - 8));

  const availableWidth = Math.max(42, viewport.width - boxX - 2);
  const availableHeight = Math.max(16, viewport.height - boxY - 2);
  boxWidth = clamp(boxWidth, 40, availableWidth);
  boxHeight = clamp(boxHeight, 14, availableHeight);

  const xPct = clamp(boxX / viewport.width, 0, 0.99);
  const yPct = clamp(boxY / viewport.height, 0, 0.99);
  const wPct = clamp(boxWidth / viewport.width, 0.025, 0.92);
  const hPct = clamp(boxHeight / viewport.height, 0.01, 0.28);

  const keyBase = sanitizeFieldKey(label) || `field_${state.pdfLab.nextFieldNumber}`;
  const score = scoreSuggestionText(rawText, labelLike, type, textWidth, textHeight);
  if (score < 5) {
    return null;
  }

  return {
    score,
    label: label.slice(0, 56),
    type,
    keyBase,
    xPct,
    yPct,
    wPct,
    hPct,
  };
}

function normalizeSuggestionLabel(rawText) {
  const cleaned = rawText
    .replace(/[_]+/g, " ")
    .replace(/[\u0000-\u001f]/g, "")
    .replace(/^[\-:;,.\s]+|[\-:;,.\s]+$/g, "")
    .trim();

  if (!cleaned || cleaned.length <= 2) {
    return "";
  }

  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

function isBoilerplateSuggestionText(rawText) {
  const normalized = rawText.toLowerCase();

  if (normalized.length > 60) {
    return true;
  }

  if (/^[0-9\-\/.()\s]+$/.test(normalized)) {
    return true;
  }

  const ignoredTokens = [
    "copyright",
    "for research use only",
    "all rights reserved",
    "regulatory",
    "history",
    "troubleshooting",
    "introduction",
    "contents",
    "www.",
    "http://",
    "https://",
    "becton",
    "biosciences",
    "rhapsody",
  ];

  if (ignoredTokens.some((token) => normalized.includes(token))) {
    return true;
  }

  return normalized.split(/\s+/).length > 8;
}

function isLikelyLabelText(rawText) {
  if (/[?:]$/.test(rawText)) {
    return true;
  }

  const normalized = rawText.toLowerCase();
  return /\b(name|sample|batch|operator|date|time|id|lot|run|tube|volume|count|concentration|temperature|notes?|comment|email|phone|address|city|state|country|qc|pass|fail|include|optional)\b/.test(
    normalized
  );
}

function inferFieldTypeFromLabel(label, rawText) {
  const normalized = `${label} ${rawText}`.toLowerCase();

  if (/\b(yes\/no|yes no|include|optional|enable|check|confirm|approved|pass|fail|present|absent)\b/.test(normalized)) {
    return "checkbox";
  }

  if (/\b(count|number|qty|quantity|volume|vol|concentration|conc|age|hours?|mins?|minutes?|temperature|temp|percent|%)\b/.test(normalized)) {
    return "number";
  }

  return "text";
}

function scoreSuggestionText(rawText, labelLike, type, textWidth, textHeight) {
  let score = 0;
  const normalized = rawText.toLowerCase();

  if (labelLike) {
    score += 10;
  }

  if (type === "number") {
    score += 4;
  }

  if (type === "checkbox") {
    score += 3;
  }

  if (normalized.length >= 5 && normalized.length <= 36) {
    score += 3;
  }

  if (textWidth > 28 && textWidth < 320) {
    score += 2;
  }

  if (textHeight > 8 && textHeight < 40) {
    score += 2;
  }

  if (normalized.split(/\s+/).length > 5) {
    score -= 4;
  }

  if (/[;,.]{2,}/.test(rawText)) {
    score -= 4;
  }

  if (/[A-Z]{3,}/.test(rawText) && rawText.length > 24) {
    score -= 2;
  }

  return score;
}

function hasSimilarFieldOnPage(pageNumber, xPct, yPct, wPct = 0, hPct = 0, keyBase = "") {
  return state.pdfLab.fields.some((field) => {
    if (field.pageNumber !== pageNumber) {
      return false;
    }

    if (keyBase && field.key === keyBase) {
      return true;
    }

    const dx = Math.abs(field.xPct - xPct);
    const dy = Math.abs(field.yPct - yPct);
    const dw = Math.abs((field.wPct || 0) - wPct);
    const dh = Math.abs((field.hPct || 0) - hPct);
    return dx < 0.028 && dy < 0.022 && dw < 0.1 && dh < 0.08;
  });
}

function sanitizeFieldKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function ensureUniqueFieldKey(baseKey, currentFieldId) {
  const used = new Set(
    state.pdfLab.fields
      .filter((field) => !currentFieldId || field.id !== currentFieldId)
      .map((field) => field.key)
  );

  if (!used.has(baseKey)) {
    return baseKey;
  }

  let index = 2;
  while (used.has(`${baseKey}_${index}`)) {
    index += 1;
  }
  return `${baseKey}_${index}`;
}

async function publishPdfTemplateToMarketplace() {
  const pdfDoc = state.pdfLab.pdfDoc;
  if (!pdfDoc) {
    setPdfStatus("Upload a PDF before publishing.", true);
    return;
  }

  setPdfStatus("Generating template pages and publishing to marketplace...");

  try {
    const pageImages = await buildPdfPageImages();
    const protocol = buildProtocolFromPdfLab(pageImages);

    protocolCatalog.unshift(protocol);
    protocolById[protocol.id] = protocol;
    rebuildProtocolCatalogOrder();
    syncMarketplaceDensity();

    renderCatalog();
    selectProtocol(protocol.id);
    loadProtocol(protocol.id);
    setOverlayState("pdf-lab", false);
    setStatus(`Imported template ${protocol.label} is ready in your workspace.`);
  } catch (error) {
    setPdfStatus(`Could not publish template: ${error.message}`, true);
  }
}

async function buildPdfPageImages() {
  const pdfDoc = state.pdfLab.pdfDoc;
  const pageCount = Math.min(pdfDoc.numPages, 12);
  const images = [];

  for (let index = 1; index <= pageCount; index += 1) {
    setPdfStatus(`Rendering page ${index} / ${pageCount}...`);
    const page = await pdfDoc.getPage(index);
    const viewport = page.getViewport({ scale: 1.35 });

    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);

    const context = canvas.getContext("2d", { alpha: false });
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);

    await page.render({ canvasContext: context, viewport }).promise;
    images.push(canvas.toDataURL("image/jpeg", 0.92));
  }

  return images;
}

function buildProtocolFromPdfLab(pageImages) {
  const fileName = state.pdfLab.fileName || "Imported PDF";
  const labelBase = fileName.replace(/\.pdf$/i, "").replace(/[_-]+/g, " ").trim();
  const label = labelBase || "Imported PDF Template";

  const protocolId = `pdf_import_${Date.now()}`;
  const editableFields = state.pdfLab.fields.filter((field) => field.editable);

  const parameters = editableFields.map((field) => {
    if (field.type === "checkbox") {
      return {
        key: field.key,
        label: field.label,
        type: "checkbox",
      };
    }

    if (field.type === "number") {
      return {
        key: field.key,
        label: field.label,
        type: "number",
        step: 0.01,
      };
    }

    return {
      key: field.key,
      label: field.label,
      type: "text",
    };
  });

  const defaults = Object.fromEntries(
    editableFields.map((field) => [
      field.key,
      field.type === "checkbox"
        ? toBoolean(field.defaultValue)
        : field.defaultValue === undefined
          ? ""
          : String(field.defaultValue),
    ])
  );

  const allFields = state.pdfLab.fields.map((field) => ({ ...field }));
  const templateHtml = buildImportedTemplateHtml(label, pageImages, allFields);

  return {
    id: protocolId,
    label,
    source: "internal",
    owner: "Imported PDF",
    version: "draft",
    availability: "ready",
    description:
      "Template generated from uploaded PDF. Editable regions were configured in the visual PDF Import Lab.",
    tags: ["PDF Import", "Custom", "Interactive"],
    inlineTemplate: templateHtml,
    marketPreviewHtml() {
      return createImagePreviewHtml(label, pageImages[0]);
    },
    parameters,
    defaults,
    normalize(values) {
      const normalized = {};
      editableFields.forEach((field) => {
        const value = values[field.key];
        if (field.type === "checkbox") {
          normalized[field.key] = Boolean(value);
          return;
        }

        if (field.type === "number") {
          const parsed = Number.parseFloat(value);
          normalized[field.key] = Number.isFinite(parsed)
            ? parsed
            : Number.parseFloat(field.defaultValue || "0") || 0;
          return;
        }

        normalized[field.key] = value === undefined || value === null ? "" : String(value);
      });
      return normalized;
    },
    updateSummary(values) {
      const editableCount = editableFields.length;
      const lockedCount = allFields.length - editableCount;
      const preview = editableFields
        .slice(0, 2)
        .map((field) => `${field.label}: ${formatSummaryValue(values[field.key])}`)
        .join(" | ");

      setSummary("Imported Template Summary", [
        `${editableCount} editable field${editableCount === 1 ? "" : "s"} · ${lockedCount} locked field${lockedCount === 1 ? "" : "s"}`,
        preview || "No editable fields configured.",
        `Pages imported: ${pageImages.length}`,
      ]);
    },
    applyRules(doc, values) {
      allFields.forEach((field) => {
        const selector = `[data-field-key="${escapeCssSelector(field.key)}"]`;
        doc.querySelectorAll(selector).forEach((node) => {
          const value = field.editable ? values[field.key] : field.defaultValue;
          node.textContent = formatImportedFieldValue(field, value);
          node.classList.toggle("is-locked", !field.editable);
        });
      });

      const note = doc.getElementById("template-source-note");
      if (note) {
        note.textContent = `Generated from ${fileName}`;
      }
    },
  };
}

function buildImportedTemplateHtml(label, pageImages, fields) {
  const pages = pageImages
    .map((image, index) => {
      const pageNumber = index + 1;
      const slots = fields
        .filter((field) => field.pageNumber === pageNumber)
        .map((field) => {
          const safeValue = escapeHtml(
            field.defaultValue === undefined || field.defaultValue === null || String(field.defaultValue) === ""
              ? field.label
              : String(field.defaultValue)
          );
          const safeKey = escapeAttribute(field.key);
          const lockClass = field.editable ? "" : " is-locked";
          return [
            `<div class="pdf-slot${lockClass}"`,
            ` data-field-key="${safeKey}"`,
            ` style="left:${(field.xPct * 100).toFixed(4)}%;`,
            ` top:${(field.yPct * 100).toFixed(4)}%;`,
            ` width:${(field.wPct * 100).toFixed(4)}%;`,
            ` height:${(field.hPct * 100).toFixed(4)}%;">`,
            `${safeValue}</div>`,
          ].join("");
        })
        .join("\n");

      return [
        `<section class="pdf-page" data-page="${pageNumber}">`,
        `  <img class="pdf-page-image" src="${image}" alt="PDF page ${pageNumber}" />`,
        "  <div class=\"pdf-page-layer\">",
        slots,
        "  </div>",
        "</section>",
      ].join("\n");
    })
    .join("\n");

  return [
    "<!doctype html>",
    "<html lang=\"en\">",
    "<head>",
    "  <meta charset=\"utf-8\" />",
    "  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />",
    `  <title>${escapeHtml(label)}</title>`,
    "  <style>",
    "    :root { color-scheme: light; }",
    "    * { box-sizing: border-box; }",
    "    html, body { margin: 0; padding: 0; background: #d8e0ec; font-family: 'Avenir Next', 'Segoe UI', sans-serif; }",
    "    main { display: grid; gap: 18px; padding: 18px 10px 24px; justify-items: center; }",
    "    .pdf-page { position: relative; width: min(100%, 1020px); border: 1px solid #d2dceb; border-radius: 14px; overflow: hidden; background: #fff; box-shadow: 0 10px 26px rgba(18, 36, 63, 0.2); }",
    "    .pdf-page-image { width: 100%; display: block; }",
    "    .pdf-page-layer { position: absolute; inset: 0; }",
    "    .pdf-slot { position: absolute; border: 1px dashed rgba(13, 102, 230, 0.5); border-radius: 6px; background: rgba(255, 255, 255, 0.64); color: #10203a; padding: 2px 4px; font-size: clamp(11px, 1.2vw, 13px); line-height: 1.2; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }",
    "    .pdf-slot.is-locked { border-color: rgba(191, 129, 47, 0.55); background: rgba(255, 245, 231, 0.68); }",
    "    .template-note { position: fixed; right: 12px; bottom: 12px; border-radius: 999px; border: 1px solid #ced7e9; background: rgba(255, 255, 255, 0.92); padding: 6px 10px; color: #3b5476; font-size: 11px; }",
    "    @media print {",
    "      @page { size: auto; margin: 0; }",
    "      html, body { background: #ffffff; }",
    "      main { gap: 0; padding: 0; }",
    "      .pdf-page { border: 0; border-radius: 0; box-shadow: none; break-after: page; page-break-after: always; }",
    "      .pdf-page:last-child { break-after: auto; page-break-after: auto; }",
    "      .template-note { display: none; }",
    "    }",
    "  </style>",
    "</head>",
    "<body>",
    "  <main>",
    pages,
    "  </main>",
    "  <div id=\"template-source-note\" class=\"template-note\">Generated from uploaded PDF</div>",
    "</body>",
    "</html>",
  ].join("\n");
}

function formatImportedFieldValue(field, value) {
  if (field.type === "checkbox") {
    return toBoolean(value) ? "Yes" : "No";
  }

  if (field.type === "number") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? String(parsed) : String(field.defaultValue || "0");
  }

  return value === undefined || value === null ? "" : String(value);
}

function toBoolean(value) {
  if (typeof value === "boolean") {
    return value;
  }
  const normalized = String(value || "").trim().toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "yes" || normalized === "on";
}

function createImagePreviewHtml(label, imageDataUrl) {
  return [
    "<!doctype html>",
    "<html lang=\"en\">",
    "<head>",
    "  <meta charset=\"utf-8\" />",
    "  <style>",
    "    html, body { margin: 0; height: 100%; }",
    "    body { display: grid; place-items: center; background: linear-gradient(145deg, #f3f7ff, #ebf1ff); font-family: 'Avenir Next', sans-serif; }",
    "    .frame { width: calc(100% - 18px); height: calc(100% - 18px); margin: 9px; border: 1px solid #ced7e9; border-radius: 10px; overflow: hidden; background: #fff; display: grid; grid-template-rows: auto 1fr; }",
    "    .head { padding: 6px 8px; font-size: 10px; color: #294a77; border-bottom: 1px solid #dde5f4; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }",
    "    img { width: 100%; height: 100%; object-fit: cover; display: block; }",
    "  </style>",
    "</head>",
    "<body>",
    "  <div class=\"frame\">",
    `    <div class=\"head\">${escapeHtml(label)}</div>`,
    `    <img src=\"${imageDataUrl}\" alt=\"Template preview\" />`,
    "  </div>",
    "</body>",
    "</html>",
  ].join("\n");
}

function createDefaultPreviewHtml(label) {
  const previewTitle = String(label || "Template Preview").trim();

  return [
    "<!doctype html>",
    "<html lang=\"en\">",
    "<head>",
    "  <meta charset=\"utf-8\" />",
    "  <style>",
    "    html, body { margin: 0; height: 100%; }",
    "    body { display: grid; place-items: center; background: linear-gradient(150deg, #edf4ff, #f8fbff); font-family: 'Avenir Next', sans-serif; color: #173b68; }",
    "    .sheet { width: 86%; height: 86%; border-radius: 12px; border: 1px solid #d1def4; background: #ffffff; box-shadow: 0 8px 20px rgba(23, 56, 98, 0.12); padding: 10px; display: grid; grid-template-rows: auto 1fr; gap: 8px; }",
    "    .title { font-size: 11px; font-weight: 700; line-height: 1.2; padding-top: 1px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }",
    "    .blocks { display: grid; gap: 8px; align-content: start; }",
    "    .block { border-radius: 8px; background: linear-gradient(145deg, #f4f8ff, #ecf2fd); border: 1px solid #dbe5f7; height: 22px; }",
    "    .block.short { width: 55%; }",
    "  </style>",
    "</head>",
    "<body>",
    "  <div class=\"sheet\">",
    `    <div class=\"title\">${escapeHtml(previewTitle)}</div>`,
    "    <div class=\"blocks\">",
    "      <div class=\"block\"></div>",
    "      <div class=\"block\"></div>",
    "      <div class=\"block short\"></div>",
    "      <div class=\"block\"></div>",
    "      <div class=\"block short\"></div>",
    "    </div>",
    "  </div>",
    "</body>",
    "</html>",
  ].join("\n");
}

function createPlannedPreviewHtml(label) {
  return [
    "<!doctype html>",
    "<html lang=\"en\">",
    "<head>",
    "  <meta charset=\"utf-8\" />",
    "  <style>",
    "    html, body { margin: 0; height: 100%; }",
    "    body { display: grid; place-items: center; background: linear-gradient(135deg, #fff6e8, #ffe7cb); font-family: 'Avenir Next', sans-serif; }",
    "    .coming { width: 86%; height: 86%; border-radius: 12px; border: 1px dashed #e6bc83; background: rgba(255, 255, 255, 0.82); display: grid; place-items: center; text-align: center; padding: 10px; color: #8d5f18; }",
    "    .coming h4 { margin: 0; font-size: 12px; }",
    "    .coming p { margin: 6px 0 0; font-size: 10px; }",
    "  </style>",
    "</head>",
    "<body>",
    "  <div class=\"coming\">",
    `    <div><h4>${escapeHtml(label)}</h4><p>Template is planned and not yet published.</p></div>`,
    "  </div>",
    "</body>",
    "</html>",
  ].join("\n");
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/`/g, "&#96;");
}

function escapeCssSelector(value) {
  return String(value).replace(/[^a-zA-Z0-9_-]/g, "\\$&");
}

function createProtocolCatalog() {
  return [
    {
      id: "abseq",
      label: "BD AbSeq (1-40 plex)",
      source: "official",
      owner: "Scomix",
      version: "v2.0",
      availability: "ready",
      description:
        "High-fidelity AbSeq protocol with conditional MasterMix math and optional section masking.",
      tags: ["AbSeq", "Official", "High-fidelity", "RUO"],
      templateFile: "protocol_hifi.html",
      marketPreviewHtml() {
        return createDefaultPreviewHtml("BD AbSeq High-Fidelity Template");
      },
      parameters: [
        {
          key: "panelType",
          label: "Panel type",
          type: "select",
          options: [
            { value: "10", label: "10-plex" },
            { value: "20", label: "20-plex" },
            { value: "40", label: "40-plex" },
            { value: "custom", label: "Custom (1-40)" },
          ],
        },
        {
          key: "antibodyCount",
          label: "Number of antibodies (N)",
          type: "number",
          min: 1,
          max: 40,
          step: 1,
          hint: "Drives BD Stain Buffer math: 100-2N / 130-2.6N / 260-5.2N uL.",
        },
        {
          key: "includeFcBlock",
          label: "Include optional Fc Block step",
          type: "checkbox",
        },
        {
          key: "lowAbundance",
          label: "Low-abundance sample (<20,000)",
          type: "checkbox",
        },
        {
          key: "rbcContamination",
          label: "Sample with red blood cell contamination",
          type: "checkbox",
        },
      ],
      defaults: {
        panelType: "20",
        antibodyCount: 20,
        includeFcBlock: true,
        lowAbundance: false,
        rbcContamination: false,
      },
      syncUi(values, controls) {
        if (!controls.panelType || !controls.antibodyCount) {
          return;
        }

        if (values.panelType === "custom") {
          controls.antibodyCount.disabled = false;
          return;
        }

        values.antibodyCount = String(values.panelType);
        controls.antibodyCount.value = String(values.panelType);
        controls.antibodyCount.disabled = true;
      },
      normalize(values) {
        const panelType = values.panelType || "20";
        let antibodyCount = Number.parseInt(values.antibodyCount, 10);

        if (panelType !== "custom") {
          antibodyCount = Number.parseInt(panelType, 10);
        }

        antibodyCount = clamp(antibodyCount, 1, 40);

        return {
          panelType,
          antibodyCount,
          includeFcBlock: Boolean(values.includeFcBlock),
          lowAbundance: Boolean(values.lowAbundance),
          rbcContamination: Boolean(values.rbcContamination),
        };
      },
      updateSummary(values) {
        const n = values.antibodyCount;
        const v1 = Math.max(0, 100 - 2.0 * n);
        const v2 = Math.max(0, 130 - 2.6 * n);
        const v3 = Math.max(0, 260 - 5.2 * n);

        setSummary("Calculated MasterMix", [
          `N = ${n} antibodies`,
          `BD Stain Buffer: ${toFixed1(v1)} / ${toFixed1(v2)} / ${toFixed1(v3)} uL`,
          "Column totals: 100.0 / 130.0 / 260.0 uL",
        ]);
      },
      applyRules(doc, values) {
        applyReferenceNotice(doc, "23-24262(01)");

        const page4 = getPageSvg(doc, 4);
        const page5 = getPageSvg(doc, 5);
        const page6 = getPageSvg(doc, 6);
        const page7 = getPageSvg(doc, 7);

        if (!page5 || !page6 || !page7 || !page4) {
          throw new Error("Not all expected pages were found in the base HTML.");
        }

        applyMasterMixCalculations(page5, values.antibodyCount);
        applyFcBlockToggle(page6, values.includeFcBlock);
        applyLowAbundanceToggle(page7, values.lowAbundance);
        applyRbcToggle(page4, values.rbcContamination);
      },
    },
    {
      id: "internal-run-sheet",
      label: "Sample Processing Run Sheet",
      source: "internal",
      owner: "Internal Lab Operations",
      version: "v1.1",
      availability: "ready",
      description:
        "Internal operational run sheet. Lightweight template for quick process customization.",
      tags: ["Internal", "Operations", "Starter"],
      inlineTemplate: createInternalRunSheetTemplate,
      marketPreviewHtml() {
        return createDefaultPreviewHtml("Internal Run Sheet");
      },
      parameters: [
        {
          key: "operatorName",
          label: "Operator name",
          type: "text",
          hint: "Displayed in run metadata.",
        },
        {
          key: "batchCode",
          label: "Batch code",
          type: "text",
        },
        {
          key: "sampleCount",
          label: "Number of samples",
          type: "number",
          min: 1,
          max: 96,
          step: 1,
        },
        {
          key: "incubationMinutes",
          label: "Incubation time (minutes)",
          type: "number",
          min: 1,
          max: 180,
          step: 1,
        },
        {
          key: "includeSterilityCheck",
          label: "Include sterility checkpoint",
          type: "checkbox",
        },
      ],
      defaults: {
        operatorName: "",
        batchCode: "INT-0001",
        sampleCount: 24,
        incubationMinutes: 30,
        includeSterilityCheck: true,
      },
      normalize(values) {
        return {
          operatorName: String(values.operatorName || "").trim(),
          batchCode: String(values.batchCode || "INT-0001").trim() || "INT-0001",
          sampleCount: clamp(Number.parseInt(values.sampleCount, 10), 1, 96),
          incubationMinutes: clamp(Number.parseInt(values.incubationMinutes, 10), 1, 180),
          includeSterilityCheck: Boolean(values.includeSterilityCheck),
        };
      },
      updateSummary(values) {
        const loadLabel = values.sampleCount > 48 ? "High" : "Standard";
        setSummary("Run Sheet Overview", [
          `Batch ${values.batchCode} · ${values.sampleCount} samples (${loadLabel} load)`,
          `Operator: ${values.operatorName || "Unassigned"}`,
          `Incubation: ${values.incubationMinutes} min`,
        ]);
      },
      applyRules(doc, values) {
        setTextContent(doc, "slot-protocol-name", "Internal Sample Processing");
        setTextContent(doc, "slot-owner", "Internal Lab Operations");
        setTextContent(doc, "slot-operator", values.operatorName || "Unassigned");
        setTextContent(doc, "slot-batch", values.batchCode);
        setTextContent(doc, "slot-samples", String(values.sampleCount));
        setTextContent(doc, "slot-incubation", `${values.incubationMinutes} min`);
        setTextContent(doc, "slot-load-level", values.sampleCount > 48 ? "High throughput" : "Standard throughput");

        const sterilityRow = doc.getElementById("sterility-row");
        if (sterilityRow) {
          sterilityRow.style.display = values.includeSterilityCheck ? "" : "none";
        }

        setTextContent(doc, "slot-generated", `Generated ${new Date().toLocaleString()}`);
      },
    },
    {
      id: "scomix-cite-seq-plus",
      label: "Scomix CITE-Seq Plus",
      source: "official",
      owner: "Scomix",
      version: "planned",
      availability: "planned",
      description:
        "Official CITE-Seq workflow entry. Marketplace slot ready for upcoming release package.",
      tags: ["CITE-Seq", "Official", "Coming soon"],
      parameters: [],
      defaults: {},
      marketPreviewHtml() {
        return createPlannedPreviewHtml("Scomix CITE-Seq Plus");
      },
    },
    {
      id: "internal-immune-monitor",
      label: "Immune Monitor Pilot",
      source: "internal",
      owner: "Internal Translational Team",
      version: "planned",
      availability: "planned",
      description:
        "Internal pilot workflow with custom checkpoints. Ready to be activated when protocol package arrives.",
      tags: ["Internal", "Pilot", "Coming soon"],
      parameters: [],
      defaults: {},
      marketPreviewHtml() {
        return createPlannedPreviewHtml("Immune Monitor Pilot");
      },
    },
  ];
}

function createInternalRunSheetTemplate() {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Internal Sample Processing Run Sheet</title>
  <style>
    :root {
      color-scheme: light;
      --ink: #182b45;
      --muted: #526685;
      --accent: #0f63df;
      --line: #d4deee;
      --panel: #f6f9ff;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Avenir Next", "IBM Plex Sans", "Segoe UI", sans-serif;
      color: var(--ink);
      background: #edf2fb;
      padding: 24px;
    }
    main {
      max-width: 960px;
      margin: 0 auto;
      background: #fff;
      border: 1px solid var(--line);
      border-radius: 16px;
      padding: 22px;
      box-shadow: 0 12px 26px rgba(19, 38, 70, 0.12);
    }
    .kicker {
      margin: 0;
      color: var(--accent);
      text-transform: uppercase;
      letter-spacing: 0.08em;
      font-size: 12px;
      font-weight: 700;
    }
    h1 {
      margin: 8px 0 6px;
      font-size: 1.9rem;
      letter-spacing: -0.02em;
    }
    .sub {
      margin: 0;
      color: var(--muted);
      font-size: 0.95rem;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
      margin-top: 18px;
    }
    .card {
      border: 1px solid var(--line);
      border-radius: 12px;
      background: var(--panel);
      padding: 12px;
    }
    .card h2 {
      margin: 0 0 10px;
      font-size: 0.98rem;
    }
    dl {
      margin: 0;
      display: grid;
      grid-template-columns: 130px 1fr;
      gap: 6px 8px;
      font-size: 0.9rem;
    }
    dt { color: var(--muted); font-weight: 600; }
    dd { margin: 0; font-weight: 600; }
    ul {
      margin: 0;
      padding-left: 18px;
      display: grid;
      gap: 6px;
      font-size: 0.9rem;
    }
    .badge {
      margin-top: 10px;
      display: inline-block;
      border-radius: 999px;
      border: 1px solid #bdd2f4;
      background: #dbe8ff;
      color: #16468f;
      padding: 5px 10px;
      font-size: 0.78rem;
      font-weight: 700;
    }
    footer {
      margin-top: 18px;
      color: #627493;
      font-size: 0.82rem;
    }
    @media print {
      body { background: #fff; padding: 0; }
      main { box-shadow: none; }
    }
    @media (max-width: 760px) {
      .grid { grid-template-columns: 1fr; }
      dl { grid-template-columns: 110px 1fr; }
    }
  </style>
</head>
<body>
  <main>
    <p class="kicker">Internal Protocol Blueprint</p>
    <h1 id="slot-protocol-name">Internal Sample Processing</h1>
    <p class="sub">Owner: <span id="slot-owner">Internal Lab Operations</span></p>

    <section class="grid">
      <article class="card">
        <h2>Run Metadata</h2>
        <dl>
          <dt>Operator</dt>
          <dd id="slot-operator">Unassigned</dd>
          <dt>Batch</dt>
          <dd id="slot-batch">INT-0001</dd>
          <dt>Samples</dt>
          <dd id="slot-samples">24</dd>
          <dt>Incubation</dt>
          <dd id="slot-incubation">30 min</dd>
        </dl>
        <span id="slot-load-level" class="badge">Standard throughput</span>
      </article>

      <article class="card">
        <h2>Checkpoints</h2>
        <ul>
          <li>Confirm sample intake and identifiers.</li>
          <li>Prepare reagents and verify lot numbers.</li>
          <li id="sterility-row">Run sterility checkpoint before incubation.</li>
          <li>Record completion time and export run summary.</li>
        </ul>
      </article>
    </section>

    <footer id="slot-generated">Generated by Protocol Studio</footer>
  </main>
</body>
</html>`;
}

function setTextContent(doc, id, value) {
  const node = doc.getElementById(id);
  if (!node) {
    return;
  }
  node.textContent = value;
}

const STUDIO_OVERLAY_ATTR = "data-studio-overlay";

// Centralized AbSeq SVG regions. Coordinates are in the embedded SVG's native
// space and were measured directly against the vectorized PDF. When the base
// template changes, adjust these values (ideally only here).
const ABSEQ_COORDS = {
  referenceNotice: {
    page: 1,
    cover: { x: 72, y: 694, width: 220, height: 31 },
    text: { x: 76, y: 710, fontSize: 8, fontWeight: "500" },
  },
  masterMix: {
    page: 5,
    // addPdfText uses a matrix(.75 0 -0 .75 0 792) transform, so the tspan y
    // is expressed as a negative number in that rotated/scaled space.
    columnTransformY: -478.96,
    columns: [
      { cover: { x: 221, y: 423, width: 63, height: 13 }, textX: 291 },
      { cover: { x: 293, y: 423, width: 66, height: 13 }, textX: 387 },
      { cover: { x: 415, y: 423, width: 80, height: 13 }, textX: 555 },
    ],
  },
  fcBlock: {
    page: 6,
    cover: { x: 72, y: 112, width: 468, height: 266 },
  },
  lowAbundance: {
    page: 7,
    cover: { x: 72, y: 337, width: 468, height: 42 },
  },
  rbcContamination: {
    page: 4,
    cover: { x: 72, y: 654, width: 468, height: 24 },
  },
};

// Remove any overlay nodes previously injected by applyRules. Called before
// re-applying rules so the same iframe can be reused across parameter changes.
function clearStudioOverlays(doc) {
  if (!doc) return;
  doc.querySelectorAll(`[${STUDIO_OVERLAY_ATTR}]`).forEach((node) => node.remove());
}

function applyReferenceNotice(doc, referenceCode) {
  const svg = getPageSvg(doc, ABSEQ_COORDS.referenceNotice.page);
  if (!svg) return;

  addCoverRect(svg, ABSEQ_COORDS.referenceNotice.cover);
  addSvgText(svg, {
    ...ABSEQ_COORDS.referenceNotice.text,
    text: `Protocol generated using ${referenceCode} as reference.`,
  });
}

function applyMasterMixCalculations(page5Svg, n) {
  const { columns, columnTransformY } = ABSEQ_COORDS.masterMix;
  const values = [
    Math.max(0, 100 - 2.0 * n),
    Math.max(0, 130 - 2.6 * n),
    Math.max(0, 260 - 5.2 * n),
  ];

  columns.forEach((col, idx) => {
    addCoverRect(page5Svg, col.cover);
    addPdfText(page5Svg, {
      x: col.textX,
      y: columnTransformY,
      text: toFixed1(values[idx]),
    });
  });
}

function applyFcBlockToggle(page6Svg, includeFcBlock) {
  if (includeFcBlock) return;
  addCoverRect(page6Svg, ABSEQ_COORDS.fcBlock.cover);
}

function applyLowAbundanceToggle(page7Svg, lowAbundance) {
  if (lowAbundance) return;
  addCoverRect(page7Svg, ABSEQ_COORDS.lowAbundance.cover);
}

function applyRbcToggle(page4Svg, rbcContamination) {
  if (rbcContamination) return;
  addCoverRect(page4Svg, ABSEQ_COORDS.rbcContamination.cover);
}

function markOverlay(node) {
  node.setAttribute(STUDIO_OVERLAY_ATTR, "true");
  return node;
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
  svg.querySelector("g").appendChild(markOverlay(textEl));
}

function addCoverRect(svg, input) {
  const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  // Apply a tiny bleed to avoid anti-aliasing seams around covered text.
  const bleed = Number.isFinite(input.bleed) ? input.bleed : 1;
  rect.setAttribute("x", String(input.x - bleed));
  rect.setAttribute("y", String(input.y - bleed));
  rect.setAttribute("width", String(input.width + bleed * 2));
  rect.setAttribute("height", String(input.height + bleed * 2));
  rect.setAttribute("fill", "#ffffff");
  rect.setAttribute("shape-rendering", "crispEdges");
  svg.querySelector("g").appendChild(markOverlay(rect));
}

function addSvgText(svg, input) {
  const textEl = document.createElementNS("http://www.w3.org/2000/svg", "text");
  textEl.setAttribute("x", String(input.x));
  textEl.setAttribute("y", String(input.y));
  textEl.setAttribute("font-size", String(input.fontSize || 8));
  textEl.setAttribute("font-family", "Helvetica, Arial, sans-serif");
  textEl.setAttribute("font-weight", input.fontWeight || "500");
  textEl.setAttribute("fill", "#111111");
  textEl.textContent = input.text;
  svg.querySelector("g").appendChild(markOverlay(textEl));
}

function getPageSvg(doc, pageNumber) {
  return doc.querySelector(`section.page[data-page="${pageNumber}"] svg`);
}

function toFixed1(value) {
  return Number.parseFloat(value).toFixed(1);
}

function clamp(value, min, max) {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.min(max, Math.max(min, value));
}


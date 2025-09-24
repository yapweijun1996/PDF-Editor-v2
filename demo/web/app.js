/*
 * Minimal PDF editor demo, reusing existing PDF.js viewer logic.
 * - ESM, 2-space indent, semicolons.
 */

import {
  getDocument,
  GlobalWorkerOptions,
  AnnotationEditorType,
  AnnotationMode,
} from "pdfjs-lib";
import { EventBus } from "../../web/event_utils.js";
import { PDFViewer } from "../../web/pdf_viewer.js";
import { SimpleLinkService } from "../../web/pdf_link_service.js";
import { DownloadManager } from "../../web/download_manager.js";
import { GenericL10n } from "web-null_l10n";

const DEFAULT_URL = "../web/compressed.tracemonkey-pldi-09.pdf";
const CMAP_URL = "../external/bcmaps/";
const STANDARD_FONTS_URL = "../external/standard_fonts/";

// Worker (ESM)
GlobalWorkerOptions.workerSrc = "../src/pdf.worker.js";

const ui = {
  fileInput: document.getElementById("fileInput"),
  openBtn: document.getElementById("openBtn"),
  saveBtn: document.getElementById("saveBtn"),
  zoomIn: document.getElementById("zoomIn"),
  zoomOut: document.getElementById("zoomOut"),
  prevPage: document.getElementById("prevPage"),
  nextPage: document.getElementById("nextPage"),
  pageNumber: document.getElementById("pageNumber"),
  numPages: document.getElementById("numPages"),
  modeSelect: document.getElementById("modeSelect"),
  modeFreeText: document.getElementById("modeFreeText"),
  modeHighlight: document.getElementById("modeHighlight"),
  modeInk: document.getElementById("modeInk"),
  modeStamp: document.getElementById("modeStamp"),
  modeSignature: document.getElementById("modeSignature"),
  viewerContainer: document.getElementById("viewerContainer"),
  viewer: document.getElementById("viewer"),
};

// Core services
const eventBus = new EventBus();
const l10n = new GenericL10n();
const linkService = new SimpleLinkService();
const downloadManager = new DownloadManager();

const viewer = new PDFViewer({
  container: ui.viewerContainer,
  viewer: ui.viewer,
  eventBus,
  linkService,
  l10n,
  textLayerMode: 1,
  annotationMode: AnnotationMode.ENABLE_FORMS,
  annotationEditorMode: AnnotationEditorType.NONE,
  imageResourcesPath: "../web/images/",
});
linkService.setViewer(viewer);

let pdfDoc = null;
let loadingTask = null;
let currentUrl = null;
let currentFileName = "document.pdf";

function setButtonsPressed(targetId) {
  const ids = [
    "modeSelect",
    "modeFreeText",
    "modeHighlight",
    "modeInk",
    "modeStamp",
    "modeSignature",
  ];
  for (const id of ids) {
    const btn = document.getElementById(id);
    if (!btn) continue;
    btn.setAttribute("aria-pressed", String(id === targetId));
  }
}

function setEditorMode(mode) {
  if (!pdfDoc) return;
  if (mode === null) {
    viewer.annotationEditorMode = { mode: AnnotationEditorType.NONE };
    setButtonsPressed("modeSelect");
    return;
  }
  viewer.annotationEditorMode = { mode };
}

async function openPdfFromData(data, name = "document.pdf") {
  if (loadingTask) {
    try { await loadingTask.destroy(); } catch {}
    loadingTask = null;
  }

  loadingTask = getDocument({
    data,
    cMapUrl: CMAP_URL,
    cMapPacked: true,
    standardFontDataUrl: STANDARD_FONTS_URL,
    worker: null,
  });

  bindLoadingTask(loadingTask, name, null);
}

async function openPdfFromUrl(url) {
  if (loadingTask) {
    try { await loadingTask.destroy(); } catch {}
    loadingTask = null;
  }

  loadingTask = getDocument({
    url,
    cMapUrl: CMAP_URL,
    cMapPacked: true,
    standardFontDataUrl: STANDARD_FONTS_URL,
    worker: null,
    withCredentials: false,
  });

  const name = url.split("/").pop() || "document.pdf";
  bindLoadingTask(loadingTask, name, url);
}

function bindLoadingTask(task, name, url) {
  currentUrl = url;
  currentFileName = name;

  task.onProgress = ({ loaded, total }) => {
    // 可选：可以显示进度条，这里保持简洁
  };

  task.promise
    .then(async doc => {
      pdfDoc = doc;
      viewer.setDocument(pdfDoc);
      linkService.setDocument(pdfDoc, null);
      ui.numPages.textContent = String(pdfDoc.numPages);
      ui.pageNumber.value = String(1);
      viewer.currentScaleValue = "page-width";
      setEditorMode(null); // 初始为选择模式
    })
    .catch(err => {
      console.error("加载 PDF 失败:", err);
      alert("加载 PDF 失败: " + (err?.message || String(err)));
    });
}

function getCurrentPageNumber() {
  return viewer.currentPageNumber || 1;
}

function setCurrentPageNumber(num) {
  const n = Math.min(Math.max(1, num | 0), pdfDoc?.numPages || 1);
  viewer.currentPageNumber = n;
  ui.pageNumber.value = String(n);
}

async function saveOrDownload() {
  if (!pdfDoc) return;
  try {
    const hasEdits = (pdfDoc.annotationStorage?.size || 0) > 0;
    if (hasEdits) {
      const data = await pdfDoc.saveDocument();
      downloadManager.download(data, currentUrl, currentFileName);
    } else {
      // 未编辑：直接下载原文件（若来自本地 data 则仍生成 blob 下载）
      try {
        const data = await (pdfDoc ? pdfDoc.getData() : loadingTask?.getData());
        downloadManager.download(data, currentUrl, currentFileName);
      } catch {
        // Fallback：若无法读取数据，则尝试按 URL 下载
        downloadManager.download(null, currentUrl, currentFileName);
      }
    }
  } catch (e) {
    console.error("保存/下载失败:", e);
    alert("保存/下载失败: " + (e?.message || String(e)));
  }
}

function hookEvents() {
  // 打开文件（input）
  ui.openBtn.addEventListener("click", () => ui.fileInput.click());
  ui.fileInput.addEventListener("change", async e => {
    const file = e.target.files?.[0];
    if (!file) return;
    const buf = await file.arrayBuffer();
    await openPdfFromData(buf, file.name || "document.pdf");
    ui.fileInput.value = "";
  });

  // 编辑模式切换
  ui.modeSelect.addEventListener("click", () => {
    setEditorMode(null);
    setButtonsPressed("modeSelect");
  });
  ui.modeFreeText.addEventListener("click", () => {
    setEditorMode(AnnotationEditorType.FREETEXT);
    setButtonsPressed("modeFreeText");
  });
  ui.modeHighlight.addEventListener("click", () => {
    setEditorMode(AnnotationEditorType.HIGHLIGHT);
    setButtonsPressed("modeHighlight");
  });
  ui.modeInk.addEventListener("click", () => {
    setEditorMode(AnnotationEditorType.INK);
    setButtonsPressed("modeInk");
  });
  ui.modeStamp.addEventListener("click", () => {
    setEditorMode(AnnotationEditorType.STAMP);
    setButtonsPressed("modeStamp");
  });
  ui.modeSignature.addEventListener("click", () => {
    setEditorMode(AnnotationEditorType.SIGNATURE);
    setButtonsPressed("modeSignature");
  });

  // 缩放
  ui.zoomIn.addEventListener("click", () => {
    viewer.currentScale = (viewer.currentScale || 1) * 1.1;
  });
  ui.zoomOut.addEventListener("click", () => {
    viewer.currentScale = (viewer.currentScale || 1) / 1.1;
  });

  // 翻页
  ui.prevPage.addEventListener("click", () => setCurrentPageNumber(getCurrentPageNumber() - 1));
  ui.nextPage.addEventListener("click", () => setCurrentPageNumber(getCurrentPageNumber() + 1));
  ui.pageNumber.addEventListener("change", () => setCurrentPageNumber(parseInt(ui.pageNumber.value, 10) || 1));

  // 保存/下载
  ui.saveBtn.addEventListener("click", saveOrDownload);

  // 初始化完成事件，用于调整默认缩放
  eventBus.on("pagesinit", () => {
    viewer.currentScaleValue = "page-width";
  });
}

async function main() {
  hookEvents();
  // 打开默认 PDF（可在此改成相对 demo/web/ 的自定义文件路径）
  await openPdfFromUrl(DEFAULT_URL);
}

main().catch(err => console.error(err));

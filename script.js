// script.js

// PDF.js worker setup
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';

const { PDFDocument, StandardFonts, rgb, PDFName, PDFNumber, PDFString } = PDFLib;

// State variables
let pdfDoc = null;           // pdf-lib document
let pdfBytes = null;         // Uint8Array of current PDF
let pdfjsDoc = null;         // PDF.js document
let history = [];            // history stack (Uint8Array snapshots)
let redoStack = [];          // redo stack
let currentPage = 1;
let totalPages = 0;
let zoomLevel = 1;
let currentViewport = null;  // PDF.js viewport for current page
const overlayContainer = document.getElementById('overlayContainer');
let annotations = []; // annotation list
let selectedAnno = null;
let dragOffset = { x: 0, y: 0 };
// Add shape drawing controls references and state
const rectBtn = document.getElementById('rectBtn');
const ellipseBtn = document.getElementById('ellipseBtn');
const highlightBtn = document.getElementById('highlightBtn');
const shapeColorInput = document.getElementById('shapeColorInput');
const borderWidthInput = document.getElementById('borderWidthInput');

let shapes = []; // list of drawn shapes
let drawMode = null; // 'rect'|'ellipse'|'highlight'
let drawing = false;
let startX = 0;
let startY = 0;
let shapePreviewEl = null;
let highlights = [];  // list of highlight annotations

// Map fontSelect value to CSS font-family
const fontMap = {
  Helvetica: 'Helvetica, Arial, sans-serif',
  TimesRoman: 'Times New Roman, Times, serif',
  Courier: 'Courier New, Courier, monospace',
};

// DOM elements
const fileInput = document.getElementById('fileInput');
const openFileBtn = document.getElementById('openFileBtn');
const dropZone = document.getElementById('dropZone');
const fileNameEl = document.getElementById('fileName');
const canvas = document.getElementById('pdfCanvas');
const ctx = canvas.getContext('2d');
const sidebar = document.getElementById('sidebar');
const firstPageBtn = document.getElementById('firstPageBtn');
const prevPageBtn = document.getElementById('prevPageBtn');
const nextPageBtn = document.getElementById('nextPageBtn');
const lastPageBtn = document.getElementById('lastPageBtn');
const pageNumberInput = document.getElementById('pageNumberInput');
const totalPagesEl = document.getElementById('totalPages');
const zoomSelect = document.getElementById('zoomSelect');
const zoomInBtn = document.getElementById('zoomInBtn');
const zoomOutBtn = document.getElementById('zoomOutBtn');
const rotateLeftBtn = document.getElementById('rotateLeftBtn');
const rotateRightBtn = document.getElementById('rotateRightBtn');
const undoBtn = document.getElementById('undoBtn');
const redoBtn = document.getElementById('redoBtn');
const downloadBtn = document.getElementById('downloadBtn');
const textInput = document.getElementById('textInput');
const fontSelect = document.getElementById('fontSelect');
const sizeInput = document.getElementById('sizeInput');
const colorInput = document.getElementById('colorInput');
const alignSelect = document.getElementById('alignSelect');
const xCoordInput = document.getElementById('xCoordInput');
const yCoordInput = document.getElementById('yCoordInput');
const uploadProgress = document.getElementById('uploadProgress');
const thumbnailContainer = document.getElementById('thumbnailContainer');
const errorMessage = document.getElementById('errorMessage');
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
const pageLoader = document.getElementById('pageLoader');
const sizeSlider = document.getElementById('sizeSlider');
const zoomSlider = document.getElementById('zoomSlider');
const textToolBtn = document.getElementById('textToolBtn');
const modeToggleBtn = document.getElementById('modeToggleBtn');
const controlsPanel = document.querySelector('.controls');
const boldBtn = document.getElementById('boldBtn');
const italicBtn = document.getElementById('italicBtn');
const toastEl = document.getElementById('toast');

let editMode = true;
let textToolActive = false;
let boldActive = false;
let italicActive = false;
let saveHandle = null;

// Update undo/redo button states
function updateUndoRedoButtons() {
  undoBtn.disabled = history.length < 2;
  redoBtn.disabled = redoStack.length === 0;
}

// Save current PDF state to history
async function pushHistory() {
  const bytes = await pdfDoc.save();
  pdfBytes = bytes;
  history.push(bytes);
  redoStack = [];
  updateUndoRedoButtons();
}

// Load a new PDF from ArrayBuffer
async function loadArrayBuffer(buffer, file) {
  // Load into pdf-lib
  pdfDoc = await PDFDocument.load(buffer);
  pdfBytes = new Uint8Array(buffer);

  // Load into PDF.js
  pdfjsDoc = await pdfjsLib.getDocument({ data: pdfBytes }).promise;
  totalPages = pdfjsDoc.numPages;
  currentPage = 1;
  zoomLevel = parseFloat(zoomSelect.value) || 1;

  // UI updates
  fileNameEl.textContent = file.name;
  pageNumberInput.min = 1;
  pageNumberInput.max = totalPages;
  totalPagesEl.textContent = totalPages;
  pageNumberInput.value = currentPage;

  // Initialize history
  history = [];
  redoStack = [];
  await pushHistory();

  // Render
  await renderPage();
  showToast(`Loaded: ${file.name}`);
  // Populate sidebar thumbnails
  await generateSidebarThumbnails();
}

// Toggle shape drawing modes
rectBtn.addEventListener('click', () => {
  drawMode = drawMode === 'rect' ? null : 'rect';
  rectBtn.classList.toggle('active', drawMode === 'rect');
  ellipseBtn.classList.remove('active');
  highlightBtn.classList.remove('active');
  overlayContainer.style.pointerEvents = drawMode ? 'auto' : 'none';
});
ellipseBtn.addEventListener('click', () => {
  drawMode = drawMode === 'ellipse' ? null : 'ellipse';
  ellipseBtn.classList.toggle('active', drawMode === 'ellipse');
  rectBtn.classList.remove('active');
  highlightBtn.classList.remove('active');
  overlayContainer.style.pointerEvents = drawMode ? 'auto' : 'none';
});
highlightBtn.addEventListener('click', () => {
  drawMode = drawMode === 'highlight' ? null : 'highlight';
  highlightBtn.classList.toggle('active', drawMode === 'highlight');
  rectBtn.classList.remove('active');
  ellipseBtn.classList.remove('active');
  overlayContainer.style.pointerEvents = drawMode ? 'auto' : 'none';
});

// Render shapes overlay
function renderShapes() {
  shapes.filter(s => s.page === currentPage).forEach(s => {
    const el = document.createElement('div');
    el.className = 'shape';
    const { xMin, yMin, xMax, yMax, color, borderWidth, mode } = s;
    const [x1Px, y1Px] = currentViewport.convertToViewportPoint(xMin, yMin);
    const [x2Px, y2Px] = currentViewport.convertToViewportPoint(xMax, yMax);
    const left = Math.min(x1Px, x2Px);
    const top = Math.min(y1Px, y2Px);
    const widthPx = Math.abs(x2Px - x1Px);
    const heightPx = Math.abs(y2Px - y1Px);
    el.style.position = 'absolute';
    el.style.left = `${left}px`;
    el.style.top = `${top}px`;
    el.style.width = `${widthPx}px`;
    el.style.height = `${heightPx}px`;
    el.style.border = `${borderWidth * zoomLevel}px solid ${color}`;
    el.style.background = 'none';
    if (mode === 'ellipse') el.style.borderRadius = '50%';
    overlayContainer.appendChild(el);
  });
}

// Render highlight annotations for current page
function renderHighlights() {
  highlights.filter(h => h.page === currentPage).forEach(h => {
    const el = document.createElement('div');
    el.className = 'highlight';
    el.dataset.id = h.id;
    el.dataset.comment = h.comment;
    el.addEventListener('dblclick', async () => {
      highlights = highlights.filter(h2 => h2.id !== h.id);
      await pushHistory();
      await renderPage();
    });
    const [x1Px, y1Px] = currentViewport.convertToViewportPoint(h.xMin, h.yMin);
    const [x2Px, y2Px] = currentViewport.convertToViewportPoint(h.xMax, h.yMax);
    const left = Math.min(x1Px, x2Px);
    const top = Math.min(y1Px, y2Px);
    const widthPx = Math.abs(x2Px - x1Px);
    const heightPx = Math.abs(y2Px - y1Px);
    el.style.left = `${left}px`;
    el.style.top = `${top}px`;
    el.style.width = `${widthPx}px`;
    el.style.height = `${heightPx}px`;
    overlayContainer.appendChild(el);
  });
}

// Update navigation buttons and page input state
function updateNavButtons() {
  if (!pdfjsDoc) {
    firstPageBtn.disabled = prevPageBtn.disabled = nextPageBtn.disabled = lastPageBtn.disabled = true;
    pageNumberInput.disabled = true;
    pageNumberInput.value = '';
    downloadBtn.disabled = true;
  } else {
    downloadBtn.disabled = false;
    pageNumberInput.disabled = false;
    firstPageBtn.disabled = currentPage <= 1;
    prevPageBtn.disabled = currentPage <= 1;
    nextPageBtn.disabled = currentPage >= totalPages;
    lastPageBtn.disabled = currentPage >= totalPages;
  }
}

// Initial navigation state
updateNavButtons();

// Override renderPage to include shapes and highlights
async function renderPage() {
  if (!pdfjsDoc) {
    return;
  }
  // Show loading spinner
  pageLoader.hidden = false;
  const page = await pdfjsDoc.getPage(currentPage);
  const viewport = page.getViewport({ scale: zoomLevel });
  currentViewport = viewport;
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const renderContext = { canvasContext: ctx, viewport };
  await page.render(renderContext).promise;
  pageNumberInput.value = currentPage;
  // Render overlay shapes, highlights, and annotations
  overlayContainer.innerHTML = '';
  overlayContainer.style.width = canvas.width + 'px';
  overlayContainer.style.height = canvas.height + 'px';
  renderShapes();
  renderHighlights();
  renderAnnotations();
  // Update navigation controls
  updateNavButtons();
  // Update sidebar selection
  updateSidebarSelection();
  // Hide loading spinner
  pageLoader.hidden = true;
}

// Render annotations for current page
function renderAnnotations() {
  annotations
    .filter(a => a.page === currentPage)
    .forEach(a => {
      const el = document.createElement('div');
      el.className = 'annotation';
      el.dataset.id = a.id;
      el.innerText = a.text;
      // Positioning and styling
      el.style.position = 'absolute';
      // Text styling
      el.style.fontFamily = fontMap[a.fontName] || fontMap.Helvetica;
      el.style.fontSize = `${a.size * zoomLevel}px`;
      el.style.fontWeight = a.bold ? 'bold' : 'normal';
      el.style.fontStyle = a.italic ? 'italic' : 'normal';
      el.style.color = a.color;
      el.style.cursor = 'move';
      el.style.pointerEvents = 'auto';
      // Highlight if selected
      if (selectedAnno && a.id === selectedAnno.id) {
        el.classList.add('selected');
      }
      // Append, then measure size
      overlayContainer.appendChild(el);
      // Convert PDF point to CSS pixel
      const [xPx, yPx] = currentViewport.convertToViewportPoint(a.x, a.y);
      const elWidth = el.offsetWidth;
      const elHeight = el.offsetHeight;
      // Calculate left offset based on alignment
      let leftPx = xPx;
      if (a.align === 'center') {
        leftPx = xPx - elWidth / 2;
      } else if (a.align === 'right') {
        leftPx = xPx - elWidth;
      }
      // Position element so its bottom aligns with baseline
      el.style.left = `${leftPx}px`;
      el.style.top = `${yPx - elHeight}px`;
      // Drag events
      el.addEventListener('mousedown', annotationMouseDown);
    });
}

// Handle file input change
fileInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  clearError();
  if (file.type !== 'application/pdf') { showError('Unsupported file type.'); return; }
  if (file.size > MAX_FILE_SIZE) { showError('File too large. Maximum size is 20 MB.'); return; }
  showProgress();
  try {
    const buffer = await readFileAsArrayBufferWithProgress(file);
    await loadArrayBuffer(buffer, file);
    generateThumbnail();
  } catch (err) {
    showError('Error reading file.');
  } finally {
    hideProgress();
  }
});

// Drag & drop handling
['dragenter','dragover','dragleave','drop'].forEach(evt => {
  dropZone.addEventListener(evt, e => {
    e.preventDefault(); e.stopPropagation();
    dropZone.classList.toggle('drop-zone--active', evt==='dragenter'||evt==='dragover');
  });
});

dropZone.addEventListener('drop', async (e) => {
  const file = e.dataTransfer.files[0];
  if (!file) return;
  clearError();
  if (file.type !== 'application/pdf') { showError('Unsupported file type.'); return; }
  if (file.size > MAX_FILE_SIZE) { showError('File too large. Maximum size is 20 MB.'); return; }
  showProgress();
  try {
    const buffer = await readFileAsArrayBufferWithProgress(file);
    await loadArrayBuffer(buffer, file);
    generateThumbnail();
  } catch (err) {
    showError('Error reading file.');
  } finally {
    hideProgress();
  }
});

// Navigation buttons
firstPageBtn.addEventListener('click', async () => { currentPage=1; await renderPage(); });
prevPageBtn.addEventListener('click', async () => { currentPage--; if(currentPage<1) currentPage=1; await renderPage(); });
nextPageBtn.addEventListener('click', async () => { currentPage++; if(currentPage>totalPages) currentPage=totalPages; await renderPage(); });
lastPageBtn.addEventListener('click', async () => { currentPage=totalPages; await renderPage(); });
pageNumberInput.addEventListener('change', async () => {
  let v = parseInt(pageNumberInput.value) || 1;
  currentPage = Math.min(Math.max(v, 1), totalPages);
  await renderPage();
});
pageNumberInput.addEventListener('keydown', e => {
  const val = parseFloat(pageNumberInput.value);
  if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && !Number.isInteger(val)) {
    e.preventDefault();
  }
});

// Zoom controls
zoomSelect.addEventListener('change', async () => {
  const val = zoomSelect.value;
  if (val === 'fit-width' || val === 'fit-page') {
    const page = await pdfjsDoc.getPage(currentPage);
    const origViewport = page.getViewport({ scale: 1 });
    const container = document.querySelector('.viewer-container');
    if (val === 'fit-width') {
      zoomLevel = container.clientWidth / origViewport.width;
    } else {
      zoomLevel = container.clientHeight / origViewport.height;
    }
  } else {
    zoomLevel = parseFloat(val) || 1;
  }
  zoomSlider.value = zoomLevel;
  zoomSelect.value = val;
  await renderPage();
});
zoomInBtn.addEventListener('click', async () => { zoomLevel*=1.25; zoomSelect.value=zoomLevel; await renderPage(); });
zoomOutBtn.addEventListener('click', async () => { zoomLevel/=1.25; zoomSelect.value=zoomLevel; await renderPage(); });

// Rotate current page
rotateLeftBtn.addEventListener('click', async () => { await rotatePage(-90); });
rotateRightBtn.addEventListener('click', async () => { await rotatePage(90); });
async function rotatePage(angle) {
  if (!pdfDoc) return;
  const page = pdfDoc.getPages()[currentPage-1];
  const curr = page.getRotation().angle || 0;
  page.setRotation({ type: 'degrees', angle: curr+angle });
  await pushHistory();
  pdfjsDoc = await pdfjsLib.getDocument({ data: pdfBytes }).promise;
  await renderPage();
}

// Click-to-place text
canvas.addEventListener('click', async (e) => {
  // Only handle left-click when text tool is active and in edit mode
  if (e.button !== 0 || !textToolActive || !editMode) return;
  if (!pdfDoc) return alert('Load a PDF first.');
  const text = textInput.value.trim();
  if (!text) return alert('Enter text to add.');
  // Convert click coords to PDF point
  const rect = canvas.getBoundingClientRect();
  const xPx = e.clientX - rect.left;
  const yPx = e.clientY - rect.top;
  const [x, y] = currentViewport.convertToPdfPoint(xPx, yPx);
  // Create annotation
  const anno = {
    id: Date.now() + '_' + Math.random(), page: currentPage,
    text, fontName: fontSelect.value, size: parseFloat(sizeInput.value),
    color: colorInput.value, align: alignSelect.value,
    bold: boldActive, italic: italicActive,
    x, y
  };
  annotations.push(anno);
  await pushHistory();
  selectedAnno = anno;
  xCoordInput.value = anno.x.toFixed(1);
  yCoordInput.value = anno.y.toFixed(1);
  renderAnnotations();
  // Clear input for next text
  textInput.value = '';
  sizeSlider.value = sizeInput.value;
});

// Drag handlers
function annotationMouseDown(e) {
  const id = e.currentTarget.dataset.id;
  selectedAnno = annotations.find(a => a.id === id);
  xCoordInput.value = selectedAnno.x.toFixed(1);
  yCoordInput.value = selectedAnno.y.toFixed(1);
  dragOffset.x = e.clientX - e.currentTarget.offsetLeft;
  dragOffset.y = e.clientY - e.currentTarget.offsetTop;
  e.currentTarget.classList.add('selected');
  document.addEventListener('mousemove', annotationMouseMove);
  document.addEventListener('mouseup', annotationMouseUp);
}
function annotationMouseMove(e) {
  if (!selectedAnno) return;
  const el = overlayContainer.querySelector(`[data-id="${selectedAnno.id}"]`);
  let left = e.clientX - dragOffset.x;
  let top = e.clientY - dragOffset.y;
  left = Math.max(0, Math.min(left, canvas.width - el.offsetWidth));
  top = Math.max(0, Math.min(top, canvas.height - el.offsetHeight));
  el.style.left = `${left}px`;
  el.style.top = `${top}px`;
  // Convert CSS pixel baseline to PDF point
  const h = el.offsetHeight;
  const baselinePx = top + h;
  const [xPdf, yPdf] = currentViewport.convertToPdfPoint(left, baselinePx);
  selectedAnno.x = xPdf;
  selectedAnno.y = yPdf;
  document.getElementById('xCoordInput').value = xPdf.toFixed(2);
  document.getElementById('yCoordInput').value = yPdf.toFixed(2);
}
function annotationMouseUp(e) {
  // Stop drag but keep annotation selected
  document.removeEventListener('mousemove', annotationMouseMove);
  document.removeEventListener('mouseup', annotationMouseUp);
}

// Undo
undoBtn.addEventListener('click', async () => {
  if (history.length<2) return;
  const last = history.pop();
  redoStack.push(last);
  const prev = history[history.length-1];
  pdfDoc = await PDFDocument.load(prev);
  pdfBytes = prev;
  pdfjsDoc = await pdfjsLib.getDocument({ data: pdfBytes }).promise;
  totalPages = pdfjsDoc.numPages;
  currentPage = Math.min(currentPage,totalPages);
  updateUndoRedoButtons();
  await renderPage();
});

// Redo
redoBtn.addEventListener('click', async () => {
  if (!redoStack.length) return;
  const next = redoStack.pop();
  history.push(next);
  pdfDoc = await PDFDocument.load(next);
  pdfBytes = next;
  pdfjsDoc = await pdfjsLib.getDocument({ data: pdfBytes }).promise;
  totalPages = pdfjsDoc.numPages;
  currentPage = Math.min(currentPage,totalPages);
  updateUndoRedoButtons();
  await renderPage();
});

// Save PDF including shapes, highlights, and text annotations
downloadBtn.addEventListener('click', async () => {
  if (!pdfBytes) { return alert('Load a PDF first.'); }
  // Prepare PDF bytes
  const saveDoc = await PDFDocument.load(pdfBytes);
  const pages = saveDoc.getPages();

  // Draw shapes (rectangles & ellipses)
  for (const s of shapes) {
    const page = pages[s.page - 1];
    const width = s.xMax - s.xMin;
    const height = s.yMax - s.yMin;
    const [r, g, b] = [s.color.slice(1,3), s.color.slice(3,5), s.color.slice(5,7)]
      .map(hx => parseInt(hx, 16) / 255);
    if (s.mode === 'rect') {
      page.drawRectangle({ x: s.xMin, y: s.yMin, width, height, borderColor: rgb(r, g, b), borderWidth: s.borderWidth });
    } else {
      page.drawEllipse({ x: s.xMin + width/2, y: s.yMin + height/2, xScale: width/2, yScale: height/2, borderColor: rgb(r, g, b), borderWidth: s.borderWidth });
    }
  }

  // Create PDF highlight annotations with popups for comments
  for (const h of highlights) {
    const page = pages[h.page - 1];
    // Create highlight annotation
    const rectNums = [h.xMin, h.yMin, h.xMax, h.yMax].map(n => PDFNumber.of(n));
    const quadNums = [h.xMin, h.yMax, h.xMax, h.yMax, h.xMax, h.yMin, h.xMin, h.yMin]
      .map(n => PDFNumber.of(n));
    const highlightDict = saveDoc.context.obj({
      Type: PDFName.of('Annot'),
      Subtype: PDFName.of('Highlight'),
      Rect: saveDoc.context.obj(rectNums),
      QuadPoints: saveDoc.context.obj(quadNums),
      C: saveDoc.context.obj([PDFNumber.of(1), PDFNumber.of(1), PDFNumber.of(0)]),
      CA: PDFNumber.of(0.2),
      Border: saveDoc.context.obj([PDFNumber.of(0), PDFNumber.of(0), PDFNumber.of(0)]),
      Contents: PDFString.of(h.comment)
    });
    const highlightRef = saveDoc.context.register(highlightDict);
    // Create popup annotation linked to highlight
    const popupRect = [h.xMax + 5, h.yMax - 20, h.xMax + 155, h.yMax + 60]
      .map(n => PDFNumber.of(n));
    const popupDict = saveDoc.context.obj({
      Type: PDFName.of('Annot'),
      Subtype: PDFName.of('Popup'),
      Rect: saveDoc.context.obj(popupRect),
      Parent: highlightRef,
      Contents: PDFString.of(h.comment),
      Open: true
    });
    const popupRef = saveDoc.context.register(popupDict);
    // Add both annotations to the page
    const annotsKey = PDFName.of('Annots');
    const existing = page.node.get(annotsKey);
    if (existing) {
      existing.push(highlightRef, popupRef);
    } else {
      page.node.set(annotsKey, saveDoc.context.obj([highlightRef, popupRef]));
    }
  }

  // Draw text annotations
  for (const a of annotations) {
    const page = pages[a.page - 1];
    const font = await saveDoc.embedFont(StandardFonts[a.fontName] || StandardFonts.Helvetica);
    const [rT, gT, bT] = [a.color.slice(1,3), a.color.slice(3,5), a.color.slice(5,7)].map(hx => parseInt(hx, 16) / 255);
    page.drawText(a.text, { x: a.x, y: a.y, size: a.size, font, color: rgb(rT, gT, bT) });
  }

  // Use File System Access API if available
  try {
    let handle = saveHandle;
    if (!handle && window.showSaveFilePicker) {
      handle = await window.showSaveFilePicker({
        types: [{ description: 'PDF Files', accept: { 'application/pdf': ['.pdf'] } }]
      });
      saveHandle = handle;
    }
    if (handle) {
      const writable = await handle.createWritable();
      const bytes = await saveDoc.save();
      await writable.write(bytes);
      await writable.close();
    } else {
      // fallback download
      const bytes = await saveDoc.save();
      const blob = new Blob([bytes], { type: 'application/pdf' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = 'edited.pdf';
      link.click();
      URL.revokeObjectURL(link.href);
    }
    showToast('PDF saved');
  } catch (err) {
    console.error(err);
    alert('Save failed: ' + err.message);
  }
});

// Keyboard shortcuts
document.addEventListener('keydown', e => {
  if (e.ctrlKey && e.key==='z') { e.preventDefault(); undoBtn.click(); }
  if (e.ctrlKey && (e.key==='y'||(e.shiftKey&&e.key==='Z'))) { e.preventDefault(); redoBtn.click(); }
  if (e.ctrlKey && e.key==='s') { e.preventDefault(); downloadBtn.click(); }
});

// Enable fine-tuning via inputs & nudge
xCoordInput.addEventListener('change', () => {
  if (!selectedAnno) return;
  const val = parseFloat(xCoordInput.value);
  if (!isNaN(val)) {
    selectedAnno.x = val;
    renderAnnotations();
  }
});
yCoordInput.addEventListener('change', () => {
  if (!selectedAnno) return;
  const val = parseFloat(yCoordInput.value);
  if (!isNaN(val)) {
    selectedAnno.y = val;
    renderAnnotations();
  }
});

// Simplified drawing handlers for shapes and highlights
overlayContainer.addEventListener('pointerdown', (e) => {
  if (!drawMode || e.target !== overlayContainer) return;
  e.preventDefault();
  drawing = true;
  const rect = overlayContainer.getBoundingClientRect();
  startX = e.clientX - rect.left;
  startY = e.clientY - rect.top;
  shapePreviewEl = document.createElement('div');
  shapePreviewEl.className = 'shape-preview';
  if (drawMode === 'highlight') {
    shapePreviewEl.style.background = 'rgba(255,255,0,0.4)';
    shapePreviewEl.style.border     = '1px dashed rgba(255,255,0,0.8)';
  } else {
    const color = shapeColorInput.value;
    const bw    = parseFloat(borderWidthInput.value) * zoomLevel;
    shapePreviewEl.style.border       = `${bw}px solid ${color}`;
    shapePreviewEl.style.background   = 'none';
    shapePreviewEl.style.borderRadius = drawMode === 'ellipse' ? '50%' : '0';
  }
  shapePreviewEl.style.left = `${startX}px`;
  shapePreviewEl.style.top  = `${startY}px`;
  overlayContainer.appendChild(shapePreviewEl);
});
overlayContainer.addEventListener('pointermove', (e) => {
  if (!drawing) return;
  const rect = overlayContainer.getBoundingClientRect();
  const curX = e.clientX - rect.left;
  const curY = e.clientY - rect.top;
  const w = curX - startX;
  const h = curY - startY;
  shapePreviewEl.style.left   = `${w < 0 ? curX : startX}px`;
  shapePreviewEl.style.top    = `${h < 0 ? curY : startY}px`;
  shapePreviewEl.style.width  = `${Math.abs(w)}px`;
  shapePreviewEl.style.height = `${Math.abs(h)}px`;
});
overlayContainer.addEventListener('pointerup', (e) => {
  if (!drawing) return;
  drawing = false;
  const rectPx = shapePreviewEl.getBoundingClientRect();
  const parent = overlayContainer.getBoundingClientRect();
  const x1Px = rectPx.left   - parent.left;
  const y1Px = rectPx.bottom - parent.top;
  const x2Px = rectPx.right  - parent.left;
  const y2Px = rectPx.top    - parent.top;
  const [xMin, yMin] = currentViewport.convertToPdfPoint(x1Px, y1Px);
  const [xMax, yMax] = currentViewport.convertToPdfPoint(x2Px, y2Px);
  if (drawMode === 'highlight') {
    const comment = prompt('Enter highlight comment:');
    if (comment) {
      const hl = { id: Date.now() + '_' + Math.random(), page: currentPage, xMin, yMin, xMax, yMax, comment };
      highlights.push(hl);
    }
  } else {
    shapes.push({ page: currentPage, xMin, yMin, xMax, yMax,
      color: shapeColorInput.value,
      borderWidth: parseFloat(borderWidthInput.value),
      mode: drawMode });
  }
  overlayContainer.removeChild(shapePreviewEl);
  shapePreviewEl = null;
  renderPage();
});

function showError(msg) {
  errorMessage.textContent = msg;
}
function clearError() {
  errorMessage.textContent = '';
}
function showProgress() {
  uploadProgress.hidden = false;
  uploadProgress.removeAttribute('value');
}
function hideProgress() {
  uploadProgress.hidden = true;
  uploadProgress.value = 0;
}

// Read a File object as ArrayBuffer with progress reporting
function readFileAsArrayBufferWithProgress(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.onprogress = (e) => {
      if (e.lengthComputable) {
        const percent = Math.round((e.loaded / e.total) * 100);
        uploadProgress.value = percent;
      }
    };
    reader.readAsArrayBuffer(file);
  });
}

// Generate a thumbnail of the first page and display it
async function generateThumbnail() {
  if (!pdfjsDoc) return;
  thumbnailContainer.innerHTML = '';
  const page = await pdfjsDoc.getPage(1);
  // Determine scale based on container width
  const origViewport = page.getViewport({ scale: 1 });
  const containerWidth = thumbnailContainer.clientWidth || 40;
  const scale = containerWidth / origViewport.width;
  const thumbViewport = page.getViewport({ scale });
  const canvasThumb = document.createElement('canvas');
  const ctxThumb = canvasThumb.getContext('2d');
  canvasThumb.width = thumbViewport.width;
  canvasThumb.height = thumbViewport.height;
  await page.render({ canvasContext: ctxThumb, viewport: thumbViewport }).promise;
  const img = new Image();
  img.src = canvasThumb.toDataURL();
  thumbnailContainer.appendChild(img);
}

// New: generate thumbnails in sidebar for each page
async function generateSidebarThumbnails() {
  if (!pdfjsDoc) return;
  sidebar.innerHTML = '';
  for (let i = 1; i <= totalPages; i++) {
    const page = await pdfjsDoc.getPage(i);
    const viewport = page.getViewport({ scale: 0.2 });
    const canvasThumb = document.createElement('canvas');
    const ctxThumb = canvasThumb.getContext('2d');
    canvasThumb.width = viewport.width;
    canvasThumb.height = viewport.height;
    await page.render({ canvasContext: ctxThumb, viewport }).promise;
    const img = new Image();
    img.src = canvasThumb.toDataURL();
    const thumbDiv = document.createElement('div');
    thumbDiv.className = 'thumb';
    if (i === currentPage) thumbDiv.classList.add('selected');
    thumbDiv.appendChild(img);
    thumbDiv.addEventListener('click', async () => {
      currentPage = i;
      await renderPage();
    });
    sidebar.appendChild(thumbDiv);
  }
}

// New: highlight the current thumbnail
function updateSidebarSelection() {
  const thumbs = sidebar.querySelectorAll('.thumb');
  thumbs.forEach((thumb, idx) => {
    thumb.classList.toggle('selected', idx + 1 === currentPage);
  });
}

// Context-menu only on annotation/highlight elements
overlayContainer.addEventListener('contextmenu', e => {
  e.preventDefault();
  contextMenu.hidden = true;
  let target = e.target;
  // If clicking inside an annotation/highlight child, climb until the element
  while (target && !target.classList.contains('annotation') && !target.classList.contains('highlight')) {
    if (target === overlayContainer) return;
    target = target.parentElement;
  }
  if (target && (target.classList.contains('annotation') || target.classList.contains('highlight'))) {
    contextTarget = target;
    contextMenu.style.left = e.pageX + 'px';
    contextMenu.style.top = e.pageY + 'px';
    contextMenu.hidden = false;
  }
});

// Menu actions
contextMenu.querySelectorAll('li').forEach(li => {
  li.addEventListener('click', async () => {
    const action = li.dataset.action;
    if (action === 'delete' && contextTarget) {
      if (contextTarget.classList.contains('annotation')) {
        annotations = annotations.filter(a => a.id !== contextTarget.dataset.id);
        selectedAnno = null;
        await pushHistory();
        await renderPage();
      } else if (contextTarget.classList.contains('highlight')) {
        highlights = highlights.filter(h => h.id !== contextTarget.dataset.id);
        await pushHistory();
        await renderPage();
      }
    } else if (action === 'copy' && contextTarget) {
      if (contextTarget.classList.contains('annotation')) {
        const a = annotations.find(a => a.id === contextTarget.dataset.id);
        if (a) {
          const clone = { ...a, id: Date.now() + '_' + Math.random(), x: a.x + 10, y: a.y - 10 };
          annotations.push(clone);
          selectedAnno = clone;
          await pushHistory();
          await renderPage();
        }
      } else if (contextTarget.classList.contains('highlight')) {
        const h = highlights.find(h => h.id === contextTarget.dataset.id);
        if (h) {
          const clone = { ...h, id: Date.now() + '_' + Math.random(), xMin: h.xMin + 10, yMin: h.yMin - 10, xMax: h.xMax + 10, yMax: h.yMax - 10 };
          highlights.push(clone);
          await pushHistory();
          await renderPage();
        }
      }
    } else if ((action === 'bringFront' || action === 'sendBack') && contextTarget) {
      const isAnno = contextTarget.classList.contains('annotation');
      const list = isAnno ? annotations : highlights;
      const id = contextTarget.dataset.id;
      const idx = list.findIndex(item => item.id === id);
      if (idx >= 0) {
        const [item] = list.splice(idx, 1);
        if (action === 'bringFront') list.push(item);
        else list.unshift(item);
        await pushHistory();
        await renderPage();
      }
    } else if (action === 'convert' && contextTarget && contextTarget.classList.contains('highlight')) {
      const hid = contextTarget.dataset.id;
      const h = highlights.find(h2 => h2.id === hid);
      if (h) {
        highlights = highlights.filter(h2 => h2.id !== hid);
        if (!editMode) modeToggleBtn.click();
        if (!textToolActive) textToolBtn.click();
        const anno = {
          id: Date.now() + '_' + Math.random(), page: currentPage,
          text: h.comment || '', fontName: fontSelect.value,
          size: parseFloat(sizeInput.value), color: colorInput.value,
          align: alignSelect.value, bold: boldActive, italic: italicActive,
          x: h.xMin, y: h.yMin
        };
        annotations.push(anno);
        await pushHistory();
        selectedAnno = anno;
        xCoordInput.value = anno.x.toFixed(1);
        yCoordInput.value = anno.y.toFixed(1);
        await renderPage();
        textInput.value = anno.text;
        textInput.focus();
      }
    }
    contextMenu.hidden = true;
  });
});

// Sync size slider and number input
sizeSlider.addEventListener('input', () => { sizeInput.value = sizeSlider.value; });
sizeInput.addEventListener('change', () => { sizeSlider.value = sizeInput.value; });

// Toggle edit/view mode
modeToggleBtn.addEventListener('click', () => {
  editMode = !editMode;
  document.body.classList.toggle('view-mode', !editMode);
  modeToggleBtn.classList.toggle('active', editMode);
  // Disable tools when in view mode
  [rectBtn, ellipseBtn, highlightBtn, textToolBtn].forEach(btn => btn.disabled = !editMode);
  controlsPanel.hidden = !editMode || !textToolActive;
});

// Toggle text-tool visiblity
textToolBtn.addEventListener('click', () => {
  textToolActive = !textToolActive;
  controlsPanel.hidden = !textToolActive;
  textToolBtn.classList.toggle('active', textToolActive);
  // Ensure edit mode is on
  if (textToolActive && !editMode) modeToggleBtn.click();
});

// Bold/italic styling toggles
boldBtn.addEventListener('click', () => { boldActive = !boldActive; boldBtn.classList.toggle('active', boldActive); });
italicBtn.addEventListener('click', () => { italicActive = !italicActive; italicBtn.classList.toggle('active', italicActive); });

// Zoom slider binding
zoomSlider.addEventListener('input', async () => {
  zoomLevel = parseFloat(zoomSlider.value) || 1;
  zoomSelect.value = zoomLevel;
  await renderPage();
});

// Open PDF via button
openFileBtn.addEventListener('click', () => fileInput.click());

// Helper: show toast notifications
function showToast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  setTimeout(() => toastEl.classList.remove('show'), 2000);
} 
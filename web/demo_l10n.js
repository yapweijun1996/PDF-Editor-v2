// Minimal in-browser L10n that satisfies PDF.js' GenericL10n usage without external "fluent-*" deps.
// It fills common UI strings and gracefully falls back to readable text.
//
// Export name MUST be GenericL10n because modules import { GenericL10n } from "web-null_l10n".

class GenericL10n {
  constructor(lang) {
    this._lang = (typeof lang === "string" ? lang : lang?.lang) || "en-US";
    this._dir = "ltr";
    this._paused = false;
  }

  getLanguage() {
    return this._lang;
  }
  getDirection() {
    return this._dir;
  }
  async setLanguage(lang) {
    if (typeof lang === "string") {
      this._lang = lang;
    } else if (lang?.lang) {
      this._lang = lang.lang;
      if (lang.dir) this._dir = lang.dir;
    }
    return this._lang;
  }

  pause() {
    this._paused = true;
  }
  resume() {
    this._paused = false;
  }
  async destroy() {}

  // Core translate utilities
  async get(id, args) {
    const raw = STRINGS[id];
    if (!raw) return humanize(id, args);
    return format(raw, args);
  }

  async translate(root) {
    if (!root) return;
    const list = root.querySelectorAll("[data-l10n-id]");
    for (const el of list) {
      const id = el.getAttribute("data-l10n-id");
      let args = undefined;
      const argsAttr = el.getAttribute("data-l10n-args");
      if (argsAttr) {
        try {
          args = JSON.parse(argsAttr);
        } catch {
          // ignore parse error
        }
      }
      const text = await this.get(id, args);
      if (text === undefined || text === null) continue;

      const tag = el.tagName?.toUpperCase?.() || "";
      const hasChildSpan = el.querySelector?.(":scope > span");
      const parentButton = el.closest?.("button.toolbarButton, a.toolbarButton");

      // 1) If the element itself is a clickable control (button/anchor) that
      //    contains an inner span for the label, don't inject visible text in
      //    the control (to avoid breaking compact toolbar layout).
      //    Instead, only set aria-label/title for accessibility.
      if ((tag === "BUTTON" || tag === "A") && hasChildSpan) {
        el.setAttribute("aria-label", String(text));
        el.setAttribute("title", String(text));
        continue;
      }

      // 2) If the element is the inner span of a toolbar control and the control
      //    is NOT a "labeled" button (i.e., main/top toolbar), skip visible text
      //    and mirror to the parent control's aria/tooltip. This keeps the main
      //    toolbar compact while allowing secondary toolbar (labeled) to show text.
      if (
        tag === "SPAN" &&
        parentButton &&
        !parentButton.classList.contains("labeled")
      ) {
        parentButton.setAttribute("aria-label", String(text));
        parentButton.setAttribute("title", String(text));
        continue;
      }

      // Inputs typically need placeholder rather than inner text.
      if (tag === "INPUT") {
        const type = el.getAttribute("type");
        // Set placeholder for text/number/password inputs.
        if (!type || /^(text|number|password|search|email|url)$/i.test(type)) {
          el.setAttribute("placeholder", String(text));
        }
        // Mirror to title for accessibility.
        el.setAttribute("title", String(text));
        continue;
      }

      // Default: visible text.
      el.textContent = String(text);
    }
  }

  // For components that call translateOnce
  async translateOnce(element) {
    return this.translate(element);
  }
}

// Basic formatter: replace {name} placeholders.
function format(tpl, args) {
  if (!args) return tpl;
  return tpl.replace(/\{(\w+)\}/g, (_, k) =>
    Object.prototype.hasOwnProperty.call(args, k) ? String(args[k]) : `{${k}}`
  );
}

// Fallback: make the id readable.
function humanize(id, args) {
  // drop common prefixes/suffixes
  let s = id
    .replace(/^pdfjs[-_:]/, "")
    .replace(/[-_:]button(-label)?$/i, "")
    .replace(/[-_:]label$/i, "")
    .replace(/[-_:]/g, " ");
  s = s
    .split(" ")
    .map(w => (w ? w[0].toUpperCase() + w.slice(1) : ""))
    .join(" ")
    .trim();
  return format(s || id, args);
}

// Minimal strings for Secondary Toolbar + key toolbar items.
// Add more ids as needed; unknown ids will fall back to humanized text.
const STRINGS = {
  // Main toolbar
  "pdfjs-tools-button-label": "More Tools",
  "pdfjs-print-button-label": "Print",
  "pdfjs-save-button-label": "Download",
  "pdfjs-zoom-in-button-label": "Zoom In",
  "pdfjs-zoom-out-button-label": "Zoom Out",
  "pdfjs-toggle-sidebar-button-label": "Toggle Sidebar",
  "pdfjs-findbar-button-label": "Find",
  "pdfjs-page-scale-auto": "Automatic Zoom",
  "pdfjs-page-scale-actual": "Actual Size",
  "pdfjs-page-scale-fit": "Page Fit",
  "pdfjs-page-scale-width": "Page Width",
  "pdfjs-page-scale-percent": "{scale}%",
  "pdfjs-of-pages": "of {pagesCount}",
  "pdfjs-page-of-pages": "{pageNumber} of {pagesCount}",

  // Secondary toolbar group
  "pdfjs-open-file-button-label": "Open File",
  "pdfjs-print-button": "Print",
  "pdfjs-save-button": "Download",
  "pdfjs-presentation-mode-button-label": "Presentation Mode",
  "pdfjs-bookmark-button-label": "Current View",
  "pdfjs-first-page-button-label": "First Page",
  "pdfjs-last-page-button-label": "Last Page",
  "pdfjs-page-rotate-cw-button-label": "Rotate Clockwise",
  "pdfjs-page-rotate-ccw-button-label": "Rotate Counterclockwise",

  "pdfjs-cursor-text-select-tool-button-label": "Text Selection Tool",
  "pdfjs-cursor-hand-tool-button-label": "Hand Tool",

  "pdfjs-scroll-page-button-label": "Page Scrolling",
  "pdfjs-scroll-vertical-button-label": "Vertical Scrolling",
  "pdfjs-scroll-horizontal-button-label": "Horizontal Scrolling",
  "pdfjs-scroll-wrapped-button-label": "Wrapped Scrolling",

  "pdfjs-spread-none-button-label": "No Spreads",
  "pdfjs-spread-odd-button-label": "Odd Spreads",
  "pdfjs-spread-even-button-label": "Even Spreads",

  "pdfjs-image-alt-text-settings-button-label": "Alt Text Settings",
  "pdfjs-document-properties-button-label": "Document Properties",

  // Sidebar buttons
  "pdfjs-thumbs-button-label": "Thumbnails",
  "pdfjs-document-outline-button-label": "Document Outline",
  "pdfjs-attachments-button-label": "Attachments",
  "pdfjs-layers-button-label": "Layers",

  // Misc
  "pdfjs-password-label": "Enter the password to open this PDF file.",
  "pdfjs-password-ok-button": "OK",
  "pdfjs-password-cancel-button": "Cancel",
};

export { GenericL10n };
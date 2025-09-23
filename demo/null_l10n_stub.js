// 轻量本地化实现，避免依赖 Fluent 库，仅满足基本接口需求。
// 实现 IL10n 接口所需的方法，提供最简翻译占位能力。

class GenericL10n {
  constructor(lang) {
    this._lang = (lang || (navigator && navigator.language) || "en-US").toLowerCase();
    this._dir = this._isRTL(this._lang) ? "rtl" : "ltr";
  }

  getLanguage() {
    return this._lang;
  }

  getDirection() {
    return this._dir;
  }

  async get(ids, _args = null, fallback) {
    if (Array.isArray(ids)) {
      return ids.map(({ id, fallback: fb }) => fb || id || "");
    }
    return fallback || (typeof ids === "string" ? ids : "");
  }

  async translate(root) {
    if (!root) return;
    // 将所有带 data-l10n-id 的元素填充为其 id，作为占位文本。
    const nodes = root.querySelectorAll("[data-l10n-id]");
    for (const el of nodes) {
      const id = el.getAttribute("data-l10n-id");
      const hasChildText = [...el.childNodes].some(n => n.nodeType === Node.TEXT_NODE && n.nodeValue.trim().length > 0);
      if (!hasChildText) {
        el.textContent = id || el.textContent;
      }
      // 同步 title 等常见属性
      if (el.hasAttribute("title") && !el.getAttribute("title")) {
        el.setAttribute("title", id || "");
      }
      if (el.hasAttribute("aria-label") && !el.getAttribute("aria-label")) {
        el.setAttribute("aria-label", id || "");
      }
    }
  }

  async translateOnce(element) {
    return this.translate(element);
  }

  pause() {}
  resume() {}
  async destroy() {}

  _isRTL(lang) {
    const short = lang.split("-", 1)[0];
    return ["ar", "he", "fa", "ps", "ur"].includes(short);
  }
}

export { GenericL10n };


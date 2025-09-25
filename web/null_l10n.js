// 简化版本地化实现：避免依赖 fluent-bundle/fluent-dom
// 满足 IL10n 接口，返回 key 或 fallback。

class GenericL10n {
  constructor(lang = "zh-CN") {
    this._lang = lang;
  }
  getLanguage() {
    return this._lang;
  }
  getDirection() {
    return "ltr";
  }
  async get(ids, _args = null, fallback) {
    if (Array.isArray(ids)) {
      // 取首个 id 作为回退
      return fallback ?? ids[0] ?? "";
    }
    return fallback ?? ids ?? "";
  }
  async translate(_element) {
    // 本 Demo 不做 DOM 翻译
  }
  pause() {}
  resume() {}
}

export { GenericL10n };


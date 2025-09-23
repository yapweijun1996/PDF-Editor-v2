// 独立外部服务实现，避免依赖 Fluent 与浏览器特定桥接。
// 覆盖默认的 web-external_services 与 web-preferences 映射。

import { BaseExternalServices } from "./web/external_services.js";
import { BasePreferences } from "./web/preferences.js";
import { GenericScripting } from "./web/generic_scripting.js";
import { SignatureStorage } from "./web/generic_signature_storage.js";
import { GenericL10n } from "./null_l10n_stub.js";
import { AppOptions } from "./web/app_options.js";

function initCom(_app) {
  // 通用环境无需额外初始化。
}

class Preferences extends BasePreferences {
  async _writeToStorage(prefObj) {
    try {
      localStorage.setItem("pdfjs.preferences", JSON.stringify(prefObj));
    } catch (_) {}
  }
  async _readFromStorage(_defaults) {
    try {
      const raw = localStorage.getItem("pdfjs.preferences");
      if (raw) {
        return { prefs: JSON.parse(raw) };
      }
    } catch (_) {}
    return { prefs: {} };
  }
}

class ExternalServices extends BaseExternalServices {
  async createL10n() {
    // 使用轻量 L10n，避免依赖 Fluent。
    return new GenericL10n(AppOptions.get("localeProperties")?.lang);
  }

  createScripting() {
    // 若启用 scripting，使用通用脚本桥；默认我们会在页面层关闭它。
    return new GenericScripting(AppOptions.get("sandboxBundleSrc"));
  }

  createSignatureStorage(eventBus, signal) {
    return new SignatureStorage(eventBus, signal);
  }
}

// 简化版 ML 管理器（禁用 Alt Text 相关 ML 能力，但接口存在）
class MLManager {
  async isEnabledFor(_name) { return false; }
  async deleteModel(_name) { return null; }
  isReady(_name) { return false; }
  guess(_data) {}
  toggleService(_name, _enabled) {}
}

export { ExternalServices, initCom, MLManager, Preferences };

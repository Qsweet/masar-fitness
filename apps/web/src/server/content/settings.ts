import {
  NO_SETTINGS,
  resolveSettings,
  type SettingOverrides,
  type SettingValues,
} from "@masar/domain";
import { SITE_SETTING_DEFAULTS } from "@/config/site-settings";

/**
 * الإعدادات المنظَّمة كما يقرؤها الموقع (ADMIN_A3_CONTENT §5): تجاوزات الإصدار فوق افتراضيات `config/`.
 * كل مستهلك (الصفحات، التذييل، JSON-LD، llms.txt) يقرأ من هنا وحده، فالقيمة واحدة في كل مكان.
 */
const resolved = new WeakMap<SettingOverrides, SettingValues>();

export function siteSettings(overrides: SettingOverrides): SettingValues {
  if (overrides.size === 0) {
    return SITE_SETTING_DEFAULTS;
  }
  const cached = resolved.get(overrides);
  if (cached !== undefined) {
    return cached;
  }
  const settings = resolveSettings(overrides, SITE_SETTING_DEFAULTS);
  resolved.set(overrides, settings);
  return settings;
}

export const DEFAULT_SETTINGS: SettingValues = siteSettings(NO_SETTINGS);

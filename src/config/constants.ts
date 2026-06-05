/**
 * Platform configuration constants
 * All magic strings and configuration values should be defined here
 */

export const PLATFORM_CONFIG = {
  // Super user email - has access to all organizations
  SUPER_USER_EMAIL: import.meta.env.VITE_SUPER_USER_EMAIL || 'admin@nortyx.dev',

  // Limits and quotas
  MAX_INVITE_PER_REQUEST: 20,
  SESSION_TIMEOUT_MS: 30 * 60 * 1000, // 30 minutes

  // Storage keys
  STORAGE_PREFIX: 'nortyx',
  ACTIVE_ORG_KEY_PREFIX: 'nortyx_active_org',
  CATEGORY_MAPPINGS_KEY_PREFIX: 'nortyx_category_mappings',
  COLOR_OVERRIDES_KEY_PREFIX: 'nortyx_color_overrides',

  // Legacy keys for migration
  LEGACY_ORG_KEY: 'paggio_active_org',
  LEGACY_CATEGORY_KEY: 'paggio_category_mappings',
  LEGACY_CATEGORIES_KEY: 'paggio_categories',
};

// Storage key generators with user/org scoping
export const getActiveOrgStorageKey = (userId: string) =>
  `${PLATFORM_CONFIG.ACTIVE_ORG_KEY_PREFIX}_${userId}`;

export const getCategoryMappingsStorageKey = (orgId: string) =>
  `${PLATFORM_CONFIG.CATEGORY_MAPPINGS_KEY_PREFIX}_${orgId}`;

export const getColorOverridesStorageKey = (orgId: string) =>
  `${PLATFORM_CONFIG.COLOR_OVERRIDES_KEY_PREFIX}_${orgId}`;

const DEFAULT_SETTINGS = {
  apiKey: "",
  model: "gpt-4o-mini",
  redactQuery: true,
  sendFullUrl: false,
  allowedTopLevel: "",
  maxDepth: 3,
  applyRenames: false,
  categoryRoot: "AI Categories",
  categoryRootParent: "Bookmarks Bar",
  emptyFolderAction: "trash"
};

export async function getSettings() {
  const stored = await chrome.storage.local.get("settings");
  return { ...DEFAULT_SETTINGS, ...(stored.settings || {}) };
}

export async function saveSettings(settings) {
  await chrome.storage.local.set({ settings: { ...DEFAULT_SETTINGS, ...settings } });
}

export async function clearApiKey() {
  const settings = await getSettings();
  settings.apiKey = "";
  await saveSettings(settings);
}

export async function getTagsMap() {
  const stored = await chrome.storage.local.get("tags");
  return stored.tags || {};
}

export async function setTagsMap(tagsMap) {
  await chrome.storage.local.set({ tags: tagsMap });
}

export async function setTagsForBookmark(bookmarkId, tags) {
  const tagsMap = await getTagsMap();
  tagsMap[bookmarkId] = tags;
  await setTagsMap(tagsMap);
}

export async function setLastBackup(backup) {
  await chrome.storage.local.set({ lastBackup: backup });
}

export async function getLastBackup() {
  const stored = await chrome.storage.local.get("lastBackup");
  return stored.lastBackup || null;
}

export { DEFAULT_SETTINGS };

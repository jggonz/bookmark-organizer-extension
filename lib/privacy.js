export function redactUrl(url, settings) {
  if (!url) return "";
  try {
    const parsed = new URL(url);
    if (settings.sendFullUrl) {
      return parsed.toString();
    }
    const base = parsed.origin + parsed.pathname;
    if (settings.redactQuery) {
      return base;
    }
    return base + parsed.search;
  } catch {
    return url;
  }
}

export function getDomain(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

export function buildPayload(items, settings, chunkInfo, existingFolderPaths = []) {
  const safeItems = items.map((item) => ({
    id: item.id,
    type: item.type,
    title: item.title,
    url: item.url ? redactUrl(item.url, settings) : null,
    domain: item.url ? getDomain(item.url) : null,
    folderPath: item.folderPath,
    dateAdded: item.dateAdded || null
  }));

  return {
    version: "1.0",
    chunkInfo,
    settings: {
      maxDepth: settings.maxDepth,
      categoryRoot: settings.categoryRoot || "AI Categories",
      categoryRootParent: settings.categoryRootParent || "Bookmarks Bar",
      allowedTopLevel: settings.allowedTopLevel
        ? settings.allowedTopLevel.split(",").map((v) => v.trim()).filter(Boolean)
        : []
    },
    existingFolderPaths,
    items: safeItems
  };
}

export function buildPayloadPreview(items, settings, sampleSize = 5) {
  const sample = items.slice(0, sampleSize).map((item) => ({
    id: item.id,
    type: item.type,
    title: item.title,
    url: item.url ? redactUrl(item.url, settings) : null,
    folderPath: item.folderPath
  }));
  return {
    sample,
    totalItems: items.length,
    redaction: settings.sendFullUrl ? "full" : settings.redactQuery ? "redacted" : "query-only"
  };
}

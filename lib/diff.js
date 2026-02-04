function joinPath(path) {
  return Array.isArray(path) ? path.join(" / ") : "";
}

function normalizeProposedPath(path, settings) {
  const root = settings.categoryRoot || "AI Categories";
  const parent = settings.categoryRootParent || "Bookmarks Bar";
  const normalized = Array.isArray(path) ? [...path] : [];
  if (normalized[0] === parent) normalized.shift();
  if (normalized[0] === root) normalized.shift();
  return [parent, root, ...normalized].filter(Boolean);
}

export function buildPreview(plan, itemsMap, tagsMap, settings) {
  const operations = [];
  const seen = new Set();

  for (const suggestion of plan.suggestions || []) {
    const item = itemsMap.get(suggestion.itemId);
    if (!item) continue;
    const itemType = suggestion.itemType || item.type || "bookmark";

    const normalizedPath = normalizeProposedPath(suggestion.proposedFolderPath, settings);
    const currentPath = joinPath(item.folderPath);
    const proposedPath = joinPath(normalizedPath);

    if (proposedPath && proposedPath !== currentPath) {
      const id = `${suggestion.itemId}-move`;
      if (!seen.has(id)) {
        operations.push({
          id,
          type: "move",
          itemId: suggestion.itemId,
          itemType,
          title: item.title,
          from: currentPath,
          to: proposedPath,
          fromPath: item.folderPath,
          toPath: normalizedPath,
          selected: true
        });
        seen.add(id);
      }
    }

    if (suggestion.proposedTitle && suggestion.proposedTitle !== item.title) {
      const id = `${suggestion.itemId}-rename`;
      if (!seen.has(id)) {
        operations.push({
          id,
          type: "rename",
          itemId: suggestion.itemId,
          itemType,
          title: item.title,
          proposedTitle: suggestion.proposedTitle,
          selected: Boolean(settings.applyRenames)
        });
        seen.add(id);
      }
    }

    if (Array.isArray(suggestion.tags)) {
      const existing = tagsMap[suggestion.itemId] || [];
      const newTags = suggestion.tags;
      const changed = existing.join("|") !== newTags.join("|");
      if (changed) {
        const id = `${suggestion.itemId}-tags`;
        if (!seen.has(id)) {
          operations.push({
            id,
            type: "tags",
            itemId: suggestion.itemId,
            itemType,
            title: item.title,
            tags: newTags,
            selected: true
          });
          seen.add(id);
        }
      }
    }
  }

  return {
    operations,
    duplicateGroups: plan.duplicateGroups || []
  };
}

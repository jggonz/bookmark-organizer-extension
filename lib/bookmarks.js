export async function getBookmarksTree() {
  const tree = await chrome.bookmarks.getTree();
  return tree[0];
}

function traverseForFolders(node, path, folderPaths, folderMap, folders, rootId) {
  if (!node || node.url) return;
  const currentPath = node.title ? [...path, node.title] : [...path];
  if (node.title) {
    folderPaths.push(currentPath);
    folderMap.set(node.id, currentPath);
    if (node.parentId && node.parentId !== rootId) {
      folders.push({
        id: node.id,
        parentId: node.parentId,
        title: node.title,
        folderPath: path,
        fullPath: currentPath,
        dateAdded: node.dateAdded,
        type: "folder"
      });
    }
  }
  if (node.children) {
    node.children.forEach((child) => traverseForFolders(child, currentPath, folderPaths, folderMap, folders, rootId));
  }
}

function traverseForBookmarks(node, path, bookmarks) {
  if (!node) return;
  if (node.url) {
    bookmarks.push({
      id: node.id,
      parentId: node.parentId,
      title: node.title || node.url,
      url: node.url,
      folderPath: path,
      dateAdded: node.dateAdded,
      type: "bookmark"
    });
    return;
  }
  const currentPath = node.title ? [...path, node.title] : [...path];
  if (node.children) {
    node.children.forEach((child) => traverseForBookmarks(child, currentPath, bookmarks));
  }
}

export function flattenBookmarks(treeRoot) {
  const bookmarks = [];
  const folderPaths = [];
  const folderMap = new Map();
  const folders = [];
  if (!treeRoot.children) {
    return { bookmarks, folders, folderPaths, folderMap };
  }

  treeRoot.children.forEach((child) => traverseForFolders(child, [], folderPaths, folderMap, folders, treeRoot.id));
  treeRoot.children.forEach((child) => traverseForBookmarks(child, [], bookmarks));
  return { bookmarks, folders, folderPaths, folderMap };
}

export function buildFolderTree(treeRoot) {
  const buildNode = (node) => {
    if (!node || node.url) return null;
    const children = (node.children || [])
      .map(buildNode)
      .filter(Boolean);
    return {
      id: node.id,
      title: node.title,
      children
    };
  };

  const roots = (treeRoot.children || []).map(buildNode).filter(Boolean);
  return roots;
}

function buildFolderIndex(treeRoot) {
  const map = new Map();
  const rootId = treeRoot.id;

  const walk = (node, path) => {
    if (!node || node.url) return;
    const currentPath = node.title ? [...path, node.title] : [...path];
    if (node.title) {
      map.set(currentPath.join(" / "), node.id);
    }
    (node.children || []).forEach((child) => walk(child, currentPath));
  };

  (treeRoot.children || []).forEach((child) => walk(child, []));
  return { map, rootId };
}

async function ensureFolderPath(pathArray, index) {
  if (!Array.isArray(pathArray) || pathArray.length === 0) return null;
  let parentId = index.rootId;
  for (let i = 0; i < pathArray.length; i++) {
    const partial = pathArray.slice(0, i + 1).join(" / ");
    if (index.map.has(partial)) {
      parentId = index.map.get(partial);
      continue;
    }
    const title = pathArray[i];
    const created = await chrome.bookmarks.create({ parentId, title });
    parentId = created.id;
    index.map.set(partial, created.id);
  }
  return parentId;
}

async function getTrashFolderId(settings, index) {
  const trashPath = [settings.categoryRootParent, "Trash"];
  return ensureFolderPath(trashPath, index);
}

async function isFolderEmpty(folderId) {
  const children = await chrome.bookmarks.getChildren(folderId);
  return children.length === 0;
}

async function isTopLevelFolder(folderId) {
  const nodes = await chrome.bookmarks.get(folderId);
  if (!nodes || nodes.length === 0) return false;
  const node = nodes[0];
  // Top-level folders have parentId "0" (the root) or are direct children of root
  const parent = await chrome.bookmarks.get(node.parentId);
  return parent && parent.length > 0 && parent[0].parentId === undefined;
}

async function cleanupEmptyFolders(sourceFolderIds, settings, index) {
  if (settings.emptyFolderAction === "keep") return;

  const trashFolderId = settings.emptyFolderAction === "trash"
    ? await getTrashFolderId(settings, index)
    : null;

  // Process folders, potentially recursively checking parents
  const processed = new Set();
  const toProcess = [...sourceFolderIds];

  while (toProcess.length > 0) {
    const folderId = toProcess.pop();
    if (processed.has(folderId)) continue;
    processed.add(folderId);

    try {
      // Skip if folder no longer exists
      const nodes = await chrome.bookmarks.get(folderId);
      if (!nodes || nodes.length === 0) continue;

      const node = nodes[0];

      // Skip if this is a top-level folder
      if (await isTopLevelFolder(folderId)) continue;

      // Skip the Trash folder itself
      if (trashFolderId && folderId === trashFolderId) continue;

      // Check if folder is empty
      if (await isFolderEmpty(folderId)) {
        const parentId = node.parentId;

        if (settings.emptyFolderAction === "delete") {
          await chrome.bookmarks.remove(folderId);
        } else if (settings.emptyFolderAction === "trash" && trashFolderId) {
          await chrome.bookmarks.move(folderId, { parentId: trashFolderId });
        }

        // Check if parent folder is now empty too
        if (parentId && !processed.has(parentId)) {
          toProcess.push(parentId);
        }
      }
    } catch (e) {
      // Folder may have been already deleted or moved, ignore
    }
  }
}

export async function applyOperations(operations, settings) {
  const treeRoot = await getBookmarksTree();
  const index = buildFolderIndex(treeRoot);

  // Track source folders that may become empty
  const sourceFolderIds = new Set();

  for (const op of operations) {
    if (!op.selected) continue;
    if (op.type === "move") {
      if (!Array.isArray(op.toPath) || op.toPath.length === 0) continue;
      if (op.itemType === "folder" && Array.isArray(op.fromPath)) {
        const currentFull = [...op.fromPath, op.title].join(" / ");
        const targetFull = [...op.toPath, op.title].join(" / ");
        if (targetFull.startsWith(currentFull)) {
          continue;
        }
      }

      // Get the item's current parent before moving
      try {
        const items = await chrome.bookmarks.get(op.itemId);
        if (items && items.length > 0) {
          sourceFolderIds.add(items[0].parentId);
        }
      } catch (e) {
        // Item may not exist, continue
      }

      const targetParentId = await ensureFolderPath(op.toPath, index);
      if (targetParentId) {
        await chrome.bookmarks.move(op.itemId, { parentId: targetParentId });
      }
    }
    if (op.type === "rename" && settings.applyRenames) {
      await chrome.bookmarks.update(op.itemId, { title: op.proposedTitle });
    }
  }

  // Clean up empty source folders
  if (sourceFolderIds.size > 0) {
    await cleanupEmptyFolders(sourceFolderIds, settings, index);
  }
}

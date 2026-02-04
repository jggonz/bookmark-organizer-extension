import { getBookmarksTree, flattenBookmarks, buildFolderTree, applyOperations } from "./lib/bookmarks.js";
import { getSettings, getTagsMap, setTagsMap, setLastBackup } from "./lib/storage.js";
import { buildPayload } from "./lib/privacy.js";
import { requestPlan } from "./lib/openai.js";
import { buildPreview } from "./lib/diff.js";

const state = {
  settings: null,
  bookmarks: [],
  folders: [],
  items: [],
  itemsMap: new Map(),
  folderTree: [],
  folderPaths: [],
  tagsMap: {},
  selectedFolder: null,
  searchQuery: "",
  activeTag: null,
  preview: null,
  running: false,
  collapsedFolders: new Set(),
  progress: null,
  topLevelFolders: []
};

const elements = {
  searchInput: document.getElementById("searchInput"),
  folderTree: document.getElementById("folderTree"),
  bookmarkList: document.getElementById("bookmarkList"),
  bookmarkCount: document.getElementById("bookmarkCount"),
  tagFilters: document.getElementById("tagFilters"),
  aiButton: document.getElementById("aiButton"),
  settingsButton: document.getElementById("settingsButton"),
  exportButton: document.getElementById("exportButton"),
  statusBar: document.getElementById("statusBar"),
  modal: document.getElementById("modal"),
  modalTitle: document.getElementById("modalTitle"),
  modalBody: document.getElementById("modalBody"),
  modalActions: document.getElementById("modalActions"),
  modalClose: document.getElementById("modalClose"),
  collapseAll: document.getElementById("collapseAll"),
  aiFolderButton: document.getElementById("aiFolderButton")
};

function showStatus(message, timeout = 2500) {
  elements.statusBar.textContent = message;
  elements.statusBar.classList.remove("hidden");
  if (timeout) {
    setTimeout(() => elements.statusBar.classList.add("hidden"), timeout);
  }
}

function openModal(title, bodyNode, actions = []) {
  elements.modalTitle.textContent = title;
  elements.modalBody.innerHTML = "";
  elements.modalBody.appendChild(bodyNode);
  elements.modalActions.innerHTML = "";
  actions.forEach((action) => elements.modalActions.appendChild(action));
  elements.modal.classList.remove("hidden");
}

function closeModal() {
  elements.modal.classList.add("hidden");
  state.progress = null;
}

function escapeText(text) {
  const span = document.createElement("span");
  span.textContent = text;
  return span.innerHTML;
}

function arraysStartWith(a, b) {
  if (!b || b.length === 0) return true;
  if (a.length < b.length) return false;
  for (let i = 0; i < b.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function getFilteredBookmarks() {
  const query = state.searchQuery.toLowerCase();
  return state.bookmarks.filter((bm) => {
    if (state.selectedFolder && !arraysStartWith(bm.folderPath, state.selectedFolder)) return false;
    const tags = state.tagsMap[bm.id] || [];
    if (state.activeTag && !tags.includes(state.activeTag)) return false;

    if (!query) return true;
    const hay = [
      bm.title,
      bm.url,
      bm.folderPath.join(" / "),
      tags.join(" ")
    ]
      .join(" ")
      .toLowerCase();
    return hay.includes(query);
  });
}

function renderTagFilters() {
  const tags = new Set();
  Object.values(state.tagsMap).forEach((list) => list.forEach((t) => tags.add(t)));
  const sorted = Array.from(tags).sort();
  elements.tagFilters.innerHTML = "";

  const allChip = document.createElement("div");
  allChip.className = `chip ${state.activeTag ? "" : "active"}`;
  allChip.textContent = "All";
  allChip.addEventListener("click", () => {
    state.activeTag = null;
    render();
  });
  elements.tagFilters.appendChild(allChip);

  sorted.forEach((tag) => {
    const chip = document.createElement("div");
    chip.className = `chip ${state.activeTag === tag ? "active" : ""}`;
    chip.textContent = tag;
    chip.addEventListener("click", () => {
      state.activeTag = state.activeTag === tag ? null : tag;
      render();
    });
    elements.tagFilters.appendChild(chip);
  });
}

function renderFolderTree() {
  elements.folderTree.innerHTML = "";

  const rootList = document.createElement("ul");
  const allItem = document.createElement("li");
  const allRow = document.createElement("div");
  allRow.className = `tree-item ${state.selectedFolder ? "" : "active"}`;
  allRow.textContent = "All Bookmarks";
  allRow.addEventListener("click", () => {
    state.selectedFolder = null;
    render();
  });
  allItem.appendChild(allRow);
  rootList.appendChild(allItem);

  const buildNode = (node, path) => {
    const li = document.createElement("li");
    const row = document.createElement("div");
    row.className = `tree-item ${
      state.selectedFolder && state.selectedFolder.join("/") === path.join("/") ? "active" : ""
    }`;

    const left = document.createElement("div");
    left.className = "tree-left";

    const toggle = document.createElement("span");
    toggle.className = "tree-toggle";
    toggle.textContent = node.children && node.children.length ? (state.collapsedFolders.has(node.id) ? "▸" : "▾") : "";
    left.appendChild(toggle);

    const label = document.createElement("span");
    label.textContent = node.title || "(untitled)";
    left.appendChild(label);

    row.appendChild(left);

    const action = document.createElement("button");
    action.className = "tree-action";
    action.textContent = "AI";
    action.title = "AI Organize this folder";
    action.addEventListener("click", (event) => {
      event.stopPropagation();
      runAiOrganize({ scopePath: path });
    });
    row.appendChild(action);

    row.addEventListener("click", (event) => {
      event.stopPropagation();
      state.selectedFolder = path;
      render();
    });

    if (node.children && node.children.length) {
      toggle.addEventListener("click", (event) => {
        event.stopPropagation();
        if (state.collapsedFolders.has(node.id)) {
          state.collapsedFolders.delete(node.id);
        } else {
          state.collapsedFolders.add(node.id);
        }
        renderFolderTree();
      });
    }

    li.appendChild(row);

    if (node.children && node.children.length && !state.collapsedFolders.has(node.id)) {
      const ul = document.createElement("ul");
      node.children.forEach((child) => ul.appendChild(buildNode(child, [...path, child.title])));
      li.appendChild(ul);
    }

    return li;
  };

  state.folderTree.forEach((node) => rootList.appendChild(buildNode(node, [node.title])));
  elements.folderTree.appendChild(rootList);
}

function renderBookmarkList() {
  const filtered = getFilteredBookmarks();
  elements.bookmarkCount.textContent = `${filtered.length} bookmarks`;
  elements.bookmarkList.innerHTML = "";

  const batchSize = 120;
  let index = 0;

  const renderBatch = () => {
    const fragment = document.createDocumentFragment();
    for (let i = 0; i < batchSize && index < filtered.length; i++, index++) {
      const bm = filtered[index];
      const row = document.createElement("div");
      row.className = "row";

      const titleCol = document.createElement("div");
      const title = document.createElement("div");
      title.className = "row-title";
      title.textContent = bm.title;
      const meta = document.createElement("div");
      meta.className = "row-meta";
      meta.textContent = bm.url;
      titleCol.appendChild(title);
      titleCol.appendChild(meta);

      const folderCol = document.createElement("div");
      folderCol.innerHTML = `<div class="row-meta">Folder</div><div>${escapeText(
        bm.folderPath.join(" / ")
      )}</div>`;

      const tagCol = document.createElement("div");
      const tagLabel = document.createElement("div");
      tagLabel.className = "row-meta";
      tagLabel.textContent = "Tags";
      const tagWrap = document.createElement("div");
      tagWrap.className = "row-tags";
      const tags = state.tagsMap[bm.id] || [];
      if (tags.length === 0) {
        const empty = document.createElement("span");
        empty.className = "row-meta";
        empty.textContent = "—";
        tagWrap.appendChild(empty);
      } else {
        tags.forEach((tag) => {
          const chip = document.createElement("span");
          chip.className = "tag";
          chip.textContent = tag;
          tagWrap.appendChild(chip);
        });
      }
      tagCol.appendChild(tagLabel);
      tagCol.appendChild(tagWrap);

      row.appendChild(titleCol);
      row.appendChild(folderCol);
      row.appendChild(tagCol);
      fragment.appendChild(row);
    }

    elements.bookmarkList.appendChild(fragment);
    if (index < filtered.length) {
      requestAnimationFrame(renderBatch);
    }
  };

  renderBatch();
}

function render() {
  renderTagFilters();
  renderFolderTree();
  renderBookmarkList();
}

async function loadData() {
  const tree = await getBookmarksTree();
  const { bookmarks, folders, folderPaths } = flattenBookmarks(tree);
  state.bookmarks = bookmarks;
  state.folders = folders;
  state.items = [...bookmarks, ...folders];
  state.itemsMap = new Map(state.items.map((item) => [item.id, item]));
  state.folderTree = buildFolderTree(tree);
  state.topLevelFolders = state.folderTree.map((node) => node.title).filter(Boolean);
  state.folderPaths = folderPaths.map((p) => p.join(" / "));
  state.tagsMap = await getTagsMap();
  render();
}

function chunkBookmarks(list) {
  const chunkSize = list.length > 200 ? 150 : list.length || 1;
  const chunks = [];
  for (let i = 0; i < list.length; i += chunkSize) {
    chunks.push(list.slice(i, i + chunkSize));
  }
  return chunks;
}

async function exportBackup() {
  const tree = await getBookmarksTree();
  const backup = {
    createdAt: new Date().toISOString(),
    tree
  };
  await setLastBackup(backup);

  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `bookmark-backup-${Date.now()}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
  showStatus("Backup exported.");
}

function buildPreflightNode(payload, chunkInfo) {
  const wrapper = document.createElement("div");
  const desc = document.createElement("p");
  desc.textContent = `This is exactly what will be sent for chunk ${chunkInfo.chunkId} of ${chunkInfo.totalChunks}.`;
  wrapper.appendChild(desc);

  const note = document.createElement("p");
  note.textContent = `Redaction mode: ${state.settings.sendFullUrl ? "full" : state.settings.redactQuery ? "redacted" : "query-only"}.`;
  wrapper.appendChild(note);

  const pre = document.createElement("pre");
  pre.textContent = JSON.stringify(payload, null, 2);
  pre.style.background = "#f7f1e6";
  pre.style.padding = "12px";
  pre.style.borderRadius = "10px";
  pre.style.maxHeight = "300px";
  pre.style.overflow = "auto";
  wrapper.appendChild(pre);
  return wrapper;
}

function buildProgressNode(scopeLabel, totalChunks) {
  const wrapper = document.createElement("div");
  wrapper.className = "progress-wrap";

  const title = document.createElement("div");
  title.textContent = `Organizing: ${scopeLabel}`;

  const status = document.createElement("div");
  status.textContent = "Preparing...";

  const bar = document.createElement("div");
  bar.className = "progress-bar";
  const fill = document.createElement("div");
  fill.className = "progress-fill";
  bar.appendChild(fill);

  const details = document.createElement("div");
  details.className = "progress-details";
  details.textContent = `0 / ${totalChunks} chunks`;

  const errorBox = document.createElement("div");
  errorBox.className = "progress-error";
  errorBox.style.display = "none";

  const debugDetails = document.createElement("details");
  debugDetails.className = "progress-debug";
  const debugSummary = document.createElement("summary");
  debugSummary.textContent = "Debug details";
  const debugPre = document.createElement("pre");
  debugPre.textContent = "";
  debugPre.style.background = "#f7f1e6";
  debugPre.style.padding = "10px";
  debugPre.style.borderRadius = "10px";
  debugPre.style.maxHeight = "220px";
  debugPre.style.overflow = "auto";
  debugDetails.appendChild(debugSummary);
  debugDetails.appendChild(debugPre);

  wrapper.appendChild(title);
  wrapper.appendChild(status);
  wrapper.appendChild(bar);
  wrapper.appendChild(details);
  wrapper.appendChild(errorBox);
  wrapper.appendChild(debugDetails);

  state.progress = { wrapper, status, fill, details, errorBox, debugPre, debugLines: [] };
  return wrapper;
}

function updateProgress({ message, chunkIndex, totalChunks }) {
  if (!state.progress) return;
  if (message) state.progress.status.textContent = message;
  if (typeof chunkIndex === "number" && typeof totalChunks === "number") {
    const percent = totalChunks > 0 ? Math.round((chunkIndex / totalChunks) * 100) : 0;
    state.progress.fill.style.width = `${percent}%`;
    state.progress.details.textContent = `${chunkIndex} / ${totalChunks} chunks`;
  }
}

function showProgressError(message) {
  if (!state.progress) return;
  state.progress.errorBox.textContent = message;
  state.progress.errorBox.style.display = "block";
}

function appendProgressDebug(line) {
  if (!state.progress) return;
  state.progress.debugLines.push(line);
  state.progress.debugPre.textContent = state.progress.debugLines.join("\n");
}

function updateProgressDebug(info) {
  if (!state.progress) return;
  const time = new Date().toLocaleTimeString();
  if (info.stage === "request") {
    appendProgressDebug(
      `[${time}] request chunk ${info.chunkIndex}/${info.totalChunks} | items: ${info.items} | model: ${info.model}`
    );
  }
  if (info.stage === "response") {
    appendProgressDebug(`[${time}] response ${info.status} (chunk ${info.chunkIndex}/${info.totalChunks})`);
    if (info.responseText) {
      appendProgressDebug(info.responseText);
    }
  }
  if (info.stage === "retry") {
    appendProgressDebug(`[${time}] retry due to validation errors: ${info.validationErrors.join("; ")}`);
  }
}

function getEffectiveSettings() {
  const base = state.settings || {};
  const parentCandidates = state.topLevelFolders.length ? state.topLevelFolders : [];
  let parent = base.categoryRootParent;
  if (!parent || (parentCandidates.length && !parentCandidates.includes(parent))) {
    parent = parentCandidates[0] || "Bookmarks Bar";
  }
  return { ...base, categoryRootParent: parent };
}

async function runAiOrganize({ scopePath = null } = {}) {
  if (state.running) return;
  state.settings = await getSettings();
  const effectiveSettings = getEffectiveSettings();

  if (!effectiveSettings.apiKey) {
    const wrapper = document.createElement("div");
    wrapper.innerHTML = "<p>Add an OpenAI API key in Settings before running AI organize.</p>";
    const openBtn = document.createElement("button");
    openBtn.className = "btn primary";
    openBtn.textContent = "Open Settings";
    openBtn.addEventListener("click", () => {
      chrome.runtime.openOptionsPage();
      closeModal();
    });
    openModal("API Key Required", wrapper, [openBtn]);
    return;
  }

  state.running = true;
  try {
    if (state.bookmarks.length === 0) {
      await loadData();
    }

    const scopeItems = scopePath
      ? state.items.filter((item) => {
          if (!arraysStartWith(item.folderPath, scopePath)) return false;
          if (item.type === "folder" && item.fullPath && item.fullPath.join("/") === scopePath.join("/")) {
            return false;
          }
          return true;
        })
      : state.items;

    if (scopeItems.length === 0) {
      showStatus("No items in this scope.");
      state.running = false;
      return;
    }

    const scopeLabel = scopePath ? scopePath.join(" / ") : "All Bookmarks";
    const chunks = chunkBookmarks(scopeItems);
    const chunkInfo = { chunkId: "1", totalChunks: chunks.length };
    const firstPayload = buildPayload(chunks[0], effectiveSettings, chunkInfo, state.folderPaths);

    if (!sessionStorage.getItem("privacyAccepted")) {
      const body = buildPreflightNode(firstPayload, chunkInfo);
      const cancelBtn = document.createElement("button");
      cancelBtn.className = "btn subtle";
      cancelBtn.textContent = "Cancel";
      cancelBtn.addEventListener("click", closeModal);

      const contBtn = document.createElement("button");
      contBtn.className = "btn primary";
      contBtn.textContent = "Continue";
      contBtn.addEventListener("click", () => {
        sessionStorage.setItem("privacyAccepted", "true");
        closeModal();
        runAiOrganize({ scopePath });
      });

      const title = `Privacy Preview (${scopeLabel})`;
      openModal(title, body, [cancelBtn, contBtn]);
      state.running = false;
      return;
    }

    const progressNode = buildProgressNode(scopeLabel, chunks.length);
    const closeBtn = document.createElement("button");
    closeBtn.className = "btn subtle";
    closeBtn.textContent = "Close";
    closeBtn.addEventListener("click", closeModal);
    openModal(`Organizing (${scopeLabel})`, progressNode, [closeBtn]);

    updateProgress({ message: "Requesting AI plan...", chunkIndex: 0, totalChunks: chunks.length });
    const suggestionsMap = new Map();
    const duplicates = [];

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const payload = buildPayload(
        chunk,
        effectiveSettings,
        { chunkId: String(i + 1), totalChunks: chunks.length },
        state.folderPaths
      );
      updateProgress({
        message: `Requesting AI plan... (${i + 1}/${chunks.length})`,
        chunkIndex: i + 1,
        totalChunks: chunks.length
      });
      const plan = await requestPlan(payload, effectiveSettings, (info) => {
        updateProgressDebug({
          ...info,
          chunkIndex: i + 1,
          totalChunks: chunks.length,
          items: payload.items.length,
          model: effectiveSettings.model
        });
      });
      (plan.suggestions || []).forEach((s) => suggestionsMap.set(s.itemId, s));
      (plan.duplicateGroups || []).forEach((g) => duplicates.push(g));
    }

    updateProgress({ message: "Building preview...", chunkIndex: chunks.length, totalChunks: chunks.length });
    const combinedPlan = {
      suggestions: Array.from(suggestionsMap.values()),
      duplicateGroups: duplicates
    };

    const preview = buildPreview(combinedPlan, state.itemsMap, state.tagsMap, effectiveSettings);
    state.preview = preview;
    closeModal();
    showPreview(preview);
  } catch (error) {
    const message = error && error.message ? error.message : "Unknown error.";
    if (state.progress) {
      showProgressError(message);
      const closeBtn = document.createElement("button");
      closeBtn.className = "btn";
      closeBtn.textContent = "Close";
      closeBtn.addEventListener("click", closeModal);
      elements.modalActions.innerHTML = "";
      elements.modalActions.appendChild(closeBtn);
    } else {
      const body = document.createElement("div");
      body.innerHTML = `<p>${escapeText(message)}</p>`;
      const closeBtn = document.createElement("button");
      closeBtn.className = "btn";
      closeBtn.textContent = "Close";
      closeBtn.addEventListener("click", closeModal);
      openModal("AI Organize Failed", body, [closeBtn]);
    }
  } finally {
    state.running = false;
  }
}

function showPreview(preview) {
  const wrapper = document.createElement("div");

  const summary = document.createElement("p");
  summary.textContent = `${preview.operations.length} proposed changes, ${preview.duplicateGroups.length} duplicate groups.`;
  wrapper.appendChild(summary);

  if (!state.settings.applyRenames) {
    const note = document.createElement("p");
    note.textContent = "Rename suggestions are disabled in Settings.";
    wrapper.appendChild(note);
  }

  const moveOps = preview.operations.filter((o) => o.type === "move");
  const renameOps = preview.operations.filter((o) => o.type === "rename");
  const tagOps = preview.operations.filter((o) => o.type === "tags");

  const section = (title, ops, renderRow) => {
    const block = document.createElement("div");
    block.className = "preview-section";
    const header = document.createElement("h3");
    header.textContent = `${title} (${ops.length})`;
    block.appendChild(header);
    if (ops.length === 0) {
      const empty = document.createElement("p");
      empty.textContent = "No changes.";
      block.appendChild(empty);
      return block;
    }

    const table = document.createElement("table");
    table.className = "preview-table";
    const thead = document.createElement("thead");
    thead.innerHTML = "<tr><th>Apply</th><th>Bookmark</th><th>Details</th></tr>";
    table.appendChild(thead);
    const tbody = document.createElement("tbody");

    ops.forEach((op) => {
      const tr = document.createElement("tr");
      const checkTd = document.createElement("td");
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = op.selected;
      if (op.type === "rename" && !state.settings.applyRenames) {
        checkbox.disabled = true;
        op.selected = false;
      }
      checkbox.addEventListener("change", () => {
        op.selected = checkbox.checked;
      });
      checkTd.appendChild(checkbox);

      const titleTd = document.createElement("td");
      titleTd.textContent = `${op.itemType === "folder" ? "Folder: " : "Bookmark: "}${op.title}`;
      const detailTd = document.createElement("td");
      detailTd.innerHTML = renderRow(op);

      tr.appendChild(checkTd);
      tr.appendChild(titleTd);
      tr.appendChild(detailTd);
      tbody.appendChild(tr);
    });

    table.appendChild(tbody);
    block.appendChild(table);
    return block;
  };

  wrapper.appendChild(
    section("Moves", moveOps, (op) => `From <span class="badge">${escapeText(op.from)}</span> to <span class="badge">${escapeText(op.to)}</span>`)
  );
  wrapper.appendChild(
    section("Renames", renameOps, (op) => `Rename to <span class="badge">${escapeText(op.proposedTitle)}</span>`)
  );
  wrapper.appendChild(
    section("Tags", tagOps, (op) => `Tags: ${op.tags.map((t) => `<span class="badge">${escapeText(t)}</span>`).join(" ")}`)
  );

  const dupSection = document.createElement("div");
  dupSection.className = "preview-section";
  const dupHeader = document.createElement("h3");
  dupHeader.textContent = `Duplicates (${preview.duplicateGroups.length})`;
  dupSection.appendChild(dupHeader);
  if (preview.duplicateGroups.length === 0) {
    const empty = document.createElement("p");
    empty.textContent = "No duplicates flagged.";
    dupSection.appendChild(empty);
  } else {
    preview.duplicateGroups.forEach((group) => {
      const p = document.createElement("p");
      p.textContent = `${group.reason} (keep ${group.recommendedKeepId})`;
      dupSection.appendChild(p);
    });
  }
  wrapper.appendChild(dupSection);

  const cancelBtn = document.createElement("button");
  cancelBtn.className = "btn subtle";
  cancelBtn.textContent = "Cancel";
  cancelBtn.addEventListener("click", closeModal);

  const applyBtn = document.createElement("button");
  applyBtn.className = "btn primary";
  applyBtn.textContent = "Apply Selected";
  applyBtn.addEventListener("click", async () => {
    if (!confirm("Apply selected changes? A backup will be exported first.")) return;
    await exportBackup();
    await applySelectedChanges(preview);
    closeModal();
    await loadData();
    showStatus("Changes applied.");
  });

  openModal("Preview Changes", wrapper, [cancelBtn, applyBtn]);
}

async function applySelectedChanges(preview) {
  const selectedOps = preview.operations.filter((op) => op.selected);
  const moveRenameOps = selectedOps.filter((op) => op.type === "move" || op.type === "rename");
  const tagOps = selectedOps.filter((op) => op.type === "tags");

  const effectiveSettings = getEffectiveSettings();
  await applyOperations(moveRenameOps, effectiveSettings);

  if (tagOps.length) {
    const tagsMap = { ...state.tagsMap };
    tagOps.forEach((op) => {
      tagsMap[op.itemId] = op.tags;
    });
    await setTagsMap(tagsMap);
    state.tagsMap = tagsMap;
  }
}

function attachEvents() {
  elements.searchInput.addEventListener("input", (event) => {
    state.searchQuery = event.target.value || "";
    renderBookmarkList();
  });

  elements.aiButton.addEventListener("click", () => runAiOrganize());
  elements.settingsButton.addEventListener("click", () => chrome.runtime.openOptionsPage());
  elements.exportButton.addEventListener("click", exportBackup);
  elements.modalClose.addEventListener("click", closeModal);
  elements.modal.addEventListener("click", (event) => {
    if (event.target === elements.modal) closeModal();
  });
  elements.aiFolderButton.addEventListener("click", () => {
    if (!state.selectedFolder) {
      showStatus("Select a folder to organize.");
      return;
    }
    runAiOrganize({ scopePath: state.selectedFolder });
  });
  elements.collapseAll.addEventListener("click", () => {
    if (state.collapsedFolders.size) {
      state.collapsedFolders.clear();
    } else {
      state.folderTree.forEach((node) => state.collapsedFolders.add(node.id));
    }
    renderFolderTree();
  });
}

async function init() {
  state.settings = await getSettings();
  attachEvents();
  await loadData();
}

init();

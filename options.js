import { getSettings, saveSettings, clearApiKey } from "./lib/storage.js";

const elements = {
  apiKey: document.getElementById("apiKey"),
  model: document.getElementById("model"),
  redactQuery: document.getElementById("redactQuery"),
  sendFullUrl: document.getElementById("sendFullUrl"),
  categoryRoot: document.getElementById("categoryRoot"),
  categoryRootParent: document.getElementById("categoryRootParent"),
  allowedTopLevel: document.getElementById("allowedTopLevel"),
  maxDepth: document.getElementById("maxDepth"),
  applyRenames: document.getElementById("applyRenames"),
  emptyFolderAction: document.getElementById("emptyFolderAction"),
  saveButton: document.getElementById("saveButton"),
  clearButton: document.getElementById("clearButton"),
  testButton: document.getElementById("testButton"),
  testStatus: document.getElementById("testStatus")
};

async function load() {
  const settings = await getSettings();
  elements.apiKey.value = settings.apiKey || "";
  elements.model.value = settings.model || "";
  elements.redactQuery.checked = Boolean(settings.redactQuery);
  elements.sendFullUrl.checked = Boolean(settings.sendFullUrl);
  elements.categoryRoot.value = settings.categoryRoot || "";
  elements.categoryRootParent.value = settings.categoryRootParent || "";
  elements.allowedTopLevel.value = settings.allowedTopLevel || "";
  elements.maxDepth.value = settings.maxDepth || 3;
  elements.applyRenames.checked = Boolean(settings.applyRenames);
  elements.emptyFolderAction.value = settings.emptyFolderAction || "trash";
}

async function save() {
  await saveSettings({
    apiKey: elements.apiKey.value.trim(),
    model: elements.model.value.trim(),
    redactQuery: elements.redactQuery.checked,
    sendFullUrl: elements.sendFullUrl.checked,
    categoryRoot: elements.categoryRoot.value.trim() || "AI Categories",
    categoryRootParent: elements.categoryRootParent.value.trim() || "Bookmarks Bar",
    allowedTopLevel: elements.allowedTopLevel.value.trim(),
    maxDepth: Number(elements.maxDepth.value) || 3,
    applyRenames: elements.applyRenames.checked,
    emptyFolderAction: elements.emptyFolderAction.value || "trash"
  });
  elements.testStatus.textContent = "Saved.";
  setTimeout(() => (elements.testStatus.textContent = ""), 1500);
}

async function testConnection() {
  const apiKey = elements.apiKey.value.trim();
  const model = elements.model.value.trim();
  if (!apiKey || !model) {
    elements.testStatus.textContent = "Please enter API key and model.";
    return;
  }
  elements.testStatus.textContent = "Testing...";

  const body = {
    model,
    input: [
      { role: "system", content: "You are a connection tester. Reply with JSON only." },
      { role: "user", content: "Return { \"ok\": true }." }
    ],
    text: {
      format: {
        type: "json_schema",
        name: "connection_test",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          properties: { ok: { type: "boolean" } },
          required: ["ok"]
        }
      }
    }
  };

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errText = await response.text();
      elements.testStatus.textContent = `Error ${response.status}: ${errText.slice(0, 120)}`;
      return;
    }

    elements.testStatus.textContent = "Connection OK.";
  } catch (error) {
    elements.testStatus.textContent = `Failed: ${error.message}`;
  }
}

async function clearKey() {
  await clearApiKey();
  elements.apiKey.value = "";
  elements.testStatus.textContent = "API key cleared.";
}

function attach() {
  elements.saveButton.addEventListener("click", save);
  elements.clearButton.addEventListener("click", clearKey);
  elements.testButton.addEventListener("click", testConnection);
}

load();
attach();

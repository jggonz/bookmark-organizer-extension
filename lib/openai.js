const PLAN_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    version: { type: "string" },
    chunkInfo: {
      type: "object",
      additionalProperties: false,
      properties: {
        chunkId: { type: "string" },
        totalChunks: { type: "integer" }
      },
      required: ["chunkId", "totalChunks"]
    },
    suggestions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          itemId: { type: "string" },
          itemType: { type: "string", enum: ["bookmark", "folder"] },
          proposedFolderPath: { type: "array", items: { type: "string" } },
          tags: { type: "array", items: { type: "string" } },
          proposedTitle: { type: ["string", "null"] },
          confidence: { type: "number" },
          rationale: { type: "string" }
        },
        required: ["itemId", "itemType", "proposedFolderPath", "tags", "proposedTitle", "confidence", "rationale"]
      }
    },
    duplicateGroups: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          reason: { type: "string" },
          bookmarkIds: { type: "array", items: { type: "string" } },
          recommendedKeepId: { type: "string" }
        },
        required: ["reason", "bookmarkIds", "recommendedKeepId"]
      }
    }
  },
  required: ["version", "chunkInfo", "suggestions", "duplicateGroups"]
};

function extractOutputText(response) {
  if (response.output_text) return response.output_text;
  if (Array.isArray(response.output)) {
    for (const item of response.output) {
      if (Array.isArray(item.content)) {
        for (const content of item.content) {
          if (content.type === "output_text" || content.type === "text") {
            return content.text;
          }
        }
      }
    }
  }
  return null;
}

function truncateText(text, limit = 3000) {
  if (!text) return "";
  if (text.length <= limit) return text;
  return `${text.slice(0, limit)}\n... (truncated)`;
}

function validatePlan(plan) {
  const errors = [];
  if (!plan || typeof plan !== "object") {
    return ["Plan is not an object."];
  }
  if (typeof plan.version !== "string") errors.push("version must be string");
  if (!plan.chunkInfo || typeof plan.chunkInfo !== "object") {
    errors.push("chunkInfo missing");
  } else {
    if (typeof plan.chunkInfo.chunkId !== "string") errors.push("chunkInfo.chunkId must be string");
    if (!Number.isInteger(plan.chunkInfo.totalChunks)) errors.push("chunkInfo.totalChunks must be integer");
  }
  if (!Array.isArray(plan.suggestions)) errors.push("suggestions must be array");
  if (!Array.isArray(plan.duplicateGroups)) errors.push("duplicateGroups must be array");

  if (Array.isArray(plan.suggestions)) {
    plan.suggestions.forEach((s, i) => {
      if (!s || typeof s !== "object") {
        errors.push(`suggestions[${i}] must be object`);
        return;
      }
      if (typeof s.itemId !== "string") errors.push(`suggestions[${i}].itemId must be string`);
      if (s.itemType !== "bookmark" && s.itemType !== "folder") {
        errors.push(`suggestions[${i}].itemType must be bookmark or folder`);
      }
      if (!Array.isArray(s.proposedFolderPath)) errors.push(`suggestions[${i}].proposedFolderPath must be array`);
      if (!Array.isArray(s.tags)) errors.push(`suggestions[${i}].tags must be array`);
      if (typeof s.confidence !== "number") errors.push(`suggestions[${i}].confidence must be number`);
      if (typeof s.rationale !== "string") errors.push(`suggestions[${i}].rationale must be string`);
      if (s.proposedTitle !== null && s.proposedTitle !== undefined && typeof s.proposedTitle !== "string") {
        errors.push(`suggestions[${i}].proposedTitle must be string or null`);
      }
    });
  }

  if (Array.isArray(plan.duplicateGroups)) {
    plan.duplicateGroups.forEach((g, i) => {
      if (!g || typeof g !== "object") {
        errors.push(`duplicateGroups[${i}] must be object`);
        return;
      }
      if (typeof g.reason !== "string") errors.push(`duplicateGroups[${i}].reason must be string`);
      if (!Array.isArray(g.bookmarkIds)) errors.push(`duplicateGroups[${i}].bookmarkIds must be array`);
      if (typeof g.recommendedKeepId !== "string") errors.push(`duplicateGroups[${i}].recommendedKeepId must be string`);
    });
  }

  return errors;
}

async function fetchPlan(payload, settings, extraInstruction = "", debugCallback = null) {
  const categoryRoot = settings.categoryRoot || "AI Categories";
  const categoryRootParent = settings.categoryRootParent || "Bookmarks Bar";
  const systemPrompt = `You are a bookmark organization assistant.\n\nRules:\n- Return ONLY valid JSON that matches the provided schema.\n- Never propose deletions.\n- Each suggestion must include itemId and itemType (bookmark or folder).\n- proposedFolderPath is the TARGET PARENT path (for both bookmarks and folders).\n- proposedFolderPath should be a category path *relative* to the category root (do not include the category root or top-level parent).\n- Category root folder name: "${categoryRoot}". Its parent top-level folder: "${categoryRootParent}".\n- Keep folder depth <= ${settings.maxDepth}.\n- Prefer existing folder paths from existingFolderPaths; create new folders only if needed.\n- Provide concise tags (2-6) and optional title cleanup.\n- If no rename is needed, set proposedTitle to null.\n- Include confidence between 0 and 1.\n${extraInstruction}`;

  const body = {
    model: settings.model,
    input: [
      { role: "system", content: systemPrompt },
      { role: "user", content: JSON.stringify(payload) }
    ],
    text: {
      format: {
        type: "json_schema",
        name: "bookmark_plan",
        strict: true,
        schema: PLAN_SCHEMA
      }
    }
  };

  if (debugCallback) {
    debugCallback({
      stage: "request",
      requestSummary: {
        model: settings.model,
        items: Array.isArray(payload.items) ? payload.items.length : 0,
        chunk: payload.chunkInfo || null
      }
    });
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${settings.apiKey}`
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errText = await response.text();
    if (debugCallback) {
      debugCallback({
        stage: "response",
        status: response.status,
        responseText: truncateText(errText)
      });
    }
    const error = new Error(`OpenAI error ${response.status}: ${errText.slice(0, 200)}`);
    error.status = response.status;
    error.responseText = errText;
    throw error;
  }

  const rawText = await response.text();
  if (debugCallback) {
    debugCallback({
      stage: "response",
      status: response.status,
      responseText: truncateText(rawText)
    });
  }

  let data;
  try {
    data = JSON.parse(rawText);
  } catch {
    throw new Error("OpenAI returned non-JSON response.");
  }
  const text = extractOutputText(data);
  if (!text) {
    throw new Error("No output text returned from OpenAI.");
  }

  let plan;
  try {
    plan = JSON.parse(text);
  } catch {
    throw new Error("Model output was not valid JSON.");
  }

  return plan;
}

export async function requestPlan(payload, settings, debugCallback = null) {
  let plan = await fetchPlan(payload, settings, "", debugCallback);
  let errors = validatePlan(plan);
  if (errors.length === 0) return plan;

  const extra = `\nThe previous output did not match schema. Errors: ${errors.join("; ")}. You MUST fix to match schema exactly.`;
  if (debugCallback) {
    debugCallback({ stage: "retry", validationErrors: errors });
  }
  plan = await fetchPlan(payload, settings, extra, debugCallback);
  errors = validatePlan(plan);
  if (errors.length > 0) {
    throw new Error(`Schema validation failed: ${errors.join("; ")}`);
  }
  return plan;
}

export { PLAN_SCHEMA, validatePlan };

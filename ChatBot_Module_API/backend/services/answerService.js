const axios = require("axios");

/**
 * Natural language conversational answer generator.
 * Combines grounded rule-based formatting with optional local/cloud LLM providers.
 */

function formatCurrency(val) {
  if (typeof val === "number") {
    return `₹${val.toFixed(2)}`;
  }
  return val;
}

function composeLiveApiResponse({ projectName, endpoint, entities = {}, apiData }) {
  if (!apiData) {
    return `I contacted the ${projectName} service, but received an empty response.`;
  }

  // If response is a direct message or string
  if (typeof apiData === "string") return apiData;
  if (apiData.message && typeof apiData.message === "string") return apiData.message;
  if (apiData.detail && typeof apiData.detail === "string") return apiData.detail;

  // If response is an Array of items (e.g. search results, records)
  if (Array.isArray(apiData)) {
    if (apiData.length === 0) {
      const itemSearched = entities.medicine_name || entities.product_name || entities.item || entities.ItemName || "";
      return itemSearched
        ? `I checked ${projectName}, but could not find any records matching **${itemSearched}**.`
        : `No records were found for your request in ${projectName}.`;
    }

    if (apiData.length === 1) {
      const item = apiData[0];
      return formatSingleRecord(item, projectName);
    }

    // Multiple items -> format bullet list
    let lines = [`Found **${apiData.length} records** in ${projectName}:\n`];
    for (let i = 0; i < Math.min(apiData.length, 5); i++) {
      const it = apiData[i];
      const title = it.name || it.product_name || it.medicine_name || it.title || `Item #${i + 1}`;
      const price = it.price !== undefined ? ` • Price: ${formatCurrency(it.price)}` : "";
      const stock = it.stock !== undefined ? ` • Stock: ${it.stock} units` : "";
      const status = it.status ? ` • Status: ${it.status}` : "";
      lines.push(`- **${title}**${price}${stock}${status}`);
    }
    if (apiData.length > 5) {
      lines.push(`\n*(and ${apiData.length - 5} more items)*`);
    }
    return lines.join("\n");
  }

  // If response is an object with items/data array inside
  if (apiData.items && Array.isArray(apiData.items)) {
    return composeLiveApiResponse({ projectName, endpoint, entities, apiData: apiData.items });
  }
  if (apiData.data && (Array.isArray(apiData.data) || typeof apiData.data === "object")) {
    return composeLiveApiResponse({ projectName, endpoint, entities, apiData: apiData.data });
  }

  // Single Object record
  return formatSingleRecord(apiData, projectName);
}

function formatSingleRecord(record, projectName) {
  if (typeof record !== "object" || record === null) return String(record);

  const title = record.name || record.product_name || record.medicine_name || record.title || "Record";
  const lines = [`Here are the details for **${title}** from ${projectName}:\n`];

  for (const [key, val] of Object.entries(record)) {
    if (["_id", "__v", "id"].includes(key)) continue;
    if (val === null || val === undefined || typeof val === "object") continue;

    const readableKey = key
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());

    const displayVal = key.toLowerCase().includes("price") || key.toLowerCase().includes("cost")
      ? formatCurrency(val)
      : String(val);

    lines.push(`• **${readableKey}**: ${displayVal}`);
  }

  return lines.join("\n");
}

function composeKnowledgeResponse({ projectName, knowledgeChunks = [] }) {
  if (knowledgeChunks.length === 0) {
    return `I checked the knowledge base for ${projectName}, but did not find specific information on that topic.`;
  }

  const primary = knowledgeChunks[0];
  let answer = `**${primary.title}**\n\n${primary.content}`;

  if (knowledgeChunks.length > 1) {
    answer += "\n\n**Related Information:**";
    for (let i = 1; i < Math.min(knowledgeChunks.length, 3); i++) {
      const c = knowledgeChunks[i];
      answer += `\n• **${c.title}**: ${c.content.substring(0, 150)}${c.content.length > 150 ? "..." : ""}`;
    }
  }

  return answer;
}

function composeClarificationResponse({ missingParameters = [], intent = null }) {
  const paramNames = missingParameters.map((p) => p.replace(/_/g, " "));
  if (paramNames.length === 1) {
    return `To help you with that, could you please provide the **${paramNames[0]}**?`;
  }
  return `To complete your request, I need a few more details: please provide **${paramNames.join(", ")}**.`;
}

function composeConfirmationPrompt({ operation, parameters = {}, endpoint = null }) {
  const readableOp = (operation || "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .toLowerCase();
  const summaryParts = [];

  for (const [k, v] of Object.entries(parameters || {})) {
    if (["accessKey", "question"].includes(k)) continue;
    summaryParts.push(`**${k}**: ${v}`);
  }

  const detailsStr = summaryParts.length > 0 ? ` with ${summaryParts.join(", ")}` : "";
  return (
    `⚠️ **Action Confirmation Required**\n\n` +
    `You are requesting to perform: **${readableOp}**${detailsStr}.\n\n` +
    `This will modify live application data. Would you like to proceed? Click **Confirm** or reply **yes** to execute.`
  );
}

function composeGreeting({ projectName }) {
  return (
    `Hello! 👋 I am your AI assistant for **${projectName}**.\n\n` +
    `How can I assist you today? You can ask about products, services, live data, or business workflows.`
  );
}

function composeOutOfScopeResponse({ projectName, suggestedQuestions = [] }) {
  let text = `I'm not sure I understand that query in the context of **${projectName}**.`;
  if (suggestedQuestions.length > 0) {
    text += "\n\nHere are some things you can ask me:\n" + suggestedQuestions.map((q) => `• "${q}"`).join("\n");
  } else {
    text += "\n\nYou can ask about features, services, or live data available in this application.";
  }
  return text;
}

/**
 * Optional LLM synthesis adapter.
 * If user has configured Ollama or external LLM, refines the prompt.
 * Otherwise returns the deterministic grounded answer.
 */
async function synthesizeWithOptionalLLM({ prompt, groundedAnswer, llmConfig = null }) {
  if (!llmConfig || llmConfig.provider === "none") {
    return groundedAnswer;
  }

  try {
    if (llmConfig.provider === "ollama") {
      const ollamaUrl = `${llmConfig.api_base_url || "http://localhost:11434"}/api/generate`;
      const resp = await axios.post(
        ollamaUrl,
        {
          model: llmConfig.model_name || "llama3",
          prompt: `You are a helpful customer assistant. Given this verified factual information:\n${groundedAnswer}\n\nAnswer the user question politely: "${prompt}"`,
          stream: false,
        },
        { timeout: 8000 }
      );
      if (resp.data?.response) {
        return resp.data.response.trim();
      }
    }
  } catch (err) {
    // Graceful fallback to deterministic answer
    console.debug("Optional LLM generation skipped/failed:", err.message);
  }

  return groundedAnswer;
}

module.exports = {
  composeLiveApiResponse,
  composeKnowledgeResponse,
  composeClarificationResponse,
  composeConfirmationPrompt,
  composeGreeting,
  composeOutOfScopeResponse,
  synthesizeWithOptionalLLM,
};

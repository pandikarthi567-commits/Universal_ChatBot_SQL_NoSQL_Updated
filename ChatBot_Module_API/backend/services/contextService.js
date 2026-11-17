const Conversation = require("../models/Conversation");
const { getNextSequence } = require("../models/Counter");

/**
 * Retrieves or initializes conversation context for a session.
 */
async function getOrCreateConversation({ sessionId, projectId, userId = null }) {
  let conv = await Conversation.findOne({
    session_id: sessionId,
    project_id: Number(projectId),
  });

  if (!conv) {
    const id = await getNextSequence("conversation");
    conv = new Conversation({
      id,
      session_id: sessionId,
      project_id: Number(projectId),
      user_id: userId ? Number(userId) : null,
      context: {
        last_intent: null,
        last_entities: {},
        active_entity_reference: {
          type: null,
          name: null,
          id: null,
          attributes: {},
        },
        pending_parameters: {},
        target_endpoint_id: null,
        target_intent_name: null,
        recent_results: [],
        clarification_prompt: null,
      },
      message_count: 0,
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
    });
    await conv.save();
  }

  return conv;
}

/**
 * Resolves conversational references (anaphora: "its", "it", "that", "those")
 * using previous conversation context.
 */
function resolveConversationReferences({ question, entities = {}, context = {} }) {
  const resolvedEntities = { ...(entities || {}) };
  const activeRef = context.active_entity_reference || {};
  const qLower = (question || "").toLowerCase();

  // Words that indicate anaphoric references
  const hasPronounRef = /\b(its|it|that|those|this|same|the medicine|the product|the item)\b/i.test(qLower);

  if (hasPronounRef && activeRef.name) {
    // If no explicit item/medicine/product entity was extracted in current turn,
    // inject the active reference entity from context!
    const entityKeys = Object.keys(resolvedEntities);
    const hasNameEntity = entityKeys.some(
      (k) =>
        k.toLowerCase().includes("item") ||
        k.toLowerCase().includes("product") ||
        k.toLowerCase().includes("medicine") ||
        k.toLowerCase().includes("name") ||
        k.toLowerCase() === "category"
    );

    if (!hasNameEntity) {
      const targetKey = activeRef.type || "ItemName";
      resolvedEntities[targetKey] = activeRef.name;
      if (activeRef.id) {
        resolvedEntities[`${targetKey}_id`] = activeRef.id;
      }
    }
  }

  // Parse quantity from conversational phrases like "add two", "give me 3", "two strips"
  if (!resolvedEntities.quantity && !resolvedEntities.Quantity) {
    const wordNumbers = {
      one: 1,
      two: 2,
      three: 3,
      four: 4,
      five: 5,
      six: 6,
      seven: 7,
      eight: 8,
      nine: 9,
      ten: 10,
    };
    const qtyMatch = qLower.match(/\b(one|two|three|four|five|six|seven|eight|nine|ten|\d+)\s*(?:units?|strips?|packs?|boxes?|items?|bottles?|pieces?)?\b/);
    if (qtyMatch) {
      const rawQty = qtyMatch[1];
      const parsedQty = wordNumbers[rawQty] || parseInt(rawQty, 10);
      if (!isNaN(parsedQty)) {
        resolvedEntities.quantity = parsedQty;
      }
    }
  }

  return resolvedEntities;
}

/**
 * Updates conversation state after a turn is completed.
 */
async function updateConversationContext({
  sessionId,
  projectId,
  intent,
  entities = {},
  apiResult = null,
  pendingParams = {},
  targetEndpointId = null,
  targetIntentName = null,
  clarificationPrompt = null,
}) {
  const conv = await getOrCreateConversation({ sessionId, projectId });

  const ctx = conv.context || {};
  ctx.last_intent = intent || ctx.last_intent;
  ctx.last_entities = { ...(ctx.last_entities || {}), ...(entities || {}) };
  ctx.pending_parameters = pendingParams || {};
  ctx.target_endpoint_id = targetEndpointId;
  ctx.target_intent_name = targetIntentName;
  ctx.clarification_prompt = clarificationPrompt;

  // Extract active entity reference from entities or API result
  // Look for keys like medicine_name, product_name, item, category, name, id
  for (const [k, v] of Object.entries(entities || {})) {
    if (
      v &&
      typeof v === "string" &&
      (k.toLowerCase().includes("item") ||
        k.toLowerCase().includes("product") ||
        k.toLowerCase().includes("medicine") ||
        k.toLowerCase().includes("name") ||
        k.toLowerCase() === "category")
    ) {
      ctx.active_entity_reference = {
        type: k,
        name: v,
        id: entities.id || entities.item_id || null,
        attributes: { ...(entities || {}) },
      };
      break;
    }
  }

  // If API returned a specific record, record it in active reference & recent results
  if (apiResult && typeof apiResult === "object") {
    if (apiResult.data) {
      const record = Array.isArray(apiResult.data) ? apiResult.data[0] : apiResult.data;
      if (record && typeof record === "object") {
        ctx.recent_results = Array.isArray(apiResult.data) ? apiResult.data.slice(0, 5) : [record];
        const recordName = record.name || record.product_name || record.medicine_name || record.title;
        if (recordName) {
          ctx.active_entity_reference.name = recordName;
          ctx.active_entity_reference.id = record.id || record._id || ctx.active_entity_reference.id;
          ctx.active_entity_reference.attributes = record;
        }
      }
    }
  }

  conv.context = ctx;
  conv.message_count += 1;
  conv.updated_at = new Date();
  conv.expires_at = new Date(Date.now() + 24 * 60 * 60 * 1000); // Reset 24-hr TTL

  await conv.save();
  return conv;
}

/**
 * Resets context for a session.
 */
async function clearConversationSession(sessionId, projectId) {
  return Conversation.findOneAndDelete({
    session_id: sessionId,
    project_id: Number(projectId),
  });
}

module.exports = {
  getOrCreateConversation,
  resolveConversationReferences,
  updateConversationContext,
  clearConversationSession,
};

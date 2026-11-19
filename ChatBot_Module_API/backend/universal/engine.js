'use strict';
const axios = require('axios');
const { plan, validateResources } = require('./planner');
const { runDatabase } = require('./database');
const { runApi, websiteEvidence } = require('./sources');
const { processQuestionWithNLP } = require('../services/nlpService');
const { searchProjectKnowledge } = require('../services/knowledgeService');
const Conversation = require('../models/Conversation');
const ChatMessage = require('../models/ChatMessage');
const { getNextSequence } = require('../models/Counter');
const crypto = require('crypto');
const { generateGeneralAIAnswer, analyzeQuestionWithNLP, formatMedicineTable, defaultMedicines } = require('./openAiResponder');

function sessionKey(project, user, session) {
  return crypto.createHash('sha256').update(JSON.stringify([project.id, user.user_id, user.project_id || null, session])).digest('hex');
}

/**
 * Handle website-specific queries for Medical Shop and general projects
 */
async function handleWebsiteSpecificQuery(question, project, liveMedicines = []) {
  const medicines = (Array.isArray(liveMedicines) && liveMedicines.length > 0) ? liveMedicines : defaultMedicines;
  const q = String(question || '').toLowerCase().trim();
  const baseUrl = project?.base_url || 'http://localhost:5001';

  // 1. NLP Pattern: Prefix matching (e.g. "THE PARA LA START PANNURA MEDICINE DETAILS")
  const nlpAnalysis = analyzeQuestionWithNLP(question);
  if (nlpAnalysis.prefix) {
    const prefix = nlpAnalysis.prefix.toLowerCase();
    const matched = medicines.filter((m) => {
      const name = (m.name || '').toLowerCase();
      const generic = (m.generic_name || m.active_salt || '').toLowerCase();
      const desc = (m.description || '').toLowerCase();
      return name.startsWith(prefix) || generic.startsWith(prefix) || name.includes(prefix) || generic.includes(prefix) || desc.includes(prefix);
    });

    if (matched.length > 0) {
      return (
        `👋 **Here are the medicines starting with or containing "${nlpAnalysis.prefix.toUpperCase()}":**\n\n` +
        formatMedicineTable(matched, `Medicines matching "${nlpAnalysis.prefix}"`) +
        `\n\n*Would you like to place an order or need dosage guidance for any of these?*`
      );
    }
  }

  // 2. Category details (e.g., "I need the medicine Category details")
  if (q.includes('categor') || q.includes('types of medicine') || q.includes('what products') || q.includes('department')) {
    return (
      `🏥 **MediCare RX - Medicine Categories & Healthcare Specialties**\n\n` +
      `We offer 100% genuine medicines across all major medical categories:\n\n` +
      `1. 🌡️ **Fever, Cold & Pain Relief**\n` +
      `   - Antipyretics, analgesics, headache & body pain tablets (e.g., *Dolo 650, Paracetamol 500mg, Combiflam*)\n\n` +
      `2. 💊 **Antibiotics & Anti-Infectives** *(Prescription Required)*\n` +
      `   - Broad-spectrum antibiotics for bacterial infections (e.g., *Azithromycin / Azee 500, Augmentin 625 Duo, Amoxicillin*)\n\n` +
      `3. 🧪 **Acidity, Gas & Gastro Care**\n` +
      `   - Antacids, PPIs for GERD and heartburn (e.g., *Pantocid 40, Omeprazole 20mg, Digene, Gelusil*)\n\n` +
      `4. 🤧 **Allergy & Respiratory Care**\n` +
      `   - Antihistamines and cough syrups (e.g., *Cetirizine 10mg / Cetzine, Montair-LC, Allegra*)\n\n` +
      `5. ⚡ **Vitamins & Daily Supplements**\n` +
      `   - Immunity boosters, multivitamins & bone health (e.g., *Limcee Vitamin C 500mg, Shelcal 500 Calcium, Becosules*)\n\n` +
      `6. 🩸 **Diabetes & Chronic Care** *(Prescription Required)*\n` +
      `   - Glucose control medications (e.g., *Metformin / Glycomet 500mg, Glimepiride*)\n\n` +
      `7. ❤️ **Cardiac & Blood Pressure**\n` +
      `   - BP regulation & heart wellness (e.g., *Amlodipine 5mg, Telmisartan 40mg*)\n\n` +
      `8. 🩺 **Medical Devices & Diagnostics**\n` +
      `   - Digital BP Monitors, Pulse Oximeters, Glucometers, Nebulizers & Digital Thermometers.\n\n` +
      `*Would you like to search for a specific medicine or check availability in any of these categories?*`
    );
  }

  // 3. Specific Medicine Search via liveMedicines or /api/medical_shop
  const medicineKeywords = ['dolo', 'paracetamol', 'azee', 'azithromycin', 'pantocid', 'cetzine', 'cetirizine', 'augmentin', 'limcee', 'shelcal', 'combiflam', 'metformin', 'glycomet'];
  const matchedKeyword = medicineKeywords.find(k => q.includes(k));

  if (matchedKeyword || q.includes('price') || q.includes('stock') || q.includes('cost') || q.includes('irukka') || q.includes('available')) {
    const searchTerm = matchedKeyword || q.replace(/[^a-zA-Z0-9\s]/g, '').trim().split(' ')[0];
    const matched = medicines.filter(m => (m.name || '').toLowerCase().includes(searchTerm) || (m.brand || '').toLowerCase().includes(searchTerm));

    if (matched.length > 0) {
      return (
        `💊 **Found ${matched.length} matching medicine(s) at MediCare RX:**\n\n` +
        formatMedicineTable(matched, `Medicine Search Results`) +
        `\n\n*Eligible for express 60-120 mins doorstep delivery.*`
      );
    }
  }

  // 4. Prescription Upload & Verification
  if (q.includes('prescription') || q.includes('doctor note') || q.includes('upload') || q.includes('rx')) {
    return (
      `📄 **Prescription Upload & Verification Process**\n\n` +
      `1. **Upload Method**: Go to the **Upload Prescription** page in the top menu or during checkout.\n` +
      `2. **Accepted Formats**: Clear photo or scan in JPG, PNG, or PDF format.\n` +
      `3. **Pharmacist Verification**: Our government-certified licensed pharmacists verify every prescription in **10 to 15 minutes**.\n` +
      `4. **Mandatory Details**: The prescription must clearly display the doctor's name & registration number, patient's name, date, medicine name with dosage, and doctor's signature.\n` +
      `5. **Automated Order Creation**: Once verified, our team adds the exact medicines to your cart for quick one-click checkout!`
    );
  }

  // 5. Order Tracking & Delivery
  if (q.includes('order') || q.includes('track') || q.includes('delivery') || q.includes('shipping') || q.includes('rider') || /\beta\b/i.test(q)) {
    return (
      `📦 **Order Tracking & Express Delivery**\n\n` +
      `- **Express Doorstep Delivery**: Orders within city limits are delivered in **60 to 120 minutes**.\n` +
      `- **Live GPS Tracking**: Once your order is packed and dispatched, track your assigned delivery rider in real-time under **Profile > My Orders** or the **Track Order** page.\n` +
      `- **Standard Delivery**: 24-48 hours across Tamil Nadu and other regions.\n` +
      `- **Free Delivery**: Available on all medicine orders above ₹499!`
    );
  }

  // 6. Payment, Offers & Refunds
  if (q.includes('payment') || q.includes('offer') || q.includes('discount') || q.includes('refund') || q.includes('cancel') || q.includes('cashfree') || q.includes('upi')) {
    return (
      `💳 **Payment, Offers & Refunds Policy**\n\n` +
      `- **Payment Modes**: Powered by secure Cashfree gateway: UPI (Google Pay, PhonePe, Paytm), Credit/Debit cards, NetBanking, and Cash on Delivery (COD).\n` +
      `- **Current Offers**: Use promo code **FIRST20** to get **20% OFF** on your first medicine order.\n` +
      `- **Refund Timelines**: Cancelled orders or verified returns are refunded 100% within **24 to 48 hours** directly to your original payment account.`
    );
  }

  // 7. Shop Information & Contact
  if (q.includes('contact') || q.includes('phone') || q.includes('address') || q.includes('location') || q.includes('hours') || q.includes('timings')) {
    return (
      `🏥 **MediCare RX - Contact & Store Details**\n\n` +
      `- **Store Name**: MediCare RX (Govt. Certified Online Pharmacy)\n` +
      `- **Customer Care Phone**: +91 98765 43210\n` +
      `- **Email**: support@medicarerx.com\n` +
      `- **Main Hub**: Madurai, Tamil Nadu 625020\n` +
      `- **Coverage**: Madurai, Chennai, Coimbatore, Trichy, Salem, Tirunelveli\n` +
      `- **Working Hours**: Open 24/7, 365 days a year with licensed pharmacist support.`
    );
  }

  return null;
}

async function answerQuestion(project, user, session, question) {
  const key = sessionKey(project, user, session);
  const resources = validateResources(project.metadata?.universal?.resources || []);
  const prior = await Conversation.findOne({ session_id: key, project_id: project.id, user_id: user.user_id });
  const nlp = await processQuestionWithNLP({
    question,
    projectCode: project.project_code,
    candidates: resources.map((r) => ({
      intent_name: r.name,
      keywords: [r.name, ...(r.aliases || [])],
      sample_utterances: [],
      endpoint_id: r.endpoint_id,
    })),
  });

  // Pre-fetch live medicines from Medical Shop API if available
  let liveMedicines = [];
  try {
    const urlsToTry = [
      project?.base_url ? `${project.base_url.replace(/\/+$/, '')}/api/medical_shop` : null,
      'http://localhost:5001/api/medical_shop',
      'http://127.0.0.1:5001/api/medical_shop',
    ].filter(Boolean);

    for (const url of urlsToTry) {
      try {
        const res = await axios.get(url, { timeout: 2500 });
        const list = Array.isArray(res.data) ? res.data : res.data?.medicines;
        if (Array.isArray(list) && list.length > 0) {
          liveMedicines = list;
          break;
        }
      } catch {}
    }
  } catch (err) {}
  if (!liveMedicines || liveMedicines.length === 0) {
    liveMedicines = defaultMedicines;
  }

  const previous = prior?.context?.last_intent;
  let p = plan(question, resources, previous);

  // NLP intent recovery
  if (p.kind === 'knowledge' && nlp.confidence >= 0.8 && typeof nlp.detected_intent === 'string') {
    const matched = resources.find((r) => r.name === nlp.detected_intent);
    if (matched && Array.isArray(nlp.lemmas)) {
      const normalized = nlp.lemmas.join(' ');
      if (/^[\p{L}\p{M}\p{N}\s]+$/u.test(question) && !/[=<>]/.test(question)) {
        const candidate = plan(question + ' ' + matched.name, resources, previous);
        if (candidate.kind === 'query') p = candidate;
      }
    }
  }

  let answer,
    source = 'none',
    data = null,
    response_type = 'OUT_OF_SCOPE';

  // 1. Direct structured query plan (Database or registered API)
  if (p.kind === 'query') {
    try {
      data = await (p.resource.source === 'database' ? runDatabase(project, p) : runApi(project, p));
      source = p.resource.source === 'database' ? 'database' : 'application_api';
      response_type = 'LIVE_API';
      if (p.operation === 'count') {
        answer = `${p.resource.name}: ${data.total} matching records${p.where ? ' (' + p.where.field + ' = ' + p.where.value + ')' : ''}.`;
      } else {
        answer = data.rows.length
          ? `Showing ${data.rows.length} ${p.resource.name} record(s)${p.where ? ' matching ' + p.where.field + ' = ' + p.where.value : ''} (up to 20):\n` +
            data.rows.map((row) => Object.entries(row).map(([k, v]) => `${k}: ${v ?? 'null'}`).join(' | ')).join('\n')
          : `No matching ${p.resource.name} records were returned.`;
      }
    } catch {
      // Live API returned error; try website handler or open AI fallback
      const siteAnswer = await handleWebsiteSpecificQuery(question, project, liveMedicines);
      if (siteAnswer) {
        answer = siteAnswer;
        source = 'website_knowledge';
        response_type = 'KNOWLEDGE_ANSWER';
      } else {
        answer = await generateGeneralAIAnswer(question, project, liveMedicines);
        source = 'openai_ai_engine';
        response_type = 'OPENAI_GENERATIVE';
      }
    }
  } else if (p.kind === 'unsupported') {
    answer = 'This chatbot is currently in read-only consultation mode. Direct database modifications are restricted for security.';
    response_type = 'ACCESS_DENIED';
  } else {
    // 2. Check website-specific details first (Prefix e.g. "para la start", Categories, Medicines, Prescriptions, Orders, Offers)
    const websiteAnswer = await handleWebsiteSpecificQuery(question, project, liveMedicines);
    if (websiteAnswer) {
      answer = websiteAnswer;
      source = 'website_details';
      response_type = 'KNOWLEDGE_ANSWER';
    } else {
      // 3. Search grounded Project Knowledge / RAG
      const items = await searchProjectKnowledge({ projectId: project.id, query: question, minScore: 0.35, limit: 3 });
      const evidence = items.length ? items : await websiteEvidence(project, question);

      if (evidence.length) {
        source = items.length ? 'knowledge_base' : 'website';
        data = evidence.map((x) => ({ title: x.title || null, content: String(x.content).slice(0, 1200), source: x.source || 'project knowledge' }));
        answer = data.map((x) => `${x.title ? x.title + '\n' : ''}${x.content}\nSource: ${x.source}`).join('\n\n');
        response_type = 'KNOWLEDGE_ANSWER';
      } else if (/^(hi|hello|hey|vanakkam|வணக்கம்|greetings)[!.\s]*$/iu.test(question)) {
        answer = `Hello! I am Dr. MediBot, the AI assistant for ${project.name || 'MediCare RX'}. Ask me anything about medicine categories, stock availability, prescription verification, order tracking, or general healthcare advice!`;
        response_type = 'DIRECT_ANSWER';
      } else {
        // 4. Outside Website / Open AI Concept fallback (ChatGPT / OpenAI format)
        answer = await generateGeneralAIAnswer(question, project, liveMedicines);
        source = 'openai_ai_engine';
        response_type = 'OPENAI_GENERATIVE';
      }
    }
  }

  // Conversation session tracking
  const last = p.kind === 'query' && source !== 'none' ? p.resource.name : previous || null;
  await Conversation.findOneAndUpdate(
    { session_id: key, project_id: project.id, user_id: user.user_id },
    { $set: { 'context.last_intent': last, expires_at: new Date(Date.now() + 86400000), updated_at: new Date() }, $setOnInsert: { id: await getNextSequence('conversation') }, $inc: { message_count: 1 } },
    { upsert: true, new: true }
  );

  return {
    success: true,
    project_code: project.project_code,
    project_id: project.id,
    session_id: session,
    answer,
    response_type,
    source,
    data,
    language: nlp.language_hint || 'unknown',
    nlp: { intent: nlp.detected_intent || null, confidence: nlp.confidence || 0 },
    correlation_id: crypto.randomUUID(),
  };
}

module.exports = { answerQuestion, sessionKey };

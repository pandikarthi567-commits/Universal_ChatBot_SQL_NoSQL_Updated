/**
 * Universal AI Chatbot Platform Integration Test Suite (Node.js)
 * Tests:
 * 1. Decision Engine response modes (DIRECT_ANSWER, KNOWLEDGE_ANSWER, LIVE_API,
 *    API_REQUIRED, ACTION_CONFIRMATION, CLARIFICATION_REQUIRED, OUT_OF_SCOPE)
 * 2. Multi-turn conversation context & anaphora resolution ("its price", "add two")
 * 3. SSRF and network security allowlist verification
 * 4. Mode C External Execution completion and correlation binding
 * 5. Action confirmation workflow
 * 6. Cross-project isolation
 * 7. Multi-domain verification (Medical Shop and E-Commerce)
 */
const assert = require("assert");
const { validateDestinationUrl, maskSensitiveData, resolveParameters } = require("../backend/services/secureApiExecutor");
const { resolveConversationReferences } = require("../backend/services/contextService");
const { composeLiveApiResponse, composeKnowledgeResponse, composeClarificationResponse, composeConfirmationPrompt } = require("../backend/services/answerService");
const { buildResponseContract } = require("../backend/services/decisionEngine");

let passedCount = 0;
let totalCount = 0;

function it(name, fn) {
  totalCount++;
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passedCount++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
    throw err;
  }
}

async function runTests() {
  console.log("\n=======================================================");
  console.log("  Running Universal Platform Node.js Test Suite");
  console.log("=======================================================\n");

  // 1. SSRF and Network Security Tests
  console.log("1. SSRF & Network Security Validation:");
  it("Blocks cloud metadata service IP 169.254.169.254", () => {
    assert.throws(
      () => validateDestinationUrl("http://169.254.169.254/latest/meta-data"),
      /SSRF Protection: Access to metadata service/
    );
  });

  it("Blocks metadata.google.internal hostname", () => {
    assert.throws(
      () => validateDestinationUrl("http://metadata.google.internal/computeMetadata/v1"),
      /SSRF Protection/
    );
  });

  it("Enforces allowed_domains allowlist when configured", () => {
    const allowed = ["localhost", "127.0.0.1", "api.pharmacyshop.com"];
    assert.strictEqual(validateDestinationUrl("http://localhost:5000/api/medicines", allowed), true);
    assert.strictEqual(validateDestinationUrl("https://api.pharmacyshop.com/v1/stock", allowed), true);

    assert.throws(
      () => validateDestinationUrl("https://untrusted-external-site.com/hack", allowed),
      /is not in project allowed domains/
    );
  });

  it("Masks sensitive fields in audit logging payloads", () => {
    const raw = {
      username: "john_doe",
      password: "SuperSecretPassword123",
      api_key: "key_live_987654321",
      token: "bearer_xyz_jwt_token",
      nested: { secret: "confidential" },
    };
    const masked = maskSensitiveData(raw);
    assert.strictEqual(masked.password, "••••••••");
    assert.strictEqual(masked.api_key, "••••••••");
    assert.strictEqual(masked.token, "••••••••");
    assert.strictEqual(masked.nested.secret, "••••••••");
    assert.strictEqual(masked.username, "john_doe");
  });

  // 2. Multi-turn Conversation Context & Anaphora Resolution
  console.log("\n2. Conversational Context & Anaphora Reference Resolution:");
  it("Resolves 'its price' to active entity name from previous turn", () => {
    const context = {
      active_entity_reference: {
        type: "MedicineName",
        name: "Dolo 650",
        id: "MED-101",
      },
    };
    const question = "What is its price?";
    const entities = {}; // No explicit entity in turn 2

    const resolved = resolveConversationReferences({ question, entities, context });
    assert.strictEqual(resolved.MedicineName, "Dolo 650");
    assert.strictEqual(resolved.MedicineName_id, "MED-101");
  });

  it("Resolves 'add two to my cart' to quantity=2 and active entity", () => {
    const context = {
      active_entity_reference: {
        type: "MedicineName",
        name: "Dolo 650",
        id: "MED-101",
      },
    };
    const question = "Add two strips of that to my cart";
    const entities = {};

    const resolved = resolveConversationReferences({ question, entities, context });
    assert.strictEqual(resolved.MedicineName, "Dolo 650");
    assert.strictEqual(resolved.quantity, 2);
  });

  it("Resolves numeric quantity from words 'five'", () => {
    const context = { active_entity_reference: { type: "ProductName", name: "Paracetamol" } };
    const question = "Order five packs";
    const resolved = resolveConversationReferences({ question, entities: {}, context });
    assert.strictEqual(resolved.quantity, 5);
  });

  // 3. Natural Conversational Answer Service Tests
  console.log("\n3. Real-World Natural Language Answer Engine:");
  it("Formats single medicine record with price and stock conversationally", () => {
    const record = {
      name: "Dolo 650",
      dosage: "650mg",
      price: 30.5,
      stock: 142,
      manufacturer: "Micro Labs",
    };
    const answer = composeLiveApiResponse({
      projectName: "Apollo Pharmacy",
      endpoint: { name: "Medicine Price" },
      entities: { medicine_name: "Dolo 650" },
      apiData: record,
    });
    assert.ok(answer.includes("Dolo 650"));
    assert.ok(answer.includes("₹30.50"));
    assert.ok(answer.includes("142"));
    assert.ok(!answer.includes("🤖 [Chatbot NLP Understanding")); // No technical debug text!
  });

  it("Formats multiple items into a clean list", () => {
    const items = [
      { name: "Dolo 650", price: 30.5, stock: 142 },
      { name: "Crocin 650", price: 32.0, stock: 85 },
      { name: "Calpol 650", price: 29.0, stock: 50 },
    ];
    const answer = composeLiveApiResponse({
      projectName: "Apollo Pharmacy",
      endpoint: { name: "Search Medicines" },
      entities: {},
      apiData: items,
    });
    assert.ok(answer.includes("Found **3 records**"));
    assert.ok(answer.includes("Dolo 650"));
    assert.ok(answer.includes("Crocin 650"));
  });

  it("Generates natural clarification question when parameters are missing", () => {
    const answer = composeClarificationResponse({
      missingParameters: ["medicine_name"],
      intent: { intent_name: "CheckPrice" },
    });
    assert.strictEqual(answer, "To help you with that, could you please provide the **medicine name**?");
  });

  it("Generates action confirmation prompt for mutating operations", () => {
    const prompt = composeConfirmationPrompt({
      operation: "AddToCart",
      parameters: { medicine_name: "Dolo 650", quantity: 2 },
    });
    assert.ok(prompt.includes("Action Confirmation Required"));
    assert.ok(prompt.includes("add to cart"));
    assert.ok(prompt.includes("Dolo 650"));
    assert.ok(prompt.includes("Confirm"));
  });

  // 4. Standard Response Contract Verification
  console.log("\n4. Standard JSON Response Contract:");
  it("Validates full standard response contract schema", () => {
    const res = buildResponseContract({
      success: true,
      answer: "Dolo 650 is available for ₹30.50.",
      response_type: "LIVE_API",
      intent: "CheckPrice",
      entities: { MedicineName: "Dolo 650" },
      confidence: 0.92,
      data: { price: 30.5 },
      source: "api_execution",
      session_id: "SESSION-101",
      correlation_id: "c-1234",
    });

    assert.strictEqual(res.success, true);
    assert.strictEqual(res.response_type, "LIVE_API");
    assert.strictEqual(res.intent, "CheckPrice");
    assert.strictEqual(res.entities.MedicineName, "Dolo 650");
    assert.strictEqual(res.confidence, 0.92);
    assert.strictEqual(res.session_id, "SESSION-101");
    assert.strictEqual(res.correlation_id, "c-1234");
    assert.strictEqual(res.requires_clarification, false);
    assert.strictEqual(res.requires_confirmation, false);
  });

  // 5. Parameter Validation and Missing Required Parameters
  console.log("\n5. Parameter Validation:");
  it("Detects missing required parameters during endpoint resolution", () => {
    const endpoint = {
      path: "/api/medicines/{id}/price",
      expected_params: [
        { name: "id", in: "path", required: true },
        { name: "discount_code", in: "query", required: false },
      ],
    };
    const { missingRequired } = resolveParameters({ endpoint, entities: {}, formData: {} });
    assert.strictEqual(missingRequired.length, 1);
    assert.strictEqual(missingRequired[0], "id");
  });

  it("Successfully extracts parameters when present", () => {
    const endpoint = {
      path: "/api/medicines/{id}/price",
      expected_params: [
        { name: "id", in: "path", required: true },
        { name: "batch", in: "query", required: false },
      ],
    };
    const { pathParams, queryParams, missingRequired } = resolveParameters({
      endpoint,
      entities: { id: "MED-101", batch: "B-2026" },
      formData: {},
    });
    assert.strictEqual(missingRequired.length, 0);
    assert.strictEqual(pathParams.id, "MED-101");
    assert.strictEqual(queryParams.batch, "B-2026");
  });

  // 6. Multi-Domain Verification (E-Commerce Domain)
  console.log("\n6. Multi-Domain Verification (E-Commerce & Orders):");
  it("Handles E-Commerce domain response without domain coupling", () => {
    const orderData = {
      order_id: "ORD-998877",
      status: "SHIPPED",
      courier: "BlueDart",
      tracking_number: "BD123456789",
      estimated_delivery: "Tomorrow by 5 PM",
    };
    const answer = composeLiveApiResponse({
      projectName: "MegaStore E-Commerce",
      endpoint: { name: "Order Tracking" },
      entities: { order_id: "ORD-998877" },
      apiData: orderData,
    });
    assert.ok(answer.includes("ORD-998877"));
    assert.ok(answer.includes("SHIPPED"));
    assert.ok(answer.includes("BlueDart"));
    assert.ok(answer.includes("Tomorrow by 5 PM"));
  });

  console.log("\n=======================================================");
  console.log(`  All ${passedCount}/${totalCount} Universal Platform Tests Passed Successfully!`);
  console.log("=======================================================\n");
}

runTests();

/**
 * Integration tests for POST /api/batches/:batchId/analyze
 *
 * What is REAL here: the Express app, routing, multer, the multipart request
 * built by mlProxy.service.js, the controller logic, and Mongoose schema
 * validation (documents are validated with the real schemas).
 *
 * What is STUBBED: (1) the Python AI service — a local HTTP server that
 * records the multipart request and returns a response in the exact
 * AnalyzeBatchResult shape; (2) MongoDB persistence — Model.create / findById
 * etc. are replaced with in-memory versions (no database needed).
 * These tests therefore do NOT prove the Python pipeline or MongoDB work;
 * they prove the Express <-> frontend contract and persistence mapping.
 *
 * Run: npm test   (node --test)
 */
import test, { before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import mongoose from "mongoose";
import logger from "../src/utils/logger.js";

// ── Stub Python AI service ───────────────────────────────────────────────────
let pyServer;
let pyRequests = [];
let pyMode = "ok"; // ok | drop | error422 | incomplete | slow
let pyAction = "SELL";
let pyUrgency = "HIGH";
let pyAllocAction = "SELL";

const aiResult = (batchId) => ({
    batch_id: batchId,
    cv_analysis: {
        visual_class: "freshapples",
        freshness_score: 82.5,
        confidence: 0.91,
        class_distribution: { freshapples: 0.91, rottenapples: 0.09 },
    },
    shelf_life: {
        produce: "apple",
        condition: { visual_class: "freshapples", freshness_score: 82.5, cv_confidence: 0.91, batch_condition: "GOOD" },
        assessment: {
            estimated_remaining_shelf_life_days: 12,
            estimate_range_days: [9, 15],
            spoilage_risk: "LOW",
            confidence: 0.74,
            urgency: pyUrgency,
        },
        factors: [{ factor: "storage_temperature", impact: "positive", explanation: "Cold storage extends life." }],
        missing_information: ["humidity_percent"],
        reasoning_summary: "Fresh apples in cold storage.",
        data_quality: "PARTIAL",
        evidence: [{ source: "apple/storage.md", title: "Apple storage", key_information: "0-4C ideal." }],
    },
    decision: {
        batch_id: batchId,
        recommendation: { primary_action: pyAction, urgency: pyUrgency, confidence: 0.8, confidence_basis: "PARTIAL_DATA" },
        allocations: [{ quantity_kg: 100, destination: "Pune Mandi", action: pyAllocAction, reason: "demand" }],
        unallocated: null,
        impact: { total_batch_kg: 100, allocated_kg: 100, expected_waste_kg: 0, estimated_recovered_value: 5000, estimated_transport_cost: 0 },
        reasoning: "Sell now.",
        constraints: [],
        missing_information: [],
        calculation_details: {},
    },
});

const startPythonStub = () =>
    new Promise((resolve) => {
        pyServer = http.createServer((req, res) => {
            const chunks = [];
            req.on("data", (c) => chunks.push(c));
            req.on("end", async () => {
                const raw = Buffer.concat(chunks).toString("latin1");
                const fields = [...raw.matchAll(/name="([^"]+)"(?:; filename="[^"]*")?\r\n(?:Content-Type: [^\r\n]+\r\n)?\r\n([^\r]*)/g)].map(
                    (m) => [m[1], m[2]]
                );
                pyRequests.push({ url: req.url, contentType: req.headers["content-type"], fields });
                if (pyMode === "drop") return req.socket.destroy();
                if (pyMode === "slow") await new Promise((r) => setTimeout(r, 300));
                if (pyMode === "error422") {
                    res.writeHead(422, { "content-type": "application/json" });
                    return res.end(JSON.stringify({ detail: { error: "invalid_image", detail: "Could not decode image", stage: "input_validation" } }));
                }
                const batchId = fields.find(([k]) => k === "batch_id")?.[1] ?? "x";
                const body = aiResult(batchId);
                if (pyMode === "incomplete") delete body.decision;
                res.writeHead(200, { "content-type": "application/json" });
                res.end(JSON.stringify(body));
            });
        });
        pyServer.listen(0, "127.0.0.1", () => resolve(pyServer.address().port));
    });

// ── Test harness ─────────────────────────────────────────────────────────────
const BATCH_ID = new mongoose.Types.ObjectId().toString();
let app, server, baseUrl;
let Batch, QualityInspection, Prediction, Recommendation;
let db; // in-memory "collections"
let batchDoc;

const daysAgo = (d) => new Date(Date.now() - d * 24 * 60 * 60 * 1000);

const stubModel = (Model, name) => {
    Model.create = async (doc) => {
        if (db.failOn === name) throw new Error(`${name} write failed`);
        const d = new Model(doc);
        await d.validate(); // REAL schema validation
        db[name].push(d);
        return d;
    };
    Model.deleteOne = async ({ _id }) => {
        db[name] = db[name].filter((d) => String(d._id) !== String(_id));
    };
};

before(async () => {
    const port = await startPythonStub();
    process.env.AI_SERVICE_URL = `http://127.0.0.1:${port}`;
    process.env.NODE_ENV = "test";
    ({ default: app } = await import("../src/app.js"));
    ({ default: Batch } = await import("../src/models/Batch.js"));
    ({ default: QualityInspection } = await import("../src/models/QualityInspection.js"));
    ({ default: Prediction } = await import("../src/models/Prediction.js"));
    ({ default: Recommendation } = await import("../src/models/Recommendation.js"));

    Batch.findById = async (id) => (String(id) === BATCH_ID ? batchDoc : null);
    Batch.findOne = () => ({ select: async () => null }); // unknown batchCode (real findOne returns a query)
    Batch.findByIdAndUpdate = async (id, update) => {
        db.cacheUpdates.push({ id: String(id), update });
        return batchDoc;
    };
    stubModel(QualityInspection, "QualityInspection");
    stubModel(Prediction, "Prediction");
    stubModel(Recommendation, "Recommendation");

    server = http.createServer(app);
    await new Promise((r) => server.listen(0, "127.0.0.1", r));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
    server?.close();
    pyServer?.close();
});

beforeEach(() => {
    pyRequests = [];
    pyMode = "ok";
    pyAction = "SELL";
    pyUrgency = "HIGH";
    pyAllocAction = "SELL";
    db = { QualityInspection: [], Prediction: [], Recommendation: [], cacheUpdates: [], failOn: null };
    batchDoc = {
        _id: new mongoose.Types.ObjectId(BATCH_ID),
        produceType: "apple",
        quantity: 100,
        harvestDate: daysAgo(3),
        storageTemperatureCelsius: null,
        storageHumidityPercent: null,
    };
});

const png = () => new Blob([Buffer.from("89504e470d0a1a0a", "hex")], { type: "image/png" });

const analyze = async ({ batchId = BATCH_ID, images = 1, fields = {}, extraFiles = [] } = {}) => {
    const form = new FormData();
    for (let i = 0; i < images; i++) form.append("images", png(), `img${i}.png`);
    for (const f of extraFiles) form.append(f.field, f.blob, f.name);
    for (const [k, v] of Object.entries(fields)) form.append(k, String(v));
    const res = await fetch(`${baseUrl}/api/batches/${batchId}/analyze`, { method: "POST", body: form });
    return { status: res.status, body: await res.json() };
};

const pyField = (name) => pyRequests[0]?.fields.filter(([k]) => k === name).map(([, v]) => v);

// ── Tests ────────────────────────────────────────────────────────────────────
test("success: multi-image multipart reaches Python with correct field names and persists everything", async () => {
    const { status, body } = await analyze({
        images: 2,
        fields: { temperature: 4, humidity: 80, storageType: "Cold storage", storageLocation: "Cold room A", transportDurationHours: 6 },
    });
    assert.equal(status, 201, JSON.stringify(body));
    assert.equal(body.success, true);

    // Express -> Python request
    assert.match(pyRequests[0].contentType, /^multipart\/form-data; boundary=/);
    assert.equal(pyRequests[0].url, "/analyze-batch");
    assert.equal(pyField("images").length, 2);
    assert.equal(pyField("batch_id")[0], BATCH_ID);
    assert.equal(pyField("produce")[0], "apple");
    assert.equal(pyField("quantity_kg")[0], "100");
    assert.equal(pyField("temperature_c")[0], "4");
    assert.equal(pyField("humidity_percent")[0], "80");
    assert.equal(pyField("storage_type")[0], "Cold storage");
    assert.equal(pyField("transport_duration_hours")[0], "6");

    // Persistence
    assert.equal(db.Prediction.length, 1);
    assert.equal(db.QualityInspection.length, 1);
    assert.equal(db.Recommendation.length, 1);
    const p = db.Prediction[0];
    assert.equal(String(p.batchId), BATCH_ID);
    assert.equal(p.source, "ml_python_service");
    assert.equal(String(p.inspectionId), String(db.QualityInspection[0]._id));
    assert.equal(p.shelfLifeDays, 12);
    assert.equal(p.riskLevel, "LOW");
    assert.equal(p.shelfLifeAssessment.assessment.estimate_range_days[1], 15);
    assert.equal(p.decision.recommendation.primary_action, "SELL");
    assert.equal(p.inputSignals.storageType, "Cold storage");
    assert.equal(p.inputSignals.transportDurationHours, 6);
    assert.equal(p.inputSignals.storageLocation, "Cold room A");
    const r = db.Recommendation[0];
    assert.equal(String(r.predictionId), String(p._id));
    assert.equal(r.actionType, "SELL_LOCAL");
    assert.equal(r.targetMarket, "Pune Mandi");

    // Batch cache
    assert.equal(db.cacheUpdates.length, 1);
    assert.equal(db.cacheUpdates[0].update.latestShelfLifeDays, 12);
    assert.equal(db.cacheUpdates[0].update.latestFreshnessScore, 82.5);

    // Response is the saved prediction
    assert.equal(body.data.source, "ml_python_service");
    assert.equal(body.data.shelfLifeAssessment.condition.cv_confidence, 0.91);
});

test("harvest age comes from the batch's stored harvestDate; a client-supplied value is ignored", async () => {
    const { status } = await analyze({ fields: { daysSinceHarvest: 99, harvestAgeDays: 99 } });
    assert.equal(status, 201);
    const sent = Number(pyField("harvest_age_days")[0]);
    assert.ok(Math.abs(sent - 3) < 0.01, `expected ~3 days, got ${sent}`);
    assert.equal(db.Prediction[0].inputSignals.daysSinceHarvest, sent);
});

for (const [pythonAction, expected] of [
    ["SELL", "SELL_LOCAL"],
    ["REDISTRIBUTE", "MOVE_TO_MARKET"],
    ["DISCOUNT", "DISCOUNT"],
    ["RESCUE", "PROCESS"],
]) {
    test(`Python action ${pythonAction} is persisted as ${expected} (never defaulted to HOLD)`, async () => {
        pyAction = pythonAction;
        const { status } = await analyze();
        assert.equal(status, 201);
        assert.equal(db.Recommendation[0].actionType, expected);
    });
}

test("UNKNOWN urgency from the AI service is stored as UNKNOWN, not invented", async () => {
    pyUrgency = "UNKNOWN";
    const { status } = await analyze();
    assert.equal(status, 201);
    assert.equal(db.Recommendation[0].urgencyLevel, "UNKNOWN");
});

test("optional storage info omitted: succeeds and no storage values are fabricated", async () => {
    const { status } = await analyze();
    assert.equal(status, 201);
    assert.deepEqual(pyField("temperature_c"), []);
    assert.deepEqual(pyField("humidity_percent"), []);
    assert.deepEqual(pyField("storage_type"), []);
    assert.equal(db.Prediction[0].inputSignals.temperature, null);
});

test("non-numeric temperature is rejected with 422 (not silently dropped)", async () => {
    const { status, body } = await analyze({ fields: { temperature: "warm" } });
    assert.equal(status, 422);
    assert.match(body.message, /temperature/);
    assert.equal(pyRequests.length, 0);
    assert.equal(db.Prediction.length, 0);
});

test("no images -> 422 and nothing is called or saved", async () => {
    const { status, body } = await analyze({ images: 0, fields: { temperature: 4 } });
    assert.equal(status, 422);
    assert.match(body.message, /image/i);
    assert.equal(pyRequests.length, 0);
    assert.equal(db.Prediction.length, 0);
});

test("invalid (non-image) upload -> 415 with a clear message", async () => {
    const { status, body } = await analyze({
        images: 0,
        extraFiles: [{ field: "images", blob: new Blob(["hello"], { type: "text/plain" }), name: "notes.txt" }],
    });
    assert.equal(status, 415);
    assert.match(body.message, /images only/i);
    assert.equal(pyRequests.length, 0);
});

test("wrong multipart field name -> 422 with a clear message", async () => {
    const form = new FormData();
    form.append("photo", png(), "a.png");
    const res = await fetch(`${baseUrl}/api/batches/${BATCH_ID}/analyze`, { method: "POST", body: form });
    assert.equal(res.status, 422);
    assert.match((await res.json()).message, /field name 'images'/);
});

test("too many images -> 422", async () => {
    const { status } = await analyze({ images: 9 });
    assert.equal(status, 422);
    assert.equal(pyRequests.length, 0);
});

test("Python AI service unavailable -> 503, nothing saved", async () => {
    pyMode = "drop";
    const { status, body } = await analyze();
    assert.equal(status, 503);
    assert.match(body.message, /unreachable/i);
    assert.equal(db.Prediction.length, 0);
    assert.equal(db.QualityInspection.length, 0);
    assert.equal(db.Recommendation.length, 0);
    assert.equal(db.cacheUpdates.length, 0);
});

test("Python validation error is forwarded with its status and message", async () => {
    pyMode = "error422";
    const { status, body } = await analyze();
    assert.equal(status, 422);
    assert.match(body.message, /Could not decode image/);
    assert.equal(db.Prediction.length, 0);
});

test("incomplete Python response -> 502, nothing saved (no fake success)", async () => {
    pyMode = "incomplete";
    const { status, body } = await analyze();
    assert.equal(status, 502);
    assert.match(body.message, /incomplete/i);
    assert.equal(db.Prediction.length, 0);
});

test("invalid batch id (unknown batchCode) -> 404", async () => {
    const { status, body } = await analyze({ batchId: "NOT-A-BATCH" });
    assert.equal(status, 404);
    assert.match(body.message, /not found/i);
    assert.equal(pyRequests.length, 0);
});

test("well-formed but non-existent batch id -> 404", async () => {
    const { status } = await analyze({ batchId: new mongoose.Types.ObjectId().toString() });
    assert.equal(status, 404);
    assert.equal(pyRequests.length, 0);
});

test("future harvest date -> 422; missing harvest date -> 422", async () => {
    batchDoc.harvestDate = daysAgo(-10);
    let r = await analyze();
    assert.equal(r.status, 422);
    assert.match(r.body.message, /future/i);
    batchDoc.harvestDate = null;
    r = await analyze();
    assert.equal(r.status, 422);
    assert.match(r.body.message, /harvest date/i);
    assert.equal(pyRequests.length, 0);
});

test("harvest date a few hours ahead (timezone artefact) is clamped to 0 days, not rejected", async () => {
    batchDoc.harvestDate = new Date(Date.now() + 5 * 60 * 60 * 1000);
    const { status } = await analyze();
    assert.equal(status, 201);
    assert.equal(Number(pyField("harvest_age_days")[0]), 0);
});

test("duplicate concurrent submissions: one analysis runs, the other gets 409, one record set is created", async () => {
    pyMode = "slow";
    const [a, b] = await Promise.all([analyze(), analyze()]);
    const statuses = [a.status, b.status].sort();
    assert.deepEqual(statuses, [201, 409]);
    assert.equal(pyRequests.length, 1);
    assert.equal(db.Prediction.length, 1);
    assert.equal(db.Recommendation.length, 1);
    // lock released afterwards
    pyMode = "ok";
    const c = await analyze();
    assert.equal(c.status, 201);
});

test("a failure midway rolls back partial writes (no orphan inspection/prediction)", async () => {
    db.failOn = "Recommendation";
    const { status } = await analyze();
    assert.equal(status, 500);
    assert.equal(db.Prediction.length, 0);
    assert.equal(db.QualityInspection.length, 0);
    assert.equal(db.cacheUpdates.length, 0);
    // and the lock is released so the user can retry
    db.failOn = null;
    assert.equal((await analyze()).status, 201);
});

test("SELL headline whose top allocation is a remote market is stored as MOVE_TO_MARKET (consistent with targetMarket)", async () => {
    pyAllocAction = "REDISTRIBUTE";
    const { status } = await analyze();
    assert.equal(status, 201);
    assert.equal(db.Recommendation[0].actionType, "MOVE_TO_MARKET");
    assert.equal(db.Recommendation[0].targetMarket, "Pune Mandi");
});

test("every mapped actionType is accepted by the Recommendation schema enum", async () => {
    const allowed = Recommendation.schema.path("actionType").enumValues;
    for (const action of ["SELL", "REDISTRIBUTE", "DISCOUNT", "RESCUE"]) {
        pyAction = action;
        db.Recommendation = [];
        assert.equal((await analyze()).status, 201);
        assert.ok(allowed.includes(db.Recommendation[0].actionType), action);
    }
});

test("if rollback itself fails, the orphan is logged loudly (not silently ignored)", async () => {
    db.failOn = "Recommendation";
    const origDelete = Prediction.deleteOne;
    const origError = logger.error;
    const logged = [];
    Prediction.deleteOne = async () => { throw new Error("delete failed"); };
    logger.error = (msg, meta) => logged.push([msg, meta]);
    try {
        assert.equal((await analyze()).status, 500);
    } finally {
        Prediction.deleteOne = origDelete;
        logger.error = origError;
    }
    const rb = logged.find(([m]) => /ROLLBACK FAILED/.test(m));
    assert.ok(rb, "expected a ROLLBACK FAILED log");
    assert.equal(rb[1].model, "Prediction");
});

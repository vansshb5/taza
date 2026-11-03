/**
 * AI vs heuristic prediction separation.
 * Real: Express app, routes, controllers, services. Stubbed: Mongoose query
 * methods (in-memory arrays) — NO real MongoDB is used.
 */
import test, { before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import mongoose from "mongoose";

const BATCH_ID = new mongoose.Types.ObjectId().toString();
let server, baseUrl, Prediction, Batch, QualityInspection;
let preds, cacheUpdates;

const chain = (result) => ({
    sort: () => chain(result),
    populate: () => chain(result),
    then: (res, rej) => Promise.resolve(result).then(res, rej),
});
const mk = (source, createdAt, extra = {}) => ({
    _id: new mongoose.Types.ObjectId(), batchId: BATCH_ID, source, createdAt: new Date(createdAt),
    freshnessScore: 70, shelfLifeDays: 5, spoilageProbability: 0.2, riskLevel: "LOW", ...extra,
});

before(async () => {
    process.env.NODE_ENV = "test";
    const { default: app } = await import("../src/app.js");
    ({ default: Prediction } = await import("../src/models/Prediction.js"));
    ({ default: Batch } = await import("../src/models/Batch.js"));
    ({ default: QualityInspection } = await import("../src/models/QualityInspection.js"));
    const newest = (list) => [...list].sort((a, b) => b.createdAt - a.createdAt)[0] || null;
    Prediction.findOne = (q) => chain(newest(preds.filter((p) => !q.source || p.source === q.source)));
    Prediction.exists = async (q) => (preds.some((p) => p.source === q.source) ? { _id: 1 } : null);
    Prediction.create = async (d) => { const x = new Prediction(d); await x.validate(); preds.push(x); return x; };
    QualityInspection.findOne = () => chain(null);
    const batch = { _id: new mongoose.Types.ObjectId(BATCH_ID), produceType: "apple", quantity: 100, harvestDate: new Date(Date.now() - 2 * 864e5), quantityUnit: "kg" };
    Batch.findById = async () => batch;
    Batch.findByIdAndUpdate = async (id, u) => { cacheUpdates.push(u); return batch; };
    server = http.createServer(app);
    await new Promise((r) => server.listen(0, "127.0.0.1", r));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
});
after(() => server?.close());
beforeEach(() => { preds = []; cacheUpdates = []; });

const get = async (qs = "") => {
    const r = await fetch(`${baseUrl}/api/predictions/${BATCH_ID}${qs}`);
    return { status: r.status, body: await r.json() };
};

test("a NEWER heuristic prediction does not replace an older ML analysis by default", async () => {
    preds = [mk("ml_python_service", "2026-11-01"), mk("heuristic_mock", "2026-11-03")];
    const { status, body } = await get();
    assert.equal(status, 200);
    assert.equal(body.data.source, "ml_python_service");
});

test("both kinds stay reachable: ?source=heuristic and ?source=any", async () => {
    preds = [mk("ml_python_service", "2026-11-01"), mk("heuristic_mock", "2026-11-03")];
    assert.equal((await get("?source=heuristic")).body.data.source, "heuristic_mock");
    assert.equal((await get("?source=ml")).body.data.source, "ml_python_service");
    assert.equal((await get("?source=any")).body.data.source, "heuristic_mock"); // newest overall
});

test("when only a heuristic prediction exists it is returned, labelled by source", async () => {
    preds = [mk("heuristic_mock", "2026-11-03")];
    const { body } = await get();
    assert.equal(body.data.source, "heuristic_mock");
});

test("?source=ml with no ML analysis -> 404 (no silent fallback)", async () => {
    preds = [mk("heuristic_mock", "2026-11-03")];
    assert.equal((await get("?source=ml")).status, 404);
});

test("no predictions -> 404; bad source value -> 400", async () => {
    assert.equal((await get()).status, 404);
    assert.equal((await get("?source=bogus")).status, 400);
});

test("a heuristic run does NOT overwrite the batch cache when an ML analysis exists", async () => {
    preds = [mk("ml_python_service", "2026-11-01")];
    const r = await fetch(`${baseUrl}/api/predictions/${BATCH_ID}/run`, { method: "POST" });
    assert.equal(r.status, 201, JSON.stringify(await r.json()));
    assert.equal(preds.filter((p) => p.source === "heuristic_mock").length, 1); // still saved
    assert.equal(cacheUpdates.length, 0);
});

test("a heuristic run DOES update the batch cache when no ML analysis exists", async () => {
    const r = await fetch(`${baseUrl}/api/predictions/${BATCH_ID}/run`, { method: "POST" });
    assert.equal(r.status, 201);
    assert.equal(cacheUpdates.length, 1);
});

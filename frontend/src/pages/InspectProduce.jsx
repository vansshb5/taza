import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ScanLine, ArrowRight, ArrowLeft, Plus, CheckCircle2, Upload, X } from "lucide-react";
import PageContainer from "../components/layout/PageContainer";
import Card, { CardHeader } from "../components/ui/Card";
import Button from "../components/ui/Button";
import PipelineProgress from "../components/inspection/PipelineProgress";
import DecisionResultPanel from "../components/inspection/DecisionResultPanel";
import { useInspectionFlow } from "../hooks/useInspectionFlow";

/**
 * Create Batch + Analyze wizard.
 *
 * Real pipeline (matches actual Express routes and Python AI service):
 *   Step 1 — Batch Info (required by POST /api/batches)
 *   Step 2 — Storage Conditions (optional form fields for /analyze)
 *   Step 3 — Upload Images (1–8 images, required by Python CV model)
 *   → START INSPECTION → useInspectionFlow runs:
 *      POST /api/batches → batch created
 *      POST /api/batches/:id/analyze (multipart) → full CV + shelf-life + decision
 *   → Display real returned values from Prediction document
 *   → Optional: "Get AI Insights" → POST /api/batches/:id/analyze/insights
 *
 * Fields NOT collected here (AI determines these):
 *   freshness, shelf life, spoilage risk, urgency, recommended action
 */

const PRODUCE_OPTIONS = [
  "mango", "tomato", "banana", "onion", "papaya", "potato",
  "grapes", "spinach", "apple", "orange", "carrot", "broccoli",
  "pepper", "watermelon", "guava", "lychee",
];

const UNIT_OPTIONS = ["kg", "tonnes", "boxes", "crates"];
const STORAGE_TYPES = [
  { value: "ambient", label: "Ambient" },
  { value: "cold_storage", label: "Cold Storage" },
  { value: "refrigerated_transport", label: "Refrigerated Transport" },
  { value: "controlled_atmosphere", label: "Controlled Atmosphere" },
  { value: "unknown", label: "Unknown / Not Specified" },
];

const WIZARD_STEPS = [
  { key: "batch", title: "Batch Info" },
  { key: "storage", title: "Storage" },
  { key: "images", title: "Images" },
];

export default function InspectProduce() {
  const navigate = useNavigate();
  const { state, runPipeline, reset } = useInspectionFlow();
  const [wizardStep, setWizardStep] = useState(0);
  const fileInputRef = useRef(null);

  // ── Form state ─────────────────────────────────────────────────────────────
  const [batchForm, setBatchForm] = useState({
    productName: "",
    produceType: "",
    variety: "",
    quantity: "",
    unit: "kg",
    origin: "",
    harvestDate: "",
    arrivalDate: "",
    currentLocation: "",
  });

  const [storageForm, setStorageForm] = useState({
    harvestAgeDays: "",
    temperatureC: "",
    humidityPercent: "",
    storageDurationHours: "",
    transportDurationHours: "",
    storageType: "",
  });

  const [images, setImages] = useState([]); // File[]

  // ── Derived ────────────────────────────────────────────────────────────────
  const isRunning = state.status === "running";
  const isComplete = state.status === "complete";
  const hasError = state.status === "error";

  const BATCH_REQUIRED = [
    "productName", "produceType", "quantity", "origin",
    "harvestDate", "arrivalDate", "currentLocation",
  ];
  const batchValid = BATCH_REQUIRED.every(
    (f) => batchForm[f]?.toString().trim() !== ""
  );

  function handleBatch(e) {
    const { name, value } = e.target;
    setBatchForm((f) => {
      const next = { ...f, [name]: value };
      // Auto-fill productName from produceType when not yet manually set
      if (name === "produceType" && !f.productName) {
        next.productName = value.charAt(0).toUpperCase() + value.slice(1);
      }
      return next;
    });
  }

  function handleStorage(e) {
    const { name, value } = e.target;
    setStorageForm((f) => ({ ...f, [name]: value }));
  }

  function addImages(files) {
    const valid = Array.from(files).filter((f) => f.type.startsWith("image/"));
    setImages((prev) => {
      const combined = [...prev, ...valid];
      return combined.slice(0, 8); // max 8 per upload.middleware.js
    });
  }

  function removeImage(idx) {
    setImages((prev) => prev.filter((_, i) => i !== idx));
  }

  function handleFileDrop(e) {
    e.preventDefault();
    addImages(e.dataTransfer.files);
  }

  async function startPipeline() {
    const batchPayload = {
      ...batchForm,
      quantity: parseFloat(batchForm.quantity),
    };

    await runPipeline(batchPayload, images, storageForm);
  }

  function handleReset() {
    reset();
    setWizardStep(0);
    setBatchForm({
      productName: "", produceType: "", variety: "",
      quantity: "", unit: "kg", origin: "",
      harvestDate: "", arrivalDate: "", currentLocation: "",
    });
    setStorageForm({
      harvestAgeDays: "", temperatureC: "", humidityPercent: "",
      storageDurationHours: "", transportDurationHours: "", storageType: "",
    });
    setImages([]);
  }

  // ── Pipeline running/complete ───────────────────────────────────────────────
  if (isRunning || isComplete || hasError) {
    return (
      <PageContainer title="Analyzing Batch" subtitle="Running AI pipeline…" centerHeader>
        <div className="max-w-4xl mx-auto space-y-6">
          <Card>
            <CardHeader title="Analysis Pipeline" />
            <PipelineProgress
              currentStep={state.currentStep}
              completedSteps={state.completedSteps}
              failedStep={state.failedStep}
            />

            {/* Per-step error messages */}
            {hasError && state.failedStep === "batch" && (
              <ErrorBanner message={state.error ?? "Failed to create batch."} />
            )}
            {hasError && state.failedStep === "analyze" && (
              <ErrorBanner
                message={state.error ?? "Unable to analyze the uploaded images. Check that the AI service is running."}
              />
            )}
          </Card>

          {/* Full decision panel (CV + shelf-life + decision engine + AI insights) */}
          {state.prediction && (
            <DecisionResultPanel
              prediction={state.prediction}
              batchId={state.batch?._id}
            />
          )}

          {/* Action buttons when done */}
          {isComplete && state.batch && (
            <div className="flex gap-3 flex-wrap">
              <Button
                onClick={() => navigate(`/batches/${state.batch._id}`)}
                icon={ArrowRight}
              >
                View Batch Details
              </Button>
              <Button variant="ghost" onClick={handleReset} icon={Plus}>
                New Batch
              </Button>
            </div>
          )}

          {/* Retry on batch creation failure */}
          {hasError && state.failedStep === "batch" && (
            <Button variant="ghost" onClick={reset} icon={ArrowLeft}>
              Go Back
            </Button>
          )}

          {/* Go back on analyze failure */}
          {hasError && state.failedStep === "analyze" && (
            <div className="flex gap-3">
              <Button variant="ghost" onClick={reset} icon={ArrowLeft}>
                Try Again
              </Button>
              {state.batch && (
                <Button
                  variant="ghost"
                  onClick={() => navigate(`/batches/${state.batch._id}`)}
                  icon={ArrowRight}
                >
                  View Batch (no analysis)
                </Button>
              )}
            </div>
          )}
        </div>
      </PageContainer>
    );
  }

  // ── Wizard ──────────────────────────────────────────────────────────────────
  return (
    <PageContainer
      title="Create Batch & Inspect"
      subtitle="Create a batch, upload produce images, then run full AI analysis"
      centerHeader
    >
      <div className="max-w-4xl mx-auto space-y-6">
        <WizardStepIndicator steps={WIZARD_STEPS} current={wizardStep} />

        <AnimatePresence mode="wait">
          {/* Step 0: Batch Info */}
          {wizardStep === 0 && (
            <StepWrapper key="batch">
              <Card>
                <CardHeader
                  title="Batch Information"
                  subtitle="Required fields — the AI determines freshness, shelf life and recommendations"
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Produce Type *">
                    <select
                      name="produceType"
                      value={batchForm.produceType}
                      onChange={handleBatch}
                      className="input"
                    >
                      <option value="">Select produce…</option>
                      {PRODUCE_OPTIONS.map((p) => (
                        <option key={p} value={p}>
                          {p.charAt(0).toUpperCase() + p.slice(1)}
                        </option>
                      ))}
                      <option value="other">Other</option>
                    </select>
                  </Field>

                  <Field label="Product Name *">
                    <input
                      name="productName"
                      type="text"
                      value={batchForm.productName}
                      onChange={handleBatch}
                      placeholder="e.g. Alphonso Mango"
                      className="input"
                    />
                  </Field>

                  <Field label="Variety">
                    <input
                      name="variety"
                      type="text"
                      value={batchForm.variety}
                      onChange={handleBatch}
                      placeholder="e.g. Alphonso, Kesar"
                      className="input"
                    />
                  </Field>

                  <Field label="Origin / Farm *">
                    <input
                      name="origin"
                      type="text"
                      value={batchForm.origin}
                      onChange={handleBatch}
                      placeholder="e.g. Ratnagiri Farm A"
                      className="input"
                    />
                  </Field>

                  <Field label="Quantity *">
                    <div className="grid grid-cols-3 gap-2">
                      <input
                        name="quantity"
                        type="number"
                        min="0"
                        step="0.1"
                        value={batchForm.quantity}
                        onChange={handleBatch}
                        placeholder="e.g. 500"
                        className="input col-span-2"
                      />
                      <select
                        name="unit"
                        value={batchForm.unit}
                        onChange={handleBatch}
                        className="input col-span-1"
                      >
                        {UNIT_OPTIONS.map((u) => (
                          <option key={u} value={u}>{u}</option>
                        ))}
                      </select>
                    </div>
                  </Field>

                  <Field label="Current Location *">
                    <input
                      name="currentLocation"
                      type="text"
                      value={batchForm.currentLocation}
                      onChange={handleBatch}
                      placeholder="e.g. Warehouse B, Pune"
                      className="input"
                    />
                  </Field>

                  <Field label="Harvest Date *">
                    <input
                      name="harvestDate"
                      type="date"
                      value={batchForm.harvestDate}
                      onChange={handleBatch}
                      className="input"
                    />
                  </Field>

                  <Field label="Arrival Date *">
                    <input
                      name="arrivalDate"
                      type="date"
                      value={batchForm.arrivalDate}
                      onChange={handleBatch}
                      className="input"
                    />
                  </Field>
                </div>
              </Card>

              <div className="flex justify-end mt-4">
                <Button
                  onClick={() => setWizardStep(1)}
                  disabled={!batchValid}
                  icon={ArrowRight}
                >
                  Next: Storage
                </Button>
              </div>
            </StepWrapper>
          )}

          {/* Step 1: Storage */}
          {wizardStep === 1 && (
            <StepWrapper key="storage">
              <Card>
                <CardHeader
                  title="Storage Conditions"
                  subtitle="Optional — improves AI shelf-life assessment accuracy"
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Days Since Harvest" hint="harvestAgeDays">
                    <input
                      name="harvestAgeDays"
                      type="number"
                      min="0"
                      value={storageForm.harvestAgeDays}
                      onChange={handleStorage}
                      placeholder="e.g. 3"
                      className="input"
                    />
                  </Field>

                  <Field label="Temperature (°C)">
                    <input
                      name="temperatureC"
                      type="number"
                      step="0.1"
                      value={storageForm.temperatureC}
                      onChange={handleStorage}
                      placeholder="e.g. 8.4"
                      className="input"
                    />
                  </Field>

                  <Field label="Humidity (%)">
                    <input
                      name="humidityPercent"
                      type="number"
                      min="0"
                      max="100"
                      value={storageForm.humidityPercent}
                      onChange={handleStorage}
                      placeholder="e.g. 82"
                      className="input"
                    />
                  </Field>

                  <Field label="Storage Duration (hours)">
                    <input
                      name="storageDurationHours"
                      type="number"
                      min="0"
                      value={storageForm.storageDurationHours}
                      onChange={handleStorage}
                      placeholder="e.g. 48"
                      className="input"
                    />
                  </Field>

                  <Field label="Transit Duration (hours)">
                    <input
                      name="transportDurationHours"
                      type="number"
                      min="0"
                      value={storageForm.transportDurationHours}
                      onChange={handleStorage}
                      placeholder="e.g. 6"
                      className="input"
                    />
                  </Field>

                  <Field label="Storage Type">
                    <select
                      name="storageType"
                      value={storageForm.storageType}
                      onChange={handleStorage}
                      className="input"
                    >
                      <option value="">Select type…</option>
                      {STORAGE_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
              </Card>

              <div className="flex justify-between mt-4">
                <Button variant="ghost" icon={ArrowLeft} onClick={() => setWizardStep(0)}>
                  Back
                </Button>
                <Button onClick={() => setWizardStep(2)} icon={ArrowRight}>
                  Next: Upload Images
                </Button>
              </div>
            </StepWrapper>
          )}

          {/* Step 2: Images (required for ML pipeline) */}
          {wizardStep === 2 && (
            <StepWrapper key="images">
              <Card>
                <CardHeader
                  title="Upload Produce Images"
                  subtitle="1–8 images required for computer vision analysis (max 10 MB each)"
                />

                {/* Drop zone */}
                <div
                  onDrop={handleFileDrop}
                  onDragOver={(e) => e.preventDefault()}
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-border rounded-xl p-8 flex flex-col items-center justify-center gap-3 cursor-pointer hover:border-brand-400 hover:bg-brand-50/30 transition-colors"
                >
                  <Upload size={28} className="text-brand-400" />
                  <p className="text-sm font-medium text-ink">
                    Drop images here or click to browse
                  </p>
                  <p className="text-xs text-muted">
                    JPG, PNG, WEBP · up to 8 images · max 10 MB each
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => addImages(e.target.files)}
                  />
                </div>

                {/* Image previews */}
                {images.length > 0 && (
                  <div className="mt-4 grid grid-cols-3 sm:grid-cols-4 gap-3">
                    {images.map((file, idx) => (
                      <div key={idx} className="relative group rounded-lg overflow-hidden border border-border bg-bg">
                        <img
                          src={URL.createObjectURL(file)}
                          alt={`Image ${idx + 1}`}
                          className="w-full h-24 object-cover"
                        />
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            removeImage(idx);
                          }}
                          className="absolute top-1 right-1 w-6 h-6 rounded-full bg-red-500 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                        >
                          <X size={12} />
                        </button>
                        <p className="text-[10px] text-muted px-1 py-0.5 truncate">
                          {file.name}
                        </p>
                      </div>
                    ))}
                    {images.length < 8 && (
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="h-24 rounded-lg border-2 border-dashed border-border flex items-center justify-center text-brand-400 hover:border-brand-400 hover:bg-brand-50/30 transition-colors"
                      >
                        <Plus size={20} />
                      </button>
                    )}
                  </div>
                )}

                {/* Batch summary */}
                <div className="mt-5 p-4 bg-bg rounded-xl">
                  <p className="text-xs font-medium text-muted mb-3">Batch Summary</p>
                  <dl className="grid grid-cols-2 gap-2 text-sm">
                    <SummaryRow label="Produce" value={batchForm.productName} />
                    <SummaryRow label="Quantity" value={`${batchForm.quantity} ${batchForm.unit}`} />
                    <SummaryRow label="Origin" value={batchForm.origin} />
                    <SummaryRow label="Location" value={batchForm.currentLocation} />
                    <SummaryRow label="Harvest" value={batchForm.harvestDate} />
                    <SummaryRow label="Arrival" value={batchForm.arrivalDate} />
                  </dl>
                  <p className="text-[11px] text-muted mt-3 italic">
                    ✦ Freshness, shelf life, spoilage risk and recommended action will be determined by AI.
                  </p>
                </div>
              </Card>

              <div className="flex justify-between mt-4">
                <Button variant="ghost" icon={ArrowLeft} onClick={() => setWizardStep(1)}>
                  Back
                </Button>
                <Button
                  onClick={startPipeline}
                  disabled={images.length === 0}
                  icon={ScanLine}
                  size="lg"
                  title={images.length === 0 ? "Upload at least one image to start" : undefined}
                >
                  Start Inspection
                </Button>
              </div>
            </StepWrapper>
          )}
        </AnimatePresence>
      </div>
    </PageContainer>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function WizardStepIndicator({ steps, current }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-2">
      {steps.map((s, i) => (
        <div key={s.key} className="flex items-center gap-2">
          <div
            className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition-colors ${i < current
              ? "bg-brand-700 text-white"
              : i === current
                ? "bg-brand-700 text-white ring-4 ring-brand-100"
                : "bg-bg text-muted border border-border"
              }`}
          >
            {i < current ? <CheckCircle2 size={14} /> : i + 1}
          </div>
          <span
            className={`text-sm hidden sm:inline ${i === current ? "text-ink font-medium" : "text-muted"
              }`}
          >
            {s.title}
          </span>
          {i < steps.length - 1 && <div className="w-6 h-px bg-border mx-1" />}
        </div>
      ))}
    </div>
  );
}

function StepWrapper({ children }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -16 }}
      transition={{ duration: 0.22 }}
    >
      {children}
    </motion.div>
  );
}

function Field({ label, hint, children }) {
  return (
    <div>
      <label className="block text-xs font-medium text-muted mb-1">
        {label}
        {hint && <span className="ml-1 font-normal text-[11px] text-muted">({hint})</span>}
      </label>
      {children}
    </div>
  );
}

function SummaryRow({ label, value }) {
  return (
    <div>
      <dt className="text-[11px] text-muted">{label}</dt>
      <dd className="text-sm text-ink font-medium">{value || "—"}</dd>
    </div>
  );
}

function ErrorBanner({ message }) {
  return (
    <div className="flex items-start gap-2 bg-red-50 text-red-700 rounded-lg p-3 text-sm mt-3">
      <span className="shrink-0">⚠</span>
      <span>{message}</span>
    </div>
  );
}

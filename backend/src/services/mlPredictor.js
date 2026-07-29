/**
 * mlPredictor.js
 *
 * RESPONSIBILITY: Load and run inference on the pre-trained XGBoost model.
 * This service is the ONLY place in the Node.js codebase that interacts
 * with the Python ML environment.
 *
 * DESIGN DECISIONS:
 *  - Training happens OFFLINE in Python (ml/train_xgboost.py).
 *    Node.js is ONLY responsible for inference (prediction).
 *  - We use a Python child_process, NOT a FastAPI microservice.
 *    Rationale: For an MVP/interview project, a separate FastAPI server adds
 *    deployment complexity (two services to keep alive on Render's free tier).
 *    A child_process achieves the same interface (JSON in → JSON out) without
 *    the infrastructure overhead. The interface contract is identical to a REST
 *    microservice — so it can be swapped out with zero changes to the callers.
 *  - The model file (xgboost_pricing_model.json) is pre-loaded at module init
 *    and the Python script is spawned per-request (lazy execution).
 *  - FALLBACK POLICY: If Python is not installed, the model file is missing,
 *    or the child process errors, we set usedFallback=true and the calling
 *    PricingEngine will use deterministic composition instead.
 *    The fallback is silent — the API never returns an error to the frontend.
 *
 * PERFORMANCE NOTE:
 *  Spawning a Python child process takes ~150–400ms. This is acceptable for
 *  a pricing recommendation (not a hot path). In production, this would be
 *  replaced with an ONNX runtime (onnxruntime-node npm package) for ~5ms
 *  inference without any Python dependency.
 *
 * INTERVIEW TALKING POINT:
 *  "We deliberately kept training offline in Python because Python's XGBoost
 *   ecosystem is mature and battle-tested. We kept inference in Node.js via
 *   a child process so our API server has zero Python runtime dependency in
 *   production if we migrate to ONNX. The interface is the same either way."
 *
 * Time Complexity per call: O(D×T) where D=tree depth, T=n_estimators (XGBoost inference)
 *   In practice: ~5ms for depth=3, 100 trees on 19 features.
 * Space Complexity: O(model_size) ≈ O(1) for our small model
 */

"use strict";

const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

// ── Model & inference script paths ────────────────────────────────────────────
const INFERENCE_SCRIPT_PATH = path.join(
  __dirname,
  "..",
  "..",
  "ml_inference",
  "predict.py",
);

const MODEL_PATH = path.join(
  __dirname,
  "..",
  "..",
  "ml_inference",
  "xgboost_pricing_model.json",
);

// Model version tracking — read from a sidecar file if present
let _modelVersion = "1.0.0";
let _modelLoaded = false;

/**
 * initializeModel — Check at startup whether the model file exists.
 * Called once when the module is first required.
 * Does NOT throw — always succeeds and sets _modelLoaded.
 */
function initializeModel() {
  try {
    if (fs.existsSync(MODEL_PATH) && fs.existsSync(INFERENCE_SCRIPT_PATH)) {
      _modelLoaded = true;

      // Try to read a version sidecar (ml_inference/model_version.txt)
      const versionPath = path.join(path.dirname(MODEL_PATH), "model_version.txt");
      if (fs.existsSync(versionPath)) {
        _modelVersion = fs.readFileSync(versionPath, "utf8").trim();
      }

      console.log(
        `[MLPredictor] Model loaded — version ${_modelVersion} | path: ${MODEL_PATH}`,
      );
    } else {
      _modelLoaded = false;
      console.warn(
        "[MLPredictor] Model file or inference script not found. " +
        "Pricing engine will use deterministic fallback. " +
        `Model path: ${MODEL_PATH}, Script path: ${INFERENCE_SCRIPT_PATH}`,
      );
    }
  } catch (err) {
    _modelLoaded = false;
    console.error("[MLPredictor] Error during initialization:", err.message);
  }
}

// ── Initialize on module load ─────────────────────────────────────────────────
initializeModel();

/**
 * predict — Run XGBoost inference on a 19-element feature vector.
 *
 * Spawns `python predict.py` with the feature vector as a JSON argument.
 * The Python script loads the model file and returns:
 *   { predictedPrice: number, latencyMs: number }
 *
 * @param {number[]} featureVector - Array of exactly 19 numbers
 * @returns {Promise<{
 *   predictedPrice: number,
 *   predictionLatencyMs: number,
 *   usedFallback: boolean,
 *   modelVersion: string,
 *   error?: string
 * }>}
 */
async function predict(featureVector) {
  const startTime = Date.now();

  // ── Fallback: model not loaded ────────────────────────────────────────────
  if (!_modelLoaded) {
    return {
      predictedPrice: null,
      predictionLatencyMs: Date.now() - startTime,
      usedFallback: true,
      modelVersion: "none",
      error: "Model file not found — using deterministic fallback",
    };
  }

  // ── Validate feature vector ───────────────────────────────────────────────
  if (!Array.isArray(featureVector) || featureVector.length !== 19) {
    return {
      predictedPrice: null,
      predictionLatencyMs: Date.now() - startTime,
      usedFallback: true,
      modelVersion: _modelVersion,
      error: `Invalid feature vector: expected 19 features, got ${featureVector?.length}`,
    };
  }

  // ── Spawn Python child process ────────────────────────────────────────────
  return new Promise((resolve) => {
    const featureJson = JSON.stringify(featureVector);

    const child = spawn("python", [INFERENCE_SCRIPT_PATH, featureJson], {
      timeout: 10000, // 10 second hard timeout
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("close", (code) => {
      const latencyMs = Date.now() - startTime;

      // FIX: Only treat non-zero exit code as failure.
      // XGBoost/NumPy frequently write deprecation warnings to stderr even on success.
      // Previously `|| stderr` caused every prediction with a warning to silently fallback.
      if (stderr) {
        console.warn(`[MLPredictor] Python stderr (non-fatal): ${stderr.slice(0, 300)}`);
      }

      if (code !== 0) {
        console.error(
          `[MLPredictor] Python inference failed (exit code ${code}): ${stderr}`,
        );
        resolve({
          predictedPrice: null,
          predictionLatencyMs: latencyMs,
          usedFallback: true,
          modelVersion: _modelVersion,
          error: `Python exit code ${code}: ${stderr.slice(0, 200)}`,
        });
        return;
      }

      try {
        const result = JSON.parse(stdout.trim());

        if (!result.predictedPrice || Number.isNaN(result.predictedPrice)) {
          throw new Error("Inference returned invalid predictedPrice");
        }

        resolve({
          predictedPrice: result.predictedPrice,
          predictionLatencyMs: latencyMs,
          usedFallback: false,
          modelVersion: _modelVersion,
        });
      } catch (parseErr) {
        console.error(
          `[MLPredictor] Failed to parse Python output: "${stdout}" — ${parseErr.message}`,
        );
        resolve({
          predictedPrice: null,
          predictionLatencyMs: latencyMs,
          usedFallback: true,
          modelVersion: _modelVersion,
          error: `Output parse failed: ${parseErr.message}`,
        });
      }
    });

    child.on("error", (spawnErr) => {
      console.error(`[MLPredictor] Failed to spawn Python: ${spawnErr.message}`);
      resolve({
        predictedPrice: null,
        predictionLatencyMs: Date.now() - startTime,
        usedFallback: true,
        modelVersion: _modelVersion,
        error: `Python not found or spawn error: ${spawnErr.message}`,
      });
    });
  });
}

/**
 * getModelStatus — Returns the current health and metadata of the ML model.
 * Used by the GET /api/v1/pricing/model-status endpoint.
 *
 * @returns {{ loaded: boolean, version: string, modelPath: string, scriptPath: string }}
 */
function getModelStatus() {
  return {
    loaded: _modelLoaded,
    version: _modelVersion,
    modelPath: MODEL_PATH,
    scriptPath: INFERENCE_SCRIPT_PATH,
    modelFileExists: fs.existsSync(MODEL_PATH),
    scriptFileExists: fs.existsSync(INFERENCE_SCRIPT_PATH),
  };
}

module.exports = { predict, getModelStatus, initializeModel };

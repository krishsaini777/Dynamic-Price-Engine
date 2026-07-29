const cron = require("node-cron");
const Product = require("../models/product");
const Settings = require("../models/settings");
const { runPricingEngine } = require("./pricingEngine");
const { updateEMAForProduct } = require("./emaService");
const { AUTO_APPLY_THRESHOLD } = require("../utils/pricingUtils");

let pricingTask = null;

let emaTask = null;

async function startScheduler() {
  // Settings are now per-user, so we use a system-level default interval for the background job.
  // Individual users' settings (seasonal, events) are resolved per-product via product.ownerId.
  //
  // Bug fix: was hardcoded to 30. Now reads from environment variable.
  // Set SCHEDULER_INTERVAL_MINUTES in backend/.env to change the interval.
  const interval = parseInt(process.env.SCHEDULER_INTERVAL_MINUTES, 10) || 30;

  pricingTask = cron.schedule(`*/${interval} * * * *`, async () => {
    console.log(
      `[Scheduler] Running batch recalculation at ${new Date().toISOString()}`,
    );
    // Fetch all auto-mode products across ALL users — the engine uses product.ownerId internally
    const products = await Product.find({
      isActive: true,
      "pricingStrategy.mode": "auto",
    });

    let applied = 0,
      skipped = 0,
      failed = 0;

    for (const product of products) {
      try {
        // FIXED: pass product.ownerId so the engine scopes settings and events to the right user
        const result = await runPricingEngine(
          product._id,
          new Date(),
          "scheduler",
          product.ownerId,   // <-- key fix
        );
        // Bug fix: was hardcoded to 0.8 here but 0.5 in pricingEngine.js — split-brain.
        // Now both paths use AUTO_APPLY_THRESHOLD (0.65) from pricingUtils.
        if (
          result.outcome?.shouldApply &&
          result.outcome?.confidenceScore >= AUTO_APPLY_THRESHOLD
        ) {
          await Product.findByIdAndUpdate(product._id, {
            currentPrice: result.eventOverlay?.eventApplied
              ? result.eventOverlay.priceAfterDiscount
              : result.outcome.recommendedPrice,
          });
          applied++;
        } else {
          skipped++;
        }
      } catch (err) {
        console.error(`[Scheduler] Failed for ${product._id}:`, err.message);
        failed++;
      }
    }
    console.log(
      `[Scheduler] Done: ${applied} applied, ${skipped} skipped, ${failed} failed`,
    );
  });

  emaTask = cron.schedule("0 * * * *", async () => {
    console.log(`[EMA] Updating EMA for all products`);
    const products = await Product.find({ isActive: true }).select('_id').lean();

    // PERF: Replace sequential for...of await with Promise.allSettled.
    // Each updateEMAForProduct call is independent — no ordering dependency.
    // allSettled (not all) ensures one failure doesn't abort the entire batch.
    const results = await Promise.allSettled(
      products.map((product) => updateEMAForProduct(product._id)),
    );

    const failed = results.filter((r) => r.status === 'rejected');
    failed.forEach((r, i) => {
      console.error(`[EMA] Failed for product index ${i}:`, r.reason?.message);
    });

    if (failed.length > 0) {
      console.log(`[EMA] Done: ${results.length - failed.length} updated, ${failed.length} failed`);
    }
  });

  console.log(
    `[Scheduler] Started — pricing every ${interval}min, EMA every 1h`,
  );
}

function stopScheduler() {
  if (pricingTask) {
    pricingTask.stop();
    pricingTask = null;
  }
  if (emaTask) {
    emaTask.stop();
    emaTask = null;
  }
  console.log("[Scheduler] Stopped");
}

module.exports = { startScheduler, stopScheduler };

/**
 * seed.js — Production-quality seed data for Dynamic Pricing Engine demo.
 *
 * 5 products, each designed to showcase a different engine behaviour:
 *   P1  Headphones  — HIGH demand + CRITICAL inventory → price UP + event overlay
 *   P2  Charger     — Competitors cheaper → price DOWN + event overlay
 *   P3  Kurta       — Monsoon seasonal boost, manual mode
 *   P4  Rice        — Oversupply + LOW demand → PROFIT_FLOOR constraint
 *   P5  Book        — Seasonal disabled for Books → multiplier 1.0
 *
 * Run:  node src/config/seed.js   (from /backend)
 * Requires MONGO_URL in .env
 */

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// ── Models ─────────────────────────────────────────
const Product = require('../models/product');
const Inventory = require('../models/inventory');
const CompetitorPrice = require('../models/competitorPrice');
const SalesEvent = require('../models/salesEvent');
const Settings = require('../models/settings');
const PromotionalEvent = require('../models/promotionalEvent');
const PricingRecommendation = require('../models/pricingRecommendation');
const EventAnalytics = require('../models/eventAnalytics');

// ── Time Helpers ───────────────────────────────────
const now = Date.now();
const hoursAgo = (h) => new Date(now - h * 3600000);
const daysAgo = (d) => new Date(now - d * 24 * 3600000);
const daysFromNow = (d) => new Date(now + d * 24 * 3600000);

// ── Sales Data Helpers ─────────────────────────────
const channels = ['web', 'mobile', 'store'];
const randomChannel = () => channels[Math.floor(Math.random() * channels.length)];

/**
 * Generate evenly-spaced hour offsets between startH and endH.
 * Used to distribute organic sales across time windows.
 */
function spreadHours(startH, endH, count) {
  if (count <= 1) return [startH];
  const step = (endH - startH) / (count - 1);
  return Array.from({ length: count }, (_, i) => +(startH + i * step).toFixed(1));
}

/**
 * Generate organic sale records at specific hour-offsets from now.
 * Each sale has quantity=1, eventId=null (organic).
 */
function organicSales(productId, hourOffsets, price) {
  return hourOffsets.map((h) => ({
    productId,
    quantity: 1,
    priceAtSale: price,
    channel: randomChannel(),
    soldAt: hoursAgo(h),
    eventId: null,
    isPromotional: false,
    isCancelled: false,
  }));
}

/**
 * Generate promotional sale records spread across 15–70h ago.
 * Each has eventId set (excluded from organic velocity calculation).
 */
function promoSales(productId, count, eventId, price) {
  return Array.from({ length: count }, (_, i) => ({
    productId,
    quantity: 1,
    priceAtSale: Math.round(price * 0.9),
    channel: randomChannel(),
    soldAt: hoursAgo(15 + i * 14), // 15h, 29h, 43h, 57h, 71h
    eventId,
    isPromotional: true,
    isCancelled: false,
  }));
}

// ════════════════════════════════════════════════════
//  MAIN SEED FUNCTION
// ════════════════════════════════════════════════════

async function seed() {
  try {
    await mongoose.connect(process.env.MONGO_URL);
    console.log('MongoDB connected for seeding...');

    // ── Clear ALL collections ──────────────────
    await Promise.all([
      Product.deleteMany({}),
      Inventory.deleteMany({}),
      CompetitorPrice.deleteMany({}),
      SalesEvent.deleteMany({}),
      PromotionalEvent.deleteMany({}),
      Settings.deleteMany({}),
      PricingRecommendation.deleteMany({}),
      EventAnalytics.deleteMany({}),
    ]);
    console.log('Cleared all existing data.');

    // ════════════════════════════════════════════
    //  1. PRODUCTS
    // ════════════════════════════════════════════

    const products = await Product.insertMany([
      // ── P1: Headphones — price UP (demand + inventory) ──
      {
        productName: 'Wireless Noise-Cancelling Headphones',
        sku: 'WNC-HP-001',
        category: 'Electronics',
        description: 'Premium ANC headphones with 30h battery life',
        costPrice: 2800,
        basePrice: 5999,
        currentPrice: 5999,
        tier: 'premium',
        targetMargin: 0.20,
        pricingStrategy: { mode: 'auto', maxIncreasePct: 0.15, maxDecreasePct: 0.15 },
        seasonalConfig: {
          season: 'festive',
          startDate: '06-01',   // Active now (June 24)
          peakDate: '06-25',    // Peak tomorrow → near-max ramp_up
          endDate: '07-31',
          maxBoost: 0.12,
        },
      },

      // ── P2: Charger — price DOWN (competitor-driven) ────
      {
        productName: 'USB-C Fast Charger 65W',
        sku: 'USB-FC-002',
        category: 'Electronics',
        description: 'GaN charger with 3 ports, PD 3.0 compatible',
        costPrice: 350,
        basePrice: 1299,
        currentPrice: 1299,
        tier: 'mid',
        targetMargin: 0.15,
        pricingStrategy: { mode: 'auto', maxIncreasePct: 0.15, maxDecreasePct: 0.15 },
        seasonalConfig: { season: 'none' },
      },

      // ── P3: Kurta — seasonal boost, manual mode ─────────
      {
        productName: 'Cotton Kurta Set',
        sku: 'CKS-003',
        category: 'Clothing',
        description: 'Breathable cotton kurta with pajama, ideal for monsoon',
        costPrice: 280,
        basePrice: 799,
        currentPrice: 799,
        tier: 'budget',
        targetMargin: 0.12,
        pricingStrategy: { mode: 'manual', maxIncreasePct: 0.15, maxDecreasePct: 0.15 },
        seasonalConfig: {
          season: 'monsoon',
          startDate: '06-01',   // Active now
          peakDate: '07-15',    // Peak in 3 weeks → ramp_up phase
          endDate: '09-15',
          maxBoost: 0.12,
        },
      },

      // ── P4: Rice — PROFIT_FLOOR constraint ──────────────
      // costPrice set to 580 to ensure floor (638) is reached
      // by the engine's ~15% decrease from demand+inventory signals
      {
        productName: 'Organic Basmati Rice 5kg',
        sku: 'OBR-004',
        category: 'Food',
        description: 'Aged organic basmati rice from Dehradun',
        costPrice: 580,
        basePrice: 699,
        currentPrice: 699,
        tier: 'mid',
        targetMargin: 0.10,
        pricingStrategy: { mode: 'auto', maxIncreasePct: 0.15, maxDecreasePct: 0.15 },
        seasonalConfig: { season: 'none' },
      },

      // ── P5: Book — seasonal cascade OFF for Books ───────
      {
        productName: 'UPSC Prelims Guide 2026',
        sku: 'UPG-005',
        category: 'Books',
        description: 'Complete guide for UPSC CSE Prelims with practice papers',
        costPrice: 180,
        basePrice: 399,
        currentPrice: 399,
        tier: 'budget',
        targetMargin: 0.10,
        pricingStrategy: { mode: 'auto', maxIncreasePct: 0.15, maxDecreasePct: 0.15 },
        seasonalConfig: {
          season: 'monsoon',       // Would boost...
          startDate: '06-01',      // ...but Books category is disabled
          peakDate: '07-15',       // in Settings → multiplier stays 1.0
          endDate: '09-15',
          maxBoost: 0.12,
        },
      },
    ]);
    console.log(`Seeded ${products.length} products.`);

    // ════════════════════════════════════════════
    //  2. INVENTORY
    // ════════════════════════════════════════════
    // Note: emaDailySales here is for display/EMA service.
    // The engine recalculates from actual sales data.

    await Inventory.insertMany([
      {
        productId: products[0]._id,
        availableQuantity: 18,
        emaDailySales: 6.5,
        emaSalesUpdatedAt: new Date(),
        coverageDays: 2.8,
        inventoryStatus: 'critical',
      },
      {
        productId: products[1]._id,
        availableQuantity: 120,
        emaDailySales: 4.2,
        emaSalesUpdatedAt: new Date(),
        coverageDays: 28.6,
        inventoryStatus: 'high',
      },
      {
        productId: products[2]._id,
        availableQuantity: 45,
        emaDailySales: 5.0,
        emaSalesUpdatedAt: new Date(),
        coverageDays: 9.0,
        inventoryStatus: 'normal',
      },
      {
        productId: products[3]._id,
        availableQuantity: 300,
        emaDailySales: 3.1,
        emaSalesUpdatedAt: new Date(),
        coverageDays: 96.8,
        inventoryStatus: 'high',
      },
      {
        productId: products[4]._id,
        availableQuantity: 55,
        emaDailySales: 4.8,
        emaSalesUpdatedAt: new Date(),
        coverageDays: 11.5,
        inventoryStatus: 'normal',
      },
    ]);
    console.log('Inventory seeded.');

    // ════════════════════════════════════════════
    //  3. PROMOTIONAL EVENTS
    // ════════════════════════════════════════════

    // Use create() instead of insertMany() because the PromotionalEvent
    // model has a pre-validate hook using next() which doesn't work with insertMany.
    const event1 = await PromotionalEvent.create({
      // Event 1 — ACTIVE: covers Products 1 & 2 (Electronics)
      eventName: 'Festive Electronics Sale',
      eventType: 'category_sale',
      description: '10% off all electronics for the festive season',
      startDate: daysAgo(3),
      endDate: daysFromNow(3),
      status: 'ACTIVE',
      priority: 2,
      discountType: 'percentage',
      discountValue: 10,
      targetType: 'specific_categories',
      targetCategories: ['Electronics'],
      respectProfitFloor: true,
    });

    const event2 = await PromotionalEvent.create({
      // Event 2 — EXPIRED: past Clothing event for analytics demo
      eventName: 'Weekend Clothing Flash Sale',
      eventType: 'flash_sale',
      description: '15% off all clothing — limited weekend offer',
      startDate: daysAgo(10),
      endDate: daysAgo(5),
      status: 'EXPIRED',
      priority: 3,
      discountType: 'percentage',
      discountValue: 15,
      targetType: 'specific_categories',
      targetCategories: ['Clothing'],
      respectProfitFloor: true,
    });

    const events = [event1, event2];
    const activeEventId = event1._id;
    console.log(`Seeded ${events.length} promotional events.`);

    // ════════════════════════════════════════════
    //  4. SALES EVENTS
    // ════════════════════════════════════════════
    //
    // ENGINE DEMAND COMPUTATION:
    //   shortTermRate = organic qty in last 6h ÷ 6  (per hour)
    //   longTermRate  = organic qty in last 7d ÷ 168 (per hour)
    //   velocityRatio = shortTermRate ÷ longTermRate
    //
    // ENGINE INVENTORY COMPUTATION:
    //   coverageDays = availableQuantity ÷ (longTermRate × 24)
    //
    // Promotional sales (eventId ≠ null) are EXCLUDED from both
    // organic rates — this verifies the demand attribution logic.

    const allSales = [];

    // ── P1: Headphones — HIGH velocity ────────────
    // Target: velocityRatio ~2.5 → HIGH interpretation
    //   45 organic total: 4 in last 6h, 6 in 6-44h, 35 in 48-166h
    //   shortTermRate = 4/6 = 0.667/hr
    //   longTermRate  = 45/168 = 0.268/hr
    //   velocityRatio = 0.667/0.268 = 2.49 → HIGH
    //   coverageDays  = 18/(0.268×24) = 2.8 → CRITICAL
    allSales.push(
      ...organicSales(products[0]._id, [1, 2, 4, 5], 5999),                   // 4 in last 6h
      ...organicSales(products[0]._id, spreadHours(8, 44, 6), 5999),          // 6 in 6–44h
      ...organicSales(products[0]._id, spreadHours(48, 166, 35), 5999),       // 35 in 48–166h
      ...promoSales(products[0]._id, 4, activeEventId, 5999),                 // 4 promo
    );

    // ── P2: Charger — STABLE velocity ─────────────
    // Target: velocityRatio ~0.9 → STABLE interpretation
    //   30 organic total: 1 in last 6h, 29 in 7-167h
    //   shortTermRate = 1/6 = 0.167/hr
    //   longTermRate  = 30/168 = 0.179/hr
    //   velocityRatio = 0.167/0.179 = 0.93 → STABLE
    //   coverageDays  = 120/(0.179×24) = 28 → HIGH
    allSales.push(
      ...organicSales(products[1]._id, [3], 1299),                            // 1 in last 6h
      ...organicSales(products[1]._id, spreadHours(7, 167, 29), 1299),        // 29 in 7–167h
      ...promoSales(products[1]._id, 4, activeEventId, 1299),                 // 4 promo
    );

    // ── P3: Kurta — RISING velocity ──────────────
    // Target: velocityRatio ~1.6 → RISING interpretation
    //   35 organic total: 2 in last 6h, 33 in 7-167h
    //   shortTermRate = 2/6 = 0.333/hr
    //   longTermRate  = 35/168 = 0.208/hr
    //   velocityRatio = 0.333/0.208 = 1.60 → RISING
    //   coverageDays  = 45/(0.208×24) = 9.0 → NORMAL
    allSales.push(
      ...organicSales(products[2]._id, [2, 4], 799),                          // 2 in last 6h
      ...organicSales(products[2]._id, spreadHours(7, 167, 33), 799),         // 33 in 7–167h
      ...promoSales(products[2]._id, 3, activeEventId, 799),                  // 3 promo
    );

    // ── P4: Rice — LOW velocity (demand falling) ──
    // Target: velocityRatio = 0 → LOW interpretation
    //   22 organic total: 0 in last 6h, 22 in 8-167h
    //   shortTermRate = 0/6 = 0
    //   longTermRate  = 22/168 = 0.131/hr
    //   velocityRatio = 0/0.131 = 0 → LOW
    //   coverageDays  = 300/(0.131×24) = 95.5 → HIGH
    allSales.push(
      ...organicSales(products[3]._id, spreadHours(8, 167, 22), 699),         // 22 in 8–167h
      ...promoSales(products[3]._id, 4, activeEventId, 699),                  // 4 promo
    );

    // ── P5: Books — STABLE velocity ──────────────
    // Target: velocityRatio ~0.8 → STABLE interpretation
    //   34 organic total: 1 in last 6h, 33 in 7-167h
    //   shortTermRate = 1/6 = 0.167/hr
    //   longTermRate  = 34/168 = 0.202/hr
    //   velocityRatio = 0.167/0.202 = 0.83 → STABLE
    //   coverageDays  = 55/(0.202×24) = 11.3 → NORMAL
    allSales.push(
      ...organicSales(products[4]._id, [3], 399),                             // 1 in last 6h
      ...organicSales(products[4]._id, spreadHours(7, 167, 33), 399),         // 33 in 7–167h
      ...promoSales(products[4]._id, 3, activeEventId, 399),                  // 3 promo
    );

    await SalesEvent.insertMany(allSales);
    console.log(`Seeded ${allSales.length} sales events.`);

    // ════════════════════════════════════════════
    //  5. COMPETITOR PRICES
    // ════════════════════════════════════════════
    // All competitors use recent recordedAt so they pass the
    // 72h freshness filter in the engine.

    const competitors = await CompetitorPrice.insertMany([
      // P1: Headphones — competitors above us → gapPercent +8%
      // Our 5999 is cheapest → competitor signal ≈ 1.03 (small upward)
      { productId: products[0]._id, competitorName: 'Amazon',   competitorPrice: 6199, recordedAt: hoursAgo(2) },
      { productId: products[0]._id, competitorName: 'Flipkart', competitorPrice: 6499, recordedAt: hoursAgo(5) },

      // P2: Charger — competitors significantly cheaper → gapPercent -15%
      // Median ≈ 1099 vs our 1299 → competitor signal ≈ 0.94 (strong downward)
      { productId: products[1]._id, competitorName: 'Amazon',   competitorPrice: 999,  recordedAt: hoursAgo(3) },
      { productId: products[1]._id, competitorName: 'Flipkart', competitorPrice: 1099, recordedAt: hoursAgo(6) },

      // P3: Kurta — competitors near parity → gap ~6%
      // Median 849 vs our 799 → slight upward signal
      { productId: products[2]._id, competitorName: 'Myntra',   competitorPrice: 849,  recordedAt: hoursAgo(8) },
      { productId: products[2]._id, competitorName: 'Ajio',     competitorPrice: 749,  recordedAt: hoursAgo(12) },

      // P4: Rice — competitors slightly cheaper → gap -6%
      // Adds downward pressure on top of LOW demand
      { productId: products[3]._id, competitorName: 'Amazon',    competitorPrice: 649,  recordedAt: hoursAgo(4) },
      { productId: products[3]._id, competitorName: 'BigBasket', competitorPrice: 659,  recordedAt: hoursAgo(7) },

      // P5: Books — near parity → gap +5%
      // Small upward signal, but change too small → MINIMUM_CHANGE
      { productId: products[4]._id, competitorName: 'Amazon',   competitorPrice: 389,  recordedAt: hoursAgo(6) },
      { productId: products[4]._id, competitorName: 'Flipkart', competitorPrice: 419,  recordedAt: hoursAgo(10) },
    ]);
    console.log(`Seeded ${competitors.length} competitor prices.`);

    // ════════════════════════════════════════════
    //  6. SETTINGS
    // ════════════════════════════════════════════

    await Settings.insertMany([
      { key: 'schedulerEnabled',           value: true,       description: 'Enable background price recalculation' },
      { key: 'schedulerIntervalMinutes',   value: 30,         description: 'Minutes between auto-recalculation runs' },
      { key: 'autoApplyThreshold',         value: 0.80,       description: 'Confidence threshold for auto-apply' },
      { key: 'minChangeThreshold',         value: 0.01,       description: '1% minimum change to avoid noise' },
      { key: 'seasonalPricingEnabled',     value: true,       description: 'Master toggle for seasonal pricing' },
      { key: 'seasonalDisabledCategories', value: ['Books'],  description: 'Categories excluded from seasonal pricing' },
      { key: 'eventsEnabled',              value: true,       description: 'Master toggle for promotional events' },
      { key: 'maxGlobalDiscountPercent',   value: 0.30,       description: 'Global max discount safety cap (30%)' },
    ]);
    console.log('Settings seeded.');

    // ── Summary ─────────────────────────────────
    const promoCount = allSales.filter((s) => s.isPromotional).length;
    const organicCount = allSales.length - promoCount;
    console.log(
      `\nSeeded: ${products.length} products, 5 inventory, ` +
      `${events.length} events, ${allSales.length} sales ` +
      `(${organicCount} organic + ${promoCount} promo), ` +
      `${competitors.length} competitors, 8 settings`,
    );

    // ── Expected engine outcomes ────────────────
    console.log('\n── Expected Engine Outcomes ──');
    console.log('P1 Headphones: recommendedPrice > 5999, demand=HIGH, inventory=CRITICAL, event=10% off');
    console.log('P2 Charger:    recommendedPrice < 1299, competitor=CHEAPER, event=10% off');
    console.log('P3 Kurta:      seasonal > 1.0 (monsoon ramp_up), mode=manual');
    console.log('P4 Rice:       PROFIT_FLOOR constraint, recommendedPrice ≈ 649');
    console.log('P5 Book:       seasonal = 1.0 (Books disabled), MINIMUM_CHANGE likely');

    console.log('\n✅ Production seed complete!');

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('Seeding failed:', err);
    process.exit(1);
  }
}

seed();

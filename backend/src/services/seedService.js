const Product = require('../models/product');
const Inventory = require('../models/inventory');
const SalesEvent = require('../models/salesEvent');
const PromotionalEvent = require('../models/promotionalEvent');
const CompetitorPrice = require('../models/competitorPrice');
const Settings = require('../models/settings');

const hoursAgo = (h) => new Date(Date.now() - h * 3600000);
const daysAgo = (d) => new Date(Date.now() - d * 24 * 3600000);
const daysFromNow = (d) => new Date(Date.now() + d * 24 * 3600000);
const channels = ['web', 'mobile', 'store'];
const randomChannel = () => channels[Math.floor(Math.random() * channels.length)];

function spreadHours(startH, endH, count) {
  if (count <= 1) return [startH];
  const step = (endH - startH) / (count - 1);
  return Array.from({ length: count }, (_, i) => +(startH + i * step).toFixed(1));
}

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

function promoSales(productId, count, eventId, price) {
  return Array.from({ length: count }, (_, i) => ({
    productId,
    quantity: 1,
    priceAtSale: parseFloat((price * 0.9).toFixed(2)),
    channel: randomChannel(),
    soldAt: hoursAgo(15 + i * 14),
    eventId,
    isPromotional: true,
    isCancelled: false,
  }));
}

async function seedDummyDataForUser(uid) {
  try {
    await Promise.all([
      Product.deleteMany({ ownerId: uid }),
      SalesEvent.deleteMany({}),
      CompetitorPrice.deleteMany({}),
      PromotionalEvent.deleteMany({ ownerId: uid }),
      Settings.deleteMany({ ownerId: uid }),
    ]);

    const inventoryIds = await Inventory.find({}).select('productId');
    if (inventoryIds.length > 0) {
      const productIds = inventoryIds.map((i) => i.productId);
      const userProducts = await Product.find({ ownerId: uid }).select('_id');
      const userProductIds = new Set(userProducts.map((p) => p._id.toString()));
      const toDelete = productIds.filter((id) => userProductIds.has(id.toString()));
      if (toDelete.length > 0) await Inventory.deleteMany({ productId: { $in: toDelete } });
    }

    const products = await Product.insertMany([
      {
        ownerId: uid,
        productName: 'Wireless Noise-Cancelling Headphones',
        sku: `WNC-HP-${uid.slice(-4).toUpperCase()}`,
        category: 'Electronics',
        description: 'Premium ANC headphones with 30h battery life',
        costPrice: 175,
        basePrice: 349.99,
        currentPrice: 349.99,
        tier: 'premium',
        targetMargin: 0.20,
        pricingStrategy: { mode: 'auto', maxIncreasePct: 0.15, maxDecreasePct: 0.15 },
        seasonalConfig: {
          season: 'festive',
          startDate: '06-01',
          peakDate: '06-25',
          endDate: '07-31',
          maxBoost: 0.12,
        },
      },
      {
        ownerId: uid,
        productName: 'USB-C Fast Charger 65W',
        sku: `USB-FC-${uid.slice(-4).toUpperCase()}`,
        category: 'Electronics',
        description: 'GaN charger with 3 ports, PD 3.0 compatible',
        costPrice: 12,
        basePrice: 44.99,
        currentPrice: 44.99,
        tier: 'mid',
        targetMargin: 0.15,
        pricingStrategy: { mode: 'auto', maxIncreasePct: 0.15, maxDecreasePct: 0.15 },
        seasonalConfig: { season: 'none' },
      },
      {
        ownerId: uid,
        productName: 'Cotton Casual Shirt Set',
        sku: `CCS-${uid.slice(-4).toUpperCase()}`,
        category: 'Clothing',
        description: 'Breathable cotton shirt, ideal for summer',
        costPrice: 22,
        basePrice: 64.99,
        currentPrice: 64.99,
        tier: 'budget',
        targetMargin: 0.12,
        pricingStrategy: { mode: 'manual', maxIncreasePct: 0.15, maxDecreasePct: 0.15 },
        seasonalConfig: {
          season: 'monsoon',
          startDate: '06-01',
          peakDate: '07-15',
          endDate: '09-15',
          maxBoost: 0.12,
        },
      },
      {
        ownerId: uid,
        productName: 'Organic Basmati Rice 5kg',
        sku: `OBR-${uid.slice(-4).toUpperCase()}`,
        category: 'Food',
        description: 'Aged organic basmati rice, premium grade',
        costPrice: 23,
        basePrice: 28.99,
        currentPrice: 28.99,
        tier: 'mid',
        targetMargin: 0.10,
        pricingStrategy: { mode: 'auto', maxIncreasePct: 0.15, maxDecreasePct: 0.15 },
        seasonalConfig: { season: 'none' },
      },
      {
        ownerId: uid,
        productName: 'UPSC Civil Services Exam Guide',
        sku: `UPG-${uid.slice(-4).toUpperCase()}`,
        category: 'Books',
        description: 'Complete guide with practice papers and mock tests',
        costPrice: 7,
        basePrice: 18.99,
        currentPrice: 18.99,
        tier: 'budget',
        targetMargin: 0.10,
        pricingStrategy: { mode: 'auto', maxIncreasePct: 0.15, maxDecreasePct: 0.15 },
        seasonalConfig: {
          season: 'monsoon',
          startDate: '06-01',
          peakDate: '07-15',
          endDate: '09-15',
          maxBoost: 0.12,
        },
      },
    ]);

    await Inventory.insertMany([
      { productId: products[0]._id, availableQuantity: 18, emaDailySales: 6.5, emaSalesUpdatedAt: new Date(), coverageDays: 2.8, inventoryStatus: 'critical' },
      { productId: products[1]._id, availableQuantity: 120, emaDailySales: 4.2, emaSalesUpdatedAt: new Date(), coverageDays: 28.6, inventoryStatus: 'high' },
      { productId: products[2]._id, availableQuantity: 45, emaDailySales: 5.0, emaSalesUpdatedAt: new Date(), coverageDays: 9.0, inventoryStatus: 'normal' },
      { productId: products[3]._id, availableQuantity: 300, emaDailySales: 3.1, emaSalesUpdatedAt: new Date(), coverageDays: 96.8, inventoryStatus: 'high' },
      { productId: products[4]._id, availableQuantity: 55, emaDailySales: 4.8, emaSalesUpdatedAt: new Date(), coverageDays: 11.5, inventoryStatus: 'normal' },
    ]);

    const event1 = await PromotionalEvent.create({
      ownerId: uid,
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

    await PromotionalEvent.create({
      ownerId: uid,
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

    const activeEventId = event1._id;
    const allSales = [];

    allSales.push(
      ...organicSales(products[0]._id, [1, 2, 4, 5], 349.99),
      ...organicSales(products[0]._id, spreadHours(8, 44, 6), 349.99),
      ...organicSales(products[0]._id, spreadHours(48, 166, 35), 349.99),
      ...promoSales(products[0]._id, 4, activeEventId, 349.99),
    );

    allSales.push(
      ...organicSales(products[1]._id, [3], 44.99),
      ...organicSales(products[1]._id, spreadHours(7, 167, 29), 44.99),
      ...promoSales(products[1]._id, 4, activeEventId, 44.99),
    );

    allSales.push(
      ...organicSales(products[2]._id, [2, 4], 64.99),
      ...organicSales(products[2]._id, spreadHours(7, 167, 33), 64.99),
      ...promoSales(products[2]._id, 3, activeEventId, 64.99),
    );

    allSales.push(
      ...organicSales(products[3]._id, spreadHours(8, 167, 22), 28.99),
      ...promoSales(products[3]._id, 4, activeEventId, 28.99),
    );

    allSales.push(
      ...organicSales(products[4]._id, [3], 18.99),
      ...organicSales(products[4]._id, spreadHours(7, 167, 33), 18.99),
      ...promoSales(products[4]._id, 3, activeEventId, 18.99),
    );

    await SalesEvent.insertMany(allSales);

    await CompetitorPrice.insertMany([
      { productId: products[0]._id, competitorName: 'Amazon',    competitorPrice: 369.99, recordedAt: hoursAgo(2) },
      { productId: products[0]._id, competitorName: 'Flipkart',  competitorPrice: 389.99, recordedAt: hoursAgo(5) },
      { productId: products[1]._id, competitorName: 'Amazon',    competitorPrice: 32.99,  recordedAt: hoursAgo(3) },
      { productId: products[1]._id, competitorName: 'Flipkart',  competitorPrice: 35.99,  recordedAt: hoursAgo(6) },
      { productId: products[2]._id, competitorName: 'Myntra',    competitorPrice: 69.99,  recordedAt: hoursAgo(8) },
      { productId: products[2]._id, competitorName: 'Ajio',      competitorPrice: 59.99,  recordedAt: hoursAgo(12) },
      { productId: products[3]._id, competitorName: 'Amazon',    competitorPrice: 25.99,  recordedAt: hoursAgo(4) },
      { productId: products[3]._id, competitorName: 'BigBasket', competitorPrice: 26.49,  recordedAt: hoursAgo(7) },
      { productId: products[4]._id, competitorName: 'Amazon',    competitorPrice: 17.99,  recordedAt: hoursAgo(6) },
      { productId: products[4]._id, competitorName: 'Flipkart',  competitorPrice: 19.99,  recordedAt: hoursAgo(10) },
    ]);

    await Settings.insertMany([
      { ownerId: uid, key: 'schedulerEnabled',           value: true },
      { ownerId: uid, key: 'schedulerIntervalMinutes',   value: 30 },
      { ownerId: uid, key: 'autoApplyThreshold',         value: 0.80 },
      { ownerId: uid, key: 'minChangeThreshold',         value: 0.01 },
      { ownerId: uid, key: 'seasonalPricingEnabled',     value: true },
      { ownerId: uid, key: 'seasonalDisabledCategories', value: ['Books'] },
      { ownerId: uid, key: 'eventsEnabled',              value: true },
      { ownerId: uid, key: 'maxGlobalDiscountPercent',   value: 0.30 },
    ]);

    console.log(`[SeedService] Successfully seeded presentation data for user: ${uid}`);
  } catch (error) {
    console.error(`[SeedService] Error seeding data for ${uid}:`, error);
  }
}

module.exports = { seedDummyDataForUser };

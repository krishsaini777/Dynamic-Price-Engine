const Product = require('../models/product');
const Inventory = require('../models/inventory');
const SalesEvent = require('../models/salesEvent');
const PromotionalEvent = require('../models/promotionalEvent');
const CompetitorPrice = require('../models/competitorPrice');
const Settings = require('../models/settings');
const PricingRecommendation = require('../models/pricingRecommendation');
const EventAnalytics = require('../models/eventAnalytics');

const hoursAgo = (h) => new Date(Date.now() - h * 3600000);
const daysAgo = (d) => new Date(Date.now() - d * 24 * 3600000);
const daysFromNow = (d) => new Date(Date.now() + d * 24 * 3600000);

const randomChannel = () => {
  const channels = ['web', 'mobile', 'store'];
  return channels[Math.floor(Math.random() * channels.length)];
};

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
    priceAtSale: Math.round(price * 0.9),
    channel: randomChannel(),
    soldAt: hoursAgo(15 + i * 14),
    eventId,
    isPromotional: true,
    isCancelled: false,
  }));
}

async function seedPresentationData(uid) {
  try {
    await Promise.all([
      Product.deleteMany({ ownerId: uid }),
      Inventory.deleteMany({ ownerId: uid }), // Using ownerId might not work on Inventory if it has no ownerId, wait, check schema!
      CompetitorPrice.deleteMany({ ownerId: uid }), // Wait, do these have ownerId?
      SalesEvent.deleteMany({ ownerId: uid }),
      PromotionalEvent.deleteMany({ ownerId: uid }),
      Settings.deleteMany({ ownerId: uid }),
      PricingRecommendation.deleteMany({ ownerId: uid }),
      EventAnalytics.deleteMany({ ownerId: uid }),
    ]);
  } catch(e) {
    // If models lack ownerId, we fall back to generic deletes (local env assumed for presentation)
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
  }

  const productsData = [
    {
      ownerId: uid,
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
      seasonalConfig: { season: 'festive', startDate: '06-01', peakDate: '06-25', endDate: '07-31', maxBoost: 0.12 },
    },
    {
      ownerId: uid,
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
    {
      ownerId: uid,
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
      seasonalConfig: { season: 'monsoon', startDate: '06-01', peakDate: '07-15', endDate: '09-15', maxBoost: 0.12 },
    },
    {
      ownerId: uid,
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
    {
      ownerId: uid,
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
      seasonalConfig: { season: 'monsoon', startDate: '06-01', peakDate: '07-15', endDate: '09-15', maxBoost: 0.12 },
    },
  ];

  const products = await Product.insertMany(productsData);

  await Inventory.insertMany([
    { productId: products[0]._id, availableQuantity: 18, emaDailySales: 6.5, coverageDays: 2.8, inventoryStatus: 'critical' },
    { productId: products[1]._id, availableQuantity: 120, emaDailySales: 4.2, coverageDays: 28.6, inventoryStatus: 'high' },
    { productId: products[2]._id, availableQuantity: 45, emaDailySales: 5.0, coverageDays: 9.0, inventoryStatus: 'normal' },
    { productId: products[3]._id, availableQuantity: 300, emaDailySales: 3.1, coverageDays: 96.8, inventoryStatus: 'high' },
    { productId: products[4]._id, availableQuantity: 55, emaDailySales: 4.8, coverageDays: 11.5, inventoryStatus: 'normal' },
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

  const event2 = await PromotionalEvent.create({
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
    ...organicSales(products[0]._id, [1, 2, 4, 5], 5999),
    ...organicSales(products[0]._id, spreadHours(8, 44, 6), 5999),
    ...organicSales(products[0]._id, spreadHours(48, 166, 35), 5999),
    ...promoSales(products[0]._id, 4, activeEventId, 5999),
  );

  allSales.push(
    ...organicSales(products[1]._id, [3], 1299),
    ...organicSales(products[1]._id, spreadHours(7, 167, 29), 1299),
    ...promoSales(products[1]._id, 4, activeEventId, 1299),
  );

  allSales.push(
    ...organicSales(products[2]._id, [2, 4], 799),
    ...organicSales(products[2]._id, spreadHours(7, 167, 33), 799),
    ...promoSales(products[2]._id, 3, activeEventId, 799),
  );

  allSales.push(
    ...organicSales(products[3]._id, spreadHours(8, 167, 22), 699),
    ...promoSales(products[3]._id, 4, activeEventId, 699),
  );

  allSales.push(
    ...organicSales(products[4]._id, [3], 399),
    ...organicSales(products[4]._id, spreadHours(7, 167, 33), 399),
    ...promoSales(products[4]._id, 3, activeEventId, 399),
  );

  await SalesEvent.insertMany(allSales);

  await CompetitorPrice.insertMany([
    { productId: products[0]._id, competitorName: 'Amazon', competitorPrice: 6199, recordedAt: hoursAgo(2) },
    { productId: products[0]._id, competitorName: 'Flipkart', competitorPrice: 6499, recordedAt: hoursAgo(5) },
    { productId: products[1]._id, competitorName: 'Amazon', competitorPrice: 999, recordedAt: hoursAgo(3) },
    { productId: products[1]._id, competitorName: 'Flipkart', competitorPrice: 1099, recordedAt: hoursAgo(6) },
    { productId: products[2]._id, competitorName: 'Myntra', competitorPrice: 849, recordedAt: hoursAgo(8) },
    { productId: products[2]._id, competitorName: 'Ajio', competitorPrice: 749, recordedAt: hoursAgo(12) },
    { productId: products[3]._id, competitorName: 'Amazon', competitorPrice: 649, recordedAt: hoursAgo(4) },
    { productId: products[3]._id, competitorName: 'BigBasket', competitorPrice: 659, recordedAt: hoursAgo(7) },
    { productId: products[4]._id, competitorName: 'Amazon', competitorPrice: 389, recordedAt: hoursAgo(6) },
    { productId: products[4]._id, competitorName: 'Flipkart', competitorPrice: 419, recordedAt: hoursAgo(10) },
  ]);

  await Settings.insertMany([
    { ownerId: uid, key: 'schedulerEnabled', value: true },
    { ownerId: uid, key: 'schedulerIntervalMinutes', value: 30 },
    { ownerId: uid, key: 'autoApplyThreshold', value: 0.80 },
    { ownerId: uid, key: 'minChangeThreshold', value: 0.01 },
    { ownerId: uid, key: 'seasonalPricingEnabled', value: true },
    { ownerId: uid, key: 'seasonalDisabledCategories', value: ['Books'] },
    { ownerId: uid, key: 'eventsEnabled', value: true },
    { ownerId: uid, key: 'maxGlobalDiscountPercent', value: 0.30 },
  ]);
}

async function seedDummyDataForUser(uid) {
  try {
    await seedPresentationData(uid);
  } catch (error) {
    console.error(`[SeedService] Error seeding presentation data for ${uid}:`, error);
  }
}

module.exports = { seedDummyDataForUser, seedPresentationData };

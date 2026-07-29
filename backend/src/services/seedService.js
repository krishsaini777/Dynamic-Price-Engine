const Product = require('../models/product');
const Inventory = require('../models/inventory');
const SalesEvent = require('../models/salesEvent');
const PromotionalEvent = require('../models/promotionalEvent');

async function seedDummyDataForUser(uid) {
  try {
    console.log(`[SeedService] Seeding dummy data for new user: ${uid}`);
    
    // 1. Create 3 Dummy Products
    const p1 = await Product.create({
      ownerId: uid,
      productName: 'Sony WH-1000XM5 Headphones',
      sku: 'AUDIO-SONY-XM5',
      category: 'Electronics',
      basePrice: 349.99,
      costPrice: 180.00,
      currentPrice: 349.99,
      targetMargin: 0.2,
      tier: 'premium',
      isActive: true,
      pricingStrategy: { mode: 'auto', bounds: { min: 250, max: 400 } }
    });

    const p2 = await Product.create({
      ownerId: uid,
      productName: 'Ergonomic Mesh Office Chair',
      sku: 'FURN-CHR-002',
      category: 'Home',
      basePrice: 199.99,
      costPrice: 95.00,
      currentPrice: 199.99,
      targetMargin: 0.15,
      tier: 'standard',
      isActive: true,
      pricingStrategy: { mode: 'auto', bounds: { min: 150, max: 250 } }
    });

    const p3 = await Product.create({
      ownerId: uid,
      productName: 'Basic Cotton T-Shirt (3-Pack)',
      sku: 'APP-TEE-PACK',
      category: 'Clothing',
      basePrice: 24.99,
      costPrice: 8.50,
      currentPrice: 24.99,
      targetMargin: 0.25,
      tier: 'budget',
      isActive: true,
      pricingStrategy: { mode: 'auto', bounds: { min: 15, max: 35 } }
    });

    // 2. Create Inventory
    await Inventory.create([
      { productId: p1._id, availableQuantity: 45, inventoryStatus: 'normal', coverageDays: 14.5, emaDailySales: 3.1 },
      { productId: p2._id, availableQuantity: 5, inventoryStatus: 'critical', coverageDays: 1.2, emaDailySales: 4.0 },
      { productId: p3._id, availableQuantity: 300, inventoryStatus: 'high', coverageDays: 45.0, emaDailySales: 6.6 }
    ]);

    // 3. Create a Scheduled Promotional Event
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    const endNextWeek = new Date();
    endNextWeek.setDate(endNextWeek.getDate() + 14);

    await PromotionalEvent.create({
      ownerId: uid,
      eventName: 'Summer Tech Blowout',
      eventType: 'weekend_sale',
      description: 'Massive discounts on premium electronics for the summer season.',
      startDate: nextWeek,
      endDate: endNextWeek,
      status: 'SCHEDULED',
      discountType: 'percentage',
      discountValue: 15,
      targetType: 'specific_categories',
      targetCategories: ['Electronics'],
      isRecurring: false
    });

    // 4. Generate 14 days of realistic past sales data
    const sales = [];
    const now = new Date();
    
    for(let i = 14; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      
      // Randomize hours to make the scatter plot look real
      d.setHours(Math.floor(Math.random() * 12) + 8); 
      
      // Electronics (Steady, 2-4 a day)
      sales.push({
        productId: p1._id,
        quantity: Math.floor(Math.random() * 3) + 2,
        priceAtSale: 349.99,
        soldAt: d
      });
      
      // Home/Office (Spiking recently, caused the low inventory)
      const chairSales = i < 3 ? Math.floor(Math.random() * 8) + 5 : Math.floor(Math.random() * 3) + 1;
      sales.push({
        productId: p2._id,
        quantity: chairSales,
        priceAtSale: 199.99,
        soldAt: d
      });
      
      // Clothing (High volume, 5-10 a day)
      sales.push({
        productId: p3._id,
        quantity: Math.floor(Math.random() * 6) + 5,
        priceAtSale: 24.99,
        soldAt: d
      });
    }
    
    await SalesEvent.insertMany(sales);
    console.log(`[SeedService] Successfully seeded dummy data for user: ${uid}`);

  } catch (error) {
    console.error(`[SeedService] Error seeding data for ${uid}:`, error);
  }
}

module.exports = { seedDummyDataForUser };

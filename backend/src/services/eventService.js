const PromotionalEvent = require("../models/promotionalEvent");
const Settings = require("../models/settings");

// ownerId: Firebase UID of the product owner — used to scope settings and events
async function findActiveEventForProduct(product, referenceDate = new Date(), ownerId = null) {
  // FIXED: was Settings.findOne({ key }) — no user scope; any user's setting would apply
  const eventsEnabled = await Settings.findOne({ key: 'eventsEnabled', ownerId });
  if (!eventsEnabled || eventsEnabled.value === false) return null;

  // FIXED: was PromotionalEvent.find({ status: 'ACTIVE' }) — fetched ALL users' events
  const activeEvents = await PromotionalEvent.find({
    ownerId,
    status: 'ACTIVE',
    startDate: { $lte: referenceDate },
    endDate: { $gte: referenceDate },
  }).sort({ priority: 1 });

  for (const event of activeEvents) {
    if (doesEventMatchProduct(event, product)) return event;
  }

  return null;
}

function doesEventMatchProduct(event, product) {
  switch (event.targetType) {
    case "all_products":
      return true;

    case "specific_products":
      return event.targetProducts.some(
        (id) => id.toString() === product._id.toString(),
      );

    case "specific_categories":
      return event.targetCategories.includes(product.category);

    default:
      return false;
  }
}

function applyEventDiscount(event, recommendedPrice, product) {
  let discountedPrice;

  switch (event.discountType) {
    case "percentage":
      discountedPrice = recommendedPrice * (1 - event.discountValue / 100);
      break;
    case "flat_amount":
      discountedPrice = recommendedPrice - event.discountValue;
      break;
    case "fixed_price":
      discountedPrice = event.discountValue;
      break;
    default:
      discountedPrice = recommendedPrice;
  }

  let constraintApplied = "NONE";
  if (event.respectProfitFloor !== false && product.costPrice) {
    const profitFloor =
      product.costPrice * (1 + (product.targetMargin || 0.15));
    if (discountedPrice < profitFloor) {
      discountedPrice = profitFloor;
      constraintApplied = "PROFIT_FLOOR";
    }
  }

  if (
    event.minFinalPrice &&
    discountedPrice < event.minFinalPrice &&
    constraintApplied === "NONE"
  ) {
    discountedPrice = event.minFinalPrice;
    constraintApplied = "EVENT_MIN_PRICE";
  }

  const finalCustomerPrice = Math.round(discountedPrice);

  return {
    eventApplied: true,
    eventId: event._id,
    eventName: event.eventName,
    discountType: event.discountType,
    discountValue: event.discountValue,
    priceBeforeDiscount: recommendedPrice,
    priceAfterDiscount: finalCustomerPrice,
    finalCustomerPrice,
    constraintApplied,
  };
}

module.exports = {
  findActiveEventForProduct,
  applyEventDiscount,
  doesEventMatchProduct,
};

const asyncHandler = require('../middleware/asyncHandler');
const PromotionalEvent = require('../models/promotionalEvent');
const EventAnalytics = require('../models/eventAnalytics');
const Product = require('../models/product');
const { sendSuccess, sendError } = require('../utils/apiResponse');

// @desc    List all events — only the authenticated user's events
// @route   GET /api/v1/events
const getEvents = asyncHandler(async (req, res) => {
  const uid = req.user.uid;
  const query = { ownerId: uid }; // FIXED: was {} — fetched ALL users' events

  if (req.query.status) {
    const statuses = req.query.status.split(',').map(s => s.trim()).filter(Boolean);
    query.status = statuses.length === 1 ? statuses[0] : { $in: statuses };
  }
  const events = await PromotionalEvent.find(query).sort({ startDate: 1 });
  sendSuccess(res, events);
});

// @desc    Get single event (ownership enforced)
// @route   GET /api/v1/events/:id
const getEvent = asyncHandler(async (req, res) => {
  const uid = req.user.uid;

  // FIXED: was PromotionalEvent.findById — no ownership check
  const event = await PromotionalEvent.findOne({ _id: req.params.id, ownerId: uid });
  if (!event) return sendError(res, 'Event not found', 404);

  const analytics = await EventAnalytics.find({ eventId: event._id });
  const data = event.toObject();
  data.analyticsSummary = analytics;
  sendSuccess(res, data);
});

// @desc    Create event — auto-assigns ownerId from JWT
// @route   POST /api/v1/events
const createEvent = asyncHandler(async (req, res) => {
  // FIXED: was PromotionalEvent.create(req.body) — no ownerId stored
  const event = await PromotionalEvent.create({
    ...req.body,
    ownerId: req.user.uid,  // always overwrite; never trust client
    status: 'DRAFT',
  });
  sendSuccess(res, event, 201);
});

// @desc    Update event (ownership enforced; only DRAFT/SCHEDULED)
// @route   PATCH /api/v1/events/:id
const updateEvent = asyncHandler(async (req, res) => {
  const uid = req.user.uid;

  // FIXED: was findById — no ownership check
  const event = await PromotionalEvent.findOne({ _id: req.params.id, ownerId: uid });
  if (!event) return sendError(res, 'Event not found', 404);
  if (!['DRAFT', 'SCHEDULED'].includes(event.status)) {
    return sendError(res, 'Can only update events in DRAFT or SCHEDULED status', 400);
  }

  // Prevent reassigning ownerId
  delete req.body.ownerId;

  const updated = await PromotionalEvent.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  sendSuccess(res, updated);
});

// @desc    Delete event (ownership enforced; only DRAFT/INACTIVE)
// @route   DELETE /api/v1/events/:id
const deleteEvent = asyncHandler(async (req, res) => {
  const uid = req.user.uid;

  // FIXED: was findById — no ownership check
  const event = await PromotionalEvent.findOne({ _id: req.params.id, ownerId: uid });
  if (!event) return sendError(res, 'Event not found', 404);
  if (!['DRAFT', 'INACTIVE'].includes(event.status)) {
    return sendError(res, 'Can only delete events in DRAFT or INACTIVE status', 400);
  }
  await PromotionalEvent.findByIdAndDelete(req.params.id);
  sendSuccess(res, { message: 'Event deleted' });
});

// @desc    Activate event (ownership enforced)
// @route   PATCH /api/v1/events/:id/activate
const activateEvent = asyncHandler(async (req, res) => {
  const uid = req.user.uid;

  const event = await PromotionalEvent.findOne({ _id: req.params.id, ownerId: uid });
  if (!event) return sendError(res, 'Event not found', 404);
  const now = new Date();
  event.status = (now >= event.startDate && now <= event.endDate) ? 'ACTIVE' : 'SCHEDULED';
  await event.save();
  sendSuccess(res, event);
});

// @desc    Deactivate event (ownership enforced)
// @route   PATCH /api/v1/events/:id/deactivate
const deactivateEvent = asyncHandler(async (req, res) => {
  const uid = req.user.uid;

  const event = await PromotionalEvent.findOne({ _id: req.params.id, ownerId: uid });
  if (!event) return sendError(res, 'Event not found', 404);
  event.status = 'INACTIVE';
  await event.save();
  sendSuccess(res, event);
});

// @desc    List currently active events (current user only)
// @route   GET /api/v1/events/active
const getActiveEvents = asyncHandler(async (req, res) => {
  const uid = req.user.uid;
  const now = new Date();

  // FIXED: was PromotionalEvent.find({ status: 'ACTIVE' }) — no ownership filter
  const events = await PromotionalEvent.find({
    ownerId: uid,
    status: 'ACTIVE',
    startDate: { $lte: now },
    endDate: { $gte: now },
  }).sort({ priority: 1 });
  sendSuccess(res, events);
});

// @desc    List scheduled future events (current user only)
// @route   GET /api/v1/events/upcoming
const getUpcomingEvents = asyncHandler(async (req, res) => {
  const uid = req.user.uid;

  // FIXED: was PromotionalEvent.find({ status: 'SCHEDULED' }) — no ownership filter
  const events = await PromotionalEvent.find({ ownerId: uid, status: 'SCHEDULED' }).sort({ startDate: 1 });
  sendSuccess(res, events);
});

// @desc    Event performance analytics (ownership enforced)
// @route   GET /api/v1/events/:id/analytics
const getEventAnalytics = asyncHandler(async (req, res) => {
  const uid = req.user.uid;

  const event = await PromotionalEvent.findOne({ _id: req.params.id, ownerId: uid });
  if (!event) return sendError(res, 'Event not found', 404);

  const analytics = await EventAnalytics.find({ eventId: req.params.id })
    .populate('productId', 'productName sku currentPrice');
  sendSuccess(res, analytics);
});

// @desc    List affected products (ownership enforced)
// @route   GET /api/v1/events/:id/products
const getEventProducts = asyncHandler(async (req, res) => {
  const uid = req.user.uid;

  // FIXED: was findById — no ownership check; also Product queries had no ownerId filter
  const event = await PromotionalEvent.findOne({ _id: req.params.id, ownerId: uid });
  if (!event) return sendError(res, 'Event not found', 404);

  let products;
  if (event.targetType === 'all_products') {
    products = await Product.find({ ownerId: uid, isActive: true });
  } else if (event.targetType === 'specific_products') {
    products = await Product.find({ _id: { $in: event.targetProducts }, ownerId: uid, isActive: true });
  } else if (event.targetType === 'specific_categories') {
    products = await Product.find({ category: { $in: event.targetCategories }, ownerId: uid, isActive: true });
  } else {
    products = [];
  }
  sendSuccess(res, products);
});

module.exports = {
  getEvents, getEvent, createEvent, updateEvent, deleteEvent,
  activateEvent, deactivateEvent, getActiveEvents, getUpcomingEvents,
  getEventAnalytics, getEventProducts,
};

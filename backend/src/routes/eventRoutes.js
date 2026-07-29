const express = require('express');
const router = express.Router();
const {
  getEvents, getEvent, createEvent, updateEvent, deleteEvent,
  activateEvent, deactivateEvent, getActiveEvents, getUpcomingEvents,
  getEventAnalytics, getEventProducts,
} = require('../controllers/eventController');

// Static paths BEFORE param paths
router.route('/active').get(getActiveEvents);
router.route('/upcoming').get(getUpcomingEvents);

router.route('/').get(getEvents).post(createEvent);

router.route('/:id/activate').patch(activateEvent);
router.route('/:id/deactivate').patch(deactivateEvent);
router.route('/:id/analytics').get(getEventAnalytics);
router.route('/:id/products').get(getEventProducts);

router.route('/:id').get(getEvent).patch(updateEvent).delete(deleteEvent);

module.exports = router;

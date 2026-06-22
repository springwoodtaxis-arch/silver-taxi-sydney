'use strict';
const mongoose = require('mongoose');
const CFG = require('./index');

// ─── Mongoose Models ──────────────────────────────────────────────────────────
const bookingSchema = new mongoose.Schema({ _id: String }, { strict: false });
const driverSchema  = new mongoose.Schema({ _id: String }, { strict: false });
const BookingModel  = mongoose.model('Booking', bookingSchema);
const DriverModel   = mongoose.model('Driver',  driverSchema);

// ─── Lazy-loaded models ───────────────────────────────────────────────────────
let IvrCallLogModel = null;
let BlacklistModel  = null;

function getIvrCallLogModel() {
  if (!IvrCallLogModel) {
    const schema = new mongoose.Schema({
      callSid: String, caller: String, passengerName: String,
      phone: String, pickup: String, dropoff: String,
      date: String, time: String, vehicle: String,
      fareEstimate: String, fareAmount: Number,
      distanceKm: Number, durationMin: Number,
      status: String, recordingUrl: String,
      bookingRef: String, notes: String,
      source: String, createdAt: Date
    }, { collection: 'ivr_calls', strict: false });
    IvrCallLogModel = mongoose.model('IvrCallLog', schema);
  }
  return IvrCallLogModel;
}

function getBlacklistModel() {
  if (!BlacklistModel) {
    const schema = new mongoose.Schema({
      phone:     { type: String, required: true, unique: true, index: true },
      type:      { type: String, enum: ['temporary', 'permanent'], default: 'permanent' },
      reason:    String,
      blockedBy: String,
      expiresAt: Date,
      createdAt: { type: Date, default: Date.now },
    }, { collection: 'blacklist', strict: false });
    BlacklistModel = mongoose.model('Blacklist', schema);
  }
  return BlacklistModel;
}

// ─── In-memory cache + persistence layer ─────────────────────────────────────
const DB = {
  bookings: new Map(),
  drivers:  new Map(),
  smsLog:   [],

  async save(b) {
    const key = (b.ref || b.id || '').toUpperCase();
    b.ref = key;
    this.bookings.set(key, b);
    try {
      await BookingModel.findByIdAndUpdate(key, { ...b, _id: key }, { upsert: true, new: true });
    } catch (e) { console.error('[DB] Booking save error:', e.message); }
  },

  async saveDriver(d) {
    this.drivers.set(d.id, d);
    try {
      await DriverModel.findByIdAndUpdate(d.id, { ...d, _id: d.id }, { upsert: true, new: true });
    } catch (e) { console.error('[DB] Driver save error:', e.message); }
  },

  async deleteDriver(id) {
    this.drivers.delete(id);
    try { await DriverModel.findByIdAndDelete(id); } catch (e) { console.error('[DB] Driver delete error:', e.message); }
  },

  get(ref) { return this.bookings.get((ref || '').replace('#', '').toUpperCase()); },

  findByPhone(ref, phone) {
    const b = this.get(ref);
    if (!b) return null;
    const stored = (b.phone || '').replace(/\D/g, '');
    const query  = (phone  || '').replace(/\D/g, '');
    return stored.endsWith(query.slice(-8)) ? b : null;
  },

  all() { return [...this.bookings.values()].sort((a, b) => (b.created > a.created ? 1 : -1)); },

  logSms(entry) {
    this.smsLog.unshift({ ...entry, ts: new Date().toISOString() });
    if (this.smsLog.length > 500) this.smsLog.pop();
  },
};

// ─── Connect & seed in-memory cache ──────────────────────────────────────────
async function connectDB() {
  try {
    await mongoose.connect(CFG.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
    console.log('[DB] Connected to MongoDB Atlas');
    const bookings = await BookingModel.find({}).lean();
    bookings.forEach(b => {
      const key = (b.ref || b._id || '').toUpperCase();
      DB.bookings.set(key, b);
    });
    const drivers = await DriverModel.find({}).lean();
    drivers.forEach(d => DB.drivers.set(d.id || d._id, d));
    console.log(`[DB] Loaded ${DB.bookings.size} bookings, ${DB.drivers.size} drivers`);
  } catch (e) {
    console.error('[DB] MongoDB connection failed:', e.message);
    console.warn('[DB] Running with empty in-memory DB — data will not persist this session');
  }
}

module.exports = { DB, connectDB, getIvrCallLogModel, getBlacklistModel };

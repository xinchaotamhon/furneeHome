const crypto = require('node:crypto');
const env = require('../config/env');
const AnonymousGenerationQuota = require('../models/AnonymousGenerationQuota');

const RESERVATION_MS = 10 * 60 * 1000;

function getClientAddress(req) {
  // Express computes req.ip using its explicit app-level trust-proxy allowlist.
  // With TRUST_PROXY unset, it remains the direct socket peer rather than XFF.
  return String(req.ip || req.socket?.remoteAddress || 'unknown');
}

function hashAddress(address) {
  return crypto.createHmac('sha256', env.anonymousQuotaSalt).update(address).digest('hex');
}

function anonymousQuotaRequiredResponse(res, pending = false) {
  return res.status(401).json({
    success: false,
    code: pending ? 'GUEST_GENERATION_PENDING' : 'GUEST_LIMIT_REACHED',
    message: pending
      ? 'Một lượt tạo ảnh miễn phí đang được xử lý. Vui lòng chờ hoàn tất.'
      : 'Bạn đã dùng lượt tạo ảnh miễn phí. Hãy đăng nhập hoặc đăng ký để tiếp tục.',
    data: { loginRequired: true },
  });
}

function createAnonymousGenerationQuotaService({ quotaModel = AnonymousGenerationQuota, now = () => new Date() } = {}) {
  async function reserveAnonymousGeneration(req, res, next) {
    if (req.user) return next();

    const currentTime = now();
    const reservationId = crypto.randomUUID();
    const reservedUntil = new Date(currentTime.getTime() + RESERVATION_MS);
    const ipHash = hashAddress(getClientAddress(req));
    const eligible = {
      ipHash,
      $or: [
        { state: 'available' },
        { state: 'reserved', reservedUntil: { $lt: currentTime } },
      ],
    };

    let reservation;
    try {
      reservation = await quotaModel.findOneAndUpdate(
        eligible,
        { $set: { state: 'reserved', reservationId, reservedUntil }, $setOnInsert: { ipHash } },
        { new: true, upsert: true, runValidators: true },
      );
    } catch (error) {
      // A simultaneous first request may win the unique-IP insert race. Retrying
      // without upsert verifies that its record is still eligible.
      if (error?.code !== 11000) return next(error);
      reservation = await quotaModel.findOneAndUpdate(
        eligible,
        { $set: { state: 'reserved', reservationId, reservedUntil } },
        { new: true },
      );
    }

    if (!reservation || reservation.reservationId !== reservationId) {
      const current = await quotaModel.findOne({ ipHash }).select('state reservedUntil');
      const pending = current?.state === 'reserved' && current.reservedUntil > currentTime;
      return anonymousQuotaRequiredResponse(res, pending);
    }

    req.anonymousGenerationReservation = { ipHash, reservationId };
    return next();
  }

  async function markAnonymousGenerationSucceeded(req) {
    const reservation = req.anonymousGenerationReservation;
    if (!reservation) return;
    const result = await quotaModel.updateOne(
      { ipHash: reservation.ipHash, state: 'reserved', reservationId: reservation.reservationId },
      { $set: { state: 'used', usedAt: now(), reservationId: '', reservedUntil: null } },
    );
    if (result.modifiedCount !== 1) throw new Error('Không thể xác nhận lượt tạo ảnh miễn phí.');
  }

  async function releaseAnonymousGeneration(req) {
    const reservation = req.anonymousGenerationReservation;
    if (!reservation) return;
    await quotaModel.updateOne(
      { ipHash: reservation.ipHash, state: 'reserved', reservationId: reservation.reservationId },
      { $set: { state: 'available', reservationId: '', reservedUntil: null } },
    );
  }

  return { reserveAnonymousGeneration, markAnonymousGenerationSucceeded, releaseAnonymousGeneration };
}

const defaultService = createAnonymousGenerationQuotaService();

module.exports = {
  ...defaultService,
  createAnonymousGenerationQuotaService,
  getClientAddress,
  hashAddress,
};

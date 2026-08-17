const RoomDesign = require('../models/RoomDesign');

async function listMine(req, res, next) {
  try { res.json({ success: true, message: 'Designs loaded', data: await RoomDesign.find({ user: req.user._id }) }); }
  catch (error) { next(error); }
}

async function save(req, res, next) {
  try { res.status(201).json({ success: true, message: 'Design saved', data: await RoomDesign.create({ ...req.body, user: req.user._id }) }); }
  catch (error) { next(error); }
}

module.exports = { listMine, save };

function isPositiveNumber(value) {
  return Number.isFinite(Number(value)) && Number(value) > 0;
}

module.exports = { isPositiveNumber };

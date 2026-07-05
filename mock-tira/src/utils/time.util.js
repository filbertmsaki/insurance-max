function nowIso() {
  return new Date().toISOString();
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getDelayMs(req, headerName, queryName, defaultValue) {
  const headerValue = req.header(headerName);
  const queryValue = req.query?.[queryName];

  const value = Number(headerValue || queryValue || defaultValue || 0);

  return Number.isFinite(value) && value >= 0 ? value : Number(defaultValue || 0);
}

module.exports = {
  nowIso,
  sleep,
  getDelayMs,
};

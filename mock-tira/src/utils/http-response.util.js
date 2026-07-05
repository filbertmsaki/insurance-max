function sendXml(res, xml, statusCode = 200, delayMs = 0) {
  res.set('Content-Type', 'application/xml');

  if (!delayMs || delayMs <= 0) {
    return res.status(statusCode).send(xml);
  }

  return setTimeout(() => {
    if (!res.headersSent) {
      res.status(statusCode).send(xml);
    }
  }, delayMs);
}

module.exports = {
  sendXml,
};

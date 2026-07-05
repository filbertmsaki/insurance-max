const {
  SEEDED_SERVICE_ENDPOINTS,
  LEGACY_MOCK_ENDPOINT,
} = require('../constants/tiramis-endpoints.constant');

function registerTiramisRoutes(app, handleTiramisRequest) {
  const registered = new Set();

  for (const endpointDefinition of SEEDED_SERVICE_ENDPOINTS) {
    if (registered.has(endpointDefinition.endpointUrl)) {
      console.warn(
        `[routes] Skipping duplicate endpoint: ${endpointDefinition.endpointUrl}`,
      );
      continue;
    }

    registered.add(endpointDefinition.endpointUrl);

    app.post(endpointDefinition.endpointUrl, (req, res) =>
      handleTiramisRequest(req, res, endpointDefinition),
    );

    console.log(
      `[routes] POST ${endpointDefinition.endpointUrl} -> ${endpointDefinition.serviceType}${
        endpointDefinition.isAlias
          ? ` alias of ${endpointDefinition.aliasOf}`
          : ''
      }`,
    );
  }

  app.post(LEGACY_MOCK_ENDPOINT.endpointUrl, (req, res) =>
    handleTiramisRequest(req, res, LEGACY_MOCK_ENDPOINT),
  );

  console.log(`[routes] POST ${LEGACY_MOCK_ENDPOINT.endpointUrl} -> LEGACY_MOCK`);
}

module.exports = {
  registerTiramisRoutes,
};

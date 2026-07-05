const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const forge = require('node-forge');

const { CONFIG } = require('../config/mock-config');
const { RESPONSE_CODES } = require('../constants/response-codes.constant');
const { extractContentXml, getTag, escapeXml } = require('../utils/xml.util');
const { buildTiraMessage } = require('./response-builder.service');

const CERT_CACHE = {
  tiraPrivateKeyPem: null,
  tiraCertificatePem: null,
  clientCertificatePem: null,
  clientPrivateKeyPem: null,
  loadedAt: null,
};

function resolveFilePath(filePath) {
  if (!filePath) {
    return null;
  }

  if (path.isAbsolute(filePath)) {
    return filePath;
  }

  return path.resolve(process.cwd(), filePath);
}

function fileExists(filePath) {
  if (!filePath) {
    return false;
  }

  try {
    return fs.existsSync(resolveFilePath(filePath));
  } catch {
    return false;
  }
}

function readFile(filePath, encoding = 'utf8') {
  const resolved = resolveFilePath(filePath);

  if (!resolved || !fs.existsSync(resolved)) {
    throw new Error(`Certificate file not found: ${filePath}`);
  }

  return fs.readFileSync(resolved, encoding);
}

function extractPkcs12(pfxPath, password = '') {
  const resolved = resolveFilePath(pfxPath);

  if (!resolved || !fs.existsSync(resolved)) {
    throw new Error(`PFX file not found: ${pfxPath}`);
  }

  const pfxBuffer = fs.readFileSync(resolved);
  const binary = pfxBuffer.toString('binary');

  const p12Asn1 = forge.asn1.fromDer(binary);
  const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, false, password || '');

  const keyBags =
    p12.getBags({
      bagType: forge.pki.oids.pkcs8ShroudedKeyBag,
    })[forge.pki.oids.pkcs8ShroudedKeyBag] ||
    p12.getBags({
      bagType: forge.pki.oids.keyBag,
    })[forge.pki.oids.keyBag] ||
    [];

  const certBags =
    p12.getBags({
      bagType: forge.pki.oids.certBag,
    })[forge.pki.oids.certBag] || [];

  const keyBag = keyBags[0];
  const certBag = certBags[0];

  return {
    privateKeyPem: keyBag?.key ? forge.pki.privateKeyToPem(keyBag.key) : null,
    certificatePem: certBag?.cert
      ? forge.pki.certificateToPem(certBag.cert)
      : null,
  };
}

function loadCertificates() {
  if (CERT_CACHE.loadedAt) {
    return CERT_CACHE;
  }

  let tiraPrivateKeyPem = null;
  let tiraCertificatePem = null;
  let clientCertificatePem = null;
  let clientPrivateKeyPem = null;

  if (fileExists(CONFIG.tiraPfxPath)) {
    const extracted = extractPkcs12(CONFIG.tiraPfxPath, CONFIG.tiraPfxPassword);

    tiraPrivateKeyPem = extracted.privateKeyPem;
    tiraCertificatePem = extracted.certificatePem;
  }

  if (!tiraPrivateKeyPem && fileExists(CONFIG.tiraPrivateKeyPath)) {
    tiraPrivateKeyPem = readFile(CONFIG.tiraPrivateKeyPath);
  }

  if (!tiraCertificatePem && fileExists(CONFIG.tiraCertificatePath)) {
    tiraCertificatePem = readFile(CONFIG.tiraCertificatePath);
  }

  if (fileExists(CONFIG.clientPfxPath)) {
    const extracted = extractPkcs12(CONFIG.clientPfxPath, CONFIG.clientPfxPassword);

    clientCertificatePem = extracted.certificatePem;
    clientPrivateKeyPem = extracted.privateKeyPem;
  }

  if (!clientCertificatePem && fileExists(CONFIG.clientCertificatePath)) {
    clientCertificatePem = readFile(CONFIG.clientCertificatePath);
  }

  if (!clientPrivateKeyPem && fileExists(CONFIG.clientPrivateKeyPath)) {
    clientPrivateKeyPem = readFile(CONFIG.clientPrivateKeyPath);
  }

  CERT_CACHE.tiraPrivateKeyPem = tiraPrivateKeyPem;
  CERT_CACHE.tiraCertificatePem = tiraCertificatePem;
  CERT_CACHE.clientCertificatePem = clientCertificatePem;
  CERT_CACHE.clientPrivateKeyPem = clientPrivateKeyPem;
  CERT_CACHE.loadedAt = new Date().toISOString();

  return CERT_CACHE;
}

function clearCertificateCache() {
  CERT_CACHE.tiraPrivateKeyPem = null;
  CERT_CACHE.tiraCertificatePem = null;
  CERT_CACHE.clientCertificatePem = null;
  CERT_CACHE.clientPrivateKeyPem = null;
  CERT_CACHE.loadedAt = null;

  return {
    success: true,
    message: 'Certificate cache cleared',
  };
}

function prepareXmlForSignature(xml) {
  const value = String(xml || '');

  if (CONFIG.signatureXmlMode === 'trim') {
    return value.trim();
  }

  if (CONFIG.signatureXmlMode === 'compact') {
    return value.replace(/>\s+</g, '><').trim();
  }

  return value;
}

function signWithPrivateKey(contentXml, privateKeyPem) {
  if (!privateKeyPem) {
    throw new Error('Private key is not configured');
  }

  const signingXml = prepareXmlForSignature(contentXml);

  const signer = crypto.createSign('RSA-SHA1');
  signer.update(signingXml, 'utf8');
  signer.end();

  return signer.sign(privateKeyPem, 'base64');
}

function verifyWithCertificate(contentXml, signatureBase64, certificatePem) {
  if (!certificatePem) {
    throw new Error('Public certificate is not configured');
  }

  if (!signatureBase64) {
    return false;
  }

  const signingXml = prepareXmlForSignature(contentXml);

  const verifier = crypto.createVerify('RSA-SHA1');
  verifier.update(signingXml, 'utf8');
  verifier.end();

  return verifier.verify(certificatePem, signatureBase64, 'base64');
}

function signResponseContent(contentXml) {
  const certs = loadCertificates();

  if (!certs.tiraPrivateKeyPem) {
    if (CONFIG.allowUnsignedRequests) {
      return '';
    }

    throw new Error('Mock TIRA private key is not configured');
  }

  return signWithPrivateKey(contentXml, certs.tiraPrivateKeyPem);
}

function wrapTiraMessage(contentXml) {
  return buildTiraMessage(contentXml, signResponseContent);
}

function signClientContent(contentXml) {
  const certs = loadCertificates();

  if (!certs.clientPrivateKeyPem) {
    throw new Error(
      'Client private key is not configured. Set MOCK_CLIENT_PRIVATE_KEY_PATH or MOCK_CLIENT_PFX_PATH.',
    );
  }

  return signWithPrivateKey(contentXml, certs.clientPrivateKeyPem);
}

function wrapClientTiraMessage(contentXml) {
  const signature = signClientContent(contentXml);

  return [
    '<TiraMsg>',
    `<Content>${escapeXml(contentXml)}</Content>`,
    `<MsgSignature>${escapeXml(signature)}</MsgSignature>`,
    '</TiraMsg>',
  ].join('');
}

function extractSignedRequest(xml) {
  const fullXml = String(xml || '');
  const contentXml = extractContentXml(fullXml);
  const signature = getTag(fullXml, 'MsgSignature');

  return {
    fullXml,
    contentXml,
    signature,
    hasWrapper: fullXml.includes('<TiraMsg'),
    hasContent: fullXml.includes('<Content>'),
    hasSignature: !!signature,
  };
}

function buildSignatureDebug(signed) {
  const content = String(signed?.contentXml || '');

  return {
    signatureXmlMode: CONFIG.signatureXmlMode,
    hasWrapper: !!signed?.hasWrapper,
    hasContent: !!signed?.hasContent,
    hasSignature: !!signed?.hasSignature,
    contentLength: content.length,
    contentSha256: crypto
      .createHash('sha256')
      .update(prepareXmlForSignature(content), 'utf8')
      .digest('hex'),
  };
}

function verifyClientRequestSignature(xml) {
  if (!CONFIG.requireSignature || CONFIG.allowUnsignedRequests) {
    return {
      ok: true,
      code: 'TIRA001',
      desc: 'Signature validation skipped by mock config',
      skipped: true,
    };
  }

  try {
    const certs = loadCertificates();
    const signed = extractSignedRequest(xml);

    if (!signed.hasWrapper || !signed.hasContent || !signed.hasSignature) {
      return {
        ok: false,
        code: 'TIRA016',
        desc: 'TiraMsg wrapper, Content, or MsgSignature is missing',
        debug: buildSignatureDebug(signed),
      };
    }

    if (!certs.clientCertificatePem) {
      return {
        ok: false,
        code: 'TIRA015',
        desc: 'Client public certificate is not configured in mock server',
        debug: buildSignatureDebug(signed),
      };
    }

    const verified = verifyWithCertificate(
      signed.contentXml,
      signed.signature,
      certs.clientCertificatePem,
    );

    if (!verified) {
      return {
        ok: false,
        code: 'TIRA016',
        desc: RESPONSE_CODES.TIRA016,
        debug: buildSignatureDebug(signed),
      };
    }

    return {
      ok: true,
      code: 'TIRA001',
      desc: RESPONSE_CODES.TIRA001,
      debug: CONFIG.debugSignature ? buildSignatureDebug(signed) : undefined,
    };
  } catch (error) {
    return {
      ok: false,
      code: 'TIRA016',
      desc: error.message || RESPONSE_CODES.TIRA016,
    };
  }
}

function verifyTiraResponseSignature(xml) {
  try {
    const certs = loadCertificates();
    const signed = extractSignedRequest(xml);

    if (!certs.tiraCertificatePem) {
      return {
        ok: false,
        code: 'TIRA015',
        desc: 'Mock TIRA public certificate is not configured',
      };
    }

    const verified = verifyWithCertificate(
      signed.contentXml,
      signed.signature,
      certs.tiraCertificatePem,
    );

    return {
      ok: verified,
      code: verified ? 'TIRA001' : 'TIRA016',
      desc: verified ? RESPONSE_CODES.TIRA001 : RESPONSE_CODES.TIRA016,
      debug: CONFIG.debugSignature ? buildSignatureDebug(signed) : undefined,
    };
  } catch (error) {
    return {
      ok: false,
      code: 'TIRA016',
      desc: error.message || RESPONSE_CODES.TIRA016,
    };
  }
}

function validateHeaders(req) {
  const contentType = String(req.header('Content-Type') || '').toLowerCase();
  const clientCode = req.header('ClientCode');
  const clientKey = req.header('ClientKey');

  if (!contentType.includes('xml')) {
    return {
      ok: false,
      code: 'TIRA005',
      desc: 'Content-Type must be application/xml',
    };
  }

  if (!clientCode || !clientKey) {
    return {
      ok: false,
      code: 'TIRA008',
      desc: RESPONSE_CODES.TIRA008,
    };
  }

  if (clientCode !== CONFIG.clientCode) {
    return {
      ok: false,
      code: 'TIRA004',
      desc: RESPONSE_CODES.TIRA004,
    };
  }

  if (clientKey !== CONFIG.clientKey) {
    return {
      ok: false,
      code: 'TIRA003',
      desc: RESPONSE_CODES.TIRA003,
    };
  }

  return {
    ok: true,
    code: 'TIRA001',
    desc: RESPONSE_CODES.TIRA001,
  };
}

function getCertificateHealth() {
  let certs = null;
  let error = null;

  try {
    certs = loadCertificates();
  } catch (err) {
    error = err.message || String(err);
  }

  return {
    success: !error,
    error,
    config: {
      signatureXmlMode: CONFIG.signatureXmlMode,
      requireSignature: CONFIG.requireSignature,
      allowUnsignedRequests: CONFIG.allowUnsignedRequests,
      debugSignature: CONFIG.debugSignature,
    },
    files: {
      tiraPfxPath: {
        configured: !!CONFIG.tiraPfxPath,
        exists: fileExists(CONFIG.tiraPfxPath),
      },
      tiraPrivateKeyPath: {
        configured: !!CONFIG.tiraPrivateKeyPath,
        exists: fileExists(CONFIG.tiraPrivateKeyPath),
      },
      tiraCertificatePath: {
        configured: !!CONFIG.tiraCertificatePath,
        exists: fileExists(CONFIG.tiraCertificatePath),
      },
      clientCertificatePath: {
        configured: !!CONFIG.clientCertificatePath,
        exists: fileExists(CONFIG.clientCertificatePath),
      },
      clientPfxPath: {
        configured: !!CONFIG.clientPfxPath,
        exists: fileExists(CONFIG.clientPfxPath),
      },
      clientPrivateKeyPath: {
        configured: !!CONFIG.clientPrivateKeyPath,
        exists: fileExists(CONFIG.clientPrivateKeyPath),
      },
    },
    loaded: {
      loadedAt: certs?.loadedAt || null,
      tiraPrivateKeyLoaded: !!certs?.tiraPrivateKeyPem,
      tiraCertificateLoaded: !!certs?.tiraCertificatePem,
      clientCertificateLoaded: !!certs?.clientCertificatePem,
      clientPrivateKeyLoaded: !!certs?.clientPrivateKeyPem,
    },
  };
}

module.exports = {
  loadCertificates,
  clearCertificateCache,
  getCertificateHealth,
  validateHeaders,
  verifyClientRequestSignature,
  verifyTiraResponseSignature,
  signResponseContent,
  wrapTiraMessage,
  signClientContent,
  wrapClientTiraMessage,
  extractSignedRequest,
  prepareXmlForSignature,
};

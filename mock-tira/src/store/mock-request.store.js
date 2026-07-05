const fs = require('fs');
const path = require('path');

const { CONFIG } = require('../config/mock-config');
const { nowIso } = require('../utils/time.util');

const MOCK_REQUESTS = new Map();
const REQUEST_INDEX = new Map();

let saveTimer = null;
let initialized = false;

function resolveStoragePath(filePath) {
  if (path.isAbsolute(filePath)) {
    return filePath;
  }

  return path.resolve(process.cwd(), filePath);
}

function ensureDirForFile(filePath) {
  const resolved = resolveStoragePath(filePath);
  fs.mkdirSync(path.dirname(resolved), {
    recursive: true,
  });

  return resolved;
}

function createMockTrackingId() {
  return `MOCK-${Date.now()}-${Math.floor(Math.random() * 999999)}`;
}

function normalizeRecord(record = {}) {
  const {
    id,
    requestId,
    root,
    serviceType,
    endpoint,
    mode,
    scenario,
    callbackUrl,
    companyCode,
    insurerCompanyCode,
    businessReference,
    duplicateKey,
    duplicateOfRequestId,
    duplicateOfTrackingId,
    duplicateReason,
    duplicateCheck,
    status,
    ackCode,
    finalCode,
    headers,
    headerValidation,
    signatureValidation,
    validations,
    callbackAttempts,
    rawRequestXml,
    contentXml,
    ackXml,
    finalXml,
    createdAt,
    updatedAt,
    ...rest
  } = record || {};

  return {
    ...rest,
    id: id || createMockTrackingId(),
    requestId: requestId || null,
    root: root || null,
    serviceType: serviceType || null,
    endpoint: endpoint || null,
    mode: mode || null,
    scenario: scenario || CONFIG.defaultScenario,
    callbackUrl: callbackUrl || null,

    companyCode: companyCode || null,
    insurerCompanyCode: insurerCompanyCode || null,
    businessReference: businessReference || null,

    duplicateKey: duplicateKey || null,
    duplicateOfRequestId: duplicateOfRequestId || null,
    duplicateOfTrackingId: duplicateOfTrackingId || null,
    duplicateReason: duplicateReason || null,
    duplicateCheck: duplicateCheck || null,

    status: status || 'RECEIVED',
    ackCode: ackCode || null,
    finalCode: finalCode || null,

    headers: headers || {},
    headerValidation: headerValidation || null,
    signatureValidation: signatureValidation || null,
    validations: Array.isArray(validations) ? validations : [],

    callbackAttempts: Array.isArray(callbackAttempts)
      ? callbackAttempts
      : [],

    rawRequestXml: rawRequestXml || null,
    contentXml: contentXml || null,
    ackXml: ackXml || null,
    finalXml: finalXml || null,

    createdAt: createdAt || nowIso(),
    updatedAt: updatedAt || createdAt || nowIso(),
  };
}

function registerRequestIndex(record) {
  if (!record?.requestId) {
    return;
  }

  const ids = REQUEST_INDEX.get(record.requestId) || [];
  const nextIds = [record.id, ...ids.filter((id) => id !== record.id)];

  REQUEST_INDEX.set(record.requestId, nextIds);
}

function unregisterRequestIndex(record) {
  if (!record?.requestId) {
    return;
  }

  const ids = REQUEST_INDEX.get(record.requestId) || [];
  const nextIds = ids.filter((id) => id !== record.id);

  if (nextIds.length === 0) {
    REQUEST_INDEX.delete(record.requestId);
    return;
  }

  REQUEST_INDEX.set(record.requestId, nextIds);
}

function getLatestTrackingIdForRequestId(requestId) {
  const ids = REQUEST_INDEX.get(requestId) || [];
  return ids[0] || null;
}

function resolveTrackingId(recordOrRequestId) {
  if (!recordOrRequestId) {
    return null;
  }

  if (typeof recordOrRequestId !== 'string') {
    return recordOrRequestId.id || recordOrRequestId.requestId || null;
  }

  if (MOCK_REQUESTS.has(recordOrRequestId)) {
    return recordOrRequestId;
  }

  return getLatestTrackingIdForRequestId(recordOrRequestId);
}

function storeTrackingRecord(record) {
  const normalized = normalizeRecord(record);

  MOCK_REQUESTS.set(normalized.id, normalized);
  registerRequestIndex(normalized);

  return normalized;
}

function limitTrackingStore(shouldPersist = true) {
  const max = Number(CONFIG.trackingLimit || 1000);

  if (MOCK_REQUESTS.size <= max) {
    return;
  }

  const records = listTrackingRecords();
  const toRemove = records.slice(max);

  for (const record of toRemove) {
    unregisterRequestIndex(record);
    MOCK_REQUESTS.delete(record.id);
  }

  if (shouldPersist) {
    schedulePersistTrackingStore();
  }
}

function initializeTrackingStore() {
  if (initialized) {
    return {
      success: true,
      alreadyInitialized: true,
      persistenceEnabled: CONFIG.trackingPersistEnabled,
      total: MOCK_REQUESTS.size,
    };
  }

  initialized = true;

  if (!CONFIG.trackingPersistEnabled) {
    return {
      success: true,
      persistenceEnabled: false,
      total: MOCK_REQUESTS.size,
    };
  }

  const storagePath = resolveStoragePath(CONFIG.trackingStoragePath);

  if (!fs.existsSync(storagePath)) {
    ensureDirForFile(storagePath);

    return {
      success: true,
      persistenceEnabled: true,
      storagePath,
      loaded: 0,
      total: MOCK_REQUESTS.size,
    };
  }

  try {
    const raw = fs.readFileSync(storagePath, 'utf8');
    const parsed = raw ? JSON.parse(raw) : {};
    const records = Array.isArray(parsed.records) ? parsed.records : [];

    MOCK_REQUESTS.clear();
    REQUEST_INDEX.clear();

    for (const record of records) {
      if (!record?.requestId) {
        continue;
      }

      storeTrackingRecord(record);
    }

    limitTrackingStore(false);

    return {
      success: true,
      persistenceEnabled: true,
      storagePath,
      loaded: MOCK_REQUESTS.size,
      total: MOCK_REQUESTS.size,
    };
  } catch (error) {
    return {
      success: false,
      persistenceEnabled: true,
      storagePath,
      error: error.message || String(error),
      total: MOCK_REQUESTS.size,
    };
  }
}

function getStorageState() {
  const storagePath = resolveStoragePath(CONFIG.trackingStoragePath);

  return {
    persistenceEnabled: CONFIG.trackingPersistEnabled,
    storagePath,
    storageExists: fs.existsSync(storagePath),
    persistXml: CONFIG.trackingPersistXml,
    saveDebounceMs: CONFIG.trackingSaveDebounceMs,
    backupEnabled: CONFIG.trackingBackupEnabled,
    backupDir: resolveStoragePath(CONFIG.trackingBackupDir),
    initialized,
    total: MOCK_REQUESTS.size,
  };
}

function serializeRecordForStorage(record) {
  if (CONFIG.trackingPersistXml) {
    return record;
  }

  const {
    rawRequestXml,
    contentXml,
    ackXml,
    finalXml,
    ...withoutXml
  } = record;

  return {
    ...withoutXml,
    hasRawRequestXml: !!rawRequestXml,
    hasContentXml: !!contentXml,
    hasAckXml: !!ackXml,
    hasFinalXml: !!finalXml,
  };
}

function persistTrackingStoreNow() {
  if (!CONFIG.trackingPersistEnabled) {
    return {
      success: true,
      skipped: true,
      reason: 'MOCK_TRACKING_PERSIST_ENABLED=false',
    };
  }

  const storagePath = ensureDirForFile(CONFIG.trackingStoragePath);
  const payload = {
    version: 1,
    savedAt: nowIso(),
    total: MOCK_REQUESTS.size,
    persistXml: CONFIG.trackingPersistXml,
    records: listTrackingRecords().map((record) =>
      serializeRecordForStorage(record),
    ),
  };

  const tempPath = `${storagePath}.tmp`;

  fs.writeFileSync(tempPath, JSON.stringify(payload, null, 2), 'utf8');
  fs.renameSync(tempPath, storagePath);

  return {
    success: true,
    storagePath,
    total: payload.total,
    savedAt: payload.savedAt,
  };
}

function schedulePersistTrackingStore() {
  if (!CONFIG.trackingPersistEnabled) {
    return;
  }

  if (saveTimer) {
    clearTimeout(saveTimer);
  }

  saveTimer = setTimeout(() => {
    saveTimer = null;

    try {
      persistTrackingStoreNow();
    } catch (error) {
      console.warn(
        `[tracking-store] Failed to persist tracking records: ${
          error.message || error
        }`,
      );
    }
  }, Number(CONFIG.trackingSaveDebounceMs || 500));

  if (typeof saveTimer.unref === 'function') {
    saveTimer.unref();
  }
}

function backupTrackingStore(reason = 'manual') {
  if (!CONFIG.trackingBackupEnabled) {
    return {
      success: true,
      skipped: true,
      reason: 'MOCK_TRACKING_BACKUP_ENABLED=false',
    };
  }

  const backupDir = resolveStoragePath(CONFIG.trackingBackupDir);
  fs.mkdirSync(backupDir, {
    recursive: true,
  });

  const filename = `mock-requests-${new Date()
    .toISOString()
    .replace(/[:.]/g, '-')}-${reason}.json`;
  const backupPath = path.join(backupDir, filename);

  const payload = {
    version: 1,
    backedUpAt: nowIso(),
    reason,
    total: MOCK_REQUESTS.size,
    records: listTrackingRecords().map((record) =>
      serializeRecordForStorage(record),
    ),
  };

  fs.writeFileSync(backupPath, JSON.stringify(payload, null, 2), 'utf8');

  return {
    success: true,
    backupPath,
    total: payload.total,
  };
}

function importTrackingRecords(params = {}) {
  const records = Array.isArray(params.records)
    ? params.records
    : Array.isArray(params)
      ? params
      : [];

  const mode = params.mode || 'merge';

  if (!['merge', 'replace'].includes(mode)) {
    throw new Error('Import mode must be merge or replace');
  }

  if (mode === 'replace') {
    backupTrackingStore('before-import-replace');
    MOCK_REQUESTS.clear();
    REQUEST_INDEX.clear();
  }

  let imported = 0;
  let skipped = 0;

  for (const record of records) {
    const requestId = record?.requestId || record?.id || null;

    if (!requestId) {
      skipped += 1;
      continue;
    }

    storeTrackingRecord({
      ...record,
      requestId,
      id: record.id || createMockTrackingId(),
      updatedAt: record.updatedAt || nowIso(),
    });

    imported += 1;
  }

  limitTrackingStore(false);
  schedulePersistTrackingStore();

  return {
    success: true,
    mode,
    imported,
    skipped,
    total: MOCK_REQUESTS.size,
  };
}

function exportTrackingRecords(params = {}) {
  const includeXml = params.includeXml !== false;
  const records = listTrackingRecords();

  return {
    version: 1,
    exportedAt: nowIso(),
    total: records.length,
    includeXml,
    records: includeXml
      ? records
      : records.map((record) => {
          const {
            rawRequestXml,
            contentXml,
            ackXml,
            finalXml,
            ...withoutXml
          } = record;

          return withoutXml;
        }),
  };
}

function createTrackingRecord(params) {
  const record = storeTrackingRecord({
    id: createMockTrackingId(),
    requestId: params.requestId,
    root: params.root || null,
    serviceType: params.serviceType || null,
    endpoint: params.endpoint || null,
    mode: params.mode || null,
    scenario: params.scenario || CONFIG.defaultScenario,
    callbackUrl: params.callbackUrl || null,

    companyCode: params.companyCode || null,
    insurerCompanyCode: params.insurerCompanyCode || null,
    businessReference: params.businessReference || null,

    duplicateKey: params.duplicateKey || null,
    duplicateOfRequestId: null,
    duplicateOfTrackingId: null,
    duplicateReason: null,
    duplicateCheck: null,

    status: 'RECEIVED',
    ackCode: null,
    finalCode: null,

    headers: params.headers || {},
    headerValidation: null,
    signatureValidation: null,
    validations: [],

    callbackAttempts: [],

    rawRequestXml: params.rawRequestXml || null,
    contentXml: params.contentXml || null,
    ackXml: null,
    finalXml: null,

    createdAt: nowIso(),
    updatedAt: nowIso(),
  });

  limitTrackingStore();
  schedulePersistTrackingStore();

  return record;
}

function resolveRecord(recordOrRequestId) {
  const trackingId = resolveTrackingId(recordOrRequestId);

  if (!trackingId) {
    return null;
  }

  return MOCK_REQUESTS.get(trackingId) || null;
}

function updateTracking(recordOrRequestId, updates) {
  const record = resolveRecord(recordOrRequestId);

  if (!record) {
    return null;
  }

  const previousRequestId = record.requestId;

  Object.assign(record, updates, {
    updatedAt: nowIso(),
  });

  if (updates?.requestId && updates.requestId !== previousRequestId) {
    unregisterRequestIndex({
      requestId: previousRequestId,
      id: record.id,
    });

    record.requestId = updates.requestId;
    registerRequestIndex(record);
  }

  MOCK_REQUESTS.set(record.id, record);
  schedulePersistTrackingStore();

  return record;
}

function addCallbackAttempt(requestIdOrTrackingId, attempt) {
  const record = resolveRecord(requestIdOrTrackingId);

  if (!record) {
    return null;
  }

  record.callbackAttempts.push({
    ...attempt,
    attemptedAt: nowIso(),
  });

  record.updatedAt = nowIso();
  MOCK_REQUESTS.set(record.id, record);
  schedulePersistTrackingStore();

  return record;
}

function getTrackingRecord(requestIdOrTrackingId) {
  const record = resolveRecord(requestIdOrTrackingId);

  if (record) {
    return record;
  }

  return (
    Array.from(MOCK_REQUESTS.values()).find(
      (item) =>
        item.id === requestIdOrTrackingId ||
        item.requestId === requestIdOrTrackingId,
    ) || null
  );
}

function listTrackingRecords() {
  return Array.from(MOCK_REQUESTS.values()).sort((a, b) => {
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

function getPublicTrackingRecord(record) {
  if (!record) {
    return null;
  }

  const { rawRequestXml, contentXml, ackXml, finalXml, ...publicRecord } =
    record;

  return {
    ...publicRecord,
    hasRawRequestXml: !!rawRequestXml,
    hasContentXml: !!contentXml,
    hasAckXml: !!ackXml,
    hasFinalXml: !!finalXml,
  };
}

function getMockStatistics() {
  const records = listTrackingRecords();

  const byStatus = {};
  const byRoot = {};
  const byScenario = {};
  const byServiceType = {};
  const duplicates = records.filter(
    (item) => item.status === 'DUPLICATE_REQUEST',
  ).length;

  for (const record of records) {
    byStatus[record.status || 'UNKNOWN'] =
      (byStatus[record.status || 'UNKNOWN'] || 0) + 1;

    byRoot[record.root || 'UNKNOWN'] =
      (byRoot[record.root || 'UNKNOWN'] || 0) + 1;

    byScenario[record.scenario || 'success'] =
      (byScenario[record.scenario || 'success'] || 0) + 1;

    byServiceType[record.serviceType || 'UNKNOWN'] =
      (byServiceType[record.serviceType || 'UNKNOWN'] || 0) + 1;
  }

  return {
    total: records.length,
    duplicates,
    byStatus,
    byRoot,
    byScenario,
    byServiceType,
    callbackAttempts: records.reduce(
      (sum, item) => sum + (item.callbackAttempts?.length || 0),
      0,
    ),
    storage: getStorageState(),
  };
}

function clearTrackingRecords(options = {}) {
  const count = MOCK_REQUESTS.size;

  if (options.backup !== false) {
    backupTrackingStore('before-clear');
  }

  MOCK_REQUESTS.clear();
  REQUEST_INDEX.clear();
  schedulePersistTrackingStore();

  return count;
}

function flushTrackingStoreBeforeExit() {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }

  try {
    return persistTrackingStoreNow();
  } catch (error) {
    console.warn(
      `[tracking-store] Failed to flush tracking store before exit: ${
        error.message || error
      }`,
    );

    return {
      success: false,
      error: error.message || String(error),
    };
  }
}

module.exports = {
  MOCK_REQUESTS,
  initializeTrackingStore,
  getStorageState,
  persistTrackingStoreNow,
  schedulePersistTrackingStore,
  backupTrackingStore,
  importTrackingRecords,
  exportTrackingRecords,
  flushTrackingStoreBeforeExit,
  createTrackingId: createMockTrackingId,
  createTrackingRecord,
  updateTracking,
  addCallbackAttempt,
  getTrackingRecord,
  listTrackingRecords,
  getPublicTrackingRecord,
  getMockStatistics,
  clearTrackingRecords,
};

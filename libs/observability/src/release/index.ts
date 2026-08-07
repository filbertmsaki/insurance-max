export interface ProductionReleaseGate {
  build: {
    lintPassed: boolean;
    unitTestsPassed: boolean;
    integrationTestsPassed: boolean;
    e2eTestsPassed: boolean;
  };
  security: {
    criticalFindings: number;
    tenantIsolationPassed: boolean;
    secretsScanPassed: boolean;
    authorizationPassed: boolean;
  };
  financial: {
    reconciliationPassed: boolean;
  };
  regulatory: {
    tiramisPassed: boolean;
    returnsPassed: boolean;
  };
  operations: {
    backupVerified: boolean;
    restoreVerified: boolean;
    monitoringReady: boolean;
    rollbackVerified: boolean;
  };
  approvals: {
    uatApproved: boolean;
    technicalApproved: boolean;
    businessApproved: boolean;
  };
}

export function isProductionReady(gate: ProductionReleaseGate): boolean {
  return (
    gate.build.lintPassed &&
    gate.build.unitTestsPassed &&
    gate.build.integrationTestsPassed &&
    gate.build.e2eTestsPassed &&
    gate.security.criticalFindings === 0 &&
    gate.security.tenantIsolationPassed &&
    gate.security.secretsScanPassed &&
    gate.security.authorizationPassed &&
    gate.financial.reconciliationPassed &&
    gate.regulatory.tiramisPassed &&
    gate.regulatory.returnsPassed &&
    gate.operations.backupVerified &&
    gate.operations.restoreVerified &&
    gate.operations.monitoringReady &&
    gate.operations.rollbackVerified &&
    gate.approvals.uatApproved &&
    gate.approvals.technicalApproved &&
    gate.approvals.businessApproved
  );
}

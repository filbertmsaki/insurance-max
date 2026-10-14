export interface ServiceInsuredDataContext {
  customerId: string;
  customerNumber: string;
  customerSnapshotHash: string;
  tiramisPolicyHolderHash?: string;
  assetManifestHash: string;
  assetCount: number;
  manifestVersion: string;
}

export interface ServiceInsuredDataContext {
  customerId: string;
  customerNumber: string;
  customerKycStatus: string;
  customerKycVersion: number;
  customerSnapshotHash: string;
  tiramisPolicyHolderHash?: string;
  assetManifestHash: string;
  assetCount: number;
  manifestVersion: string;
}

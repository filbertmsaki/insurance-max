import { create } from 'zustand';

export type ConnectivityStatus = 'online' | 'offline';

interface ConnectivityState {
  status: ConnectivityStatus;
  lastCheckedAt: number | null;
  setStatus: (status: ConnectivityStatus) => void;
  setLastCheckedAt: (timestamp: number) => void;
}

export const useConnectivityStore = create<ConnectivityState>((set) => ({
  status: 'online',
  lastCheckedAt: null,
  setStatus: (status) => set({ status }),
  setLastCheckedAt: (lastCheckedAt) => set({ lastCheckedAt }),
}));

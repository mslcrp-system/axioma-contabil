import { create } from 'zustand';

// Types representing Supabase Tables locally
export type SyncStatus = 'idle' | 'parsing' | 'uploading' | 'success' | 'error';

export interface RawAccount {
  account_code: string;
  account_name: string;
  balance: number;
  nature: 'Devedor' | 'Credor';
}

interface MappingUIState {
  // Application Transient States
  currentCnpj: string | null;
  clientId: string | null; // Core UI foreign key
  referenceDate: string | null;
  availableCompetences: { id: string; reference_date: string }[]; // List for the month selector
  syncStatus: SyncStatus;
  errorMessage: string | null;
  
  // Mapped vs Unmapped tracking during session
  orphanAccounts: RawAccount[];
  
  // UI Selection State
  selectedOrphanCodes: string[];
  bucketCounts: Record<string, number>; // Hydration for mapping UI
  allRawBalances: RawAccount[]; // Full balance for dashboard engine
  
  // Actions
  setCsvMetadata: (cnpj: string, date: string, clientId?: string) => void;
  setSyncStatus: (status: SyncStatus, error?: string) => void;
  setOrphanAccounts: (accounts: RawAccount[]) => void;
  setAllRawBalances: (accounts: RawAccount[]) => void;
  setBucketCounts: (counts: Record<string, number>) => void;
  setAvailableCompetences: (competences: { id: string; reference_date: string }[]) => void;
  toggleAccountSelection: (code: string) => void;
  clearSelection: () => void;
  resetSession: () => void;
}

export const useMappingUIStore = create<MappingUIState>((set) => ({
  currentCnpj: null,
  clientId: null,
  referenceDate: null,
  availableCompetences: [],
  syncStatus: 'idle',
  errorMessage: null,
  orphanAccounts: [],
  selectedOrphanCodes: [],
  bucketCounts: {},
  allRawBalances: [],
  
  setCsvMetadata: (cnpj, date, clientId) => set({ currentCnpj: cnpj, referenceDate: date, ...(clientId && { clientId }) }),
  
  setSyncStatus: (status, error = undefined) => set({ syncStatus: status, errorMessage: error || null }),
  
  setOrphanAccounts: (accounts) => set({ orphanAccounts: accounts }),
  
  setAllRawBalances: (accounts) => set({ allRawBalances: accounts }),
  
  setBucketCounts: (counts) => set({ bucketCounts: counts }),

  setAvailableCompetences: (competences) => set({ availableCompetences: competences }),
  
  toggleAccountSelection: (code) => set((state) => ({
    selectedOrphanCodes: state.selectedOrphanCodes.includes(code)
      ? state.selectedOrphanCodes.filter((c) => c !== code)
      : [...state.selectedOrphanCodes, code]
  })),
  
  clearSelection: () => set({ selectedOrphanCodes: [] }),
  
  resetSession: () => set({
    currentCnpj: null,
    clientId: null,
    referenceDate: null,
    syncStatus: 'idle',
    errorMessage: null,
    orphanAccounts: [],
    selectedOrphanCodes: [],
    bucketCounts: {},
    availableCompetences: [],
    allRawBalances: []
  })
}));

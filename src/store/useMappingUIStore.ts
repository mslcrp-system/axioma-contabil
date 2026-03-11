import { create } from 'zustand';

export type SyncStatus = 'idle' | 'parsing' | 'uploading' | 'success' | 'error';

export interface RawAccount {
  account_code: string;
  account_name: string;
  balance: number;
  nature: 'Devedor' | 'Credor';
}

export interface ClientRecord {
  id: string;
  name: string;
  cnpj: string;
}

interface MappingUIState {
  currentCnpj: string | null;
  clientId: string | null;
  referenceDate: string | null;
  availableCompetences: { id: string; reference_date: string }[];
  syncStatus: SyncStatus;
  errorMessage: string | null;
  orphanAccounts: RawAccount[];
  selectedOrphanCodes: string[];
  bucketCounts: Record<string, number>;
  allRawBalances: RawAccount[];

  setCsvMetadata: (cnpj: string, date: string, clientId?: string) => void;
  setClientId: (clientId: string, cnpj: string) => void;
  setSyncStatus: (status: SyncStatus, error?: string) => void;
  setOrphanAccounts: (accounts: RawAccount[]) => void;
  setAllRawBalances: (accounts: RawAccount[]) => void;
  setBucketCounts: (counts: Record<string, number>) => void;
  setAvailableCompetences: (competences: { id: string; reference_date: string }[]) => void;
  toggleAccountSelection: (code: string) => void;
  clearSelection: () => void;
  resetSession: () => void;
}

const emptySession = {
  referenceDate: null as null,
  syncStatus: 'idle' as SyncStatus,
  errorMessage: null as null,
  orphanAccounts: [] as RawAccount[],
  selectedOrphanCodes: [] as string[],
  bucketCounts: {} as Record<string, number>,
  availableCompetences: [] as { id: string; reference_date: string }[],
  allRawBalances: [] as RawAccount[],
};

export const useMappingUIStore = create<MappingUIState>((set) => ({
  currentCnpj: null,
  clientId: null,
  ...emptySession,

  setCsvMetadata: (cnpj, date, clientId) =>
    set({ currentCnpj: cnpj, referenceDate: date, ...(clientId && { clientId }) }),

  // Switches client — wipes session data ONLY if switching to a DIFFERENT client
  // If selecting the same client, we preserve the state to avoid broken re-renders
  setClientId: (clientId, cnpj) =>
    set((state) => {
      const isNewClient = state.clientId !== clientId;
      return {
        clientId,
        currentCnpj: cnpj,
        ...(isNewClient ? emptySession : {})
      };
    }),

  setSyncStatus: (status, error = undefined) =>
    set({ syncStatus: status, errorMessage: error || null }),

  setOrphanAccounts: (accounts) => set({ orphanAccounts: accounts }),

  setAllRawBalances: (accounts) => set({ allRawBalances: accounts }),

  setBucketCounts: (counts) => set({ bucketCounts: counts }),

  setAvailableCompetences: (competences) => set({ availableCompetences: competences }),

  toggleAccountSelection: (code) =>
    set((state) => ({
      selectedOrphanCodes: state.selectedOrphanCodes.includes(code)
        ? state.selectedOrphanCodes.filter((c) => c !== code)
        : [...state.selectedOrphanCodes, code],
    })),

  clearSelection: () => set({ selectedOrphanCodes: [] }),

  resetSession: () => set({ currentCnpj: null, clientId: null, ...emptySession }),
}));

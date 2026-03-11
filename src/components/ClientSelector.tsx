"use client";

import { useState, useEffect } from "react";
import { Building2, ChevronDown, Loader2, AlertCircle } from "lucide-react";
import { useMappingUIStore, ClientRecord } from "../store/useMappingUIStore";
import { supabase } from "../lib/supabase";

export function ClientSelector() {
  const [clients, setClients] = useState<ClientRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const { clientId, setClientId } = useMappingUIStore();
  const selectedClient = clients.find(c => c.id === clientId) ?? null;

  useEffect(() => {
    async function fetchClients() {
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('clients')
          .select('id, name, cnpj')
          .order('name', { ascending: true });

        if (error) {
          // Full RLS/API diagnostic logging
          console.error('[ClientSelector] Supabase error fetching clients:', {
            code: (error as any).code,
            message: error.message,
            hint: (error as any).hint,
            details: (error as any).details,
          });
          throw error;
        }
        console.log('[ClientSelector] Loaded', data?.length ?? 0, 'clients');
        setClients(data || []);
      } catch (err: any) {
        const code = err?.code ?? '';
        const hint = err?.hint ?? '';
        const msg = err?.message ?? 'Erro desconhecido';
        console.error('[ClientSelector] fetch failed:', err);
        // PGRST116 = table/view not found; 42501 = RLS denied
        const friendlyMsg = code === '42501'
          ? `Acesso negado (RLS). Execute: GRANT SELECT ON clients TO anon;`
          : code === 'PGRST116'
          ? `Tabela "clients" não encontrada no schema público.`
          : `Erro (${code}): ${msg}${hint ? ` — ${hint}` : ''}`;
        setError(friendlyMsg);
      } finally {
        setIsLoading(false);
      }
    }
    fetchClients();
  }, []);

  function handleSelect(client: ClientRecord) {
    setClientId(client.id, client.cnpj);
    setIsOpen(false);
  }

  // Format CNPJ for display: 00.000.000/0000-00
  function formatCnpj(cnpj: string) {
    const clean = cnpj.replace(/\D/g, '');
    if (clean.length !== 14) return cnpj;
    return `${clean.slice(0,2)}.${clean.slice(2,5)}.${clean.slice(5,8)}/${clean.slice(8,12)}-${clean.slice(12)}`;
  }

  return (
    <div className="relative">
      {/* Trigger button */}
      <button
        onClick={() => setIsOpen(prev => !prev)}
        className={`
          flex items-center gap-3 px-4 py-2.5 rounded-2xl border transition-all duration-200 min-w-[240px] max-w-[320px]
          ${selectedClient
            ? 'bg-white border-slate-200 hover:border-blue-300 hover:shadow-sm'
            : 'bg-blue-50 border-blue-200 hover:border-blue-400 hover:bg-blue-100'
          }
        `}
        aria-label="Selecionar empresa"
      >
        <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0
          ${selectedClient ? 'bg-blue-600' : 'bg-blue-400'}`}
        >
          {isLoading
            ? <Loader2 className="w-4 h-4 text-white animate-spin" />
            : <Building2 className="w-4 h-4 text-white" />
          }
        </div>

        <div className="flex-1 text-left overflow-hidden">
          {isLoading ? (
            <p className="text-sm font-bold text-slate-400">Carregando empresas...</p>
          ) : selectedClient ? (
            <>
              <p className="text-sm font-black text-slate-800 truncate leading-tight">{selectedClient.name}</p>
              <p className="text-[10px] font-bold text-slate-400 tracking-wide">{formatCnpj(selectedClient.cnpj)}</p>
            </>
          ) : (
            <p className="text-sm font-bold text-blue-600">Selecionar empresa</p>
          )}
        </div>

        <ChevronDown
          className={`w-4 h-4 text-slate-400 transition-transform duration-200 shrink-0 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Dropdown */}
      {isOpen && !isLoading && (
        <div className="absolute top-full mt-2 left-0 w-full min-w-[300px] bg-white rounded-2xl border border-slate-200 shadow-2xl shadow-slate-200/80 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
          {error ? (
            <div className="flex items-center gap-2 p-4 text-rose-600">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <p className="text-sm font-bold">{error}</p>
            </div>
          ) : clients.length === 0 ? (
            <div className="p-6 text-center">
              <Building2 className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-bold text-slate-500">Nenhuma empresa cadastrada</p>
              <p className="text-xs text-slate-400 mt-1">Importe um balancete para começar</p>
            </div>
          ) : (
            <ul className="py-1.5 max-h-72 overflow-y-auto">
              {clients.map(client => (
                <li key={client.id}>
                  <button
                    onClick={() => handleSelect(client)}
                    className={`w-full text-left px-4 py-3 flex items-center gap-3 transition-colors hover:bg-slate-50
                      ${clientId === client.id ? 'bg-blue-50' : ''}`}
                  >
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-xs font-black
                      ${clientId === client.id ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'}`}
                    >
                      {client.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <p className={`text-sm font-black truncate ${clientId === client.id ? 'text-blue-700' : 'text-slate-800'}`}>
                        {client.name}
                      </p>
                      <p className="text-[10px] font-bold text-slate-400">{formatCnpj(client.cnpj)}</p>
                    </div>
                    {clientId === client.id && (
                      <div className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Backdrop to close dropdown */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
}

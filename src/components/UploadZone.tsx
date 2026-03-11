"use client";

import { useState, useCallback } from "react";
import { UploadCloud, FileType, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { useMappingUIStore } from "../store/useMappingUIStore";
import { parseAndValidateCsv } from "../lib/csv-parser";
import { runAutoAllocationSync, fetchClientCompetences } from "../lib/sync-engine";

export function UploadZone() {
  const { 
    setSyncStatus, 
    setCsvMetadata, 
    setOrphanAccounts,
    setAllRawBalances,
    setBucketCounts,
    setAvailableCompetences,
    syncStatus, 
    errorMessage 
  } = useMappingUIStore();
  
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const processFile = async (file: File) => {
    setSyncStatus('parsing');
    
    // 1. Client-Side Parsing and Double-Entry Validation
    setTimeout(async () => {
        const result = await parseAndValidateCsv(file);
        
        if (!result.success || !result.cnpj || !result.referenceDate || !result.accounts) {
          setSyncStatus('error', result.error);
          return;
        }

        // 2. Client-Side parsing complete, set spinner state
        setSyncStatus('uploading');
        
        // 3. Trigger Destructive Upsert via Supabase SDK deleting old `tctb1_raw_balances`
        // 4. Batch Insert 500 records a payload
        // 5. Query mappings table
        const syncResult = await runAutoAllocationSync(
            result.cnpj, 
            result.referenceDate, 
            result.accounts,
            (msg) => console.log("[Sync Loader]: ", msg)
        );

        if (!syncResult.success) {
            setSyncStatus('error', syncResult.error);
            return;
        }

        // 6. Set Memory UI State & Transition
        setCsvMetadata(result.cnpj, result.referenceDate, syncResult.clientId);
        
        // 7. Split into Orphans and Auto-Mapped Accounts
        setOrphanAccounts(syncResult.orphanAccounts || []);
        setBucketCounts(syncResult.bucketCounts || {});
        setAllRawBalances(result.accounts);
        
        // Refresh available competences for navigation
        if (syncResult.clientId) {
            const comps = await fetchClientCompetences(syncResult.clientId);
            setAvailableCompetences(comps);
        }
        
        setSyncStatus('success');
    }, 300); // UI visual tick
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      if (file.type === "text/csv" || file.name.endsWith(".csv")) {
        processFile(file);
      } else {
        setSyncStatus('error', "Por favor, envie apenas arquivos CSV.");
      }
    }
  }, [setSyncStatus]);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFile(e.target.files[0]);
    }
  };

  // ----- Render Helpers -----
  if (syncStatus === 'parsing' || syncStatus === 'uploading') {
    return (
        <div className="w-full bg-slate-50 border-2 border-slate-200 border-dashed rounded-xl p-12 transition-all flex flex-col items-center justify-center text-center">
            <Loader2 className="w-12 h-12 text-blue-500 animate-spin mb-4" />
            <h3 className="text-xl font-bold text-slate-800 mb-2">Processando Motor de Hipóteses...</h3>
            <p className="text-slate-500">
                {syncStatus === 'parsing' ? 'Validando equação de partida dobrada no navegador...' : 'Sincronizando Mapeamentos Históricos (Auto-Alocação)...'}
            </p>
        </div>
    );
  }

  if (syncStatus === 'success') {
    return (
        <div className="w-full bg-emerald-50 border-2 border-emerald-500 border-solid rounded-xl p-12 transition-all flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 bg-emerald-500 text-white rounded-full flex items-center justify-center mb-4 shadow-lg">
                <CheckCircle className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-emerald-900 mb-2">Balancete Validado e Sincronizado</h3>
            <p className="text-emerald-700 mb-6">Equação Patrimonial verificada. As contas foram enviadas para o Painel de Amarração.</p>
            <button 
                onClick={() => setSyncStatus('idle')}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2 rounded-lg font-bold transition-all shadow-md flex items-center gap-2"
            >
                <UploadCloud className="w-4 h-4" /> Fazer novo upload
            </button>
        </div>
    );
  }

  return (
    <div 
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`w-full border-2 border-dashed rounded-xl p-12 transition-all flex flex-col items-center justify-center text-center relative
        ${isDragging ? 'border-blue-500 bg-blue-50 scale-[1.02]' : 'border-slate-300 bg-slate-50 hover:bg-slate-100 hover:border-slate-400'}`}
    >
      <input 
        type="file" 
        accept=".csv" 
        onChange={handleFileInput}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
      />
      
      <div className="w-16 h-16 bg-white shadow-sm border border-slate-200 rounded-full flex items-center justify-center mb-4 pointer-events-none">
        <UploadCloud className={`w-8 h-8 ${isDragging ? 'text-blue-500' : 'text-slate-400'}`} />
      </div>

      <h3 className="text-xl font-bold text-slate-800 mb-2 pointer-events-none">
        {isDragging ? 'Solte o arquivo do balancete aqui...' : 'Arraste o balancete analítico em CSV'}
      </h3>
      
      <p className="text-slate-500 mb-6 pointer-events-none max-w-md mx-auto">
        Validação matemática rigorosa local. Se (Devedores - Credores) for diferente de zero, o arquivo será recusado.
      </p>

      {syncStatus === 'error' && (
        <div className="bg-red-50 text-red-700 p-4 rounded-lg w-full max-w-lg mt-4 flex items-start gap-3 text-left border border-red-200 shadow-sm relative z-10 pointer-events-auto">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
                <p className="font-bold text-sm mb-1">Upload Recusado</p>
                <p className="text-sm opacity-90 break-words whitespace-pre-wrap">{errorMessage}</p>
            </div>
            <button 
              onClick={(e) => { e.stopPropagation(); setSyncStatus('idle'); }} 
              className="text-xs font-semibold bg-white border border-red-200 px-3 py-1 rounded-md hover:bg-red-50 transition-colors"
            >
                Tentar novamente
            </button>
        </div>
      )}

      {syncStatus !== 'error' && (
        <div className="flex items-center gap-2 text-sm text-slate-400 pointer-events-none">
            <FileType className="w-4 h-4" />
            <span>Formato suportado: .CSV gerado pelo ERP</span>
        </div>
      )}
    </div>
  );
}

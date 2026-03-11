"use client";

import { useMappingUIStore } from "../store/useMappingUIStore";
import { UploadZone } from "./UploadZone";
import { BucketManager, Bucket } from "./BucketManager";
import { FileText, ArrowRight, Settings, Grid, Tag, Loader2, BarChart3, TrendingUp, DollarSign, Calendar, Percent, Building2 } from "lucide-react";
import { SocraticInsights } from "./SocraticInsights";
import { TractionSimulator } from "./TractionSimulator";
import { ClientSelector } from "./ClientSelector";
import { useState, useEffect, useMemo } from "react";
import { supabase } from "../lib/supabase";
import { aggregateBalancesByBucket, AggregatedResult } from "../lib/engine";
import { fetchBalancesForCompetence, fetchClientCompetences, fetchHistoricalAggregatedData } from "../lib/sync-engine";
import { ResponsiveContainer, ComposedChart, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, BarChart, Bar } from 'recharts';

export function DashboardOrchestrator() {
  const { 
    currentCnpj, 
    referenceDate, 
    orphanAccounts, 
    selectedOrphanCodes, 
    toggleAccountSelection, 
    clearSelection, 
    setOrphanAccounts, 
    clientId, 
    bucketCounts, 
    setBucketCounts, 
    allRawBalances,
    setAllRawBalances,
    availableCompetences,
    setAvailableCompetences,
    setCsvMetadata,
    setSyncStatus
  } = useMappingUIStore();
  const [localBuckets, setLocalBuckets] = useState<Bucket[]>([]);
  const [isBucketsLoading, setIsBucketsLoading] = useState(false);
  const [isDataLoading, setIsDataLoading] = useState(false);
  const [view, setView] = useState<'mapping' | 'dashboard'>('mapping');
  const [dbMappings, setDbMappings] = useState<{account_code: string, bucket_id: string}[]>([]);
  const [historicalData, setHistoricalData] = useState<any[]>([]);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [analysisMode, setAnalysisMode] = useState<'value' | 'percent'>('value');

  // Fetch buckets on load
  useEffect(() => {
    if (!clientId) return;
    const fetchBuckets = async () => {
      setIsBucketsLoading(true);
      const { data, error } = await supabase.from('tctb1_buckets').select('*').eq('client_id', clientId);
      if (!error && data) {
        setLocalBuckets(data.map(b => ({ ...b, accountCount: 0 }))); 
      }
      setIsBucketsLoading(false);
    };
    fetchBuckets();
  }, [clientId]);

  // Fetch available competences for the client
  useEffect(() => {
    if (!clientId) return;
    const fetchComps = async () => {
        const data = await fetchClientCompetences(clientId);
        setAvailableCompetences(data || []);
    };
    fetchComps();
  }, [clientId, setAvailableCompetences]);

  // AUTO-SELECT: when competences load, immediately select the most recent one
  // Only fires when there's no referenceDate yet (fresh client switch)
  useEffect(() => {
    if (!clientId) return;
    if (availableCompetences.length === 0) return;
    // availableCompetences is already ordered DESC by reference_date from fetchClientCompetences
    const mostRecent = availableCompetences[0];
    if (!referenceDate || !availableCompetences.find(c => c.reference_date === referenceDate)) {
      setIsDataLoading(true);
      handleMonthChange(mostRecent.id).finally(() => {
        setIsDataLoading(false);
        setView('dashboard');
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableCompetences, clientId]);

  // Fetch historical data for charts (Unfiltered timeline)
  useEffect(() => {
    if (!clientId || localBuckets.length === 0) return;
    const fetchHistory = async () => {
        const data = await fetchHistoricalAggregatedData(clientId, localBuckets);
        setHistoricalData(data);
    };
    fetchHistory();
  }, [clientId, localBuckets, dbMappings]); // No dependence on referenceDate or view

  // Fetch mappings when entering dashboard
  useEffect(() => {
    if (view !== 'dashboard' || !clientId) return;
    const fetchMappings = async () => {
        const { data, error } = await supabase.from('tctb1_mappings').select('account_code, bucket_id').eq('client_id', clientId);
        if (!error && data) {
            setDbMappings(data);
        }
    };
    fetchMappings();
  }, [view, clientId]);

  const handleCreateBucket = async (newBucket: Bucket) => {
    if (!clientId) return;
    const { data, error } = await supabase.from('tctb1_buckets').insert({
        client_id: clientId,
        name: newBucket.name,
        macro_class: newBucket.macro_class
    }).select().single();

    if (!error && data) {
        setLocalBuckets(prev => [...prev, { ...data, accountCount: 0 }]);
    }
  };

  const aggregatedData = useMemo(() => {
    if (view !== 'dashboard' || !clientId) return [];
    return aggregateBalancesByBucket(
        localBuckets,
        allRawBalances,
        dbMappings
    );
  }, [view, localBuckets, allRawBalances, clientId, dbMappings]);

  const chartData = useMemo(() => {
    if (analysisMode === 'value') return historicalData;
    
    return historicalData.map(month => {
      const revenue = Math.abs(month.receita); 
      const hasRevenue = revenue > 0;
      
      return {
        ...month,
        receita: hasRevenue ? 100 : 0,
        custo: hasRevenue ? (month.custo / revenue) * 100 : 0,
        desp_adm: hasRevenue ? (month.desp_adm / revenue) * 100 : 0,
        resultado: hasRevenue ? (month.resultado / revenue) * 100 : 0,
      };
    });
  }, [historicalData, analysisMode]);

  const handleMoveToBucket = async (bucketId: string) => {
    if (selectedOrphanCodes.length === 0 || !clientId) return;

    const mappingsToInsert = selectedOrphanCodes.map(code => ({
        client_id: clientId,
        account_code: code,
        bucket_id: bucketId
    }));

    const { error } = await supabase.from('tctb1_mappings').upsert(mappingsToInsert);
    if (error) {
        console.error("Erro ao mapear contas:", error);
        return;
    }
    
    const newCounts = { ...bucketCounts };
    newCounts[bucketId] = (newCounts[bucketId] || 0) + selectedOrphanCodes.length;
    setBucketCounts(newCounts);

    // Update dbMappings locally for instant dashboard refresh
    const newMappings = selectedOrphanCodes.map(code => ({
        account_code: code,
        bucket_id: bucketId
    }));
    setDbMappings(prev => [...prev, ...newMappings]);

    const remainingOrphans = orphanAccounts.filter(acc => !selectedOrphanCodes.includes(acc.account_code));
    setOrphanAccounts(remainingOrphans);
    clearSelection();
  };

  const handleMonthChange = async (competenceId: string) => {
    if (!clientId) return;
    
    // Find the competence to get its date string
    const comp = availableCompetences.find(c => c.id === competenceId);
    if (!comp) return;

    setIsBucketsLoading(true);
    const result = await fetchBalancesForCompetence(clientId, competenceId);
    
    if (result.success) {
        setCsvMetadata(currentCnpj!, comp.reference_date);
        setOrphanAccounts(result.orphanAccounts || []);
        setBucketCounts(result.bucketCounts || {});
        setAllRawBalances([...(result.orphanAccounts || []), ...(result.mappedAccounts || [])]);
    }
    setIsBucketsLoading(false);
    return result;
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans">
      
      <header className="bg-white border-b border-slate-200 px-8 py-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-slate-800 rounded-lg flex items-center justify-center">
            <Settings className="w-6 h-6 text-blue-400" />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-800 tracking-tight">Axioma <span className="text-blue-600 font-medium">| Inteligência Contábil</span></h1>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Cognitive Audit Platform • {view === 'mapping' ? 'Taxonomy Mode' : 'Performance Mode'}</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
            <button 
                onClick={() => {
                    setSyncStatus('idle');
                    setShowUploadModal(true);
                }}
                className="text-xs font-bold text-slate-500 hover:text-blue-600 flex items-center gap-1.5 transition-colors border border-slate-200 px-3 py-1.5 rounded-lg bg-slate-50"
            >
                <Calendar className="w-3.5 h-3.5" /> Importar Balancete
            </button>
            <div className="w-px h-8 bg-slate-200"></div>

            {/* Multi-tenant client selector */}
            <ClientSelector />

            {/* Per-client controls — only shown when a client is selected */}
            {clientId && currentCnpj && (
              <div className="flex items-center gap-4">
                <div className="w-px h-8 bg-slate-200"></div>
                <div className="flex flex-col">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Competência</span>
                    {availableCompetences.length > 1 ? (
                        <select
                            value={availableCompetences.find(c => c.reference_date === referenceDate)?.id || ''}
                            onChange={(e) => handleMonthChange(e.target.value)}
                            className="text-sm font-semibold text-blue-600 bg-transparent border-none focus:ring-0 cursor-pointer p-0 h-5"
                        >
                            {availableCompetences.map(c => (
                                <option key={c.id} value={c.id}>{c.reference_date}</option>
                            ))}
                        </select>
                    ) : (
                        <span className="text-sm font-semibold text-slate-700">{referenceDate || '—'}</span>
                    )}
                </div>
                <div className="w-px h-8 bg-slate-300"></div>
                <div className="flex bg-slate-100 p-1 rounded-lg">
                    <button
                      onClick={() => setView('mapping')}
                      className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all flex items-center gap-2 ${view === 'mapping' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <Grid className="w-4 h-4" /> Mapeamento
                    </button>
                    <button
                      onClick={() => setView('dashboard')}
                      className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all flex items-center gap-2 ${view === 'dashboard' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <BarChart3 className="w-4 h-4" /> Dashboard
                    </button>
                </div>
              </div>
            )}
        </div>
      </header>

      <main className="flex-1 p-8 max-w-[1600px] w-full mx-auto">

        {/* ===== LOBBY: No client selected ===== */}
        {!clientId && (
          <div className="flex flex-col items-center justify-center min-h-[75vh] gap-10 animate-in fade-in duration-700">
            {/* Brand hero */}
            <div className="text-center">
              <h2 className="text-4xl font-black text-slate-800 tracking-tight mb-2">
                Axioma <span className="text-blue-600">| Inteligência Contábil</span>
              </h2>
              <p className="text-slate-500 text-lg font-medium">
                Selecione uma empresa para iniciar o diagnóstico ou importe um novo balancete.
              </p>
            </div>

            {/* Two action cards */}
            <div className="grid grid-cols-2 gap-6 w-full max-w-2xl">
              {/* Card A: Access existing client */}
              <div className="bg-white border-2 border-slate-200 rounded-3xl p-8 flex flex-col items-center gap-5 hover:border-blue-300 hover:shadow-lg transition-all duration-200 group">
                <div className="w-16 h-16 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center group-hover:bg-blue-100 transition-colors">
                  <Building2 className="w-8 h-8 text-blue-600" />
                </div>
                <div className="text-center">
                  <h3 className="text-lg font-black text-slate-800 mb-1">Acessar Cliente Existente</h3>
                  <p className="text-sm text-slate-500">Selecione uma empresa cadastrada no sistema.</p>
                </div>
                <ClientSelector />
              </div>

              {/* Card B: New diagnosis / upload */}
              <button
                onClick={() => { setSyncStatus('idle'); setShowUploadModal(true); }}
                className="bg-gradient-to-br from-slate-800 to-slate-900 border-2 border-slate-700 rounded-3xl p-8 flex flex-col items-center gap-5 hover:from-blue-700 hover:to-blue-900 hover:border-blue-600 transition-all duration-200 group text-left"
              >
                <div className="w-16 h-16 rounded-2xl bg-white/10 flex items-center justify-center group-hover:bg-white/20 transition-colors">
                  <FileText className="w-8 h-8 text-white" />
                </div>
                <div className="text-center">
                  <h3 className="text-lg font-black text-white mb-1">Novo Diagnóstico</h3>
                  <p className="text-sm text-slate-400 group-hover:text-slate-300 transition-colors">Importe um balancete CSV para criar um novo cliente.</p>
                </div>
                <span className="flex items-center gap-2 bg-white/10 text-white text-sm font-bold px-4 py-2 rounded-xl group-hover:bg-white/20 transition-colors">
                  <Calendar className="w-4 h-4" /> Importar Balancete
                </span>
              </button>
            </div>
          </div>
        )}

        {/* Upload modal — only triggered by explicit user action */}
        {showUploadModal && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full p-8 relative animate-in zoom-in-95 duration-300">
                <button
                    onClick={() => setShowUploadModal(false)}
                    className="absolute top-6 right-6 text-slate-400 hover:text-slate-600 p-2"
                >
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
                <div className="mb-8 text-center">
                    <h2 className="text-3xl font-black text-slate-800 mb-4 tracking-tight">Novo Diagnóstico</h2>
                    <p className="text-slate-500 text-lg">Submeta o Balancete CSV para iniciar a extração de insights auditáveis.</p>
                </div>
                <div className="mb-0">
                    <UploadZone />
                </div>
            </div>
          </div>
        )}

        {currentCnpj && view === 'mapping' && (
          <div className="h-[calc(100vh-140px)] flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-black text-slate-800 flex items-center gap-2 tracking-tight">
                    <Grid className="w-6 h-6 text-blue-500" />
                    Interface de Taxonomia Dinâmica
                </h2>
                <button 
                  onClick={() => setView('dashboard')}
                  className="bg-slate-800 hover:bg-slate-700 text-white px-6 py-2 rounded-lg font-bold flex items-center gap-2 transition-colors shadow-sm"
                >
                    Finalizar e Ver Dashboard <ArrowRight className="w-4 h-4" />
                </button>
            </div>

            <div className="flex-1 grid grid-cols-12 gap-6 min-h-0">
                <div className="col-span-4 bg-white border border-slate-200 rounded-xl flex flex-col shadow-sm overflow-hidden">
                    <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                        <div>
                            <h3 className="font-bold text-slate-700">Contas Órfãs</h3>
                            <p className="text-xs text-slate-500">Aguardando mapeamento ({orphanAccounts.length})</p>
                        </div>
                        {selectedOrphanCodes.length > 0 && (
                            <div className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-bold pulse">
                                {selectedOrphanCodes.length} selecionadas
                            </div>
                        )}
                    </div>
                    <div className="flex-1 overflow-auto p-4 space-y-2">
                        {orphanAccounts.map((acc, i) => {
                            const isSelected = selectedOrphanCodes.includes(acc.account_code);
                            return (
                                <div 
                                    key={i} 
                                    onClick={() => toggleAccountSelection(acc.account_code)}
                                    className={`p-3 border rounded-lg cursor-pointer transition-colors group relative
                                        ${isSelected ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500 shadow-sm' : 'border-slate-200 hover:border-blue-300 hover:bg-blue-50/50'}`}
                                >
                                    <div className="flex items-start gap-3">
                                        <div className={`w-4 h-4 mt-1 rounded border flex items-center justify-center transition-colors
                                            ${isSelected ? 'bg-blue-500 border-blue-500 text-white' : 'border-slate-300 bg-white group-hover:border-blue-400'}`}
                                        >
                                            {isSelected && <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="w-3 h-3"><polyline points="20 6 9 17 4 12"></polyline></svg>}
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex items-start justify-between mb-1">
                                                <span className={`text-xs font-mono transition-colors ${isSelected ? 'text-blue-600' : 'text-slate-400'}`}>{acc.account_code}</span>
                                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${acc.nature === 'Devedor' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>{acc.nature === 'Devedor' ? 'D' : 'C'}</span>
                                            </div>
                                            <h4 className={`text-sm font-semibold transition-colors line-clamp-1 truncate ${isSelected ? 'text-blue-900' : 'text-slate-700 group-hover:text-blue-700'}`}>{acc.account_name}</h4>
                                            <div className="mt-1 text-right text-sm font-medium text-slate-600">
                                                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(acc.balance)}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div className="col-span-8 bg-slate-50 border border-slate-200 rounded-xl p-6 flex flex-col shadow-inner overflow-hidden relative">
                    <div className="flex items-center justify-between mb-6 relative">
                        <div>
                           <h3 className="font-bold text-slate-700 text-lg flex items-center gap-2"><Grid className="w-5 h-5 text-blue-500" />Matriz de Destino (Buckets)</h3>
                           <p className="text-xs text-slate-500 mt-1">Selecione contas à esquerda e aplique em uma gaveta.</p>
                        </div>
                        <BucketManager onBucketCreated={handleCreateBucket} />
                    </div>
                    <div className={`flex-1 overflow-auto ${localBuckets.length === 0 || isBucketsLoading ? 'border-2 border-dashed border-slate-300 bg-slate-100/50 flex items-center justify-center' : ''} rounded-xl`}>
                        {isBucketsLoading ? (
                           <div className="text-center"><Loader2 className="w-12 h-12 text-blue-500 animate-spin mx-auto mb-4" /><h4 className="text-slate-600 font-bold">Carregando Taxonomia...</h4></div>
                        ) : localBuckets.length === 0 ? (
                           <div className="text-center max-w-sm"><Settings className="w-12 h-12 text-slate-300 mx-auto mb-4" /><h4 className="text-slate-600 font-bold mb-2">Nenhum Bucket Encontrado</h4><p className="text-sm text-slate-400">Crie seu primeiro bucket acima associando-o a uma Macro-Classe do motor matemático.</p></div>
                        ) : (
                           <div className="grid grid-cols-2 gap-4 auto-rows-max p-1">
                              {localBuckets.map(b => (
                                 <div key={b.id} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
                                    <div className="absolute top-0 left-0 w-1 h-full bg-blue-500" />
                                    <div className="flex items-start justify-between mb-3 pl-2">
                                       <h4 className="font-bold text-slate-800 text-base group-hover:text-blue-600 transition-colors">{b.name}</h4>
                                       <span className="bg-slate-100 text-slate-500 px-2 py-1 rounded-md text-xs font-bold border border-slate-200">{bucketCounts[b.id] || 0}</span>
                                    </div>
                                    <div className="pl-2">
                                       <div className="inline-flex items-center gap-1.5 px-2 py-1 bg-indigo-50 border border-indigo-100 rounded text-indigo-700 text-[10px] font-bold uppercase tracking-wider mb-2"><Tag className="w-3 h-3" />{b.macro_class}</div>
                                       <button 
                                          onClick={() => handleMoveToBucket(b.id)}
                                          disabled={selectedOrphanCodes.length === 0}
                                          className="w-full mt-2 py-2 border border-dashed border-blue-300 rounded-lg text-blue-600 text-sm font-semibold hover:bg-blue-50 hover:border-blue-500 transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                                       >
                                          <ArrowRight className="w-4 h-4" /> Mover Selecionados
                                       </button>
                                    </div>
                                 </div>
                              ))}
                           </div>
                        )}
                    </div>
                </div>
            </div>
          </div>
        )}
        {currentCnpj && view === 'dashboard' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="mb-8 flex items-center justify-between">
                    <div>
                        <h2 className="text-2xl font-black text-slate-800 flex items-center gap-2 tracking-tight">
                            <TrendingUp className="w-6 h-6 text-emerald-500" />
                            Axioma - Análise de Performance
                        </h2>
                        <p className="text-slate-500 font-medium">Auditoria horizontal e vertical baseada na série histórica de balancetes.</p>
                    </div>
                    <button 
                        onClick={() => {
                            setSyncStatus('idle');
                            setShowUploadModal(true);
                        }}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-bold flex items-center gap-2 transition-colors shadow-sm"
                    >
                        <Calendar className="w-4 h-4" /> Novo Upload
                    </button>
                </div>

                <div className="grid grid-cols-2 gap-8 mb-8">
                    {/* Graph 1: Margem Evolution */}
                    <div className="bg-white p-6 border border-slate-200 rounded-3xl shadow-sm">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                               <DollarSign className="w-5 h-5 text-emerald-500" /> Evolução de Margem
                            </h3>
                            <div className="flex bg-slate-100 p-1 rounded-lg">
                                <button 
                                    onClick={() => setAnalysisMode('value')}
                                    className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${analysisMode === 'value' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}
                                >
                                    R$
                                </button>
                                <button 
                                    onClick={() => setAnalysisMode('percent')}
                                    className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${analysisMode === 'percent' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}
                                >
                                    %
                                </button>
                            </div>
                        </div>
                        <div className="h-[300px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <ComposedChart data={chartData}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
                                    <YAxis 
                                        axisLine={false} 
                                        tickLine={false} 
                                        tick={{fill: '#94a3b8', fontSize: 12}} 
                                        tickFormatter={(val) => analysisMode === 'percent' ? `${val}%` : `R$${Math.abs(val/1000).toFixed(0)}k`} 
                                    />
                                    <Tooltip 
                                        contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}}
                                        formatter={(val: any) => analysisMode === 'percent' 
                                            ? `${Number(val).toFixed(1)}%` 
                                            : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val)}
                                    />
                                    <Legend iconType="circle" />
                                    <Bar name="Receita Bruta" dataKey="receita" fill="#10b981" radius={[4, 4, 0, 0]} barSize={40} />
                                    <Bar name="Custo Variável" dataKey="custo" fill="#f43f5e" radius={[4, 4, 0, 0]} barSize={40} />
                                    <Bar name="Despesa Administrativa" dataKey="desp_adm" fill="#94a3b8" radius={[4, 4, 0, 0]} barSize={40} />
                                    <Line 
                                        name="Resultado (Bottom Line)" 
                                        type="monotone" 
                                        dataKey="resultado" 
                                        stroke="#1e293b" 
                                        strokeWidth={4} 
                                        dot={{ r: 6, fill: '#1e293b', strokeWidth: 2, stroke: '#fff' }}
                                        activeDot={{ r: 8 }}
                                    />
                                </ComposedChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Graph 2: Structure of Financing */}
                    <div className="bg-white p-6 border border-slate-200 rounded-3xl shadow-sm">
                        <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                           <TrendingUp className="w-5 h-5 text-blue-500" /> Estrutura de Financiamento
                        </h3>
                        <div className="h-[300px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={historicalData}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
                                    <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} tickFormatter={(val) => `R$${Math.abs(val/1000).toFixed(0)}k`} />
                                    <Tooltip 
                                        contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}}
                                        formatter={(val: any) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val)}
                                    />
                                    <Legend iconType="circle" />
                                    <Line name="Contas a Receber (Clientes)" type="monotone" dataKey="clientes" stroke="#3b82f6" strokeWidth={3} dot={{r: 4}} activeDot={{r: 6}} />
                                    <Line name="Contas a Pagar (Fornecedores)" type="monotone" dataKey="fornecedores" stroke="#f59e0b" strokeWidth={3} dot={{r: 4}} activeDot={{r: 6}} />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>

                <SocraticInsights data={historicalData} buckets={localBuckets} />

                {isDataLoading ? (
                  <div className="mt-8 bg-white border border-slate-200 rounded-3xl p-10 flex flex-col items-center justify-center gap-4">
                    <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
                    <p className="text-slate-500 font-semibold text-sm">Carregando dados do período mais recente...</p>
                  </div>
                ) : (
                  <TractionSimulator historicalData={historicalData} />
                )}

                <div className="mb-6 mt-12">
                    <h3 className="text-xl font-bold text-slate-800 mb-4">Resumo do Último Mês ({referenceDate || '—'})</h3>
                    <div className="grid grid-cols-4 gap-4">
                        {isDataLoading ? (
                          Array.from({ length: 4 }).map((_, i) => (
                            <div key={i} className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm animate-pulse">
                              <div className="h-3 bg-slate-200 rounded w-2/3 mb-2" />
                              <div className="h-4 bg-slate-100 rounded w-full mb-3" />
                              <div className="h-6 bg-slate-200 rounded w-1/2" />
                            </div>
                          ))
                        ) : (
                          localBuckets.slice(0, 8).map(b => {
                            const balance = aggregatedData.find(d => d.bucketId === b.id)?.totalBalance || 0;
                            const isNegative = balance < 0;
                            return (
                                <div key={b.id} className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm hover:border-blue-200 transition-all group overflow-hidden relative">
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{b.macro_class}</span>
                                        <div className="p-1.5 bg-slate-50 rounded-lg"><DollarSign className="w-3.5 h-3.5 text-slate-300" /></div>
                                    </div>
                                    <h4 className="text-slate-600 font-bold text-sm mb-1">{b.name}</h4>
                                    <div className={`text-lg font-black ${isNegative ? 'text-rose-600' : 'text-slate-800'}`}>
                                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(balance)}
                                    </div>
                                </div>
                            );
                          })
                        )}
                    </div>
                </div>

                {localBuckets.length === 0 && (
                    <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-slate-300">
                        <BarChart3 className="w-16 h-16 text-slate-200 mx-auto mb-4" />
                        <h3 className="text-slate-600 font-bold text-lg">Nenhum dado agregado ainda.</h3>
                        <p className="text-slate-400 max-w-xs mx-auto text-sm">Crie buckets e mapeie contas no Painel de Amarração para visualizar os resultados aqui.</p>
                        <button onClick={() => setView('mapping')} className="mt-6 font-bold text-blue-600 hover:text-blue-700 flex items-center gap-2 mx-auto"><ArrowRight className="w-4 h-4 rotate-180" /> Voltar para o Mapeamento</button>
                    </div>
                )}
            </div>
        )}
      </main>
    </div>
  );
}

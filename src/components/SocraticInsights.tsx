"use client";

import { AlertCircle, TrendingDown, Zap, Search, ArrowUpRight, Loader2, Sparkles, HelpCircle, TrendingUp } from "lucide-react";
import { Bucket } from "./BucketManager";
import { useState, useEffect } from "react";

interface AIInsight {
  title: string;
  math_fact: string;
  socratic_question: string;
  severity: 'alta' | 'media';
}

interface SocraticInsightsProps {
  data: any[];
  buckets: Bucket[];
}

export function SocraticInsights({ data, buckets }: SocraticInsightsProps) {
  const [insights, setInsights] = useState<AIInsight[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!data || data.length < 2) return;

    async function fetchAIInsights() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch('/api/generate-insights', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            timeSeries: data.map(d => ({ 
                month: d.month, 
                receita: d.receita, 
                custo: d.custo, 
                desp_adm: d.desp_adm, 
                resultado: d.resultado,
                clientes: d.clientes,
                fornecedores: d.fornecedores,
                passivo_oneroso: d.passivo_oneroso
            })),
            drillDown: data[data.length - 1].drillDown // Pass most recent drill-down
          })
        });

        if (!response.ok) throw new Error("Erro na API da IA");
        const json = await response.json();
        setInsights(json.insights || []);
      } catch (err) {
        console.error(err);
        setError("Não foi possível carregar os insights cognitivos.");
      } finally {
        setLoading(false);
      }
    }

    fetchAIInsights();
  }, [data]);

  if (!data || data.length < 2) return null;

  if (loading) {
    return (
      <div className="mt-12 space-y-6 animate-pulse">
        <div className="flex items-center gap-3 border-b border-slate-200 pb-4">
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
          <h3 className="text-2xl font-black text-slate-400 uppercase tracking-tight">O motor cognitivo está analisando...</h3>
        </div>
        <div className="grid grid-cols-1 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-48 bg-slate-50 rounded-[2rem] border border-slate-100" />
          ))}
        </div>
      </div>
    );
  }

  if (error || insights.length === 0) return null;

  return (
    <div className="mt-12 space-y-6 animate-in fade-in slide-in-from-top-4 duration-1000">
      <div className="flex items-center justify-between border-b border-slate-200 pb-4">
        <h3 className="text-2xl font-black text-slate-800 flex items-center gap-3">
          <Sparkles className="w-8 h-8 text-blue-500 fill-blue-100" /> 
          MOTOR SOCRÁTICO V3 (COGNITIVE AI)
        </h3>
        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest bg-blue-50 text-blue-600 px-3 py-1 rounded-full outline outline-1 outline-blue-200">
           Gemini Artificial Intelligence
        </span>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {insights.map((insight, idx) => (
          <div 
            key={idx} 
            className={`p-8 rounded-[2.5rem] border-2 flex flex-col md:flex-row gap-6 shadow-sm transition-all hover:shadow-2xl hover:-translate-y-1 bg-white
              ${insight.severity === 'alta' ? 'border-rose-100' : 'border-amber-100'}`}
          >
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 shadow-sm
              ${insight.severity === 'alta' ? 'bg-rose-50 text-rose-500' : 'bg-amber-50 text-amber-500'}`}
            >
              <Zap className="w-8 h-8" />
            </div>
            
            <div className="flex-1 space-y-4">
              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-widest ${insight.severity === 'alta' ? 'bg-rose-600 text-white' : 'bg-amber-600 text-white'}`}>
                  {insight.severity === 'alta' ? 'Crítico' : 'Alerta'}
                </span>
                <h4 className={`text-xl font-black italic tracking-tight ${insight.severity === 'alta' ? 'text-rose-950' : 'text-amber-950'}`}>{insight.title}</h4>
              </div>
              
              <div className="bg-slate-50/50 p-6 rounded-[1.5rem] border border-slate-100 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-20 transition-opacity">
                    <TrendingUp className="w-24 h-24 text-slate-900" />
                </div>
                <p className="text-slate-800 font-bold text-lg leading-tight mb-4 relative z-10">{insight.math_fact}</p>
                <div className="flex gap-3 bg-white p-4 rounded-xl border border-blue-100 shadow-sm relative z-10">
                    <HelpCircle className="w-6 h-6 text-blue-600 shrink-0" />
                    <p className="text-blue-900 font-extrabold text-sm leading-relaxed italic uppercase">
                        {insight.socratic_question}
                    </p>
                </div>
              </div>
            </div>

            <div className="hidden md:flex flex-col items-center justify-center py-2 shrink-0 opacity-20">
               {insight.severity === 'alta' ? <TrendingDown className="w-12 h-12 text-rose-950" /> : <ArrowUpRight className="w-12 h-12 text-amber-950" />}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

import { AlertCircle, TrendingDown, Zap, Search, ArrowUpRight, Loader2, Sparkles, HelpCircle, TrendingUp, Brain } from "lucide-react";
import { Bucket } from "./BucketManager";
import { useState } from "react";
import { useMappingUIStore, AIInsight } from "../store/useMappingUIStore";

interface SocraticInsightsProps {
  data: any[];
  buckets: Bucket[];
}

/**
 * SANITIZAÇÃO DE PAYLOAD (INVERSÃO DE SINAL):
 * Inverte o sinal matemático (value * -1) EXCLUSIVAMENTE para naturezas credoras.
 * Isso garante que a IA leia PL, Passivo e Receitas saudáveis como números positivos.
 */
function sanitizeDrillDown(rawDrillDown: any, buckets: Bucket[]) {
  if (!rawDrillDown) return {};
  
  const creditNatureClasses = [
    'passivo circulante',
    'passivo nao circulante',
    'passivo oneroso',
    'patrimonio liquido',
    'receita'
  ];

  // Deep clone to avoid mutating origin or state
  const sanitized = JSON.parse(JSON.stringify(rawDrillDown));

  for (const bucketId in sanitized) {
    const bucket = buckets.find(b => b.id === bucketId);
    if (!bucket) continue;

    const macroClass = (bucket.macro_class || '').toLowerCase();
    const needsInversion = creditNatureClasses.some(c => macroClass.includes(c));

    if (needsInversion) {
      sanitized[bucketId] = sanitized[bucketId].map((acc: any) => ({
        ...acc,
        balance: acc.balance * -1
      }));
    }
  }
  return sanitized;
}

export function SocraticInsights({ data, buckets }: SocraticInsightsProps) {
  const [insights, setInsights] = useState<AIInsight[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasRun, setHasRun] = useState(false);
  const { setInsights: setGlobalInsights } = useMappingUIStore();

  if (!data || data.length < 2) return null;

  async function runAudit() {
    setIsGenerating(true);
    setError(null);
    setHasRun(true);
    try {
      // 1. Sanitize ONLY DrillDown (TimeSeries is already normalized by sync-engine)
      // We invert signs for credit-nature accounts so the AI reads healthy equity/revenue as positive.
      const sanitizedDrillDown = sanitizeDrillDown(data[data.length - 1].drillDown, buckets);

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
          drillDown: sanitizedDrillDown
        })
      });

      if (!response.ok) throw new Error("Erro na API da IA");
      const json = await response.json();
      const newInsights = json.insights || [];
      setInsights(newInsights);
      setGlobalInsights(newInsights);
    } catch (err) {
      console.error(err);
      setError("Não foi possível carregar os insights. Tente novamente.");
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <div className="mt-12 space-y-6">
      {/* Header + CTA */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-4">
        <h3 className="text-2xl font-black text-slate-800 flex items-center gap-3">
          <Sparkles className="w-8 h-8 text-blue-500 fill-blue-100" />
          MOTOR SOCRÁTICO V3 (COGNITIVE AI)
        </h3>
        <span className="text-xs font-bold uppercase tracking-widest bg-blue-50 text-blue-600 px-3 py-1 rounded-full outline outline-1 outline-blue-200">
          Gemini Artificial Intelligence
        </span>
      </div>

      {/* CTA Button — only shown before first run or on error (not during loading) */}
      {!isGenerating && (!hasRun || error) && (
        <div className="flex flex-col items-center justify-center py-10 gap-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-3xl border-2 border-dashed border-blue-200">
          {error && (
            <p className="text-sm text-rose-600 font-bold bg-rose-50 px-4 py-2 rounded-xl border border-rose-200">
              ⚠️ {error}
            </p>
          )}
          {!error && (
            <p className="text-sm text-slate-500 font-medium text-center max-w-md">
              O motor de IA analisa a série histórica e gera perguntas socráticas sobre os desvios mais críticos da operação.
            </p>
          )}
          <button
            onClick={runAudit}
            className="flex items-center gap-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-black px-8 py-4 rounded-2xl shadow-lg shadow-blue-200 transition-all duration-200 hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 text-base"
          >
            <Brain className="w-6 h-6" />
            🧠 Executar Auditoria com IA
          </button>
        </div>
      )}

      {/* Loading state */}
      {isGenerating && (
        <div className="flex flex-col items-center justify-center py-12 gap-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-3xl border-2 border-blue-200 animate-pulse">
          <div className="w-16 h-16 rounded-2xl bg-blue-500 flex items-center justify-center shadow-lg">
            <Loader2 className="w-8 h-8 text-white animate-spin" />
          </div>
          <div className="text-center">
            <p className="text-blue-800 font-black text-lg">Cruzando dados contábeis e operacionais...</p>
            <p className="text-blue-500 text-sm font-medium mt-1">O Gemini está auditando {data.length} meses de série histórica</p>
          </div>
          <div className="flex gap-1.5 mt-2">
            {[0, 1, 2].map(i => (
              <div
                key={i}
                className="w-2 h-2 rounded-full bg-blue-400 animate-bounce"
                style={{ animationDelay: `${i * 0.15}s` }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Results */}
      {hasRun && !isGenerating && insights.length > 0 && (
        <div className="grid grid-cols-1 gap-4 animate-in fade-in slide-in-from-top-4 duration-700">
          {/* Re-run button (subtle) */}
          <div className="flex justify-end">
            <button
              onClick={runAudit}
              className="flex items-center gap-2 text-xs text-blue-500 hover:text-blue-700 font-bold px-3 py-1.5 rounded-lg hover:bg-blue-50 transition-colors"
            >
              <Brain className="w-3.5 h-3.5" />
              Re-executar auditoria
            </button>
          </div>

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
      )}
    </div>
  );
}

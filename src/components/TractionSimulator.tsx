"use client";

import { useState, useMemo } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { TrendingUp, Sliders, Target, Zap } from "lucide-react";

interface TractionSimulatorProps {
  historicalData: any[];
}

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(v);

const MONTH_LABELS = ["Mês 1", "Mês 2", "Mês 3", "Mês 4", "Mês 5", "Mês 6"];

export function TractionSimulator({ historicalData }: TractionSimulatorProps) {
  const [costReduction, setCostReduction] = useState(0); // 0 to -20
  const [adminReduction, setAdminReduction] = useState(0); // 0 to -30
  const [revenueGrowth, setRevenueGrowth] = useState(0); // 0 to +20

  // Base month (the last month of historical data)
  const baseMonth = useMemo(() => {
    if (!historicalData || historicalData.length === 0) return null;
    return historicalData[historicalData.length - 1];
  }, [historicalData]);

  const projectionData = useMemo(() => {
    if (!baseMonth) return [];

    const baseReceita = Math.abs(baseMonth.receita || 0);
    const baseCusto = Math.abs(baseMonth.custo || 0);
    const baseDespAdm = Math.abs(baseMonth.desp_adm || 0);
    const baseCaixa = Math.abs(baseMonth.caixa || 0);

    // Scenario without changes (current trajectory)
    const baseResultado = baseReceita - baseCusto - baseDespAdm;

    // Axioma scenario factors
    const receitaFactor = 1 + revenueGrowth / 100;
    const custoFactor = 1 + costReduction / 100;
    const admFactor = 1 + adminReduction / 100;

    let caixaAtual = baseCaixa;
    let caixaBase = baseCaixa;

    return MONTH_LABELS.map((label, i) => {
      const monthFactor = 1 + (i * 0.01); // slight compounding

      // Baseline scenario: same inefficiency repeats
      const baseR = baseReceita * Math.pow(0.98, i + 1); // slight decay without action
      const baseC = baseCusto * Math.pow(1.01, i + 1);
      const baseD = baseDespAdm;
      const baseRes = baseR - baseC - baseD;
      caixaBase += baseRes;

      // Axioma scenario
      const axReceita = baseReceita * Math.pow(receitaFactor, i + 1) * Math.pow(monthFactor, i);
      const axCusto = baseCusto * Math.pow(custoFactor, i + 1);
      const axDesp = baseDespAdm * Math.pow(admFactor, i + 1);
      const axResultado = axReceita - axCusto - axDesp;
      caixaAtual += axResultado;

      return {
        label,
        cenarioAtual: Math.round(caixaBase),
        cenarioAxioma: Math.round(caixaAtual),
        resultadoAtual: Math.round(baseRes),
        resultadoAxioma: Math.round(axResultado),
      };
    });
  }, [baseMonth, costReduction, adminReduction, revenueGrowth]);

  const geracaoCaixaAdicional = useMemo(() => {
    if (projectionData.length === 0) return 0;
    const last = projectionData[projectionData.length - 1];
    return last.cenarioAxioma - last.cenarioAtual;
  }, [projectionData]);

  if (!baseMonth || Math.abs(baseMonth.receita || 0) === 0) {
    return null;
  }

  const baseReceita = Math.abs(baseMonth.receita || 0);
  const baseCusto = Math.abs(baseMonth.custo || 0);
  const baseDespAdm = Math.abs(baseMonth.desp_adm || 0);
  const baseResultado = baseReceita - baseCusto - baseDespAdm;

  const projReceita = baseReceita * (1 + revenueGrowth / 100);
  const projCusto = baseCusto * (1 + costReduction / 100);
  const projDesp = baseDespAdm * (1 + adminReduction / 100);
  const projResultado = projReceita - projCusto - projDesp;
  const deltaResultado = projResultado - baseResultado;

  const isPositive = geracaoCaixaAdicional >= 0;

  return (
    <div className="mt-12 animate-in fade-in slide-in-from-bottom-6 duration-700">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-4 mb-8">
        <h3 className="text-2xl font-black text-slate-800 flex items-center gap-3">
          <Target className="w-8 h-8 text-emerald-500" />
          SIMULADOR DE TRAÇÃO
        </h3>
        <span className="text-xs font-bold uppercase tracking-widest bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full outline outline-1 outline-emerald-200">
          Prescriptive Analytics Engine
        </span>
      </div>

      {/* Cash flow spotlight card */}
      <div
        className={`mb-8 rounded-3xl p-6 flex items-center justify-between shadow-sm border-2 transition-all duration-500
          ${isPositive
            ? "bg-gradient-to-r from-emerald-50 to-green-50 border-emerald-200"
            : "bg-gradient-to-r from-rose-50 to-red-50 border-rose-200"
          }`}
      >
        <div className="flex items-center gap-4">
          <div
            className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-sm ${isPositive ? "bg-emerald-500" : "bg-rose-500"}`}
          >
            <Zap className="w-7 h-7 text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-500 uppercase tracking-wider">
              Geração de Caixa Adicional Projetada em 6 Meses
            </p>
            <p
              className={`text-3xl font-black tracking-tight ${isPositive ? "text-emerald-700" : "text-rose-700"}`}
            >
              {isPositive ? "+" : ""}
              {fmt(geracaoCaixaAdicional)}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">
            Melhora no Resultado Mensal
          </p>
          <p
            className={`text-xl font-black ${deltaResultado >= 0 ? "text-emerald-700" : "text-rose-700"}`}
          >
            {deltaResultado >= 0 ? "+" : ""}
            {fmt(deltaResultado)} / mês
          </p>
        </div>
      </div>

      {/* Main layout: sliders + chart */}
      <div className="grid grid-cols-5 gap-6">
        {/* === LEFT: Hypothesis Controls === */}
        <div className="col-span-2 bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-6">
          <div className="flex items-center gap-2 mb-2">
            <Sliders className="w-5 h-5 text-blue-500" />
            <h4 className="font-black text-slate-800">Hipóteses de Governança</h4>
          </div>

          {/* Base values summary */}
          <div className="bg-slate-50 rounded-2xl p-4 space-y-2 border border-slate-100">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">
              Ponto de Partida (Mês 0)
            </p>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500">Receita Bruta</span>
              <span className="text-sm font-black text-emerald-700">{fmt(baseReceita)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500">Custo Variável</span>
              <span className="text-sm font-black text-rose-600">{fmt(baseCusto)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500">Despesa Adm.</span>
              <span className="text-sm font-black text-amber-600">{fmt(baseDespAdm)}</span>
            </div>
            <div className="border-t border-slate-200 pt-2 flex items-center justify-between">
              <span className="text-xs font-black text-slate-700">Resultado</span>
              <span
                className={`text-sm font-black ${baseResultado >= 0 ? "text-slate-800" : "text-rose-600"}`}
              >
                {fmt(baseResultado)}
              </span>
            </div>
          </div>

          {/* Slider 1: Revenue Growth */}
          <SliderControl
            label="Crescimento de Receita"
            value={revenueGrowth}
            onChange={setRevenueGrowth}
            min={0}
            max={20}
            step={0.5}
            color="emerald"
            unit="%"
            prefix="+"
            description="Ampliação do faturamento via precificação ou volume"
          />

          {/* Slider 2: Variable Cost Reduction */}
          <SliderControl
            label="Otimização de Custo Variável"
            value={costReduction}
            onChange={setCostReduction}
            min={-20}
            max={0}
            step={0.5}
            color="blue"
            unit="%"
            prefix=""
            description="Renegociação de fornecedores e eficiência produtiva"
          />

          {/* Slider 3: Admin Reduction */}
          <SliderControl
            label="Redução de Despesa Adm."
            value={adminReduction}
            onChange={setAdminReduction}
            min={-30}
            max={0}
            step={0.5}
            color="violet"
            unit="%"
            prefix=""
            description="Reestruturação de overhead e custos fixos"
          />

          {/* Projected values */}
          <div className="bg-gradient-to-br from-emerald-50 to-green-50 rounded-2xl p-4 space-y-2 border border-emerald-100">
            <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600 mb-3">
              Resultado Projetado (Mês 1)
            </p>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500">Receita Proj.</span>
              <span className="text-sm font-black text-emerald-700">{fmt(projReceita)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500">Custo Proj.</span>
              <span className="text-sm font-black text-slate-600">{fmt(projCusto)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500">Despesa Proj.</span>
              <span className="text-sm font-black text-slate-600">{fmt(projDesp)}</span>
            </div>
            <div className="border-t border-emerald-200 pt-2 flex items-center justify-between">
              <span className="text-xs font-black text-slate-700">Resultado Proj.</span>
              <span className={`text-lg font-black ${projResultado >= 0 ? "text-emerald-700" : "text-rose-600"}`}>
                {fmt(projResultado)}
              </span>
            </div>
          </div>
        </div>

        {/* === RIGHT: Projection Chart === */}
        <div className="col-span-3 bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-black text-slate-800 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-emerald-500" />
              Trajetória de Caixa Acumulado (6 Meses)
            </h4>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-rose-400" />
                <span className="text-xs font-bold text-slate-500">Cenário Atual</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-emerald-500" />
                <span className="text-xs font-bold text-slate-500">Cenário Axioma</span>
              </div>
            </div>
          </div>

          <div className="h-[340px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={projectionData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradAtual" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradAxioma" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis
                  dataKey="label"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#94a3b8", fontSize: 12, fontWeight: 600 }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#94a3b8", fontSize: 12 }}
                  tickFormatter={(v) => `R$${(Math.abs(v) / 1000).toFixed(0)}k`}
                  width={60}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: "1rem",
                    border: "none",
                    boxShadow: "0 10px 25px -5px rgb(0 0 0 / 0.15)",
                    fontSize: "13px",
                    fontWeight: 600,
                  }}
                  formatter={(val: any, name: string) => [
                    fmt(val),
                    name === "cenarioAtual" ? "Cenário Atual" : "Cenário Axioma",
                  ]}
                  labelStyle={{ color: "#475569", fontWeight: 700, marginBottom: "8px" }}
                />
                <Area
                  type="monotone"
                  dataKey="cenarioAtual"
                  name="cenarioAtual"
                  stroke="#f43f5e"
                  strokeWidth={2.5}
                  strokeDasharray="6 3"
                  fill="url(#gradAtual)"
                  dot={{ r: 4, fill: "#f43f5e", strokeWidth: 2, stroke: "#fff" }}
                  activeDot={{ r: 6 }}
                />
                <Area
                  type="monotone"
                  dataKey="cenarioAxioma"
                  name="cenarioAxioma"
                  stroke="#10b981"
                  strokeWidth={3}
                  fill="url(#gradAxioma)"
                  dot={{ r: 5, fill: "#10b981", strokeWidth: 2, stroke: "#fff" }}
                  activeDot={{ r: 7 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Monthly result delta table */}
          <div className="mt-4 border-t border-slate-100 pt-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">
              Resultado Mensal Projetado
            </p>
            <div className="grid grid-cols-6 gap-2">
              {projectionData.map((d, i) => {
                const delta = d.resultadoAxioma - d.resultadoAtual;
                return (
                  <div
                    key={i}
                    className="bg-slate-50 rounded-xl p-2 text-center border border-slate-100"
                  >
                    <p className="text-[10px] font-bold text-slate-400 mb-1">{d.label}</p>
                    <p
                      className={`text-xs font-black ${d.resultadoAxioma >= 0 ? "text-emerald-700" : "text-rose-600"}`}
                    >
                      {d.resultadoAxioma >= 0 ? "+" : ""}
                      {(d.resultadoAxioma / 1000).toFixed(1)}k
                    </p>
                    {delta > 0 && (
                      <p className="text-[9px] font-bold text-emerald-500 mt-0.5">
                        +{(delta / 1000).toFixed(1)}k
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ===== Slider Control Sub-component ===== */
interface SliderControlProps {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
  color: "emerald" | "blue" | "violet";
  unit: string;
  prefix: string;
  description: string;
}

const colorMap = {
  emerald: {
    track: "accent-emerald-500",
    badge: "bg-emerald-100 text-emerald-700",
    border: "border-emerald-200",
  },
  blue: {
    track: "accent-blue-500",
    badge: "bg-blue-100 text-blue-700",
    border: "border-blue-200",
  },
  violet: {
    track: "accent-violet-500",
    badge: "bg-violet-100 text-violet-700",
    border: "border-violet-200",
  },
};

function SliderControl({
  label,
  value,
  onChange,
  min,
  max,
  step,
  color,
  unit,
  description,
}: SliderControlProps) {
  const c = colorMap[color];
  const displayValue = value.toFixed(1);
  const isActive = value !== 0 && value !== min && value !== max;

  return (
    <div
      className={`p-4 rounded-2xl border transition-all duration-300 ${isActive || value !== 0 ? c.border + " bg-white shadow-sm" : "border-slate-100 bg-slate-50/50"}`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-black text-slate-700">{label}</span>
        <span className={`text-sm font-black px-2 py-0.5 rounded-lg ${c.badge}`}>
          {value >= 0 && value !== min ? "+" : ""}
          {displayValue}
          {unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className={`w-full h-2 rounded-full cursor-pointer ${c.track}`}
      />
      <div className="flex justify-between mt-1">
        <span className="text-[10px] text-slate-400 font-bold">{min > 0 ? `+${min}` : min}{unit}</span>
        <span className="text-[9px] text-slate-400 italic">{description}</span>
        <span className="text-[10px] text-slate-400 font-bold">{max > 0 ? `+${max}` : max}{unit}</span>
      </div>
    </div>
  );
}

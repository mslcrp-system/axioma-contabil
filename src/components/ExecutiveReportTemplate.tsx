"use client";

import React from "react";
import { AIInsight } from "../store/useMappingUIStore";

interface ExecutiveReportTemplateProps {
  clientName: string;
  cnpj: string;
  date: string;
  insights: AIInsight[];
  simulation: {
    base: { receita: number; custo: number; despAdm: number; resultado: number };
    projected: { receita: number; custo: number; despAdm: number; resultado: number };
    deltaResultado: number;
    geracaoCaixaAdicional: number;
  } | null;
}

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(v);

export const ExecutiveReportTemplate = React.forwardRef<HTMLDivElement, ExecutiveReportTemplateProps>((props, ref) => {
  const { clientName, cnpj, date, insights, simulation } = props;

  return (
    <div
      ref={ref}
      style={{
        width: "210mm",
        minHeight: "297mm",
        padding: "20mm",
        backgroundColor: "#ffffff",
        color: "#1a1a1a",
        fontFamily: "Arial, sans-serif",
        lineHeight: "1.5",
        boxSizing: "border-box",
      }}
    >
      {/* Header */}
      <div style={{ borderBottom: "2px solid #1e293b", paddingBottom: "10mm", marginBottom: "10mm", display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "5mm" }}>
          {/* Base64 Logo embed */}
          <div style={{ width: "12mm", height: "12mm", backgroundColor: "#0f172a", borderRadius: "2mm", display: "flex", alignItems: "center", justifyItems: "center", padding: "1mm" }}>
             <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAMAAACdt4HsAAAABGdBTUEAALGPC/xhBQAAACBjSFJNAAB6JgAAgIQAAPoAAACA6AAAdTAAAOpgAAA6mAAAF3CculE8AAAAXVBMVEUAAAD///8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAn96mXAAAAHnRSTlMAAAAAAAA0/v58vO40P/7+8v7S8v7y0f7+8vX+8vb9937DcgAAAAlwSFlzAAALEwAACxMBAJqcGAAAAW9JREFUWFft10mSgzAMBFApIsY8E2L6GvL+p8h6ixvoLu4XPQfoB1WWIPB8YW3OTOq+MWmXelKfq25oW9WYRr91c6DwWsYKoyq2t3i4wRRntu52VIzJvy/yUwjzmND/PwAA///Qru5z/tSagQAAAABJRU5ErkJggg==" alt="Logo" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: "28px", fontWeight: "900", color: "#0f172a" }}>
              AXIOMA <span style={{ fontWeight: "400", color: "#2563eb" }}>CONSULTORIA</span>
            </h1>
            <p style={{ margin: "2px 0 0 0", fontSize: "10px", fontWeight: "bold", color: "#64748b", textTransform: "uppercase", letterSpacing: "1px" }}>
              Inteligência em Auditoria e Governança
            </p>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <p style={{ margin: 0, fontSize: "12px", fontWeight: "bold" }}>{clientName}</p>
          <p style={{ margin: 0, fontSize: "10px", color: "#64748b" }}>CNPJ: {cnpj}</p>
          <p style={{ margin: 0, fontSize: "10px", color: "#64748b" }}>Data do Diagnóstico: {date}</p>
        </div>
      </div>

      {/* Title */}
      <h2 style={{ fontSize: "20px", fontWeight: "900", marginBottom: "8mm", textAlign: "center", textTransform: "uppercase", borderBottom: "1px solid #e2e8f0", paddingBottom: "4mm" }}>
        Relatório de Diagnóstico Executivo
      </h2>

      {/* Section 1: AI Insights */}
      <div style={{ marginBottom: "12mm" }}>
        <h3 style={{ fontSize: "16px", fontWeight: "bold", color: "#2563eb", marginBottom: "4mm", display: "flex", alignItems: "center", gap: "2mm" }}>
          1. Diagnóstico de Riscos e Oportunidades (IA)
        </h3>
        {insights.length === 0 ? (
          <p style={{ fontSize: "12px", color: "#64748b", fontStyle: "italic" }}>Nenhum insight gerado para este período.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "6mm" }}>
            {insights.map((insight, idx) => (
              <div key={idx} style={{ padding: "5mm", border: "1px solid #e2e8f0", borderRadius: "4mm", backgroundColor: "#f8fafc" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "2mm", marginBottom: "2mm" }}>
                  <span style={{ fontSize: "9px", fontWeight: "bold", padding: "1mm 2mm", borderRadius: "1mm", backgroundColor: insight.severity === 'alta' ? '#ef4444' : '#f59e0b', color: "#ffffff", textTransform: "uppercase" }}>
                    {insight.severity === 'alta' ? 'Crítico' : 'Alerta'}
                  </span>
                  <h4 style={{ margin: 0, fontSize: "14px", fontWeight: "bold" }}>{insight.title}</h4>
                </div>
                <p style={{ margin: "0 0 3mm 0", fontSize: "12px", fontWeight: "bold", color: "#334155" }}>{insight.math_fact}</p>
                <div style={{ padding: "3mm", backgroundColor: "#ffffff", borderLeft: "4px solid #2563eb", fontStyle: "italic", fontSize: "11px", color: "#1e3a8a" }}>
                  " {insight.socratic_question} "
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Section 2: Projections */}
      {simulation && (
        <div style={{ marginBottom: "12mm" }}>
          <h3 style={{ fontSize: "16px", fontWeight: "bold", color: "#2563eb", marginBottom: "4mm" }}>
            2. Simulação de Tração e Resultado Projetado
          </h3>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
            <thead>
              <tr style={{ backgroundColor: "#f1f5f9" }}>
                <th style={{ textAlign: "left", padding: "3mm", border: "1px solid #e2e8f0" }}>Indicador</th>
                <th style={{ textAlign: "right", padding: "3mm", border: "1px solid #e2e8f0" }}>Ponto de Partida (Mês 0)</th>
                <th style={{ textAlign: "right", padding: "3mm", border: "1px solid #e2e8f0" }}>Projetado (Mês 6)</th>
                <th style={{ textAlign: "right", padding: "3mm", border: "1px solid #e2e8f0" }}>Delta</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ padding: "3mm", border: "1px solid #e2e8f0", fontWeight: "bold" }}>Receita Bruta</td>
                <td style={{ padding: "3mm", border: "1px solid #e2e8f0", textAlign: "right" }}>{fmt(simulation.base.receita)}</td>
                <td style={{ padding: "3mm", border: "1px solid #e2e8f0", textAlign: "right" }}>{fmt(simulation.projected.receita)}</td>
                <td style={{ padding: "3mm", border: "1px solid #e2e8f0", textAlign: "right", color: "#10b981", fontWeight: "bold" }}>
                  +{simulation.base.receita > 0 ? ( (simulation.projected.receita / simulation.base.receita - 1) * 100).toFixed(1) : 0}%
                </td>
              </tr>
              <tr>
                <td style={{ padding: "3mm", border: "1px solid #e2e8f0", fontWeight: "bold" }}>Custo Variável</td>
                <td style={{ padding: "3mm", border: "1px solid #e2e8f0", textAlign: "right" }}>{fmt(simulation.base.custo)}</td>
                <td style={{ padding: "3mm", border: "1px solid #e2e8f0", textAlign: "right" }}>{fmt(simulation.projected.custo)}</td>
                <td style={{ padding: "3mm", border: "1px solid #e2e8f0", textAlign: "right", color: "#f43f5e" }}>
                  {simulation.base.custo > 0 ? ( (simulation.projected.custo / simulation.base.custo - 1) * 100).toFixed(1) : 0}%
                </td>
              </tr>
              <tr>
                <td style={{ padding: "3mm", border: "1px solid #e2e8f0", fontWeight: "bold" }}>Despesa Administrativa</td>
                <td style={{ padding: "3mm", border: "1px solid #e2e8f0", textAlign: "right" }}>{fmt(simulation.base.despAdm)}</td>
                <td style={{ padding: "3mm", border: "1px solid #e2e8f0", textAlign: "right" }}>{fmt(simulation.projected.despAdm)}</td>
                <td style={{ padding: "3mm", border: "1px solid #e2e8f0", textAlign: "right", color: "#f43f5e" }}>
                  {simulation.base.despAdm > 0 ? ( (simulation.projected.despAdm / simulation.base.despAdm - 1) * 100).toFixed(1) : 0}%
                </td>
              </tr>
              <tr style={{ backgroundColor: "#f8fafc", fontWeight: "900" }}>
                <td style={{ padding: "3mm", border: "1px solid #e2e8f0" }}>RESULTADO OPERACIONAL</td>
                <td style={{ padding: "3mm", border: "1px solid #e2e8f0", textAlign: "right" }}>{fmt(simulation.base.resultado)}</td>
                <td style={{ padding: "3mm", border: "1px solid #e2e8f0", textAlign: "right" }}>{fmt(simulation.projected.resultado)}</td>
                <td style={{ padding: "3mm", border: "1px solid #e2e8f0", textAlign: "right", color: "#10b981" }}>
                  +{fmt(simulation.deltaResultado)}
                </td>
              </tr>
            </tbody>
          </table>
          <div style={{ marginTop: "6mm", backgroundColor: "#ecfdf5", border: "1px solid #10b981", padding: "5mm", borderRadius: "4mm", textAlign: "center" }}>
            <p style={{ margin: 0, fontSize: "14px", fontWeight: "bold", color: "#065f46" }}>
              GANHO DE LUCRATIVIDADE ACUMULADA (6 MESES): <span style={{ fontSize: "20px" }}>{fmt(simulation.geracaoCaixaAdicional)}</span>
            </p>
          </div>
        </div>
      )}

      {/* Footer */}
      <div style={{ position: "absolute", bottom: "20mm", left: "20mm", right: "20mm", borderTop: "1px solid #e2e8f0", paddingTop: "5mm", textAlign: "center" }}>
        <p style={{ margin: 0, fontSize: "9px", color: "#94a3b8", fontWeight: "bold" }}>
          Documento gerado sob premissas de auditoria lógica contábil. Exclusivo para análise de M&A e Governança.
        </p>
      </div>
    </div>
  );
});

ExecutiveReportTemplate.displayName = "ExecutiveReportTemplate";

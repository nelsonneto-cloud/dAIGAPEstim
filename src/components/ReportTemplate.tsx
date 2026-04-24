import React from 'react';
import { EstimationItem, ProjectInfo } from '../types';
import ReactMarkdown from 'react-markdown';

interface ReportTemplateProps {
  projectInfo: ProjectInfo;
  items: EstimationItem[];
  aiAnalysis: Record<string, string>;
  totalHours: number;
}

const formatDate = (dateString: string) => {
  if (!dateString) return new Date().toLocaleDateString('pt-BR');
  try {
    const d = new Date(dateString);
    d.setMinutes(d.getMinutes() + d.getTimezoneOffset());
    return d.toLocaleDateString('pt-BR');
  } catch (e) {
    return dateString;
  }
};

const COMPLEXITY_COLORS: Record<string, string> = {
  PP: '#16a34a',
  P:  '#65a30d',
  M:  '#ca8a04',
  G:  '#ea580c',
  GG: '#dc2626',
};

export const ReportTemplate: React.FC<ReportTemplateProps> = ({
  projectInfo,
  items,
  aiAnalysis,
  totalHours,
}) => {
  const itemsWithAI   = items.filter(i => i.analiseIA);
  const itemsWithEF   = items.filter(i => i.especificacaoFuncional);
  const itemsWithET   = items.filter(i => i.especificacaoTecnica);

  return (
    <div id="pdf-report-content" className="bg-[#ffffff] text-[#1f2937] w-[190mm] mx-auto font-sans">

      {/* ── CAPA ── */}
      <div className="pdf-page break-after-page flex flex-col min-h-[250mm] justify-center">
        <div className="flex-1 flex flex-col justify-center">
          <div className="w-[150px] h-[40px] bg-delaware-teal mb-10 pl-4 py-2 flex items-center">
            <span className="text-white font-bold text-xl tracking-wider">delaware</span>
          </div>
          <div className="border-l-4 border-delaware-red pl-6 mb-8 mt-10">
            <h1 className="text-4xl font-bold text-delaware-gray mb-2">Estimativa GAPs</h1>
            <h2 className="text-2xl text-delaware-teal">Resumo de Atividades e Mapeamento Integrado</h2>
          </div>
          <div className="mt-20 space-y-4 text-[#4b5563]">
            {[
              ['Projeto / Cliente', projectInfo.nome || 'Não definido'],
              ['Gerente / Autor',   projectInfo.gerente || 'Não definido'],
              ['Data da Geração',   formatDate(projectInfo.data)],
              ['Versão',            '1.0'],
            ].map(([label, value]) => (
              <div key={label} className="grid grid-cols-3 border-b border-[#e5e7eb] pb-2">
                <span className="font-semibold text-[#6b7280]">{label}:</span>
                <span className="col-span-2 font-bold text-[#1f2937]">{value}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="text-center text-xs text-[#9ca3af] border-t border-[#f3f4f6] pt-4 mt-auto">
          Este documento contém estimativas e análises geradas por Inteligência Artificial e revisões especializadas.
        </div>
      </div>

      {/* ── RESUMO EXECUTIVO ── */}
      <div className="pdf-page break-after-page pt-6">
        <h2 className="text-2xl font-bold text-delaware-gray mb-6 border-b-2 border-delaware-teal pb-2">
          1. Resumo Executivo
        </h2>

        {/* KPI cards */}
        <div className="grid grid-cols-4 gap-3 mb-8">
          {[
            ['GAPs Identificados', items.length, 'text-delaware-teal'],
            ['Total de Horas',     `${totalHours.toFixed(1)} h`, 'text-delaware-red'],
            ['Esforço Funcional',  `${items.reduce((s,i)=>s+i.esforcoFuncional+i.documentacao,0).toFixed(1)} h`, 'text-[#374151]'],
            ['Esforço Técnico',    `${items.reduce((s,i)=>s+i.esforcoDev+i.testesUnitarios+i.testesIntegrados+i.deploy,0).toFixed(1)} h`, 'text-[#374151]'],
          ].map(([label, value, color]) => (
            <div key={label as string} className="bg-[#f9fafb] p-3 rounded-lg border border-[#e5e7eb] text-center">
              <div className="text-[10px] text-[#6b7280] uppercase mb-1">{label}</div>
              <div className={`text-2xl font-bold ${color}`}>{value}</div>
            </div>
          ))}
        </div>

        {/* Consolidated list */}
        <h3 className="text-base font-bold text-delaware-gray mb-3">1.1 Lista Consolidada de GAPs</h3>
        <table className="w-full text-left border border-[#e5e7eb]" style={{ fontSize: '9px' }}>
          <thead>
            <tr className="bg-delaware-teal text-white">
              <th className="p-1.5 border border-[#e5e7eb]">#</th>
              <th className="p-1.5 border border-[#e5e7eb]">Scope</th>
              <th className="p-1.5 border border-[#e5e7eb]">Título</th>
              <th className="p-1.5 border border-[#e5e7eb] text-center">Tipo</th>
              <th className="p-1.5 border border-[#e5e7eb] text-center">Cx</th>
              <th className="p-1.5 border border-[#e5e7eb] text-center">Dev</th>
              <th className="p-1.5 border border-[#e5e7eb] text-center">Func</th>
              <th className="p-1.5 border border-[#e5e7eb] text-center">Total (h)</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => (
              <tr key={item.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-[#f9fafb]'}>
                <td className="p-1.5 border border-[#e5e7eb] text-center text-[#9ca3af]">{idx + 1}</td>
                <td className="p-1.5 border border-[#e5e7eb] font-medium whitespace-nowrap">{item.scopeItem}</td>
                <td className="p-1.5 border border-[#e5e7eb]" style={{ maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {item.titulo || item.descricao.substring(0, 45)}
                </td>
                <td className="p-1.5 border border-[#e5e7eb] text-center whitespace-nowrap">{item.tipoSolicitacao}</td>
                <td className="p-1.5 border border-[#e5e7eb] text-center font-bold" style={{ color: COMPLEXITY_COLORS[item.complexidade] }}>
                  {item.complexidade}
                </td>
                <td className="p-1.5 border border-[#e5e7eb] text-center">{(item.esforcoDev + item.testesUnitarios).toFixed(1)}</td>
                <td className="p-1.5 border border-[#e5e7eb] text-center">{(item.esforcoFuncional + item.documentacao).toFixed(1)}</td>
                <td className="p-1.5 border border-[#e5e7eb] text-center font-bold text-delaware-red">{item.total.toFixed(1)}</td>
              </tr>
            ))}
            <tr className="bg-[#e5e7eb] font-bold">
              <td colSpan={7} className="p-1.5 border border-[#e5e7eb] text-right pr-3">TOTAL</td>
              <td className="p-1.5 border border-[#e5e7eb] text-center text-delaware-red">{totalHours.toFixed(1)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* ── ANÁLISES DE IA ── */}
      {itemsWithAI.length > 0 && (
        <div className="pdf-page pt-6">
          <h2 className="text-2xl font-bold text-delaware-gray mb-6 border-b-2 border-delaware-teal pb-2">
            2. Análises de Conformidade (Clean Core &amp; IA)
          </h2>

          {itemsWithAI.map((item) => (
            <div key={item.id} className="mb-4 p-3 border border-[#e5e7eb] rounded-lg bg-white">
              {/* Header */}
              <div className="flex justify-between items-center mb-2 pb-1 border-b border-[#f3f4f6]">
                <div className="flex items-center gap-2">
                  <span className="text-delaware-teal font-bold text-xs">{item.scopeItem}</span>
                  <span className="text-[#1f2937] font-semibold text-xs">{item.titulo || 'GAP Mapeado'}</span>
                </div>
                <div className="flex items-center gap-3 text-[10px]">
                  {item.aiSugestaoHoras !== undefined && (
                    <span className="text-[#6b7280]">
                      IA: <span className="font-bold text-delaware-red">{item.aiSugestaoHoras.toFixed(1)}h</span>
                      {item.ajusteConfirmado && <span className="ml-1 text-green-600">✓</span>}
                    </span>
                  )}
                  <span className="bg-[#f3f4f6] px-2 py-0.5 rounded">
                    Total: <span className="font-bold text-delaware-red">{item.total.toFixed(1)}h</span>
                  </span>
                </div>
              </div>

              {/* Análise IA */}
              <div className="prose prose-xs max-w-none text-[#374151]" style={{ fontSize: '10px', lineHeight: '1.5' }}>
                <ReactMarkdown>{item.analiseIA || ''}</ReactMarkdown>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── ESPECIFICAÇÕES FUNCIONAIS ── */}
      {itemsWithEF.map((item) => (
        <div key={`ef-${item.id}`} className="pdf-page break-before-page pt-6">
          <h2 className="text-xl font-bold text-delaware-gray mb-4 border-b-2 border-delaware-teal pb-2">
            Especificação Funcional — {item.scopeItem}
          </h2>
          <p className="text-sm font-semibold text-[#4b5563] mb-4">{item.titulo || item.descricao.substring(0, 80)}</p>
          <div className="prose prose-sm max-w-none text-[#374151]">
            <ReactMarkdown>{item.especificacaoFuncional || ''}</ReactMarkdown>
          </div>
        </div>
      ))}

      {/* ── ESPECIFICAÇÕES TÉCNICAS ── */}
      {itemsWithET.map((item) => (
        <div key={`et-${item.id}`} className="pdf-page break-before-page pt-6">
          <h2 className="text-xl font-bold text-delaware-gray mb-4 border-b-2 border-delaware-red pb-2">
            Especificação Técnica — {item.scopeItem}
          </h2>
          <p className="text-sm font-semibold text-[#4b5563] mb-4">{item.titulo || item.descricao.substring(0, 80)}</p>
          <div className="prose prose-sm max-w-none text-[#374151]">
            <ReactMarkdown>{item.especificacaoTecnica || ''}</ReactMarkdown>
          </div>
        </div>
      ))}

      {/* Placeholder when no AI data */}
      {itemsWithAI.length === 0 && itemsWithEF.length === 0 && itemsWithET.length === 0 && (
        <div className="pdf-page pt-6">
          <div className="text-center p-8 bg-[#f9fafb] text-[#6b7280] rounded border border-[#e5e7eb]">
            Clique em "Analisar com IA" no sistema antes de gerar o PDF para preencher esta seção.
          </div>
        </div>
      )}
    </div>
  );
};

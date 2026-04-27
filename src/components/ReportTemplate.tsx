import React from 'react';
import { EstimationItem, ProjectInfo } from '../types';

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
  } catch {
    return dateString;
  }
};

const stripMd = (text: string, maxLen = 350) =>
  (text || '')
    .replace(/#{1,6}\s+/g, '')
    .replace(/\*{1,2}([^*]+)\*{1,2}/g, '$1')
    .replace(/`[^`]+`/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\n+/g, ' ')
    .trim()
    .slice(0, maxLen) + ((text || '').length > maxLen ? '…' : '');

const CX_COLOR: Record<string, string> = {
  PP: '#16a34a', P: '#65a30d', M: '#ca8a04', G: '#ea580c', GG: '#dc2626',
};

export const ReportTemplate: React.FC<ReportTemplateProps> = ({
  projectInfo, items, totalHours,
}) => {
  const funcTotal = items.reduce((s, i) => s + i.esforcoFuncional + i.documentacao, 0);
  const techTotal = items.reduce((s, i) => s + i.esforcoDev + i.testesUnitarios + i.testesIntegrados + i.deploy, 0);
  const withAI    = items.filter(i => i.analiseIA && !i.analiseIA.startsWith('Erro'));

  return (
    <div id="pdf-report-content" style={{ background: '#fff', color: '#1f2937', width: '190mm', margin: '0 auto', fontFamily: 'Arial, sans-serif', fontSize: '11px' }}>

      {/* ── CAPA ── */}
      <div style={{ minHeight: '250mm', display: 'flex', flexDirection: 'column', justifyContent: 'center', pageBreakAfter: 'always' }}>
        <div style={{ width: 150, height: 40, background: '#0d7a79', marginBottom: 40, padding: '8px 16px', display: 'flex', alignItems: 'center' }}>
          <span style={{ color: '#fff', fontWeight: 'bold', fontSize: 20, letterSpacing: 2 }}>delaware</span>
        </div>
        <div style={{ borderLeft: '4px solid #e03434', paddingLeft: 24, marginBottom: 32, marginTop: 40 }}>
          <h1 style={{ fontSize: 32, fontWeight: 'bold', color: '#374151', margin: '0 0 8px' }}>Estimativa GAPs</h1>
          <h2 style={{ fontSize: 20, color: '#0d7a79', margin: 0 }}>Resumo de Atividades e Mapeamento Integrado</h2>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 32 }}>
          {[
            ['Projeto / Cliente', projectInfo.nome || 'Não definido'],
            ['Gerente / Autor',   projectInfo.gerente || 'Não definido'],
            ['Data da Geração',   formatDate(projectInfo.data)],
            ['Versão',            '1.0'],
          ].map(([label, val]) => (
            <tr key={label} style={{ borderBottom: '1px solid #e5e7eb' }}>
              <td style={{ padding: '6px 0', color: '#6b7280', width: '35%' }}>{label}:</td>
              <td style={{ padding: '6px 0', fontWeight: 'bold' }}>{val}</td>
            </tr>
          ))}
        </table>
        <div style={{ marginTop: 'auto', paddingTop: 16, borderTop: '1px solid #f3f4f6', textAlign: 'center', color: '#9ca3af', fontSize: 9 }}>
          Este documento contém estimativas e análises geradas por Inteligência Artificial e revisões especializadas.
        </div>
      </div>

      {/* ── RESUMO EXECUTIVO ── */}
      <div style={{ paddingTop: 24, pageBreakAfter: 'always' }}>
        <h2 style={{ fontSize: 18, fontWeight: 'bold', color: '#374151', borderBottom: '2px solid #0d7a79', paddingBottom: 8, marginBottom: 24 }}>
          1. Resumo Executivo
        </h2>

        {/* KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12, marginBottom: 32 }}>
          {[
            ['GAPs Identificados', String(items.length),     '#0d7a79'],
            ['Total de Horas',     `${totalHours.toFixed(1)} h`, '#e03434'],
            ['Esforço Funcional',  `${funcTotal.toFixed(1)} h`,  '#374151'],
            ['Esforço Técnico',    `${techTotal.toFixed(1)} h`,  '#374151'],
          ].map(([label, value, color]) => (
            <div key={label} style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: 12, textAlign: 'center' }}>
              <div style={{ fontSize: 9, color: '#6b7280', textTransform: 'uppercase', marginBottom: 4 }}>{label}</div>
              <div style={{ fontSize: 20, fontWeight: 'bold', color }}>{value}</div>
            </div>
          ))}
        </div>

        {/* Tabela consolidada */}
        <h3 style={{ fontSize: 13, fontWeight: 'bold', color: '#374151', marginBottom: 12 }}>1.1 Lista Consolidada de GAPs</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 8 }}>
          <thead>
            <tr style={{ background: '#0d7a79', color: '#fff' }}>
              {['#', 'Scope', 'Título', 'Tipo', 'Complexidade', 'DEV+Testes', 'Func+Doc', 'Total (h)'].map(h => (
                <th key={h} style={{ padding: '5px 4px', border: '1px solid #e5e7eb', textAlign: h === '#' || h.includes('h)') || h === 'Total (h)' ? 'center' : 'left' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => (
              <tr key={item.id} style={{ background: idx % 2 === 0 ? '#fff' : '#f9fafb', pageBreakInside: 'avoid' }}>
                <td style={{ padding: '4px', border: '1px solid #e5e7eb', textAlign: 'center', color: '#9ca3af' }}>{idx + 1}</td>
                <td style={{ padding: '4px', border: '1px solid #e5e7eb', whiteSpace: 'nowrap', fontWeight: 500 }}>{item.scopeItem}</td>
                <td style={{ padding: '4px', border: '1px solid #e5e7eb', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {item.titulo || item.descricao.substring(0, 45)}
                </td>
                <td style={{ padding: '4px', border: '1px solid #e5e7eb', whiteSpace: 'nowrap' }}>{item.tipoSolicitacao}</td>
                <td style={{ padding: '4px', border: '1px solid #e5e7eb', textAlign: 'center', fontWeight: 'bold', color: CX_COLOR[item.complexidade] }}>{item.complexidade}</td>
                <td style={{ padding: '4px', border: '1px solid #e5e7eb', textAlign: 'center' }}>{(item.esforcoDev + item.testesUnitarios).toFixed(1)}</td>
                <td style={{ padding: '4px', border: '1px solid #e5e7eb', textAlign: 'center' }}>{(item.esforcoFuncional + item.documentacao).toFixed(1)}</td>
                <td style={{ padding: '4px', border: '1px solid #e5e7eb', textAlign: 'center', fontWeight: 'bold', color: '#e03434' }}>{item.total.toFixed(1)}</td>
              </tr>
            ))}
            <tr style={{ background: '#e5e7eb', fontWeight: 'bold' }}>
              <td colSpan={7} style={{ padding: '5px 4px', border: '1px solid #d1d5db', textAlign: 'right', paddingRight: 8 }}>TOTAL</td>
              <td style={{ padding: '5px 4px', border: '1px solid #d1d5db', textAlign: 'center', color: '#e03434' }}>{totalHours.toFixed(1)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* ── ANÁLISES IA ── somente se houver */}
      {withAI.length > 0 && (
        <div style={{ paddingTop: 24, pageBreakBefore: 'always' }}>
          <h2 style={{ fontSize: 18, fontWeight: 'bold', color: '#374151', borderBottom: '2px solid #0d7a79', paddingBottom: 8, marginBottom: 20 }}>
            2. Análises de Conformidade Clean Core (IA)
          </h2>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 8 }}>
            <thead>
              <tr style={{ background: '#0d7a79', color: '#fff' }}>
                {['Scope', 'Título', 'Cx', 'Sugestão IA (h)', 'Análise Resumida'].map(h => (
                  <th key={h} style={{ padding: '5px 4px', border: '1px solid #e5e7eb', textAlign: 'left' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {withAI.map((item, idx) => (
                <tr key={item.id} style={{ background: idx % 2 === 0 ? '#fff' : '#f9fafb', verticalAlign: 'top', pageBreakInside: 'avoid' }}>
                  <td style={{ padding: '4px', border: '1px solid #e5e7eb', whiteSpace: 'nowrap', fontWeight: 500 }}>{item.scopeItem}</td>
                  <td style={{ padding: '4px', border: '1px solid #e5e7eb', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.titulo || item.descricao.substring(0, 35)}
                  </td>
                  <td style={{ padding: '4px', border: '1px solid #e5e7eb', textAlign: 'center', fontWeight: 'bold', color: CX_COLOR[item.complexidade] }}>{item.complexidade}</td>
                  <td style={{ padding: '4px', border: '1px solid #e5e7eb', textAlign: 'center', color: '#e03434', fontWeight: 'bold' }}>
                    {item.aiSugestaoHoras !== undefined ? item.aiSugestaoHoras.toFixed(1) : '-'}
                    {item.ajusteConfirmado && <span style={{ color: '#16a34a', marginLeft: 4 }}>✓</span>}
                  </td>
                  <td style={{ padding: '4px', border: '1px solid #e5e7eb', color: '#374151', maxWidth: 260 }}>
                    {stripMd(item.analiseIA || '')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ marginTop: 16, padding: 12, background: '#f0f9f9', border: '1px solid #a7f3d0', borderRadius: 6, fontSize: 9, color: '#065f46' }}>
            <strong>Nota:</strong> As Especificações Funcionais (EF) e Técnicas (ET) geradas estão disponíveis no sistema para consulta e edição individual.
            Para exportar specs específicas, acesse o item e clique no ícone de documento.
          </div>
        </div>
      )}
    </div>
  );
};

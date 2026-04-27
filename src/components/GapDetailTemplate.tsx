import React from 'react';
import { EstimationItem, ProjectInfo } from '../types';

interface Props {
  item: EstimationItem;
  projectInfo: ProjectInfo;
}

const CX_COLOR: Record<string, string> = {
  PP: '#16a34a', P: '#65a30d', M: '#ca8a04', G: '#ea580c', GG: '#dc2626',
};

const PARAM_LABELS: Record<string, string> = {
  tabelasAcessadas: 'Tabelas acessadas',
  tabelasAcessoSimples: 'Tabelas acesso simples',
  tabelasCriadas: 'Tabelas criadas',
  camposCriados: 'Campos criados',
  indicesCriados: 'Índices criados',
  sm30Criado: 'SM30 criado',
  dbLogico: 'BD Lógico',
  arquivosExternos: 'Arquivos externos',
  umaSelecaoRetornaTodas: 'Seleção retorna tudo',
  algumRelacionamento: 'Relacionamento M:N',
  infoLegado: 'Info do Legado',
  usaWrite: 'Usa WRITE',
  usaALV: 'Usa ALV',
  niveisDrillDown: 'Níveis Drill-down',
  layoutsDinamicos: 'Layouts dinâmicos',
  layoutsDrillDown: 'Layouts Drill-down',
  campos: 'Nº de campos',
  camposConversao: 'Campos Data Convers.',
  camposCalculo: 'Campos Data Calc.',
  camposValidacao: 'Campos Data Val.',
  rotinasExternas: 'Rotinas Externas',
  funcaoSimulacao: 'Função simulação',
  subscreens: 'Sub-screens',
  copiaProgramaStd: 'Cópia programa std',
  batchInput: 'Sessões BI',
  criacaoArquivoExterno: 'Cria Arquivo Externo',
};

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

function renderInline(text: string): React.ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`)/).map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return <span key={i} style={{ fontFamily: 'monospace', background: '#f3f4f6', padding: '1px 3px', borderRadius: 2, fontSize: '0.9em' }}>{part.slice(1, -1)}</span>;
    }
    return <span key={i}>{part}</span>;
  });
}

function MdLine({ line }: { line: string }) {
  if (!line.trim()) return <div style={{ height: 5 }} />;
  const hMatch = line.match(/^(#{1,4})\s+(.+)/);
  if (hMatch) {
    const level = hMatch[1].length;
    const sizes = [15, 13, 11, 10];
    return (
      <div style={{ fontWeight: 'bold', fontSize: sizes[Math.min(level - 1, 3)], color: '#0d7a79', marginTop: 10, marginBottom: 4 }}>
        {hMatch[2]}
      </div>
    );
  }
  if (/^[-*]\s/.test(line)) {
    return <div style={{ paddingLeft: 14, marginBottom: 2 }}>• {renderInline(line.replace(/^[-*]\s/, ''))}</div>;
  }
  if (/^\d+\.\s/.test(line)) {
    return <div style={{ paddingLeft: 14, marginBottom: 2 }}>{renderInline(line)}</div>;
  }
  if (line.trim().startsWith('---')) {
    return <hr style={{ border: 'none', borderTop: '1px solid #e5e7eb', margin: '8px 0' }} />;
  }
  return <div style={{ marginBottom: 2, lineHeight: 1.5 }}>{renderInline(line)}</div>;
}

function MarkdownBlock({ text }: { text: string }) {
  return <>{text.split('\n').map((line, i) => <MdLine key={i} line={line} />)}</>;
}

const labelTd: React.CSSProperties = {
  padding: '4px 8px', background: '#f9fafb', color: '#6b7280', fontWeight: 600,
  border: '1px solid #e5e7eb', whiteSpace: 'nowrap', fontSize: 9,
};
const valTd: React.CSSProperties = {
  padding: '4px 8px', border: '1px solid #e5e7eb', fontSize: 10,
};
const numTd: React.CSSProperties = {
  padding: '4px 6px', border: '1px solid #e5e7eb', textAlign: 'center',
};

export const GapDetailTemplate: React.FC<Props> = ({ item, projectInfo }) => {
  const hasAI = !!(item.analiseIA && !item.analiseIA.startsWith('Erro') && !item.analiseIA.startsWith('Não foi possível'));
  const hasRisk = item.riscoFsIncompleta || item.riscoTecnologiaNova || item.riscoDependenciaTerceiros;
  const hasNonCoded = (item.horasFSReview || 0) + (item.horasSuporteTMS || 0) + (item.horasSuporteUAT || 0) > 0;

  return (
    <div id="gap-pdf-content" style={{ background: '#fff', color: '#1f2937', width: '190mm', margin: '0 auto', fontFamily: 'Arial, sans-serif', fontSize: '10px' }}>

      {/* Header */}
      <div style={{ background: '#0d7a79', color: '#fff', padding: '10px 16px', marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontWeight: 'bold', fontSize: 14, letterSpacing: 1 }}>delaware</div>
          <div style={{ fontSize: 9, opacity: 0.8, marginTop: 2 }}>Estimativa GAPs — {projectInfo.nome || 'Projeto'}</div>
        </div>
        <div style={{ textAlign: 'right', fontSize: 9, opacity: 0.85 }}>
          <div>{projectInfo.gerente}</div>
          <div>{formatDate(projectInfo.data)}</div>
        </div>
      </div>

      {/* GAP Title */}
      <div style={{ borderLeft: '4px solid #e03434', paddingLeft: 12, marginBottom: 14 }}>
        <div style={{ fontWeight: 'bold', fontSize: 16, color: '#374151' }}>{item.titulo || item.scopeItem}</div>
        <div style={{ color: '#6b7280', fontSize: 9, marginTop: 3 }}>Scope Item: {item.scopeItem}</div>
      </div>

      {/* Info table */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 14 }}>
        <tbody>
          <tr>
            <td style={labelTd}>Tipo Solicitação</td>
            <td style={valTd}>{item.tipoSolicitacao}</td>
            <td style={labelTd}>Novo/Existente</td>
            <td style={valTd}>{item.novoOuExistente}</td>
            <td style={labelTd}>Complexidade</td>
            <td style={{ ...valTd, fontWeight: 'bold', color: CX_COLOR[item.complexidade] }}>{item.complexidade}</td>
          </tr>
          <tr>
            <td style={labelTd}>Tecnologia</td>
            <td style={valTd}>{item.tecnologia}</td>
            <td style={labelTd}>Funcional</td>
            <td style={valTd}>{item.funcional}</td>
            <td style={labelTd}>Severidade</td>
            <td style={valTd}>{item.severidade}</td>
          </tr>
          {item.observacao ? (
            <tr>
              <td style={labelTd}>Observação</td>
              <td colSpan={5} style={valTd}>{item.observacao}</td>
            </tr>
          ) : null}
        </tbody>
      </table>

      {/* Description */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontWeight: 'bold', fontSize: 11, color: '#374151', borderBottom: '1px solid #e5e7eb', paddingBottom: 4, marginBottom: 6 }}>Descrição</div>
        <div style={{ lineHeight: 1.5, color: '#374151', whiteSpace: 'pre-wrap', fontSize: 10 }}>{item.descricao}</div>
      </div>

      {/* Effort breakdown */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontWeight: 'bold', fontSize: 11, color: '#374151', borderBottom: '1px solid #e5e7eb', paddingBottom: 4, marginBottom: 6 }}>Estimativa de Esforço</div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 9 }}>
          <thead>
            <tr style={{ background: '#0d7a79', color: '#fff' }}>
              {['Dev (h)', 'Testes Unit. (h)', 'Testes Integ. (h)', 'Esf. Funcional (h)', 'Documentação (h)', 'Deploy (h)', 'TOTAL (h)'].map(h => (
                <th key={h} style={{ padding: '4px 5px', border: '1px solid #e5e7eb', textAlign: 'center' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={numTd}>{item.esforcoDev.toFixed(1)}</td>
              <td style={numTd}>{item.testesUnitarios.toFixed(1)}</td>
              <td style={numTd}>{item.testesIntegrados.toFixed(1)}</td>
              <td style={numTd}>{item.esforcoFuncional.toFixed(1)}</td>
              <td style={numTd}>{item.documentacao.toFixed(1)}</td>
              <td style={numTd}>{item.deploy.toFixed(1)}</td>
              <td style={{ ...numTd, fontWeight: 'bold', color: '#e03434', background: '#fef2f2' }}>{item.total.toFixed(1)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Risk + Non-coded (side by side when both exist) */}
      {(hasRisk || hasNonCoded) && (
        <div style={{ display: 'grid', gridTemplateColumns: hasRisk && hasNonCoded ? '1fr 1fr' : '1fr', gap: 10, marginBottom: 14 }}>
          {hasRisk && (
            <div style={{ border: '1px solid #fee2e2', borderRadius: 6, padding: 10, fontSize: 9 }}>
              <div style={{ fontWeight: 'bold', color: '#e03434', marginBottom: 5 }}>FATORES DE RISCO</div>
              {item.riscoFsIncompleta && <div style={{ marginBottom: 2 }}>✓ Especificação Funcional Incompleta (+20%)</div>}
              {item.riscoTecnologiaNova && <div style={{ marginBottom: 2 }}>✓ Tecnologia Nova para o Time (+30%)</div>}
              {item.riscoDependenciaTerceiros && <div style={{ marginBottom: 2 }}>✓ Dependência de Terceiros/Middleware (+10h)</div>}
            </div>
          )}
          {hasNonCoded && (
            <div style={{ border: '1px solid #e0f2fe', borderRadius: 6, padding: 10, fontSize: 9 }}>
              <div style={{ fontWeight: 'bold', color: '#0369a1', marginBottom: 5 }}>FASES NÃO-CODIFICAÇÃO (h)</div>
              <div>Review de FS (Qualidade): {item.horasFSReview || 0}</div>
              <div>Suporte TMS / Transport Key: {item.horasSuporteTMS || 0}</div>
              <div>Suporte ao UAT / Hypercare: {item.horasSuporteUAT || 0}</div>
            </div>
          )}
        </div>
      )}

      {/* Complexity Card */}
      {item.complexityParams && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontWeight: 'bold', fontSize: 11, color: '#374151', borderBottom: '1px solid #e5e7eb', paddingBottom: 4, marginBottom: 6 }}>
            Ficha de Complexidade (IA)
            {item.complexityScore !== undefined && (
              <span style={{ marginLeft: 10, color: '#0d7a79' }}>Score: {item.complexityScore.toFixed(2)} pts</span>
            )}
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 9 }}>
            <thead>
              <tr style={{ background: '#f3f4f6' }}>
                <th style={{ padding: '3px 6px', border: '1px solid #e5e7eb', textAlign: 'left', width: '60%' }}>Parâmetro</th>
                <th style={{ padding: '3px 6px', border: '1px solid #e5e7eb', textAlign: 'center' }}>Valor</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(item.complexityParams).map(([key, val], i) => (
                <tr key={key} style={{ background: i % 2 === 0 ? '#fff' : '#f9fafb', pageBreakInside: 'avoid' }}>
                  <td style={{ padding: '3px 6px', border: '1px solid #e5e7eb' }}>{PARAM_LABELS[key] || key}</td>
                  <td style={{ padding: '3px 6px', border: '1px solid #e5e7eb', textAlign: 'center', fontWeight: typeof val === 'boolean' ? 'normal' : 'bold' }}>
                    {typeof val === 'boolean' ? (val ? 'Sim' : 'Não') : String(val)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* AI Analysis */}
      {hasAI && (
        <div style={{ marginBottom: 14, pageBreakBefore: 'auto' }}>
          <div style={{ fontWeight: 'bold', fontSize: 11, color: '#374151', borderBottom: '2px solid #0d7a79', paddingBottom: 4, marginBottom: 8 }}>
            Análise de IA — Clean Core Compliance
            {item.aiSugestaoHoras !== undefined && (
              <span style={{ marginLeft: 10, color: '#e03434', fontWeight: 'bold' }}>
                Sugestão IA: {item.aiSugestaoHoras.toFixed(1)} h
                {item.ajusteConfirmado && <span style={{ color: '#16a34a', marginLeft: 6 }}>✓ Confirmado</span>}
              </span>
            )}
          </div>
          <div style={{ background: '#f0f9f9', border: '1px solid #a7f3d0', borderRadius: 6, padding: 10, fontSize: 9 }}>
            <MarkdownBlock text={item.analiseIA!} />
          </div>
        </div>
      )}

      {/* EF */}
      {item.especificacaoFuncional && (
        <div style={{ marginBottom: 14, pageBreakBefore: 'always' }}>
          <div style={{ fontWeight: 'bold', fontSize: 13, color: '#374151', borderBottom: '2px solid #0d7a79', paddingBottom: 4, marginBottom: 10 }}>
            Especificação Funcional (EF)
          </div>
          <div style={{ fontSize: 10, lineHeight: 1.5 }}>
            <MarkdownBlock text={item.especificacaoFuncional} />
          </div>
        </div>
      )}

      {/* ET */}
      {item.especificacaoTecnica && (
        <div style={{ marginBottom: 14, pageBreakBefore: 'always' }}>
          <div style={{ fontWeight: 'bold', fontSize: 13, color: '#374151', borderBottom: '2px solid #0d7a79', paddingBottom: 4, marginBottom: 10 }}>
            Especificação Técnica (ET)
          </div>
          <div style={{ fontSize: 10, lineHeight: 1.5 }}>
            <MarkdownBlock text={item.especificacaoTecnica} />
          </div>
        </div>
      )}

      {/* Footer */}
      <div style={{ marginTop: 20, paddingTop: 8, borderTop: '1px solid #f3f4f6', textAlign: 'center', color: '#9ca3af', fontSize: 8 }}>
        dAIGAPEstim | {projectInfo.nome} | {formatDate(projectInfo.data)}
      </div>
    </div>
  );
};

import React from 'react';
import { EstimationItem, ProjectInfo } from '../types';
import ReactMarkdown from 'react-markdown';

interface ReportTemplateProps {
  projectInfo: ProjectInfo;
  items: EstimationItem[];
  aiAnalysis: Record<string, string>;
  totalHours: number;
}

// Data formatada para DD/MM/AAAA
const formatDate = (dateString: string) => {
  if (!dateString) return new Date().toLocaleDateString('pt-BR');
  try {
    const defaultDate = new Date(dateString);
    // Adiciona o timezone offset para nao cair pra o dia anterior
    defaultDate.setMinutes(defaultDate.getMinutes() + defaultDate.getTimezoneOffset());
    return defaultDate.toLocaleDateString('pt-BR');
  } catch (e) {
    return dateString;
  }
};

export const ReportTemplate: React.FC<ReportTemplateProps> = ({ 
  projectInfo, 
  items, 
  aiAnalysis,
  totalHours 
}) => {
  return (
    <div id="pdf-report-content" className="bg-[#ffffff] text-[#1f2937] w-[190mm] mx-auto">
      
      {/* CAPA - PADRÃO DELAWARE */}
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
            <div className="grid grid-cols-3 border-b border-[#e5e7eb] pb-2">
              <span className="font-semibold text-[#6b7280]">Projeto / Cliente:</span>
              <span className="col-span-2 font-bold text-[#1f2937]">{projectInfo.nome || 'Não definido'}</span>
            </div>
            <div className="grid grid-cols-3 border-b border-[#e5e7eb] pb-2">
              <span className="font-semibold text-[#6b7280]">Gerente / Autor:</span>
              <span className="col-span-2 font-bold text-[#1f2937]">{projectInfo.gerente || 'Não definido'}</span>
            </div>
            <div className="grid grid-cols-3 border-b border-[#e5e7eb] pb-2">
              <span className="font-semibold text-[#6b7280]">Data da Geração:</span>
              <span className="col-span-2">{formatDate(projectInfo.data)}</span>
            </div>
            <div className="grid grid-cols-3 border-b border-[#e5e7eb] pb-2">
              <span className="font-semibold text-[#6b7280]">Versão:</span>
              <span className="col-span-2">1.0</span>
            </div>
          </div>
        </div>
        
        <div className="text-center text-xs text-[#9ca3af] border-t border-[#f3f4f6] pt-4 mt-auto">
          Este documento contém estimativas e análises geradas por Inteligência Artificial e revisões especializadas.
        </div>
      </div>

      {/* PÁGINA 2 - DASHBOARD RESUMO */}
      <div className="pdf-page break-after-page">
        <h2 className="text-2xl font-bold text-delaware-gray mb-6 border-b-2 border-delaware-teal pb-2">1. Resumo Executivo</h2>
        
        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="bg-[#f9fafb] p-4 rounded-lg border border-[#e5e7eb]">
            <div className="text-sm text-[#6b7280] uppercase">Total GAPs Identificados</div>
            <div className="text-3xl font-bold text-delaware-teal">{items.length}</div>
          </div>
          <div className="bg-[#f9fafb] p-4 rounded-lg border border-[#e5e7eb]">
            <div className="text-sm text-[#6b7280] uppercase">Total Horas Estimadas</div>
            <div className="text-3xl font-bold text-delaware-red">{totalHours.toFixed(1)} h</div>
          </div>
          <div className="bg-[#f9fafb] p-4 rounded-lg border border-[#e5e7eb]">
            <div className="text-sm text-[#6b7280] uppercase">Esforço Funcional (Aprox)</div>
            <div className="text-xl font-bold text-[#374151]">
              {items.reduce((s, i) => s + i.esforcoFuncional + i.documentacao, 0).toFixed(1)} h
            </div>
          </div>
          <div className="bg-[#f9fafb] p-4 rounded-lg border border-[#e5e7eb]">
            <div className="text-sm text-[#6b7280] uppercase">Esforço Técnico (Aprox)</div>
            <div className="text-xl font-bold text-[#374151]">
              {items.reduce((s, i) => s + i.esforcoDev + i.testesUnitarios + i.testesIntegrados + i.deploy, 0).toFixed(1)} h
            </div>
          </div>
        </div>

        <h3 className="text-lg font-bold text-delaware-gray mt-8 mb-4">1.1 Lista Consolidada de GAPs</h3>
        <table className="w-full text-left text-xs border border-[#e5e7eb]">
          <thead>
            <tr className="bg-delaware-teal text-[#ffffff]">
              <th className="p-2 border border-[#e5e7eb]">Scope</th>
              <th className="p-2 border border-[#e5e7eb]">Descrição Curta</th>
              <th className="p-2 border border-[#e5e7eb] text-center">Tipo</th>
              <th className="p-2 border border-[#e5e7eb] text-center">Sev.</th>
              <th className="p-2 border border-[#e5e7eb] text-center">Funcional</th>
              <th className="p-2 border border-[#e5e7eb] text-center">Total (h)</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => (
              <tr key={idx} className={idx % 2 === 0 ? 'bg-[#ffffff]' : 'bg-[#f9fafb]'}>
                <td className="p-2 border border-[#e5e7eb] font-medium">{item.scopeItem}</td>
                <td className="p-2 border border-[#e5e7eb] truncate max-w-[200px]" title={item.titulo}>{item.titulo || item.descricao.substring(0, 40) + '...'}</td>
                <td className="p-2 border border-[#e5e7eb] text-center">{item.tipoSolicitacao}</td>
                <td className="p-2 border border-[#e5e7eb] text-center">{item.severidade}</td>
                <td className="p-2 border border-[#e5e7eb] text-center">{item.funcional}</td>
                <td className="p-2 border border-[#e5e7eb] text-center font-bold">{item.total.toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* PÁGINAS SEGUINTES - ANÁLISES DETALHADAS (AI) */}
      <div className="pdf-page">
        <h2 className="text-2xl font-bold text-delaware-gray mb-6 border-b-2 border-delaware-teal pb-2 mt-8">2. Análises de Conformidade (Clean Core & IA)</h2>
        
        {items.map((item, idx) => (
          <div key={item.id} className="mb-8 p-4 border border-[#e5e7eb] rounded-lg bg-[#ffffff] shadow-sm page-break-inside-avoid" style={{ breakInside: 'avoid-page' }}>
            <div className="flex justify-between items-start mb-4 border-b border-[#f3f4f6] pb-2">
              <div>
                <span className="text-delaware-teal font-bold text-sm mr-2">{item.scopeItem}</span>
                <span className="text-[#1f2937] font-bold">{item.titulo || 'GAP Mapeado'}</span>
              </div>
              <div className="text-xs bg-[#f3f4f6] text-[#4b5563] px-2 py-1 rounded">
                Total: <span className="font-bold text-delaware-red">{item.total.toFixed(1)}h</span>
              </div>
            </div>
            
            <div className="text-sm text-[#4b5563] mb-4 bg-[#f9fafb] p-2 rounded grid grid-cols-2 gap-4">
              <div>
                <span className="font-semibold block mb-1 text-xs uppercase text-gray-500">Descrição Original:</span>
                <p className="italic text-xs line-clamp-3">{item.descricao}</p>
              </div>
              <div className="border-l border-gray-200 pl-4">
                <span className="font-semibold block mb-1 text-xs uppercase text-gray-500">Estimativa Revisada (IA):</span>
                <p className="text-delaware-red font-bold">
                  {item.aiSugestaoHoras !== undefined ? `${item.aiSugestaoHoras.toFixed(1)}h` : 'N/A'}
                  {item.ajusteConfirmado && <span className="ml-2 text-green-600 text-[10px] whitespace-nowrap">✓ Confirmado pelo Usuário</span>}
                </p>
              </div>
            </div>
            
            <div className="mt-4 prose prose-sm max-w-none text-[#374151]">
              <strong className="text-delaware-teal text-sm block mb-2">Recomendação IA (Clean Core):</strong>
              {item.analiseIA ? (
                <ReactMarkdown>{item.analiseIA}</ReactMarkdown>
              ) : (
                <p className="text-[#9ca3af] italic text-xs">Análise de IA não gerada ou não disponível para este item.</p>
              )}
            </div>

            {item.especificacaoFuncional && (
              <div className="mt-6 border-t pt-4 border-[#f3f4f6]">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-2 h-2 bg-delaware-teal rounded-full" />
                  <strong className="text-delaware-gray text-sm uppercase tracking-wider">Especificação Funcional (Draft)</strong>
                </div>
                <div className="prose prose-sm max-w-none text-gray-700 bg-gray-50 p-4 rounded-lg border border-gray-100">
                  <ReactMarkdown>{item.especificacaoFuncional}</ReactMarkdown>
                </div>
              </div>
            )}

            {item.especificacaoTecnica && (
              <div className="mt-6 border-t pt-4 border-[#f3f4f6]">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-2 h-2 bg-delaware-red rounded-full" />
                  <strong className="text-delaware-gray text-sm uppercase tracking-wider">Especificação Técnica (Draft)</strong>
                </div>
                <div className="prose prose-sm max-w-none text-gray-700 bg-gray-50 p-4 rounded-lg border border-gray-100">
                  <ReactMarkdown>{item.especificacaoTecnica}</ReactMarkdown>
                </div>
              </div>
            )}

            {item.complexityParams && (
              <div className="mt-6 border-t pt-4 border-[#f3f4f6]">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-2 h-2 bg-[#3b82f6] rounded-full" />
                  <strong className="text-delaware-gray text-sm uppercase tracking-wider">Ficha de Complexidade (IA)</strong>
                  <span className="ml-auto font-bold text-delaware-teal">Score: {item.complexityScore?.toFixed(2)} pts</span>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[10px]">
                    {Object.entries({
                      tabelasAcessadas: "Tabelas acessadas",
                      tabelasAcessoSimples: "Tabelas acesso simples",
                      tabelasCriadas: "Tabelas criadas",
                      camposCriados: "Campos criados",
                      indicesCriados: "Indices criados",
                      sm30Criado: "SM30 criado",
                      dbLogico: "BD Lógico",
                      arquivosExternos: "Arquivos externos",
                      umaSelecaoRetornaTodas: "Seleção retorna tudo",
                      algumRelacionamento: "Relacionamento M:N",
                      infoLegado: "Info do Legado",
                      usaWrite: "Usa WRITE",
                      usaALV: "Usa ALV",
                      niveisDrillDown: "Níveis Drill-down",
                      layoutsDinamicos: "Layouts dinâmicos",
                      layoutsDrillDown: "Layouts Drill-down",
                      campos: "Nº de campos",
                      camposConversao: "Campos Data Convers.",
                      camposCalculo: "Campos Data Calc.",
                      camposValidacao: "Campos Data Val.",
                      rotinasExternas: "Rotinas Externas",
                      funcaoSimulacao: "Função simulação",
                      subscreens: "Sub-screens",
                      copiaProgramaStd: "Cópia programa std",
                      batchInput: "Sessões BI",
                      criacaoArquivoExterno: "Cria Arquivo Externo"
                    }).map(([key, label]) => {
                      const val = item.complexityParams?.[key as keyof typeof item.complexityParams];
                      if (val === 0 || val === false || val === undefined) return null;
                      return (
                        <div key={key} className="flex justify-between border-b border-gray-200 py-1">
                          <span className="text-gray-600 truncate mr-2" title={label}>{label}:</span>
                          <span className="font-bold">{typeof val === 'boolean' ? (val ? 'Sim' : 'Não') : val}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}

        {!items.some(item => item.analiseIA) && items.length > 0 && (
          <div className="text-center p-8 bg-[#f9fafb] text-[#6b7280] rounded border border-[#e5e7eb]">
            Clique em "Analisar com IA" no sistema antes de gerar o PDF para preencher esta seção.
          </div>
        )}
      </div>

    </div>
  );
};

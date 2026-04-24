import { GoogleGenAI } from "@google/genai";
import { EstimationItem, Metric, ComplexityParameters } from "../types";

// Modelos descobertos via ListModels — populado em runtime
let _discoveredModels: string[] | null = null;
// Modelo que funcionou por último (começa por ele na próxima chamada)
let _lastWorkingModel: string | null = null;

function getApiKey(): string {
  const key = process.env.GEMINI_API_KEY || process.env.API_KEY || localStorage.getItem('gemini_api_key');
  if (!key) throw new Error("API_KEY_MISSING");
  return key;
}

function getAIInstance() {
  return new GoogleGenAI({ apiKey: getApiKey() });
}

// Consulta a API para descobrir quais modelos estão disponíveis para esta chave
export async function discoverModels(): Promise<string[]> {
  _discoveredModels = null; // força redescoberta
  const apiKey = getApiKey();
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}&pageSize=100`
  );
  if (!res.ok) throw new Error(`ListModels failed: ${res.status}`);
  const data = await res.json();

  const all: string[] = (data.models || [])
    .filter((m: any) =>
      Array.isArray(m.supportedGenerationMethods) &&
      m.supportedGenerationMethods.includes('generateContent')
    )
    .map((m: any) => (m.name as string).replace('models/', ''));

  // Ordena preferindo versões mais recentes de flash
  const priority = ['gemini-2.5', 'gemini-2.0', 'gemini-1.5'];
  all.sort((a, b) => {
    const ai = priority.findIndex(p => a.includes(p));
    const bi = priority.findIndex(p => b.includes(p));
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  _discoveredModels = all.filter(m => m.includes('flash') || m.includes('pro')).slice(0, 6);
  console.log('[Gemini] Modelos disponíveis:', _discoveredModels);
  return _discoveredModels;
}

async function getModels(): Promise<string[]> {
  if (_discoveredModels && _discoveredModels.length > 0) return _discoveredModels;
  try {
    return await discoverModels();
  } catch {
    // fallback conservador enquanto a descoberta falha
    return ['gemini-2.5-flash'];
  }
}

// Retorna true para erros que devem tentar o próximo modelo (não são fatais)
function shouldTryNextModel(err: any): boolean {
  const msg = String(err?.message || '');
  const status = err?.status;
  return status === 503 || status === 404
    || msg.includes('503') || msg.includes('UNAVAILABLE')
    || msg.includes('high demand') || msg.includes('NOT_FOUND')
    || msg.includes('no longer available') || msg.includes('not found for API');
}

async function generateWithFallback(
  buildRequest: (model: string) => Parameters<GoogleGenAI['models']['generateContent']>[0]
): Promise<string> {
  const ai = getAIInstance();
  const models = await getModels();

  // Reordena colocando o último modelo que funcionou na frente
  const ordered = _lastWorkingModel && models.includes(_lastWorkingModel)
    ? [_lastWorkingModel, ...models.filter(m => m !== _lastWorkingModel)]
    : models;

  let lastErr: any;
  for (const model of ordered) {
    try {
      const response = await ai.models.generateContent(buildRequest(model));
      _lastWorkingModel = model; // memoriza modelo que funcionou
      return response.text || '';
    } catch (err: any) {
      lastErr = err;
      if (shouldTryNextModel(err)) {
        console.warn(`[Gemini] ${model} indisponível (${err?.status || 'ERR'}), tentando próximo...`);
        // Aguarda 2s em caso de 503 antes do próximo modelo
        if (err?.status === 503 || String(err?.message).includes('503')) {
          await new Promise(r => setTimeout(r, 2000));
        }
        continue;
      }
      throw err;
    }
  }
  throw lastErr; // todos os modelos falharam
}

export async function getAISuggestions(items: EstimationItem[], metrics: Metric[]) {
  const prompt = `Você é um especialista em estimativas de desenvolvimento SAP S/4HANA.
Analise a seguinte lista de desenvolvimentos (GAPs) e sugira melhorias nas estimativas.
Considere a descrição do item, a tecnologia selecionada e a complexidade atribuída.

Métricas base (para referência):
${JSON.stringify(metrics.slice(0, 20))} ... (e outras similares)

Itens atuais para estimar:
${JSON.stringify(items.map(i => ({
  id: i.id,
  tipo: i.novoOuExistente,
  tecnologia: i.tecnologia,
  descricao: i.descricao,
  complexidade: i.complexidade,
  totalHoras: i.total
})))}

Retorne uma análise em Markdown sugerindo se algum item parece subestimado ou superestimado com base na descrição técnica.
Seja específico e profissional.`;

  return generateWithFallback(model => ({
    model,
    contents: [{ role: "user", parts: [{ text: prompt }] }],
  }));
}

export async function classifyAndAnalyzeCleanCore(
  description: string,
  externalEffort: number,
  calculatedEffort: number,
  availableTypes: string[]
) {
  const prompt = `Você é um especialista SAP S/4HANA focado em Clean Core.
Recebi um requisito com a seguinte descrição: "${description}"
O esforço estimado externamente é de ${externalEffort} horas.
O esforço calculado pela nossa matriz é de ${calculatedEffort} horas.

Tipos de solicitações disponíveis na nossa matriz: ${availableTypes.join(", ")}

Sua tarefa:
1. Identifique qual dos tipos disponíveis melhor se encaixa nessa descrição.
2. Classifique a complexidade técnica do desenvolvimento: PP (muito simples), P (simples), M (médio), G (grande/complexo), GG (muito complexo).
3. Sugira uma estimativa revisada em horas para este GAP.
4. Sugira a melhor abordagem seguindo o conceito SAP Clean Core.

Formato de resposta OBRIGATÓRIO (exatamente nesta ordem, sem texto adicional):
[NOME_DO_TIPO]
[COMPLEXIDADE: PP|P|M|G|GG]
[SUGESTÃO_HORAS: (número)]
[ANÁLISE EM MARKDOWN]`;

  try {
    const text = await generateWithFallback(model => ({
      model,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    }));
    const lines = text.split("\n").filter(l => l.trim().length > 0);
    const type = lines[0].replace(/\[|\]/g, "").trim();

    let complexity: string | undefined = undefined;
    const complexityLine = lines.find(l => l.includes("COMPLEXIDADE:"));
    if (complexityLine) {
      const match = complexityLine.match(/\b(PP|P|M|G|GG)\b/);
      if (match) complexity = match[1];
    }

    let suggestedHours: number | undefined = undefined;
    const hoursLine = lines.find(l => l.includes("SUGESTÃO_HORAS"));
    if (hoursLine) {
      const match = hoursLine.match(/\d+(\.\d+)?/);
      if (match) suggestedHours = parseFloat(match[0]);
    }

    const analysisStartIndex = hoursLine ? lines.indexOf(hoursLine) + 1 : (complexityLine ? lines.indexOf(complexityLine) + 1 : 1);
    const analysis = lines.slice(analysisStartIndex).join("\n").trim();

    return { type, complexity, analysis, suggestedHours };
  } catch (error) {
    console.error("Error in classifyAndAnalyzeCleanCore:", error);
    throw error;
  }
}


export async function generateFunctionalSpec(item: EstimationItem) {
  const prompt = `Você é um Consultor Funcional SAP sênior da delaware, especialista em S/4HANA e Clean Core.
Sua tarefa é gerar uma Especificação Funcional (EF) de alta qualidade para o seguinte GAP:
- Título: ${item.titulo}
- Módulo: ${item.funcional}
- Tecnologia: ${item.tecnologia}
- Descrição: ${item.descricao}
- Complexidade: ${item.complexidade}

Diretrizes de Conteúdo:
1. **Terminologia Modernizada:** Use termos de Aplicativos Fiori em vez de apenas transações (GUI).
2. **Foco Clean Core:** Justifique como a solução se integra ao núcleo limpo (ex: extensões key-user ou BTP).
3. **Estrutura Obrigatória:**
   # Especificação Funcional: ${item.titulo}
   ## 1. Objetivo e Justificativa de Negócio
   ## 2. Processo de Negócio & Experiência do Usuário (UX)
   ## 3. Descrição Funcional
   ### 3.1 Gatilho
   ### 3.2 Lógica de Processamento
   ### 3.3 Regras de Validação e Mensagens
   ## 4. Requisitos de Interface e Protótipo
   ## 5. Plano de Testes de Aceite (UAT)

Gere o conteúdo em Markdown, sendo profissional e detalhado.`;

  return generateWithFallback(model => ({
    model,
    contents: [{ role: "user", parts: [{ text: prompt }] }],
  }));
}

export async function generateTechnicalSpec(item: EstimationItem) {
  const prompt = `Você é um Arquiteto de Soluções SAP sênior da delaware, especialista em BTP e Extensibilidade Clean Core.
Sua tarefa é gerar uma Especificação Técnica (ET) moderna para o seguinte GAP:
- Título: ${item.titulo}
- Tecnologia: ${item.tecnologia}
- Complexidade: ${item.complexidade}
- Descrição Funcional: ${item.descricao}

Diretrizes Técnicas:
1. **Arquitetura Modernizada:** Priorize BTP (CAP/Node.js/Java) ou On-Stack (RAP/CDS) seguindo o Clean Core.
2. **Terminologia Fiori:** Foque em OData Services, UI5 Components e Fiori Elements.
3. **Estrutura Obrigatória:**
   # Especificação Técnica: ${item.titulo}
   ## 1. Arquitetura da Solução (Clean Core First)
   ## 2. Detalhes Técnicos (Backend)
   ### 2.1 Objetos OData/CDS Service
   ### 2.2 Classes de Comportamento ou CAP Services
   ### 2.3 Pontos de Extensão (Cloud BAdIs ou Event Mesh)
   ## 3. Frontend / User Interface
   ## 4. Estratégia de Testes Unitários
   ## 5. Segurança, Performance e Nota de Transporte

Gere o conteúdo em Markdown, use termos técnicos precisos da plataforma SAP moderna.`;

  return generateWithFallback(model => ({
    model,
    contents: [{ role: "user", parts: [{ text: prompt }] }],
  }));
}

export function calculateComplexityScore(params: ComplexityParameters): number {
  let score = 0;

  // Tabela e DB
  score += (params.tabelasAcessadas * 1.0);
  score += (params.tabelasAcessoSimples * 0.5);
  score += (params.tabelasCriadas * 1.0);
  score += (params.camposCriados * 0.25);
  score += (params.indicesCriados * 1.0);
  score += (params.sm30Criado * 0.5);
  score += (params.dbLogico ? 1.0 : 0);
  score += (params.arquivosExternos * 1.0);

  // Relacionamento (mutually exclusive essentially but added if true)
  score += (params.umaSelecaoRetornaTodas ? 1.0 : 0);
  score += (params.algumRelacionamento ? 2.0 : 0);
  score += (params.infoLegado ? 10.0 : 0);

  // Navegação
  score += (params.usaWrite ? 3.0 : 0);
  score += (params.usaALV ? 1.0 : 0);
  score += (params.niveisDrillDown * 1.0);

  // Layout
  score += (params.layoutsDinamicos ? 3.0 : 0);
  score += (params.layoutsDrillDown * 2.0);

  // Campos
  score += (params.campos * 0.5);
  score += (params.camposConversao * 0.5);
  score += (params.camposCalculo * 0.5);
  score += (params.camposValidacao * 0.5);

  // Rotinas
  score += (params.rotinasExternas * 3.0);
  score += (params.funcaoSimulacao * 4.0);
  score += (params.subscreens * 3.0);
  score += (params.copiaProgramaStd ? 2.0 : 0);
  score += (params.batchInput * 2.0);
  score += (params.criacaoArquivoExterno * 1.0);

  return score;
}

export async function analyzeComplexityParameters(description: string, spec: string = ""): Promise<ComplexityParameters> {
  try {
    const prompt = `
Você é um arquiteto de soluções especializado em SAP ABAP. Tenho os detalhes de um desenvolvimento (GAP) e preciso que você classifique os parâmetros técnicos baseados no texto fornecido.
O objetivo é preencher uma "Ficha de Complexidade" que determina o esforço com base nestes itens numéricos ou booleanos.

=== DADOS DO DESENVOLVIMENTO ===
Descrição: ${description}
Especificação: ${spec}

=== INSTRUÇÕES ===
Sua única saída DEVE SER EXATAMENTE um objeto JSON válido (sem \`\`\`json ou marcação adicional) com todas as 25 chaves listadas abaixo.
Estime as quantidades da melhor e mais precisa forma, utilizando o seu conhecimento sobre padrões SAP.
Se o objeto não envolver a funcionalidade, o valor numérico é 0 e o booleano é false.
Tenha atenção aos relacionamentos e quantidades lógicas:
- tabelasAcessadas (número de tabelas que o relatório vai ler)
- usaALV (booleano - se for um relatório normal é comum ser true)
- batchInput (número de programas/sessões de BI geradas, se houver)

Retorne EXATAMENTE as seguintes propriedades preenchidas com tipo number (int) ou boolean:
{
  "tabelasAcessadas": 0,
  "tabelasAcessoSimples": 0,
  "tabelasCriadas": 0,
  "camposCriados": 0,
  "indicesCriados": 0,
  "sm30Criado": 0,
  "dbLogico": false,
  "arquivosExternos": 0,
  "umaSelecaoRetornaTodas": false,
  "algumRelacionamento": false,
  "infoLegado": false,
  "usaWrite": false,
  "usaALV": false,
  "niveisDrillDown": 0,
  "layoutsDinamicos": false,
  "layoutsDrillDown": 0,
  "campos": 0,
  "camposConversao": 0,
  "camposCalculo": 0,
  "camposValidacao": 0,
  "rotinasExternas": 0,
  "funcaoSimulacao": 0,
  "subscreens": 0,
  "copiaProgramaStd": false,
  "batchInput": 0,
  "criacaoArquivoExterno": 0
}
  `;

    const text = await generateWithFallback(model => ({
      model,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { responseMimeType: "application/json" }
    })) || "{}";
    const data = JSON.parse(text);
    // Assegura fallback para a interface
    return {
      tabelasAcessadas: Number(data.tabelasAcessadas) || 0,
      tabelasAcessoSimples: Number(data.tabelasAcessoSimples) || 0,
      tabelasCriadas: Number(data.tabelasCriadas) || 0,
      camposCriados: Number(data.camposCriados) || 0,
      indicesCriados: Number(data.indicesCriados) || 0,
      sm30Criado: Number(data.sm30Criado) || 0,
      dbLogico: Boolean(data.dbLogico),
      arquivosExternos: Number(data.arquivosExternos) || 0,
      umaSelecaoRetornaTodas: Boolean(data.umaSelecaoRetornaTodas),
      algumRelacionamento: Boolean(data.algumRelacionamento),
      infoLegado: Boolean(data.infoLegado),
      usaWrite: Boolean(data.usaWrite),
      usaALV: Boolean(data.usaALV),
      niveisDrillDown: Number(data.niveisDrillDown) || 0,
      layoutsDinamicos: Boolean(data.layoutsDinamicos),
      layoutsDrillDown: Number(data.layoutsDrillDown) || 0,
      campos: Number(data.campos) || 0,
      camposConversao: Number(data.camposConversao) || 0,
      camposCalculo: Number(data.camposCalculo) || 0,
      camposValidacao: Number(data.camposValidacao) || 0,
      rotinasExternas: Number(data.rotinasExternas) || 0,
      funcaoSimulacao: Number(data.funcaoSimulacao) || 0,
      subscreens: Number(data.subscreens) || 0,
      copiaProgramaStd: Boolean(data.copiaProgramaStd),
      batchInput: Number(data.batchInput) || 0,
      criacaoArquivoExterno: Number(data.criacaoArquivoExterno) || 0
    };
  } catch (error) {
    console.error("Error analyzing complexity parameters:", error);
    throw error;
  }
}

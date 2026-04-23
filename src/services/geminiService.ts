import { GoogleGenAI } from "@google/genai";
import { EstimationItem, Metric, ComplexityParameters } from "../types";

function getAIInstance() {
  const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY || localStorage.getItem('gemini_api_key');
  if (!apiKey) {
    throw new Error("API_KEY_MISSING");
  }
  return new GoogleGenAI({ apiKey });
}

export async function getAISuggestions(items: EstimationItem[], metrics: Metric[]) {
  try {
    const ai = getAIInstance();
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `Você é um especialista em estimativas de desenvolvimento SAP S/4HANA. 
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
              Seja específico e profissional.`,
            },
          ],
        },
      ],
    });

    return response.text;
  } catch (error) {
    console.error("Error in getAISuggestions:", error);
    throw error;
  }
}

export async function classifyAndAnalyzeCleanCore(
  description: string, 
  externalEffort: number, 
  calculatedEffort: number, 
  availableTypes: string[]
) {
  try {
    const ai = getAIInstance();
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `Você é um especialista SAP S/4HANA focado em Clean Core.
              Recebi um requisito com a seguinte descrição: "${description}"
              O esforço estimado externamente é de ${externalEffort} horas.
              O esforço calculado pela nossa matriz é de ${calculatedEffort} horas.
              
              Tipos de solicitações disponíveis na nossa matriz: ${availableTypes.join(", ")}
              
              Sua tarefa:
              1. Identifique qual dos tipos disponíveis melhor se encaixa nessa descrição. Retorne APENAS o nome do tipo na primeira linha entre colchetes. Ex: [Report ABAP]
              2. Analise a diferença entre o esforço externo (${externalEffort}h) e o calculado (${calculatedEffort}h).
              3. Sugira uma estimativa revisada em horas para este GAP caso os parâmetros da matriz pareçam inadequados para a complexidade técnica descrita.
              4. Sugira a melhor abordagem seguindo o conceito SAP Clean Core (ex: usar APIs standard, BTP, Key User Extensibility, etc.).
              
              Formato de resposta OBRIGATÓRIO (não use outros textos):
              [NOME_DO_TIPO]
              [SUGESTÃO_HORAS: (número aqui)]
              [ANÁLISE EM MARKDOWN]`
            }
          ]
        }
      ]
    });

    const text = response.text || "";
    const lines = text.split("\n").filter(l => l.trim().length > 0);
    const type = lines[0].replace(/\[|\]/g, "").trim();
    
    let suggestedHours: number | undefined = undefined;
    const hoursLine = lines.find(l => l.includes("SUGESTÃO_HORAS"));
    if (hoursLine) {
      const match = hoursLine.match(/\d+(\.\d+)?/);
      if (match) suggestedHours = parseFloat(match[0]);
    }

    const analysisStartIndex = hoursLine ? lines.indexOf(hoursLine) + 1 : 1;
    const analysis = lines.slice(analysisStartIndex).join("\n").trim();

    return { type, analysis, suggestedHours };
  } catch (error) {
    console.error("Error in classifyAndAnalyzeCleanCore:", error);
    throw error;
  }
}

export async function generateFunctionalSpec(item: EstimationItem) {
  try {
    const ai = getAIInstance();
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `Você é um Consultor Funcional SAP sênior da delaware, especialista em S/4HANA e Clean Core. 
              Sua tarefa é gerar uma Especificação Funcional (EF) de alta qualidade para o seguinte GAP:
              - Título: ${item.titulo}
              - Módulo: ${item.funcional}
              - Tecnologia: ${item.tecnologia}
              - Descrição: ${item.descricao}
              - Complexidade: ${item.complexidade}

              Diretrizes de Conteúdo:
              1. **Terminologia Modernizada:** Use termos de Aplicativos Fiori (Ex: App de Ficha de Estoque, App de Liberação) em vez de apenas transações (GUI).
              2. **Foco Clean Core:** Justifique como a solução se integra ao núcleo limpo (ex: uso de extensões key-user ou BTP).
              3. **Estrutura Obrigatória:**
                 # Especificação Funcional: ${item.titulo}
                 ## 1. Objetivo e Justificativa de Negócio
                 [Descreva o benefício e como isso apoia a estratégia Clean Core/BTP]
                 ## 2. Processo de Negócio & Experiência do Usuário (UX)
                 [Contextualize no S/4HANA. Refira-se a Aplicativos Fiori e Business Roles]
                 ## 3. Descrição Funcional
                 ### 3.1 Gatilho (Ex: Acesso via Fiori Launchpad)
                 ### 3.2 Lógica de Processamento (Passo a Passo)
                 ### 3.3 Regras de Validação e Mensagens
                 ## 4. Requisitos de Interface e Protótipo
                 [Descrição de elementos de UI Fiori: Smart Tables, Object Pages, etc.]
                 ## 5. Plano de Testes de Aceite (UAT) e Cenários Unitários
                 [Sugira o que o funcional/usuário deve testar para validar o requisito]

              Gere o conteúdo em Markdown, sendo profissional e detalhado.`
            }
          ]
        }
      ]
    });
    return response.text;
  } catch (error) {
    console.error("Error in generateFunctionalSpec:", error);
    throw error;
  }
}

export async function generateTechnicalSpec(item: EstimationItem) {
  try {
    const ai = getAIInstance();
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `Você é um Arquiteto de Soluções SAP sênior da delaware, especialista em BTP e Extensibilidade Clean Core. 
              Sua tarefa é gerar uma Especificação Técnica (ET) moderna para o seguinte GAP:
              - Título: ${item.titulo}
              - Tecnologia: ${item.tecnologia}
              - Complexidade: ${item.complexidade}
              - Descrição Funcional: ${item.descricao}

              Diretrizes Técnicas:
              1. **Arquitetura Modernizada:** Priorize abordagens Side-by-Side no BTP (CAP/Node.js/Java) ou On-Stack (RAP/CDS) seguindo o Clean Core.
              2. **Terminologia Fiori:** Foque em OData Services, UI5 Components e Fiori Elements.
              3. **Estrutura Obrigatória:**
                 # Especificação Técnica: ${item.titulo}
                 ## 1. Arquitetura da Solução (Clean Core First)
                 [Explique por que escolheu BTP, RAP ou Extensibilidade Key-User. Use diagramas textuais se necessário]
                 ## 2. Detalhes Técnicos (Backend)
                 ### 2.1 Objetos OData/CDS Service
                 ### 2.2 Classes de Comportamento (Behavior Pools) ou CAP Services
                 ### 2.3 Pontos de Extensão (Cloud BAdIs ou Event Mesh)
                 ## 3. Frontend / User Interface
                 [Detalhes sobre manifest.json, anotações de UI e componentes UI5]
                 ## 4. Estratégia de Testes Unitários Solicitada
                 [Sugira casos específicos para ABAP Unit ou JEST (para BTP). Liste os métodos e o que testar]
                 ## 5. Segurança, Performance e Nota de Transporte BTP/S4

              Gere o conteúdo em Markdown, use termos técnicos precisos da plataforma SAP moderna.`
            }
          ]
        }
      ]
    });
    return response.text;
  } catch (error) {
    console.error("Error generating technical spec:", error);
    return "";
  }
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
    const ai = getAIInstance();
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

    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }],
        },
      ],
      config: {
        responseMimeType: "application/json"
      }
    });

    const text = response.text || "{}";
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

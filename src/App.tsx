import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Plus, Save, Settings as SettingsIcon, Calculator, Brain, Trash2, Download, X, Sparkles, Upload, FileUp, LayoutDashboard, Calendar as CalendarIcon, Users, BarChart as BarChartIcon, FileText, Cpu, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { EstimationItem, Metric, ProjectInfo, Complexity } from './types';
import { DEFAULT_METRICS } from './constants';
import { getAISuggestions, classifyAndAnalyzeCleanCore, generateFunctionalSpec, generateTechnicalSpec, analyzeComplexityParameters, calculateComplexityScore } from './services/geminiService';
import ReactMarkdown from 'react-markdown';
import * as XLSX from 'xlsx';
// @ts-ignore
import html2pdf from 'html2pdf.js';
import { ReportTemplate } from './components/ReportTemplate';

import { 
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, 
  BarChart, Bar, XAxis, YAxis, CartesianGrid 
} from 'recharts';
import { addDays, isWeekend, format, addBusinessDays } from 'date-fns';

export default function App() {
  const [activeTab, setActiveTab] = useState<'calculator' | 'settings' | 'dashboard'>('calculator');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [metrics, setMetrics] = useState<Metric[]>(() => {
    const saved = localStorage.getItem('sap_metrics');
    let loadedMetrics = saved ? JSON.parse(saved) : DEFAULT_METRICS;
    
    // Fallback for missing pontosMaximos
    loadedMetrics = loadedMetrics.map((m: Metric) => {
      if (m.pontosMaximos === undefined) {
        switch(m.complexidade) {
          case 'PP': return { ...m, pontosMaximos: 10 };
          case 'P': return { ...m, pontosMaximos: 20 };
          case 'M': return { ...m, pontosMaximos: 40 };
          case 'G': return { ...m, pontosMaximos: 60 };
          case 'GG': return { ...m, pontosMaximos: 110 };
          default: return m;
        }
      }
      return m;
    });
    return loadedMetrics;
  });
  
  const [projectInfo, setProjectInfo] = useState<ProjectInfo>(() => {
    const saved = localStorage.getItem('sap_project_info');
    return saved ? JSON.parse(saved) : { 
      nome: '', 
      gerente: '', 
      data: new Date().toISOString().split('T')[0],
      fatorCalibracao: 1.0
    };
  });

  const [items, setItems] = useState<EstimationItem[]>(() => {
    const saved = localStorage.getItem('sap_estimation_items');
    return saved ? JSON.parse(saved) : [];
  });

  const [aiAnalysis, setAiAnalysis] = useState<Record<string, string>>({});
  const [globalAiAnalysis, setGlobalAiAnalysis] = useState<string | null>(null);
  
  const [isComplexityAnalyzing, setIsComplexityAnalyzing] = useState(false);
  const [showFicha, setShowFicha] = useState(false);

  const paramLabels: Record<keyof Required<EstimationItem>['complexityParams'], string> = {
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
  };
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState({ current: 0, total: 0 });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<EstimationItem | null>(null);
  const [hasSelectedKey, setHasSelectedKey] = useState(true);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [docModal, setDocModal] = useState<{ isOpen: boolean; type: 'EF' | 'ET'; content: string; itemId?: string }>({ 
    isOpen: false, 
    type: 'EF', 
    content: '' 
  });
  const [isGeneratingDoc, setIsGeneratingDoc] = useState(false);
  const [loadingItems, setLoadingItems] = useState<Set<string>>(new Set());

  useEffect(() => {
    const checkKey = async () => {
      
      if (window.aistudio) {
        try {
          await window.aistudio.hasSelectedApiKey();
        } catch (e) {
          console.error("Error checking API key:", e);
        }
      }
    };
    checkKey();
  }, []);

  const handleSelectKey = async () => {
    if (window.aistudio) {
      await window.aistudio.openSelectKey();
    } else {
      alert("A inteligência artificial do Google Gemini já foi pré-configurada neste ambiente.");
    }
  };

  // Settings State
  const [settingsSolicitacao, setSettingsSolicitacao] = useState<string>('NOVO');
  const [settingsTipo, setSettingsTipo] = useState<string>('Report ABAP');
  const [isAddingNewTipo, setIsAddingNewTipo] = useState(false);
  const [newTipoName, setNewTipoName] = useState('');

  useEffect(() => {
    localStorage.setItem('sap_metrics', JSON.stringify(metrics));
  }, [metrics]);

  useEffect(() => {
    localStorage.setItem('sap_project_info', JSON.stringify(projectInfo));
  }, [projectInfo]);

  useEffect(() => {
    localStorage.setItem('sap_estimation_items', JSON.stringify(items));
  }, [items]);

  const totalHours = useMemo(() => items.reduce((sum, item) => sum + item.total, 0), [items]);

  const uniqueTipos = useMemo(() => Array.from(new Set(metrics.map(m => m.tipo))).sort(), [metrics]);
  const uniqueSolicitacoes = useMemo(() => Array.from(new Set(metrics.map(m => m.solicitacao))).sort(), [metrics]);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const reader = new FileReader();

    reader.onerror = () => {
      console.error("FileReader error");
      alert("Erro ao ler o arquivo. Tente novamente.");
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    };

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];

        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
        if (jsonData.length < 2) {
          alert("O arquivo está vazio ou não contém dados além do cabeçalho.");
          return;
        }

        const headers = jsonData[0];

        // Support Portuguese and English column names
        const descIdx = headers.findIndex((h: string) => h?.toLowerCase().includes('descri'));
        const effortIdx = headers.findIndex((h: string) =>
          (h?.toLowerCase().includes('esfor') && h?.toLowerCase().includes('hora')) ||
          (h?.toLowerCase().includes('effort') && h?.toLowerCase().includes('hour'))
        );
        const idIdx = headers.findIndex((h: string) => h?.trim().toLowerCase() === 'id');
        const titleIdx = headers.findIndex((h: string) =>
          h?.toLowerCase() === 'title' ||
          h?.toLowerCase().includes('título') ||
          h?.toLowerCase().includes('titulo')
        );
        const functionalIdx = headers.findIndex((h: string) =>
          h?.toLowerCase().includes('função atribuída') ||
          h?.toLowerCase().includes('funcao atribuida') ||
          h?.toLowerCase().includes('assigned role')
        );
        const priorityIdx = headers.findIndex((h: string) =>
          h?.toLowerCase().includes('prioridade') ||
          h?.toLowerCase() === 'priority'
        );

        if (descIdx === -1) {
          alert("Coluna de descrição não encontrada. Verifique se o arquivo contém uma coluna 'Description' ou 'Descrição'.");
          return;
        }

        // Strip HTML tags and return plain text
        const stripHtml = (html: string): string => {
          try {
            const doc = new DOMParser().parseFromString(html, 'text/html');
            return (doc.body.textContent || '').replace(/\s+/g, ' ').trim();
          } catch {
            return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
          }
        };

        // Extract priority embedded in HTML description (e.g. "Prioridade: Essencial")
        const extractPriorityFromHtml = (html: string): string => {
          const match = html.match(/Prioridade[:\s]*([^\n<&\r]+)/i);
          return match ? match[1].trim() : '';
        };

        const newItems: EstimationItem[] = [];

        for (let i = 1; i < jsonData.length; i++) {
          const row = jsonData[i];
          if (!row[descIdx]) continue;

          const rawDescription = String(row[descIdx]);
          const description = stripHtml(rawDescription);
          if (!description) continue;

          const externalEffortStr = String(row[effortIdx] || "0").replace(',', '.').replace(/[^0-9.]/g, '');
          const externalEffort = parseFloat(externalEffortStr) || 0;
          const scopeItem = String(row[idIdx !== -1 ? idIdx : 1] || `GAP-${i}`);
          const titulo = String(row[titleIdx !== -1 ? titleIdx : 0] || "");
          const funcional = String(row[functionalIdx] || "");

          // Priority: dedicated column first, then extract from description HTML
          const priorityRaw = priorityIdx !== -1
            ? String(row[priorityIdx] || "")
            : extractPriorityFromHtml(rawDescription);

          let severidade: EstimationItem['severidade'] = 'Média';
          if (priorityRaw.toLowerCase().includes('alta')) severidade = 'Alta';
          else if (priorityRaw.toLowerCase().includes('baixa')) severidade = 'Baixa';
          else if (priorityRaw.toLowerCase().includes('crítica') || priorityRaw.toLowerCase().includes('critica')) severidade = 'Crítica';
          else if (priorityRaw.toLowerCase().includes('essencial')) severidade = 'Essencial';

          const item: EstimationItem = {
            id: crypto.randomUUID(),
            titulo: titulo || description.substring(0, 80),
            scopeItem: scopeItem,
            novoOuExistente: 'NOVO',
            tipoSolicitacao: uniqueTipos[0] || 'Report ABAP',
            funcional: funcional,
            tecnologia: 'ABAP',
            descricao: description,
            severidade: severidade,
            observacao: '',
            complexidade: 'M',
            esforcoDev: 0,
            testesUnitarios: 0,
            esforcoFuncional: 0,
            testesIntegrados: 0,
            documentacao: 0,
            deploy: 0,
            total: 0,
            esforcoExterno: externalEffort,
            horasFSReview: 0,
            horasSuporteTMS: 0,
            horasSuporteUAT: 0
          };

          updateItemCalculations(item, metrics);
          newItems.push(item);
        }

        if (newItems.length === 0) {
          alert("Nenhuma linha válida encontrada. Verifique se a coluna de descrição está preenchida.");
          return;
        }

        setItems(prev => [...prev, ...newItems]);

        // AI analysis runs in the background after items are displayed
        newItems.forEach(item => {
          classifyAndAnalyzeCleanCore(item.descricao, item.esforcoExterno, item.total, uniqueTipos)
            .then(({ type, analysis, suggestedHours }) => {
              setItems(prev => prev.map(it => {
                if (it.id !== item.id) return it;
                const updated = {
                  ...it,
                  tipoSolicitacao: uniqueTipos.includes(type) ? type : it.tipoSolicitacao,
                  aiSugestaoHoras: suggestedHours,
                  cleanCoreSuggestion: analysis,
                };
                updateItemCalculations(updated, metrics);
                return updated;
              }));
              setAiAnalysis(prev => ({ ...prev, [item.id]: analysis }));
            })
            .catch((err: any) => {
              console.error("AI Classification error:", err);
              if (err.message === "API_KEY_MISSING" && window.aistudio) {
                handleSelectKey();
              }
              setAiAnalysis(prev => ({ ...prev, [item.id]: "Erro na análise de IA." }));
            });
        });
      } catch (error) {
        console.error("Error parsing file:", error);
        alert("Erro ao processar o arquivo. Verifique se o formato está correto.");
      } finally {
        setIsUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };

    reader.readAsArrayBuffer(file);
  };

  const openNewModal = () => {
    setEditingItem({
      id: crypto.randomUUID(),
      titulo: '',
      scopeItem: '',
      novoOuExistente: 'NOVO',
      tipoSolicitacao: uniqueTipos[0] || '',
      funcional: '',
      tecnologia: '',
      descricao: '',
      severidade: 'Média',
      observacao: '',
      complexidade: 'M',
      esforcoDev: 0,
      testesUnitarios: 0,
      esforcoFuncional: 0,
      testesIntegrados: 0,
      documentacao: 0,
      deploy: 0,
      total: 0,
      horasFSReview: 0,
      horasSuporteTMS: 0,
      horasSuporteUAT: 0
    });
    setIsModalOpen(true);
  };

  const updateItemCalculations = (item: EstimationItem, currentMetrics: Metric[]) => {
    const metric = currentMetrics.find(m => 
      m.solicitacao === item.novoOuExistente && 
      m.tipo === item.tipoSolicitacao && 
      m.complexidade === item.complexidade
    );

    if (metric) {
      item.esforcoDev = metric.esforcoDev;
      item.testesUnitarios = metric.testesUnitarios;
      item.esforcoFuncional = metric.esforcoFuncional;
      item.testesIntegrados = metric.testesIntegrados;
      item.documentacao = metric.documentacao;
      item.deploy = metric.deploy;
      
      // Calculate Base Total
      let baseTotal = metric.total;

      // Apply Risk Multipliers
      if (item.riscoFsIncompleta) baseTotal *= 1.20; // +20%
      if (item.riscoTecnologiaNova) baseTotal *= 1.30; // +30%
      if (item.riscoDependenciaTerceiros) baseTotal += 10; // +10h fixas

      // Add Extra Phases Hours
      const extraPhases = (item.horasFSReview || 0) + (item.horasSuporteTMS || 0) + (item.horasSuporteUAT || 0);
      
      // Apply Global Calibration Factor
      item.total = (baseTotal + extraPhases) * (projectInfo.fatorCalibracao || 1.0);

      // Override with AI suggestion if confirmed
      if (item.ajusteConfirmado && item.aiSugestaoHoras !== undefined) {
        item.total = item.aiSugestaoHoras;
      }
    } else {
      item.esforcoDev = 0;
      item.testesUnitarios = 0;
      item.esforcoFuncional = 0;
      item.testesIntegrados = 0;
      item.documentacao = 0;
      item.deploy = 0;
      item.total = 0;
    }
  };

  const handleAnalyzeComplexity = async () => {
    if (!editingItem) return;
    setIsComplexityAnalyzing(true);
    try {
      const desc = editingItem.descricao || editingItem.titulo;
      const spec = editingItem.especificacaoFuncional || "";
      const params = await analyzeComplexityParameters(desc, spec);
      const score = calculateComplexityScore(params);
      
      let newComplexity: Complexity = 'PP';
      const sortedLevels = [
        { level: 'PP', max: metrics.find(m => m.complexidade === 'PP')?.pontosMaximos || 10 },
        { level: 'P', max: metrics.find(m => m.complexidade === 'P')?.pontosMaximos || 20 },
        { level: 'M', max: metrics.find(m => m.complexidade === 'M')?.pontosMaximos || 40 },
        { level: 'G', max: metrics.find(m => m.complexidade === 'G')?.pontosMaximos || 60 },
        { level: 'GG', max: metrics.find(m => m.complexidade === 'GG')?.pontosMaximos || 110 }
      ].sort((a,b) => a.max - b.max);

      for (const lvl of sortedLevels) {
        if (score <= lvl.max) {
          newComplexity = lvl.level as Complexity;
          break;
        }
      }
      if (score > sortedLevels[sortedLevels.length - 1].max) {
        newComplexity = 'GG';
      }

      const updated = {
        ...editingItem,
        complexityParams: params,
        complexityScore: score,
        complexidade: newComplexity
      };
      
      updateItemCalculations(updated, metrics);
      setEditingItem(updated);
      setShowFicha(true);
    } catch (err) {
      console.error(err);
      alert('Erro ao analisar complexidade com IA.');
    } finally {
      setIsComplexityAnalyzing(false);
    }
  };

  const saveItem = () => {
    if (!editingItem) return;
    
    const updatedItem = { ...editingItem };
    updateItemCalculations(updatedItem, metrics);
    
    const existingIndex = items.findIndex(i => i.id === updatedItem.id);
    if (existingIndex >= 0) {
      const newItems = [...items];
      newItems[existingIndex] = updatedItem;
      setItems(newItems);
    } else {
      setItems([...items, updatedItem]);
    }
    setIsModalOpen(false);
    setEditingItem(null);
  };

  const confirmAiAdjustment = (itemId: string) => {
    setItems(prev => prev.map(item => {
      if (item.id === itemId) {
        const newItem = { ...item, ajusteConfirmado: true };
        updateItemCalculations(newItem, metrics);
        return newItem;
      }
      return item;
    }));
  };

  const removeItem = (id: string) => {
    setItems(items.filter(item => item.id !== id));
  };

  const handleAIAnalysis = async (item?: EstimationItem) => {
    const itemsToAnalyze = item ? [item] : items;
    if (itemsToAnalyze.length === 0) return;
    
    setIsAnalyzing(true);
    setAnalysisProgress({ current: 0, total: itemsToAnalyze.length });

    try {
      // Se for item individual, mantém lógica simples. Se for lote, processa em paralelo.
      if (item) {
        if (item.analiseIA) return; // Se já analisou, não gasta token

        setLoadingItems(prev => new Set(prev).add(item.id));
        const analysisResult = await classifyAndAnalyzeCleanCore(
          item.descricao,
          item.esforcoExterno || 0,
          item.total,
          uniqueTipos
        );
        
        setItems(prev => prev.map(i => 
          i.id === item.id 
            ? { 
                ...i, 
                analiseIA: analysisResult.analysis || "Não foi possível gerar análise.",
                aiSugestaoHoras: analysisResult.suggestedHours,
                cleanCoreSuggestion: analysisResult.analysis
              } 
            : i
        ));
      } else {
        // Processamento em lote em paralelo
        const promises = itemsToAnalyze.map(async (currentItem) => {
          if (currentItem.analiseIA) {
            setAnalysisProgress(prev => ({ ...prev, current: prev.current + 1 }));
            return;
          }
          
          try {
            const analysis = await getAISuggestions([currentItem], metrics);
            setItems(prev => prev.map(i => 
              i.id === currentItem.id 
                ? { ...i, analiseIA: analysis || "Não foi possível gerar análise." } 
                : i
            ));
          } catch (err) {
            console.error(`Error analyzing item ${currentItem.id}:`, err);
            setItems(prev => prev.map(i => 
              i.id === currentItem.id 
                ? { ...i, analiseIA: "Erro na análise automática deste item." } 
                : i
            ));
          } finally {
            setAnalysisProgress(prev => ({ ...prev, current: prev.current + 1 }));
          }
        });

        await Promise.all(promises);
      }
    } catch (error: any) {
      console.error("AI Analysis Error:", error);
      let errorMessage = "Erro ao chamar a IA. Verifique sua conexão e tente novamente.";
      
      if (error.message === "API_KEY_MISSING") {
        errorMessage = "Configuração obrigatória: Chave de API não encontrada.";
      } else if (error.message?.includes("API_KEY_INVALID")) {
        errorMessage = "Chave de API inválida.";
      }
      
      if (item) {
        setItems(prev => prev.map(i => 
          i.id === item.id 
            ? { ...i, analiseIA: errorMessage } 
            : i
        ));
      }
    } finally {
      setIsAnalyzing(false);
      if (item) {
        setLoadingItems(prev => {
          const next = new Set(prev);
          next.delete(item.id);
          return next;
        });
      }
      // Reseta progresso após um breve delay para o usuário ver o 100%
      setTimeout(() => setAnalysisProgress({ current: 0, total: 0 }), 1000);
    }
  };

  const handleGenerateDoc = async (type: 'EF' | 'ET', item?: EstimationItem) => {
    const itemsToProcess = item ? [item] : items;
    if (itemsToProcess.length === 0) return;

    setIsGeneratingDoc(true);
    setAnalysisProgress({ current: 0, total: itemsToProcess.length });

    try {
      if (item) {
        // Se já existe documentação do tipo solicitado, abre o modal direto
        const existingDoc = type === 'EF' ? item.especificacaoFuncional : item.especificacaoTecnica;
        
        if (existingDoc) {
          setDocModal({ 
            isOpen: true, 
            type, 
            content: existingDoc, 
            itemId: item.id 
          });
          return;
        }

        setLoadingItems(prev => new Set(prev).add(item.id));
        const content = type === 'EF' 
          ? await generateFunctionalSpec(item) 
          : await generateTechnicalSpec(item);
        
        setDocModal({ 
          isOpen: true, 
          type, 
          content: content || '', 
          itemId: item.id 
        });

        // Update item in local state
        setItems(prev => prev.map(idx => 
          idx.id === item.id 
            ? { ...idx, [type === 'EF' ? 'especificacaoFuncional' : 'especificacaoTecnica']: content } 
            : idx
        ));
      } else {
        // Batch processing
        const promises = itemsToProcess.map(async (currentItem) => {
          try {
            const content = type === 'EF' 
              ? await generateFunctionalSpec(currentItem) 
              : await generateTechnicalSpec(currentItem);
            
            setItems(prev => prev.map(i => 
              i.id === currentItem.id 
                ? { ...i, [type === 'EF' ? 'especificacaoFuncional' : 'especificacaoTecnica']: content } 
                : i
            ));
          } catch (err) {
            console.error(`Error generating doc for ${currentItem.id}:`, err);
          } finally {
            setAnalysisProgress(prev => ({ ...prev, current: prev.current + 1 }));
          }
        });

        await Promise.all(promises);
        alert(`${type}s geradas em lote com sucesso!`);
      }
    } catch (error) {
      console.error("Documentation generation error:", error);
      alert("Erro ao gerar a documentação.");
    } finally {
      setIsGeneratingDoc(false);
      if (item) {
        setLoadingItems(prev => {
          const next = new Set(prev);
          next.delete(item!.id);
          return next;
        });
      }
      setTimeout(() => setAnalysisProgress({ current: 0, total: 0 }), 1000);
    }
  };

  const exportToCSV = () => {
    const headers = ['ID', 'Scope Item', 'Tipo', 'Solicitação', 'Funcional', 'Tecnologia', 'Descrição', 'Severidade', 'Complexidade', 'DEV', 'Unitarios', 'Funcional', 'Integrados', 'Doc', 'Deploy', 'Total'];
    const rows = items.map(i => [
      i.id, i.scopeItem, i.novoOuExistente, i.tipoSolicitacao, i.funcional, i.tecnologia, i.descricao, i.severidade, i.complexidade,
      i.esforcoDev, i.testesUnitarios, i.esforcoFuncional, i.testesIntegrados, i.documentacao, i.deploy, i.total
    ]);
    
    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `estimativa_${projectInfo.nome || 'sap'}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportPDF = async () => {
    setIsGeneratingPDF(true);
    
    // Pequeno delay para garantir que o React renderizou as propriedades mais novas no DOM oculto
    setTimeout(async () => {
      const element = document.getElementById('pdf-report-content');
      if (!element) {
        setIsGeneratingPDF(false);
        return;
      }

      const opt = {
        margin: [10, 10, 10, 10], // Margens equilibradas
        filename: `Estimativa_GAPs_${projectInfo.nome || 'SAP'}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { 
          scale: 2, 
          useCORS: true, 
          logging: false,
          scrollY: 0,
          windowWidth: document.documentElement.offsetWidth,
          onclone: (clonedDoc: Document) => {
            const elements = clonedDoc.getElementsByTagName('*');
            for (let i = 0; i < elements.length; i++) {
              const el = elements[i] as HTMLElement;
              const style = window.getComputedStyle(el);
              // html2canvas struggles with oklch and oklab. 
              // We force a solid color for any element that might be using them.
              if (style.backgroundColor.includes('oklch') || style.backgroundColor.includes('oklab')) {
                el.style.backgroundColor = '#ffffff';
              }
              if (style.color.includes('oklch') || style.color.includes('oklab')) {
                el.style.color = '#000000';
              }
            }
          }
        },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
      };

      try {
        await html2pdf().set(opt).from(element).save();
      } catch (err) {
        console.error("Error generating PDF:", err);
        alert("Ocorreu um erro ao gerar o PDF. Verifique o console.");
      } finally {
        setIsGeneratingPDF(false);
      }
    }, 500);
  };

  const addNewTipo = () => {
    if (!newTipoName.trim()) return;
    
    const complexities: Complexity[] = ['PP', 'P', 'M', 'G', 'GG'];
    const newMetrics: Metric[] = [];
    
    ['NOVO', 'MODIFICAÇÃO'].forEach(sol => {
      complexities.forEach(c => {
        newMetrics.push({
          id: crypto.randomUUID(),
          solicitacao: sol,
          tipo: newTipoName.trim(),
          chave: `${sol} / ${newTipoName.trim()} / ${c}`,
          complexidade: c,
          esforcoDev: 0,
          esforcoFuncional: 0,
          testesUnitarios: 0,
          testesIntegrados: 0,
          documentacao: 0,
          deploy: 0,
          total: 0
        });
      });
    });
    
    setMetrics([...metrics, ...newMetrics]);
    setSettingsTipo(newTipoName.trim());
    setNewTipoName('');
    setIsAddingNewTipo(false);
  };

  const filteredMetrics = metrics.filter(m => m.solicitacao === settingsSolicitacao && m.tipo === settingsTipo);
  // Sort by complexity: PP, P, M, G, GG
  const complexityOrder: Record<Complexity, number> = { 'PP': 1, 'P': 2, 'M': 3, 'G': 4, 'GG': 5 };
  filteredMetrics.sort((a, b) => complexityOrder[a.complexidade] - complexityOrder[b.complexidade]);

  return (
    <div className="min-h-screen bg-white text-delaware-gray font-sans flex flex-col">
      {/* Header */}
      <header className="bg-delaware-gray text-white px-8 py-6 shadow-md">
        <div className="max-w-[1600px] mx-auto">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h1 className="text-3xl font-bold tracking-tight mb-1">Calculadora de Estimativas SAP S/4HANA</h1>
              <p className="text-sm text-white/80">Estimativa de esforço para desenvolvimento de GAPs | delaware</p>
            </div>
            <div className="flex gap-4">
              <div className="bg-white/10 rounded-lg p-4 text-center min-w-[100px] border border-white/10">
                <div className="text-3xl font-bold">{items.length}</div>
                <div className="text-xs text-white/70 uppercase tracking-wider mt-1">GAPs</div>
              </div>
              <div className="bg-white/10 rounded-lg p-4 text-center min-w-[120px] border border-white/10">
                <div className="text-3xl font-bold">{totalHours.toFixed(1)}</div>
                <div className="text-xs text-white/70 uppercase tracking-wider mt-1">Horas Total</div>
              </div>
            </div>
          </div>
          
          <div className="flex gap-4 items-center">
            <div className="flex items-center bg-white/10 rounded-lg px-3 py-2 border border-white/20 flex-1 max-w-md">
              <span className="text-white/60 mr-2">📁</span>
              <input 
                type="text" 
                value={projectInfo.nome}
                onChange={e => setProjectInfo({...projectInfo, nome: e.target.value})}
                className="bg-transparent border-none text-white placeholder-white/50 focus:ring-0 outline-none w-full text-sm"
                placeholder="Nome do Projeto"
              />
            </div>
            <div className="flex items-center bg-white/10 rounded-lg px-3 py-2 border border-white/20 flex-1 max-w-md">
              <span className="text-white/60 mr-2">👤</span>
              <input 
                type="text" 
                value={projectInfo.gerente}
                onChange={e => setProjectInfo({...projectInfo, gerente: e.target.value})}
                className="bg-transparent border-none text-white placeholder-white/50 focus:ring-0 outline-none w-full text-sm"
                placeholder="Gerente"
              />
            </div>
            <div className="flex items-center bg-white/10 rounded-lg px-3 py-2 border border-white/20">
              <span className="text-white/60 mr-2 text-xs">Fator Calibração</span>
              <input 
                type="number" 
                step="0.1"
                min="1"
                max="3"
                value={projectInfo.fatorCalibracao || 1.0}
                onChange={e => {
                  const val = parseFloat(e.target.value) || 1.0;
                  setProjectInfo({...projectInfo, fatorCalibracao: val});
                  // Trigger recalculation for all items
                  setItems(items.map(item => {
                    const newItem = { ...item };
                    updateItemCalculations(newItem, metrics);
                    return newItem;
                  }));
                }}
                className="bg-transparent border-none text-white focus:ring-0 outline-none text-sm w-16 text-center font-bold"
              />
            </div>
            <div className="flex items-center bg-white/10 rounded-lg px-3 py-2 border border-white/20">
              <span className="text-white/60 mr-2">📅</span>
              <input 
                type="date" 
                value={projectInfo.data}
                onChange={e => setProjectInfo({...projectInfo, data: e.target.value})}
                className="bg-transparent border-none text-white focus:ring-0 outline-none text-sm [&::-webkit-calendar-picker-indicator]:filter [&::-webkit-calendar-picker-indicator]:invert"
              />
            </div>
          </div>
        </div>
      </header>

      <main className="p-8 max-w-[1600px] mx-auto">
        <div className="flex justify-between items-center mb-6">
          <nav className="flex bg-white rounded-lg shadow-sm border border-gray-200 p-1">
            <button 
              onClick={() => setActiveTab('calculator')}
              className={`px-6 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${activeTab === 'calculator' ? 'bg-delaware-teal/10 text-delaware-teal' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <Calculator size={16} />
              Calculadora
            </button>
            <button 
              onClick={() => setActiveTab('dashboard')}
              className={`px-6 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${activeTab === 'dashboard' ? 'bg-delaware-teal/10 text-delaware-teal' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <LayoutDashboard size={16} />
              Dashboard
            </button>
            <button 
              onClick={() => setActiveTab('settings')}
              className={`px-6 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${activeTab === 'settings' ? 'bg-delaware-teal/10 text-delaware-teal' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <SettingsIcon size={16} />
              Configurações
            </button>
          </nav>

          {activeTab === 'calculator' && (
            <div className="flex gap-3">
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileUpload} 
                accept=".xlsx,.xls,.csv" 
                className="hidden" 
              />
              <button 
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="flex items-center gap-2 bg-white border border-gray-200 text-delaware-gray px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                <FileUp size={16} className="text-delaware-teal" />
                {isUploading ? 'Processando...' : 'Importar XLSX'}
              </button>
              <button 
                onClick={() => handleAIAnalysis()}
                disabled={isAnalyzing || items.length === 0}
                className="flex items-center gap-2 bg-white border border-gray-200 text-delaware-gray px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                <Sparkles size={16} className="text-delaware-red" />
                Analisar Todos com IA
              </button>
              <button 
                onClick={handleExportPDF}
                disabled={isGeneratingPDF || items.length === 0}
                className="flex items-center gap-2 bg-white border border-gray-200 text-delaware-teal px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                <Download size={16} />
                {isGeneratingPDF ? 'Gerando PDF...' : 'Exportar PDF'}
              </button>
              <div className="flex bg-white border border-gray-200 rounded-lg p-1">
                <button 
                  onClick={() => handleGenerateDoc('EF')}
                  disabled={isGeneratingDoc || items.length === 0}
                  className="flex items-center gap-2 px-3 py-1 text-xs font-bold text-delaware-teal hover:bg-delaware-teal/5 rounded transition-colors disabled:opacity-50"
                  title="Gerar EFs em lote"
                >
                  <FileUp size={14} />
                  Lote EF
                </button>
                <div className="w-[1px] bg-gray-200 mx-1" />
                <button 
                  onClick={() => handleGenerateDoc('ET')}
                  disabled={isGeneratingDoc || items.length === 0}
                  className="flex items-center gap-2 px-3 py-1 text-xs font-bold text-delaware-red hover:bg-delaware-red/5 rounded transition-colors disabled:opacity-50"
                  title="Gerar ETs em lote"
                >
                  <Cpu size={14} />
                  Lote ET
                </button>
              </div>
              <button 
                onClick={openNewModal}
                className="flex items-center gap-2 bg-delaware-teal text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-delaware-teal/90 transition-colors"
              >
                <Plus size={16} />
                Novo GAP
              </button>
            </div>
          )}
        </div>

        <AnimatePresence mode="wait">
          {activeTab === 'calculator' ? (
            <motion.div 
              key="calc"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              {items.length === 0 ? (
                <div className="bg-white rounded-xl border border-gray-200 p-20 text-center flex flex-col items-center justify-center border-dashed">
                  <div className="text-4xl mb-4">📋</div>
                  <h3 className="text-gray-500 font-medium mb-1">Nenhum GAP adicionado ainda.</h3>
                  <p className="text-gray-400 text-sm">Clique em "Novo GAP" para começar.</p>
                </div>
              ) : (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-gray-50 text-gray-500 text-xs font-semibold border-b border-gray-200">
                          <th className="px-4 py-4">ID</th>
                          <th className="px-4 py-4">Título</th>
                          <th className="px-4 py-4">Scope</th>
                          <th className="px-4 py-4">Tipo</th>
                          <th className="px-4 py-4">Solicitação</th>
                          <th className="px-4 py-4">Cmplx</th>
                          <th className="px-4 py-4">Func.</th>
                          <th className="px-4 py-4">Severidade</th>
                          <th className="px-4 py-4 text-center">DEV</th>
                          <th className="px-4 py-4 text-center">T.Unit</th>
                          <th className="px-4 py-4 text-center">Func</th>
                          <th className="px-4 py-4 text-center">T.Int</th>
                          <th className="px-4 py-4 text-center">Doc</th>
                          <th className="px-4 py-4 text-center">Dep</th>
                          <th className="px-4 py-4 text-center font-bold text-gray-700">Total</th>
                          <th className="px-4 py-4 text-center text-delaware-red">Sugestão IA</th>
                          <th className="px-4 py-4 text-center text-delaware-teal">Ext (h)</th>
                          <th className="px-4 py-4 text-center">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {items.map((item, idx) => (
                          <React.Fragment key={item.id}>
                            <tr className={`hover:bg-gray-50 transition-all group text-sm text-gray-700 ${loadingItems.has(item.id) ? 'animate-pulse bg-delaware-teal/5' : ''}`}>
                              <td className="px-4 py-4">{idx + 1}</td>
                              <td className="px-4 py-4 font-medium truncate max-w-[150px]" title={item.titulo}>{item.titulo || '-'}</td>
                              <td className="px-4 py-4">{item.scopeItem}</td>
                              <td className="px-4 py-4">{item.novoOuExistente}</td>
                              <td className="px-4 py-4">{item.tipoSolicitacao}</td>
                              <td className="px-4 py-4">
                                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full border border-gray-200 text-xs font-medium">
                                  {item.complexidade}
                                </span>
                              </td>
                              <td className="px-4 py-4">{item.funcional}</td>
                              <td className="px-4 py-4">
                                <span className={`px-2 py-1 rounded-md text-xs font-medium ${
                                  item.severidade === 'Essencial' ? 'bg-red-100 text-red-700' :
                                  item.severidade === 'Crítica' ? 'bg-delaware-red/10 text-delaware-red' :
                                  item.severidade === 'Alta' ? 'bg-yellow-100 text-yellow-700' :
                                  'bg-gray-100 text-gray-700'
                                }`}>
                                  {item.severidade}
                                </span>
                              </td>
                              <td className="px-4 py-4 text-center">{item.esforcoDev}</td>
                              <td className="px-4 py-4 text-center">{item.testesUnitarios}</td>
                              <td className="px-4 py-4 text-center">{item.esforcoFuncional}</td>
                              <td className="px-4 py-4 text-center">{item.testesIntegrados}</td>
                              <td className="px-4 py-4 text-center">{item.documentacao}</td>
                              <td className="px-4 py-4 text-center">{item.deploy}</td>
                              <td className="px-4 py-4 text-center font-bold text-delaware-red">{item.total.toFixed(1)}</td>
                              <td className="px-4 py-4 text-center">
                                {item.aiSugestaoHoras !== undefined ? (
                                  <div className="flex flex-col items-center">
                                    <span className={`font-bold ${item.ajusteConfirmado ? 'text-green-600' : 'text-delaware-red'}`}>
                                      {item.aiSugestaoHoras.toFixed(1)}h
                                    </span>
                                    {!item.ajusteConfirmado && (
                                      <button 
                                        onClick={() => confirmAiAdjustment(item.id)}
                                        className="text-[10px] bg-delaware-red text-white px-2 py-0.5 rounded mt-1 hover:bg-delaware-red/80 transition-colors"
                                      >
                                        Confirmar
                                      </button>
                                    )}
                                    {item.ajusteConfirmado && (
                                      <span className="text-[10px] text-green-600 font-bold flex items-center gap-1">
                                        ✓ Confirmado
                                      </span>
                                    )}
                                  </div>
                                ) : '-'}
                              </td>
                              <td className="px-4 py-4 text-center">
                                {item.esforcoExterno !== undefined ? (
                                  <div className="flex flex-col items-center">
                                    <span className="font-medium text-delaware-teal">{item.esforcoExterno}h</span>
                                    {item.esforcoExterno !== item.total && (
                                      <span className={`text-[10px] font-bold ${item.total > item.esforcoExterno ? 'text-red-500' : 'text-green-500'}`}>
                                        {item.total > item.esforcoExterno ? `+${(item.total - item.esforcoExterno).toFixed(1)}` : `${(item.total - item.esforcoExterno).toFixed(1)}`}
                                      </span>
                                    )}
                                  </div>
                                ) : '-'}
                              </td>
                              <td className="px-4 py-4 text-center">
                                <div className="flex items-center justify-center gap-2">
                                  {loadingItems.has(item.id) ? (
                                    <div className="flex items-center gap-1.5 text-delaware-teal font-medium animate-bounce text-xs">
                                      <Loader2 size={14} className="animate-spin" />
                                      IA Pensando...
                                    </div>
                                  ) : (
                                    <>
                                      <button 
                                        onClick={() => handleAIAnalysis(item)}
                                        className="text-delaware-red/60 hover:text-delaware-red transition-colors"
                                        title="Analisar com IA"
                                      >
                                        <Sparkles size={16} />
                                      </button>
                                      <button 
                                        onClick={() => handleGenerateDoc('EF', item)}
                                        className={`text-delaware-teal/60 hover:text-delaware-teal transition-colors ${item.especificacaoFuncional ? 'text-delaware-teal' : ''}`}
                                        title="Gerar Esp. Funcional (Gemini)"
                                      >
                                        <FileUp size={16} />
                                      </button>
                                      <button 
                                        onClick={() => handleGenerateDoc('ET', item)}
                                        className={`text-delaware-red/60 hover:text-delaware-red transition-colors ${item.especificacaoTecnica ? 'text-delaware-red' : ''}`}
                                        title="Gerar Esp. Técnica (Claude)"
                                      >
                                        <Cpu size={16} />
                                      </button>
                                      <button 
                                        onClick={() => {
                                          setEditingItem(item);
                                          setIsModalOpen(true);
                                        }}
                                        className="text-delaware-teal/60 hover:text-delaware-teal transition-colors"
                                        title="Editar"
                                      >
                                        <SettingsIcon size={16} />
                                      </button>
                                      <button 
                                        onClick={() => removeItem(item.id)}
                                        className="text-red-400 hover:text-red-600 transition-colors"
                                        title="Remover"
                                      >
                                        <Trash2 size={16} />
                                      </button>
                                    </>
                                  )}
                                </div>
                              </td>
                            </tr>
                            {item.analiseIA && (
                              <tr className="bg-delaware-red/5">
                                <td colSpan={15} className="px-6 py-4">
                                  <div className="border-l-4 border-delaware-red/40 pl-4 py-2">
                                    <div className="flex items-center gap-2 text-delaware-red font-medium mb-2">
                                      <Brain size={16} />
                                      Análise IA & Clean Core
                                    </div>
                                    <div className="prose prose-sm max-w-none text-gray-700">
                                      <ReactMarkdown>{item.analiseIA}</ReactMarkdown>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </motion.div>
          ) : activeTab === 'dashboard' ? (
            <motion.div 
              key="dashboard"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-8"
            >
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {[
                  { label: 'Total Horas', value: totalHours.toFixed(1), icon: '⏱️', color: 'bg-delaware-teal/10 text-delaware-teal border border-delaware-teal/20' },
                  { label: 'Total GAPs', value: items.length, icon: '📋', color: 'bg-gray-100 text-delaware-gray border border-gray-200' },
                  { label: 'Média/GAP', value: items.length ? (totalHours / items.length).toFixed(1) : 0, icon: '📊', color: 'bg-delaware-teal/5 text-delaware-teal border border-delaware-teal/10' },
                  { label: 'Funcional (h)', value: items.reduce((s, i) => s + i.esforcoFuncional + i.documentacao, 0).toFixed(1), icon: '🧠', color: 'bg-gray-50 text-gray-700 border border-gray-200' },
                  { label: 'Técnico (h)', value: items.reduce((s, i) => s + i.esforcoDev + i.testesUnitarios + i.testesIntegrados + i.deploy, 0).toFixed(1), icon: '💻', color: 'bg-delaware-red/10 text-delaware-red border border-delaware-red/20' },
                  { label: 'Complexidade Média', value: items.length ? 'M' : '-', icon: '⚡', color: 'bg-gray-100 text-delaware-gray border border-gray-200' },
                ].map((stat, i) => (
                  <div key={i} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                    <div className={`w-10 h-10 rounded-lg ${stat.color} flex items-center justify-center text-xl mb-3 shadow-sm`}>
                      {stat.icon}
                    </div>
                    <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">{stat.label}</div>
                    <div className="text-2xl font-bold text-gray-800 mt-1">{stat.value}</div>
                  </div>
                ))}
              </div>

              {/* Charts Row 1 */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                  <h3 className="text-sm font-bold text-gray-700 mb-6 flex items-center gap-2">
                    <Sparkles size={16} className="text-delaware-red" />
                    Distribuição por Severidade
                  </h3>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={Object.entries(items.reduce((acc, item) => {
                            acc[item.severidade] = (acc[item.severidade] || 0) + 1;
                            return acc;
                          }, {} as Record<string, number>)).map(([name, value]) => ({ name, value }))}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {['#EF463C', '#72C4BF', '#3C3C3C', '#94a3b8', '#cbd5e1'].map((color, index) => (
                            <Cell key={`cell-${index}`} fill={color} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend verticalAlign="bottom" height={36}/>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                  <h3 className="text-sm font-bold text-gray-700 mb-6 flex items-center gap-2">
                    <Users size={16} className="text-delaware-teal" />
                    Distribuição por Funcional
                  </h3>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={Object.entries(items.reduce((acc, item) => {
                            const key = item.funcional || 'N/A';
                            acc[key] = (acc[key] || 0) + 1;
                            return acc;
                          }, {} as Record<string, number>)).map(([name, value]) => ({ name, value }))}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {['#72C4BF', '#3C3C3C', '#EF463C', '#A8DADC', '#457B9D', '#1D3557', '#E63946', '#F1FAEE', '#BDE0FE'].map((color, index) => (
                            <Cell key={`cell-${index}`} fill={color} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend verticalAlign="bottom" height={36}/>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                  <h3 className="text-sm font-bold text-gray-700 mb-6 flex items-center gap-2">
                    <Calculator size={16} className="text-delaware-teal" />
                    Tipo de Solicitação
                  </h3>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={Object.entries(items.reduce((acc, item) => {
                            acc[item.tipoSolicitacao] = (acc[item.tipoSolicitacao] || 0) + 1;
                            return acc;
                          }, {} as Record<string, number>)).map(([name, value]) => ({ name, value }))}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {['#3C3C3C', '#72C4BF', '#EF463C', '#64748b', '#94a3b8', '#cbd5e1', '#e2e8f0'].map((color, index) => (
                            <Cell key={`cell-${index}`} fill={color} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend verticalAlign="bottom" height={36}/>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* Phase Totals Table */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
                  <h3 className="text-sm font-bold text-gray-700">Resumo de Esforço por Fase</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-100">
                        <th className="px-6 py-4">Fase</th>
                        <th className="px-6 py-4 text-center">Total Horas</th>
                        <th className="px-6 py-4 text-center">% do Projeto</th>
                        <th className="px-6 py-4">Descrição</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-sm">
                      {[
                        { phase: 'Funcional', hours: items.reduce((s, i) => s + i.esforcoFuncional, 0), desc: 'Entendimento e Especificação Funcional' },
                        { phase: 'Desenvolvimento', hours: items.reduce((s, i) => s + i.esforcoDev, 0), desc: 'Construção técnica do GAP' },
                        { phase: 'Testes Unitários', hours: items.reduce((s, i) => s + i.testesUnitarios, 0), desc: 'Validação técnica inicial' },
                        { phase: 'Testes Integrados', hours: items.reduce((s, i) => s + i.testesIntegrados, 0), desc: 'Validação de ponta a ponta com funcional' },
                        { phase: 'Documentação', hours: items.reduce((s, i) => s + i.documentacao, 0), desc: 'Especificação Técnica e Manuais' },
                        { phase: 'Deploy', hours: items.reduce((s, i) => s + i.deploy, 0), desc: 'Transporte e Go-live' },
                      ].map((row, i) => (
                        <tr key={i} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4 font-medium text-gray-800">{row.phase}</td>
                          <td className="px-6 py-4 text-center font-bold text-delaware-teal">{row.hours.toFixed(1)}h</td>
                          <td className="px-6 py-4 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <div className="w-16 h-2 bg-gray-100 rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-delaware-teal" 
                                  style={{ width: `${totalHours ? (row.hours / totalHours * 100) : 0}%` }}
                                />
                              </div>
                              <span className="text-xs text-gray-500">
                                {totalHours ? (row.hours / totalHours * 100).toFixed(1) : 0}%
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-gray-500 italic">{row.desc}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Timeline & Resources */}
              <div className="bg-white p-8 rounded-xl border border-gray-200 shadow-sm">
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                      <CalendarIcon size={20} className="text-delaware-teal" />
                      Timeline Sugerida & Planejamento de Recursos
                    </h3>
                    <p className="text-sm text-gray-500 mt-1">Estimativa baseada em 8h/dia úteis com paralelismo Funcional/Técnico</p>
                  </div>
                  <div className="flex gap-4">
                    <div className="text-right">
                      <div className="text-xs text-gray-400 uppercase">Data Início</div>
                      <div className="font-bold text-gray-700">{format(new Date(projectInfo.data), 'dd/MM/yyyy')}</div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                  <div className="space-y-6">
                    <div className="bg-delaware-teal/5 p-6 rounded-xl border border-delaware-teal/10">
                      <h4 className="font-bold text-delaware-teal mb-4 flex items-center gap-2">
                        <Users size={18} />
                        Recursos Necessários (FTEs)
                      </h4>
                      <div className="space-y-4">
                        {(() => {
                          const funcHours = items.reduce((s, i) => s + i.esforcoFuncional + i.documentacao, 0);
                          const techHours = items.reduce((s, i) => s + i.esforcoDev + i.testesUnitarios + i.testesIntegrados + i.deploy, 0);
                          
                          // Assume a target duration of 20 business days (1 month)
                          const targetDays = 20;
                          const funcFTE = Math.ceil(funcHours / (8 * targetDays)) || 1;
                          const techFTE = Math.ceil(techHours / (8 * targetDays)) || 1;

                          return (
                            <>
                              <div className="flex justify-between items-center p-3 bg-white rounded-lg shadow-sm">
                                <div>
                                  <div className="font-bold text-gray-800">Equipe Funcional</div>
                                  <div className="text-xs text-gray-500">{funcHours.toFixed(1)}h totais</div>
                                </div>
                                <div className="text-center">
                                  <div className="text-2xl font-black text-delaware-teal">{funcFTE}</div>
                                  <div className="text-[10px] uppercase text-gray-400">Consultores</div>
                                </div>
                              </div>
                              <div className="flex justify-between items-center p-3 bg-white rounded-lg shadow-sm">
                                <div>
                                  <div className="font-bold text-gray-800">Equipe Técnica (ABAP/BTP)</div>
                                  <div className="text-xs text-gray-500">{techHours.toFixed(1)}h totais</div>
                                </div>
                                <div className="text-center">
                                  <div className="text-2xl font-black text-delaware-teal">{techFTE}</div>
                                  <div className="text-[10px] uppercase text-gray-400">Desenvolvedores</div>
                                </div>
                              </div>
                            </>
                          );
                        })()}
                      </div>
                      <p className="text-[11px] text-delaware-teal/70 mt-4 italic">
                        * Cálculo baseado em um cronograma de 20 dias úteis (~1 mês).
                      </p>
                    </div>

                    <div className="space-y-4">
                      <h4 className="font-bold text-gray-700">Marcos do Projeto</h4>
                      <div className="relative pl-8 space-y-6 before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-gray-100">
                        {(() => {
                          const startDate = new Date(projectInfo.data);
                          const funcHours = items.reduce((s, i) => s + i.esforcoFuncional + i.documentacao, 0);
                          const techHours = items.reduce((s, i) => s + i.esforcoDev + i.testesUnitarios + i.testesIntegrados + i.deploy, 0);
                          
                          const funcDays = Math.ceil(funcHours / (8 * 1)); // 1 FTE
                          const techDays = Math.ceil(techHours / (8 * 1)); // 1 FTE
                          
                          // Parallelism: Tech starts after 25% of Func is done
                          const techStartDelay = Math.ceil(funcDays * 0.25);
                          const totalProjectDays = Math.max(funcDays, techStartDelay + techDays);

                          return [
                            { label: 'Início do Projeto', date: startDate, color: 'bg-delaware-teal' },
                            { label: 'Início do Desenvolvimento', date: addBusinessDays(startDate, techStartDelay), color: 'bg-delaware-red' },
                            { label: 'Conclusão Especificações', date: addBusinessDays(startDate, funcDays), color: 'bg-purple-500' },
                            { label: 'Entrega Final (Go-Live)', date: addBusinessDays(startDate, totalProjectDays), color: 'bg-emerald-500' },
                          ].map((milestone, i) => (
                            <div key={i} className="relative">
                              <div className={`absolute -left-8 top-1 w-2.5 h-2.5 rounded-full ${milestone.color} ring-4 ring-white`} />
                              <div className="text-sm font-bold text-gray-800">{milestone.label}</div>
                              <div className="text-xs text-gray-500">{format(milestone.date, 'dd/MM/yyyy')}</div>
                            </div>
                          ));
                        })()}
                      </div>
                    </div>
                  </div>

                  <div className="bg-gray-50 p-6 rounded-xl border border-gray-200">
                    <h4 className="font-bold text-gray-700 mb-6 flex items-center gap-2">
                      <BarChartIcon size={18} className="text-gray-400" />
                      Carga de Trabalho por Equipe (Horas)
                    </h4>
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={[
                            { 
                              name: 'Funcional', 
                              horas: items.reduce((s, i) => s + i.esforcoFuncional + i.documentacao, 0) 
                            },
                            { 
                              name: 'Técnico', 
                              horas: items.reduce((s, i) => s + i.esforcoDev + i.testesUnitarios + i.testesIntegrados + i.deploy, 0) 
                            }
                          ]}
                          layout="vertical"
                          margin={{ left: 20, right: 40 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                          <XAxis type="number" hide />
                          <YAxis dataKey="name" type="category" width={100} />
                          <Tooltip />
                          <Bar dataKey="horas" fill="#72C4BF" radius={[0, 4, 4, 0]} barSize={40} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="mt-6 p-4 bg-white rounded-lg border border-gray-200 text-sm text-gray-600">
                      <p className="flex items-start gap-2">
                        <span className="text-delaware-teal mt-1">ℹ️</span>
                        O cronograma considera que a equipe técnica inicia o desenvolvimento após 25% das especificações funcionais estarem concluídas, permitindo um fluxo contínuo de trabalho.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div 
              key="settings"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
                <div className="flex flex-wrap gap-4 items-end mb-8">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-500">Solicitação</label>
                    <select 
                      value={settingsSolicitacao}
                      onChange={e => setSettingsSolicitacao(e.target.value)}
                      className="block w-48 bg-white border border-gray-300 rounded-md py-2 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-delaware-teal focus:border-delaware-teal"
                    >
                      {uniqueSolicitacoes.map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-500">Tipo</label>
                    <div className="flex gap-2">
                      <select 
                        value={settingsTipo}
                        onChange={e => setSettingsTipo(e.target.value)}
                        className="block w-64 bg-white border border-gray-300 rounded-md py-2 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-delaware-teal focus:border-delaware-teal"
                      >
                        {uniqueTipos.map(t => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                      <button 
                        onClick={() => setIsAddingNewTipo(true)}
                        className="bg-gray-100 text-gray-600 px-3 py-2 rounded-md text-sm hover:bg-gray-200"
                        title="Adicionar Novo Tipo"
                      >
                        <Plus size={16} />
                      </button>
                    </div>
                  </div>
                  <button 
                    onClick={() => {
                      localStorage.setItem('sap_metrics', JSON.stringify(metrics));
                      alert('Métricas salvas com sucesso!');
                    }}
                    className="flex items-center gap-2 bg-[#1e3a5f] text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-[#152a45] transition-colors"
                  >
                    <Save size={16} />
                    Salvar Métricas
                  </button>

                  <div className="ml-auto flex items-center gap-2 px-4 py-2 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="w-2 h-2 rounded-full bg-green-500" />
                    <span className="text-xs font-medium text-gray-600">
                      IA: Configurada
                    </span>
                  </div>
                </div>

                {isAddingNewTipo && (
                  <div className="mb-8 p-4 bg-gray-50 rounded-lg border border-gray-200 flex items-end gap-4">
                    <div className="space-y-1 flex-1">
                      <label className="text-xs font-medium text-gray-500">Nome do Novo Tipo</label>
                      <input 
                        type="text" 
                        value={newTipoName}
                        onChange={e => setNewTipoName(e.target.value)}
                        placeholder="Ex: Novo Módulo Customizado"
                        className="block w-full bg-white border border-gray-300 rounded-md py-2 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-delaware-teal focus:border-delaware-teal"
                      />
                    </div>
                    <button 
                      onClick={addNewTipo}
                      className="bg-green-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-green-700"
                    >
                      Adicionar
                    </button>
                    <button 
                      onClick={() => setIsAddingNewTipo(false)}
                      className="bg-gray-200 text-gray-700 px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-300"
                    >
                      Cancelar
                    </button>
                  </div>
                )}

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-gray-50 text-gray-500 text-xs font-semibold border-b border-gray-200">
                        <th className="px-4 py-4">Complexidade</th>
                        <th className="px-2 py-4 text-center">Max Pontos</th>
                        <th className="px-4 py-4 text-center">Esforço DEV</th>
                        <th className="px-4 py-4 text-center">Esforço Func.</th>
                        <th className="px-4 py-4 text-center">Testes Unit.</th>
                        <th className="px-4 py-4 text-center">Testes Integ.</th>
                        <th className="px-4 py-4 text-center">Documentação</th>
                        <th className="px-4 py-4 text-center">Deploy</th>
                        <th className="px-4 py-4 text-center font-bold text-gray-700">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredMetrics.map((m) => {
                        const idx = metrics.findIndex(metric => metric.id === m.id);
                        return (
                          <tr key={m.id} className="hover:bg-gray-50">
                            <td className="px-4 py-4 font-bold text-sm flex items-center gap-2">
                              <span className={
                                m.complexidade === 'PP' ? 'text-green-600' :
                                m.complexidade === 'P' ? 'text-blue-600' :
                                m.complexidade === 'M' ? 'text-yellow-600' :
                                m.complexidade === 'G' ? 'text-orange-600' : 'text-red-600'
                              }>{m.complexidade}</span>
                            </td>
                            <td className="px-2 py-4 text-center">
                              <input 
                                type="number" 
                                value={m.pontosMaximos || 0}
                                onChange={e => {
                                  const val = parseFloat(e.target.value) || 0;
                                  const newMetrics = [...metrics];
                                  newMetrics[idx] = { ...m, pontosMaximos: val };
                                  setMetrics(newMetrics);
                                }}
                                className="w-16 text-center bg-gray-50 border border-gray-300 rounded-md py-1.5 text-sm font-bold text-delaware-teal focus:outline-none focus:ring-1 focus:ring-delaware-teal"
                                title="Pontos máximos para classificar nesta complexidade"
                              />
                            </td>
                            <td className="px-4 py-4 text-center">
                              <input 
                                type="number" 
                                value={m.esforcoDev}
                                onChange={e => {
                                  const val = parseFloat(e.target.value) || 0;
                                  const newMetrics = [...metrics];
                                  newMetrics[idx] = { ...m, esforcoDev: val, total: val + m.esforcoFuncional + m.testesUnitarios + m.testesIntegrados + m.documentacao + m.deploy };
                                  setMetrics(newMetrics);
                                }}
                                className="w-20 text-center bg-white border border-gray-300 rounded-md py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-delaware-teal"
                              />
                            </td>
                            <td className="px-4 py-4 text-center">
                              <input 
                                type="number" 
                                value={m.esforcoFuncional}
                                onChange={e => {
                                  const val = parseFloat(e.target.value) || 0;
                                  const newMetrics = [...metrics];
                                  newMetrics[idx] = { ...m, esforcoFuncional: val, total: m.esforcoDev + val + m.testesUnitarios + m.testesIntegrados + m.documentacao + m.deploy };
                                  setMetrics(newMetrics);
                                }}
                                className="w-20 text-center bg-white border border-gray-300 rounded-md py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-delaware-teal"
                              />
                            </td>
                            <td className="px-4 py-4 text-center">
                              <input 
                                type="number" 
                                value={m.testesUnitarios}
                                onChange={e => {
                                  const val = parseFloat(e.target.value) || 0;
                                  const newMetrics = [...metrics];
                                  newMetrics[idx] = { ...m, testesUnitarios: val, total: m.esforcoDev + m.esforcoFuncional + val + m.testesIntegrados + m.documentacao + m.deploy };
                                  setMetrics(newMetrics);
                                }}
                                className="w-20 text-center bg-white border border-gray-300 rounded-md py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-delaware-teal"
                              />
                            </td>
                            <td className="px-4 py-4 text-center">
                              <input 
                                type="number" 
                                value={m.testesIntegrados}
                                onChange={e => {
                                  const val = parseFloat(e.target.value) || 0;
                                  const newMetrics = [...metrics];
                                  newMetrics[idx] = { ...m, testesIntegrados: val, total: m.esforcoDev + m.esforcoFuncional + m.testesUnitarios + val + m.documentacao + m.deploy };
                                  setMetrics(newMetrics);
                                }}
                                className="w-20 text-center bg-white border border-gray-300 rounded-md py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-delaware-teal"
                              />
                            </td>
                            <td className="px-4 py-4 text-center">
                              <input 
                                type="number" 
                                value={m.documentacao}
                                onChange={e => {
                                  const val = parseFloat(e.target.value) || 0;
                                  const newMetrics = [...metrics];
                                  newMetrics[idx] = { ...m, documentacao: val, total: m.esforcoDev + m.esforcoFuncional + m.testesUnitarios + m.testesIntegrados + val + m.deploy };
                                  setMetrics(newMetrics);
                                }}
                                className="w-20 text-center bg-white border border-gray-300 rounded-md py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-delaware-teal"
                              />
                            </td>
                            <td className="px-4 py-4 text-center">
                              <input 
                                type="number" 
                                value={m.deploy}
                                onChange={e => {
                                  const val = parseFloat(e.target.value) || 0;
                                  const newMetrics = [...metrics];
                                  newMetrics[idx] = { ...m, deploy: val, total: m.esforcoDev + m.esforcoFuncional + m.testesUnitarios + m.testesIntegrados + m.documentacao + val };
                                  setMetrics(newMetrics);
                                }}
                                className="w-20 text-center bg-white border border-gray-300 rounded-md py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-delaware-teal"
                              />
                            </td>
                            <td className="px-4 py-4 text-center font-bold text-delaware-red">{m.total.toFixed(1)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <footer className="mt-auto py-6 px-8 border-t border-gray-100 bg-gray-50 text-center">
        <div className="max-w-[1600px] mx-auto flex justify-between items-center text-xs text-gray-400 uppercase tracking-widest">
          <div>SAP S/4HANA Estimation Tool</div>
          <div className="font-bold">2026 © delaware</div>
          <div>v2.1.0</div>
        </div>
      </footer>

      {/* Global AI Analysis Modal */}
      <AnimatePresence>
        {globalAiAnalysis && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-xl shadow-xl border border-gray-200 w-full max-w-4xl max-h-[80vh] flex flex-col"
            >
              <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50 rounded-t-xl">
                <div className="flex items-center gap-2 text-delaware-teal">
                  <Brain size={20} />
                  <h3 className="font-semibold">Análise Global da IA</h3>
                </div>
                <button 
                  onClick={() => setGlobalAiAnalysis(null)}
                  className="p-1 hover:bg-gray-200 rounded-full transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="p-6 overflow-y-auto prose prose-sm max-w-none">
                <ReactMarkdown>{globalAiAnalysis}</ReactMarkdown>
              </div>
              <div className="p-4 border-t border-gray-100 flex justify-end bg-gray-50 rounded-b-xl">
                <button 
                  onClick={() => setGlobalAiAnalysis(null)}
                  className="px-4 py-2 bg-delaware-teal text-white rounded-md text-sm font-medium hover:bg-[#008c84]"
                >
                  Fechar Análise
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* New/Edit GAP Modal */}
      <AnimatePresence>
        {isModalOpen && editingItem && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-xl shadow-xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-delaware-teal/5">
                <h2 className="text-lg font-bold text-delaware-teal">
                  {items.find(i => i.id === editingItem.id) ? 'Editar GAP' : `Novo GAP #${items.length + 1}`}
                </h2>
                <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                  <X size={20} />
                </button>
              </div>
              
              <div className="p-6 overflow-y-auto flex-1 space-y-6">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-700">Título do GAP</label>
                  <input 
                    type="text" 
                    value={editingItem.titulo}
                    onChange={e => setEditingItem({...editingItem, titulo: e.target.value})}
                    placeholder="Ex: GAP001 - Impressão formulário de Pedidos"
                    className="w-full bg-white border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-delaware-teal outline-none"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-700">Scope Item</label>
                    <input 
                      type="text" 
                      value={editingItem.scopeItem}
                      onChange={e => setEditingItem({...editingItem, scopeItem: e.target.value})}
                      placeholder="Ex: 2RP"
                      className="w-full bg-white border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-delaware-teal outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-700">Novo ou Existente? *</label>
                    <select 
                      value={editingItem.novoOuExistente}
                      onChange={e => {
                        const updated = {...editingItem, novoOuExistente: e.target.value as any};
                        updateItemCalculations(updated, metrics);
                        setEditingItem(updated);
                      }}
                      className="w-full bg-white border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-delaware-teal outline-none"
                    >
                      {uniqueSolicitacoes.map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-700">Tipo Solicitação *</label>
                    <select 
                      value={editingItem.tipoSolicitacao}
                      onChange={e => {
                        const updated = {...editingItem, tipoSolicitacao: e.target.value};
                        updateItemCalculations(updated, metrics);
                        setEditingItem(updated);
                      }}
                      className="w-full bg-white border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-delaware-teal outline-none"
                    >
                      {uniqueTipos.map(t => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-700">Complexidade *</label>
                    <select 
                      value={editingItem.complexidade}
                      onChange={e => {
                        const updated = {...editingItem, complexidade: e.target.value as Complexity};
                        updateItemCalculations(updated, metrics);
                        setEditingItem(updated);
                      }}
                      className="w-full bg-white border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-delaware-teal outline-none"
                    >
                      <option value="PP">PP</option>
                      <option value="P">P</option>
                      <option value="M">M</option>
                      <option value="G">G</option>
                      <option value="GG">GG</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-700">Funcional</label>
                    <input 
                      type="text" 
                      value={editingItem.funcional}
                      onChange={e => setEditingItem({...editingItem, funcional: e.target.value})}
                      placeholder="Ex: FI, CO"
                      className="w-full bg-white border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-delaware-teal outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-700">Tecnologia</label>
                    <input 
                      type="text" 
                      value={editingItem.tecnologia}
                      onChange={e => setEditingItem({...editingItem, tecnologia: e.target.value})}
                      placeholder="Ex: CPI, ABAP"
                      className="w-full bg-white border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-delaware-teal outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-700">Severidade</label>
                    <select 
                      value={editingItem.severidade}
                      onChange={e => setEditingItem({...editingItem, severidade: e.target.value as any})}
                      className="w-full bg-white border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-delaware-teal outline-none"
                    >
                      <option value="Baixa">Baixa</option>
                      <option value="Média">Média</option>
                      <option value="Alta">Alta</option>
                      <option value="Crítica">Crítica</option>
                      <option value="Essencial">Essencial</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-700">Observação</label>
                    <input 
                      type="text" 
                      value={editingItem.observacao}
                      onChange={e => setEditingItem({...editingItem, observacao: e.target.value})}
                      className="w-full bg-white border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-delaware-teal outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-medium text-gray-700">Descrição</label>
                    <button 
                      onClick={handleAnalyzeComplexity}
                      disabled={isComplexityAnalyzing || !editingItem.descricao}
                      className="text-xs flex items-center gap-1 bg-delaware-teal/10 text-delaware-teal px-2 py-1 rounded hover:bg-delaware-teal/20 transition-colors disabled:opacity-50"
                      title="Analisar parâmetros e determinar complexidade com IA"
                    >
                      {isComplexityAnalyzing ? <Loader2 size={12} className="animate-spin" /> : <Brain size={12} />}
                      Determinar Complexidade (Máquina)
                    </button>
                  </div>
                  <textarea 
                    value={editingItem.descricao}
                    onChange={e => setEditingItem({...editingItem, descricao: e.target.value})}
                    placeholder="Descreva o desenvolvimento..."
                    rows={4}
                    className="w-full bg-white border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-delaware-teal outline-none resize-none"
                  />
                </div>

                {editingItem.complexityParams && (
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mt-4 space-y-4">
                    <div className="flex items-center justify-between cursor-pointer" onClick={() => setShowFicha(!showFicha)}>
                      <div className="flex items-center gap-2">
                        <Cpu size={16} className="text-[#3b82f6]" />
                        <h4 className="font-bold text-sm text-gray-800">Ficha de Complexidade (IA)</h4>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-sm">
                          Score: <span className="font-bold text-delaware-teal">{editingItem.complexityScore?.toFixed(2) || 0} pts</span>
                        </div>
                        <div className="text-xs text-[#3b82f6] hover:underline">
                          {showFicha ? 'Esconder Parâmetros' : 'Ver Parâmetros'}
                        </div>
                      </div>
                    </div>
                    
                    <AnimatePresence>
                      {showFicha && (
                        <motion.div 
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 pt-4 border-t border-gray-200 text-xs">
                            {Object.entries(paramLabels).map(([key, label]) => {
                              const val = editingItem.complexityParams?.[key as keyof Required<EstimationItem>['complexityParams']];
                              const isBool = typeof val === 'boolean';
                              return (
                                <div key={key} className="flex flex-col gap-1 p-2 bg-white rounded border">
                                  <label className="text-gray-500 truncate" title={label}>{label}</label>
                                  {isBool ? (
                                    <input 
                                      type="checkbox" 
                                      checked={val as boolean}
                                      onChange={e => {
                                        const newParams = { ...editingItem.complexityParams, [key]: e.target.checked };
                                        const newScore = calculateComplexityScore(newParams as any);
                                        setEditingItem({...editingItem, complexityParams: newParams as any, complexityScore: newScore});
                                      }}
                                      className="rounded"
                                    />
                                  ) : (
                                    <input 
                                      type="number"
                                      value={(val as number) || 0}
                                      onChange={e => {
                                        const newParams = { ...editingItem.complexityParams, [key]: parseFloat(e.target.value) || 0 };
                                        const newScore = calculateComplexityScore(newParams as any);
                                        setEditingItem({...editingItem, complexityParams: newParams as any, complexityScore: newScore});
                                      }}
                                      className="border rounded px-2 text-gray-800 w-full"
                                    />
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Risks Checklist */}
                  <div className="space-y-3 p-4 bg-red-50/50 rounded-lg border border-red-100">
                    <h4 className="text-xs font-bold text-delaware-red uppercase tracking-wider flex items-center gap-2">
                      <Brain size={14} />
                      Fatores de Risco
                    </h4>
                    <div className="space-y-2">
                      <label className="flex items-center gap-3 cursor-pointer group">
                        <input 
                          type="checkbox" 
                          checked={editingItem.riscoFsIncompleta}
                          onChange={e => {
                            const updated = {...editingItem, riscoFsIncompleta: e.target.checked};
                            updateItemCalculations(updated, metrics);
                            setEditingItem(updated);
                          }}
                          className="rounded text-delaware-red focus:ring-delaware-red" 
                        />
                        <span className="text-sm text-gray-700 group-hover:text-delaware-red">Especificação Funcional Incompleta (+20%)</span>
                      </label>
                      <label className="flex items-center gap-3 cursor-pointer group">
                        <input 
                          type="checkbox" 
                          checked={editingItem.riscoTecnologiaNova}
                          onChange={e => {
                            const updated = {...editingItem, riscoTecnologiaNova: e.target.checked};
                            updateItemCalculations(updated, metrics);
                            setEditingItem(updated);
                          }}
                          className="rounded text-delaware-red focus:ring-delaware-red" 
                        />
                        <span className="text-sm text-gray-700 group-hover:text-delaware-red">Tecnologia Nova para o Time (+30%)</span>
                      </label>
                      <label className="flex items-center gap-3 cursor-pointer group">
                        <input 
                          type="checkbox" 
                          checked={editingItem.riscoDependenciaTerceiros}
                          onChange={e => {
                            const updated = {...editingItem, riscoDependenciaTerceiros: e.target.checked};
                            updateItemCalculations(updated, metrics);
                            setEditingItem(updated);
                          }}
                          className="rounded text-delaware-red focus:ring-delaware-red" 
                        />
                        <span className="text-sm text-gray-700 group-hover:text-delaware-red">Dependência de Terceiros/Middleware (+10h)</span>
                      </label>
                    </div>
                  </div>

                  {/* Non-coding Phases */}
                  <div className="space-y-3 p-4 bg-delaware-teal/5 rounded-lg border border-delaware-teal/10">
                    <h4 className="text-xs font-bold text-delaware-teal uppercase tracking-wider flex items-center gap-2">
                      <CalendarIcon size={14} />
                      Fases Não-Codificação (Horas)
                    </h4>
                    <div className="grid grid-cols-1 gap-2">
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-sm text-gray-700">Review de FS (Qualidade)</span>
                        <input 
                          type="number" 
                          value={editingItem.horasFSReview || 0}
                          onChange={e => {
                            const val = parseFloat(e.target.value) || 0;
                            const updated = {...editingItem, horasFSReview: val};
                            updateItemCalculations(updated, metrics);
                            setEditingItem(updated);
                          }}
                          className="w-16 border rounded px-2 py-1 text-sm text-center"
                        />
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-sm text-gray-700">Suporte TMS / Transport Key</span>
                        <input 
                          type="number" 
                          value={editingItem.horasSuporteTMS || 0}
                          onChange={e => {
                            const val = parseFloat(e.target.value) || 0;
                            const updated = {...editingItem, horasSuporteTMS: val};
                            updateItemCalculations(updated, metrics);
                            setEditingItem(updated);
                          }}
                          className="w-16 border rounded px-2 py-1 text-sm text-center"
                        />
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-sm text-gray-700">Suporte ao UAT / Hypercare</span>
                        <input 
                          type="number" 
                          value={editingItem.horasSuporteUAT || 0}
                          onChange={e => {
                            const val = parseFloat(e.target.value) || 0;
                            const updated = {...editingItem, horasSuporteUAT: val};
                            updateItemCalculations(updated, metrics);
                            setEditingItem(updated);
                          }}
                          className="w-16 border rounded px-2 py-1 text-sm text-center"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Live Preview of Calculation */}
                <div className="bg-gray-50 rounded-lg p-4 flex justify-between items-center border border-gray-200">
                  <div className="text-center">
                    <div className="text-xs text-gray-500 mb-1">DEV</div>
                    <div className="font-bold text-sm">{editingItem.esforcoDev}h</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-gray-500 mb-1">T. Unit.</div>
                    <div className="font-bold text-sm">{editingItem.testesUnitarios}h</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-gray-500 mb-1">Func.</div>
                    <div className="font-bold text-sm">{editingItem.esforcoFuncional}h</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-gray-500 mb-1">T. Integ.</div>
                    <div className="font-bold text-sm">{editingItem.testesIntegrados}h</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-gray-500 mb-1">Doc.</div>
                    <div className="font-bold text-sm">{editingItem.documentacao}h</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-gray-500 mb-1">Deploy</div>
                    <div className="font-bold text-sm">{editingItem.deploy}h</div>
                  </div>
                  <div className="text-center bg-delaware-red/10 px-6 py-2 rounded-md">
                    <div className="text-xs text-delaware-red font-bold mb-1">Total</div>
                    <div className="font-bold text-delaware-red">{editingItem.total.toFixed(1)}h</div>
                  </div>
                </div>
              </div>

              <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3 bg-gray-50">
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100"
                >
                  Cancelar
                </button>
                <button 
                  onClick={saveItem}
                  className="px-4 py-2 bg-[#7a8b9e] text-white rounded-md text-sm font-medium hover:bg-[#627488]"
                >
                  {items.find(i => i.id === editingItem.id) ? 'Salvar Alterações' : '+ Adicionar GAP'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Progress Overlay para Análise em Lote */}
      <AnimatePresence>
        {isAnalyzing && analysisProgress.total > 1 && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999] flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center"
            >
              <div className="w-16 h-16 bg-delaware-teal/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <Sparkles className="text-delaware-teal animate-pulse" size={32} />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Analisando GAPs com IA</h3>
              <p className="text-gray-500 mb-8">
                Utilizando o Gemini para classificar e analisar Clean Core...
              </p>
              
              <div className="space-y-4">
                <div className="flex justify-between text-sm font-medium text-gray-700">
                  <span>Progresso</span>
                  <span>{Math.round((analysisProgress.current / analysisProgress.total) * 100)}%</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
                  <motion.div 
                    className="h-full bg-delaware-teal"
                    initial={{ width: 0 }}
                    animate={{ width: `${(analysisProgress.current / analysisProgress.total) * 100}%` }}
                    transition={{ type: "spring", bounce: 0, duration: 0.3 }}
                  />
                </div>
                <div className="text-sm text-gray-500">
                  {analysisProgress.current} de {analysisProgress.total} itens processados
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Hidden PDF Report Template - Isolado para evitar bleed-through de UI */}
      <div 
        id="pdf-container-wrapper"
        style={{ position: 'fixed', top: '100vh', left: 0, width: '210mm', zIndex: -9999, pointerEvents: 'none' }}
        className="bg-white"
      >
        <ReportTemplate 
          items={items} 
          projectInfo={projectInfo} 
          aiAnalysis={aiAnalysis} 
          totalHours={totalHours} 
        />
      </div>

      {/* Documentation Modal */}
      <AnimatePresence>
        {docModal.isOpen && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden"
            >
              <div className="bg-delaware-gray p-4 text-white flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <div className={`p-2 rounded-lg ${docModal.type === 'EF' ? 'bg-delaware-teal' : 'bg-delaware-red'}`}>
                    {docModal.type === 'EF' ? <FileText size={20} /> : <Cpu size={20} />}
                  </div>
                  <div>
                    <h2 className="text-xl font-bold">
                      {docModal.type === 'EF' ? 'Especificação Funcional (Draft)' : 'Especificação Técnica (Draft)'}
                    </h2>
                    <p className="text-xs text-white/60">Boilerplate gerado por IA - Refine o conteúdo abaixo</p>
                  </div>
                </div>
                <button 
                  onClick={() => setDocModal({ ...docModal, isOpen: false })}
                  className="text-white/60 hover:text-white transition-colors"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 flex gap-6 flex-col lg:flex-row">
                <div className="flex-1 space-y-4">
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Editor Markdown</h3>
                  <textarea 
                    value={docModal.content}
                    onChange={e => setDocModal({ ...docModal, content: e.target.value })}
                    className="w-full h-48 lg:h-[500px] p-4 font-mono text-sm border rounded-lg focus:ring-2 focus:ring-delaware-teal outline-none resize-none bg-gray-50/50"
                  />
                </div>
                <div className="flex-1 space-y-4 border-l pl-6 overflow-y-auto max-h-[300px] lg:max-h-[550px]">
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Preview</h3>
                  <div className="prose prose-sm max-w-none">
                    <ReactMarkdown>{docModal.content}</ReactMarkdown>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 p-4 border-t flex justify-between items-center">
                <p className="text-xs text-gray-500 italic">
                  💡 {docModal.type === 'EF' ? 'Gerado pelo Google Gemini' : 'Gerado pelo Claude (Simulação)'}
                </p>
                <div className="flex gap-3">
                  <button 
                    onClick={() => setDocModal({ ...docModal, isOpen: false })}
                    className="px-6 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors"
                  >
                    Descartar
                  </button>
                  <button 
                    onClick={() => {
                      if (docModal.itemId) {
                        setItems(prevItems => prevItems.map(i => 
                          i.id === docModal.itemId 
                            ? { ...i, [docModal.type === 'EF' ? 'especificacaoFuncional' : 'especificacaoTecnica']: docModal.content } 
                            : i
                        ));
                      }
                      setDocModal({ ...docModal, isOpen: false });
                    }}
                    className="bg-delaware-teal text-white px-8 py-2 rounded-lg text-sm font-medium hover:bg-delaware-teal/90 shadow-lg shadow-delaware-teal/20 transition-all"
                  >
                    Salvar na Base
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

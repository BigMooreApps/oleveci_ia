import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { OliCustomRule, OliPlanResponse } from '../../types';
import {
  Sparkles,
  Bot,
  Zap,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Play,
  Key,
  ScrollText,
  Download,
  Trash2,
  Phone,
  Store,
  MapPin,
  Sliders,
  ShieldCheck,
  Clock,
  Activity,
  Layers,
  Search,
  Check,
  ChevronDown,
  ChevronUp,
  QrCode,
  FileText,
  Plus,
  Pencil,
  Power,
  RotateCcw,
  X,
  HelpCircle,
  Eye,
  EyeOff,
  Copy,
  User,
  Globe,
  MessageSquare,
} from 'lucide-react';
import { WhatsAppIcon } from '../WhatsAppIcon';

import { OliWhatsAppModal } from '../OliWhatsAppModal';

export interface OliLogMessage {
  id?: string;
  sender: 'user' | 'oli';
  text: string;
  timestamp: string;
  responseType?: string;
  stopsCount?: number;
  stops?: any[];
  matchedBusinesses?: Array<{ id: string; name: string; city?: string; phone?: string }>;
}

export interface OliLogEntry {
  id: string;
  channel?: 'web' | 'mobile' | 'whatsapp';
  startedAt?: string;
  lastUpdatedAt?: string;
  timestamp?: string; // backwards compatibility
  currentCity: string;
  userBudget?: number;
  totalTurns?: number;
  latestPrompt?: string;
  latestResponse?: string;
  userPrompt?: string; // backwards compatibility
  spokenText?: string; // backwards compatibility
  totalCost?: number;
  stopsCount?: number;
  matchedBusinessesCount?: number;
  stops?: any[];
  matchedBusinesses?: Array<{ id: string; name: string; city: string; phone?: string }>;
  messages?: OliLogMessage[];
}

export const AdminOliTab: React.FC = () => {
  const { businesses, posts } = useApp();

  // Active sub-tab inside Admin Oli section (Removed 'catalog')
  const [activeSubTab, setActiveSubTab] = useState<
    'models' | 'logs' | 'whatsapp' | 'rules'
  >('models');

  // LLM Config & Key management
  const [hasApiKey, setHasApiKey] = useState(false);
  const [provider, setProvider] = useState<'groq' | 'gemini' | 'local'>('groq');
  const [groqApiKey, setGroqApiKey] = useState('');
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [selectedLlm, setSelectedLlm] = useState<'groq' | 'gemini' | 'local'>('groq');
  const [inputApiKey, setInputApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [isSavingKey, setIsSavingKey] = useState(false);
  const [keySaveMessage, setKeySaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Live Playground Test Bench
  const [testPrompt, setTestPrompt] = useState('quiero almorzar en cajica con 40 mil pesos');
  const [testCity, setTestCity] = useState('Cajicá');
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    response: OliPlanResponse;
    durationMs: number;
    providerUsed: string;
  } | null>(null);
  const [testError, setTestError] = useState<string | null>(null);

  // Conversation Logs
  const [logs, setLogs] = useState<OliLogEntry[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [logFilterCity, setLogFilterCity] = useState('all');
  const [logSearchQuery, setLogSearchQuery] = useState('');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [isClearingLogs, setIsClearingLogs] = useState(false);

  // WhatsApp Baileys Status
  const [baileysStatus, setBaileysStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const [baileysQr, setBaileysQr] = useState<string | null>(null);
  const [baileysPhone, setBaileysPhone] = useState<string | null>(null);
  const [baileysLoading, setBaileysLoading] = useState(false);
  const [isWhatsAppModalOpen, setIsWhatsAppModalOpen] = useState(false);

  // Dynamic OLI Rules State
  const [rules, setRules] = useState<OliCustomRule[]>([]);
  const [isLoadingRules, setIsLoadingRules] = useState(false);
  const [rulesSearchQuery, setRulesSearchQuery] = useState('');
  const [isRuleModalOpen, setIsRuleModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<OliCustomRule | null>(null);
  const [ruleModalTitle, setRuleModalTitle] = useState('');
  const [ruleModalInstruction, setRuleModalInstruction] = useState('');
  const [ruleModalCategory, setRuleModalCategory] = useState<'tone' | 'business' | 'itinerary' | 'budget' | 'custom'>('custom');
  const [ruleModalActive, setRuleModalActive] = useState(true);
  const [isSavingRule, setIsSavingRule] = useState(false);

  // Fetch initial configuration & status
  const fetchConfig = () => {
    fetch('/api/oli/config')
      .then((res) => res.json())
      .then((data) => {
        if (data) {
          setHasApiKey(Boolean(data.hasApiKey));
          const prov = (data.provider === 'none' ? 'local' : data.provider) || 'groq';
          setProvider(prov);
          setGroqApiKey(data.groqApiKey || '');
          setGeminiApiKey(data.geminiApiKey || '');
          setSelectedLlm((curr) => {
            const next = curr || prov;
            if (next === 'groq') setInputApiKey(data.groqApiKey || '');
            else if (next === 'gemini') setInputApiKey(data.geminiApiKey || '');
            else setInputApiKey('');
            return next;
          });
        }
      })
      .catch(() => {});
  };

  const handleSelectLlmCard = (card: 'groq' | 'gemini' | 'local') => {
    setSelectedLlm(card);
    setKeySaveMessage(null);
    setShowKey(false);
    if (card === 'groq') {
      setInputApiKey(groqApiKey);
    } else if (card === 'gemini') {
      setInputApiKey(geminiApiKey);
    } else {
      setInputApiKey('');
    }
  };

  const fetchLogs = () => {
    setIsLoadingLogs(true);
    fetch('/api/oli/conversation-logs')
      .then((res) => res.json())
      .then((data) => {
        if (data && Array.isArray(data.logs)) {
          setLogs(data.logs.reverse());
        }
      })
      .catch(() => {})
      .finally(() => setIsLoadingLogs(false));
  };

  const fetchBaileysStatus = () => {
    fetch('/api/whatsapp/baileys/status')
      .then((res) => res.json())
      .then((data) => {
        if (data) {
          setBaileysStatus(data.status);
          setBaileysQr(data.qrCodeDataUrl || null);
          setBaileysPhone(data.connectedPhone || null);
        }
      })
      .catch(() => {});
  };

  const fetchRules = () => {
    setIsLoadingRules(true);
    fetch('/api/oli/rules')
      .then((res) => res.json())
      .then((data) => {
        if (data && Array.isArray(data.rules)) {
          setRules(data.rules);
        }
      })
      .catch(() => {})
      .finally(() => setIsLoadingRules(false));
  };

  useEffect(() => {
    fetchConfig();
    fetchLogs();
    fetchBaileysStatus();
    fetchRules();
  }, []);

  // Poll Baileys status when in whatsapp subtab
  useEffect(() => {
    if (activeSubTab === 'whatsapp') {
      fetchBaileysStatus();
      const interval = setInterval(fetchBaileysStatus, 3000);
      return () => clearInterval(interval);
    }
  }, [activeSubTab]);

  // Handle save API key or active provider
  const handleSaveApiKey = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsSavingKey(true);
    setKeySaveMessage(null);
    try {
      const payload: any = { provider: selectedLlm };
      if (selectedLlm === 'groq') {
        payload.groqApiKey = inputApiKey.trim();
      } else if (selectedLlm === 'gemini') {
        payload.geminiApiKey = inputApiKey.trim();
      }

      const res = await fetch('/api/oli/set-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok) {
        setHasApiKey(data.hasApiKey);
        setProvider(data.provider);
        setGroqApiKey(data.groqApiKey || '');
        setGeminiApiKey(data.geminiApiKey || '');
        setKeySaveMessage({
          type: 'success',
          text: `¡Motor ${selectedLlm === 'groq' ? 'Groq Cloud (Llama 3.3)' : selectedLlm === 'gemini' ? 'Google Gemini (Flash)' : 'Motor Semántico Local'} activado correctamente!`,
        });
      } else {
        setKeySaveMessage({ type: 'error', text: data.error || 'Error al guardar la clave API' });
      }
    } catch {
      setKeySaveMessage({ type: 'error', text: 'Error de conexión con el servidor local' });
    } finally {
      setIsSavingKey(false);
    }
  };

  const handleCopyCurrentKey = (keyVal: string) => {
    if (!keyVal) return;
    navigator.clipboard.writeText(keyVal);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  // Handle Run Test Prompt
  const handleRunTest = async () => {
    if (!testPrompt.trim() || isTesting) return;

    setIsTesting(true);
    setTestError(null);
    setTestResult(null);

    const startTime = performance.now();
    try {
      const res = await fetch('/api/oli/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userPrompt: testPrompt.trim(),
          currentCity: testCity,
          messageHistory: [],
        }),
      });

      const endTime = performance.now();
      const durationMs = Math.round(endTime - startTime);

      if (!res.ok) {
        throw new Error(`Error ${res.status}: Falló el procesamiento del asistente`);
      }

      const planData: OliPlanResponse = await res.json();
      setTestResult({
        response: planData,
        durationMs,
        providerUsed: planData.auditTrace?.provider || (hasApiKey ? 'groq / gemini' : 'motor_local_sabana'),
      });
      fetchLogs();
    } catch (err: any) {
      setTestError(err.message || 'Error ejecutando prueba');
    } finally {
      setIsTesting(false);
    }
  };

  // Clear Logs
  const handleClearLogs = async () => {
    if (!window.confirm('¿Estás seguro de que deseas vaciar todos los registros de auditoría de Oli?')) {
      return;
    }
    setIsClearingLogs(true);
    try {
      await fetch('/api/oli/conversation-logs', { method: 'DELETE' });
      setLogs([]);
    } catch {
      alert('Error eliminando registros');
    } finally {
      setIsClearingLogs(false);
    }
  };

  // Export logs to Markdown
  const handleExportLogs = () => {
    if (logs.length === 0) return;

    let md = `# REGISTRO DE AUDITORÍA Y CONVERSACIONES OLI (OLEVECI)\n\n`;
    md += `*Fecha de Exportación:* ${new Date().toLocaleString('es-CO')}\n`;
    md += `*Total de Chats Completos:* ${logs.length}\n`;
    md += `*Proveedor Activo:* ${provider.toUpperCase()}\n\n---\n\n`;

    logs.forEach((log, idx) => {
      const messagesList: OliLogMessage[] =
        log.messages && Array.isArray(log.messages) && log.messages.length > 0
          ? log.messages
          : [
              { sender: 'user', text: log.userPrompt || log.latestPrompt || '', timestamp: log.timestamp || log.startedAt || '' },
              { sender: 'oli', text: log.spokenText || log.latestResponse || '', timestamp: log.timestamp || log.lastUpdatedAt || '', stops: log.stops, matchedBusinesses: log.matchedBusinesses },
            ];

      const turns = log.totalTurns || Math.ceil(messagesList.length / 2) || 1;
      const started = new Date(log.startedAt || log.timestamp || Date.now()).toLocaleString('es-CO');
      const updated = new Date(log.lastUpdatedAt || log.timestamp || Date.now()).toLocaleString('es-CO');

      md += `## Chat #${idx + 1}: ${log.id} (${(log.channel || 'web').toUpperCase()})\n`;
      md += `- **Municipio:** ${log.currentCity}\n`;
      md += `- **Inicio:** ${started} | **Última actividad:** ${updated}\n`;
      md += `- **Total de Interacciones en este Chat:** ${turns}\n`;
      md += `\n### Transcripción Completa del Chat:\n\n`;

      messagesList.forEach((m) => {
        const who = m.sender === 'user' ? '👤 Usuario' : '🤖 Oli';
        const timeStr = m.timestamp ? new Date(m.timestamp).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }) : '';
        md += `**[${who}]** ${timeStr ? `(${timeStr})` : ''}\n`;
        md += `${m.text}\n\n`;

        if (m.stops && m.stops.length > 0) {
          md += `*Paradas del Itinerario (${m.stops.length}):*\n`;
          m.stops.forEach((s: any, sIdx: number) => {
            md += `  ${sIdx + 1}. **${s.businessName}** (${s.businessCity}) - ${s.activity} [$ ${s.cost ? s.cost.toLocaleString('es-CO') : 0}]\n`;
          });
          md += `\n`;
        }
        if (m.matchedBusinesses && m.matchedBusinesses.length > 0) {
          md += `*Comercios recomendados:*\n`;
          m.matchedBusinesses.forEach((b: any) => {
            md += `  - ${b.name} (${b.city}) - Tel: ${b.phone || 'N/A'}\n`;
          });
          md += `\n`;
        }
      });
      md += `---\n\n`;
    });

    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `conversaciones_completas_oli_${new Date().toISOString().slice(0, 10)}.md`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // WhatsApp Baileys Handlers
  const handleConnectBaileys = async () => {
    setBaileysLoading(true);
    try {
      await fetch('/api/whatsapp/baileys/connect', { method: 'POST' });
      fetchBaileysStatus();
    } catch {
      alert('Error iniciando servicio de WhatsApp');
    } finally {
      setBaileysLoading(false);
    }
  };

  const handleDisconnectBaileys = async () => {
    if (!window.confirm('¿Deseas desconectar la sesión activa de WhatsApp Web?')) return;
    setBaileysLoading(true);
    try {
      await fetch('/api/whatsapp/baileys/disconnect', { method: 'POST' });
      fetchBaileysStatus();
    } catch {
      alert('Error desconectando sesión');
    } finally {
      setBaileysLoading(false);
    }
  };

  // Rules Handlers (CRUD)
  const handleOpenCreateRule = () => {
    setEditingRule(null);
    setRuleModalTitle('');
    setRuleModalInstruction('');
    setRuleModalCategory('custom');
    setRuleModalActive(true);
    setIsRuleModalOpen(true);
  };

  const handleOpenEditRule = (rule: OliCustomRule) => {
    setEditingRule(rule);
    setRuleModalTitle(rule.title);
    setRuleModalInstruction(rule.instruction);
    setRuleModalCategory(rule.category || 'custom');
    setRuleModalActive(rule.active);
    setIsRuleModalOpen(true);
  };

  const handleSaveRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ruleModalTitle.trim() || !ruleModalInstruction.trim()) return;

    setIsSavingRule(true);
    try {
      const payload: Partial<OliCustomRule> = {
        id: editingRule?.id,
        title: ruleModalTitle.trim(),
        instruction: ruleModalInstruction.trim(),
        category: ruleModalCategory,
        active: ruleModalActive,
      };

      const res = await fetch('/api/oli/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rule: payload }),
      });
      const data = await res.json();
      if (res.ok && data.rules) {
        setRules(data.rules);
        setIsRuleModalOpen(false);
      } else {
        alert(data.error || 'Error guardando regla');
      }
    } catch {
      alert('Error al comunicarse con el servidor');
    } finally {
      setIsSavingRule(false);
    }
  };

  const handleToggleRule = async (ruleId: string) => {
    try {
      const res = await fetch(`/api/oli/rules/${ruleId}/toggle`, { method: 'PATCH' });
      const data = await res.json();
      if (res.ok && data.rules) {
        setRules(data.rules);
      }
    } catch {
      alert('Error alternando estado de la regla');
    }
  };

  const handleDeleteRule = async (ruleId: string, title: string) => {
    if (!window.confirm(`¿Estás seguro de que deseas eliminar la regla "${title}"?`)) return;

    try {
      const res = await fetch(`/api/oli/rules/${ruleId}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok && data.rules) {
        setRules(data.rules);
      }
    } catch {
      alert('Error eliminando regla');
    }
  };

  const handleResetRules = async () => {
    if (!window.confirm('¿Deseas restaurar todas las reglas a las directrices oficiales por defecto?')) return;

    try {
      const res = await fetch('/api/oli/rules/reset', { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.rules) {
        setRules(data.rules);
      }
    } catch {
      alert('Error restableciendo reglas');
    }
  };

  // Filtered Rules
  const filteredRules = useMemo(() => {
    if (!rulesSearchQuery.trim()) return rules;
    const q = rulesSearchQuery.toLowerCase();
    return rules.filter(
      (r) => r.title.toLowerCase().includes(q) || r.instruction.toLowerCase().includes(q)
    );
  }, [rules, rulesSearchQuery]);

  const activeRulesCount = useMemo(() => rules.filter((r) => r.active).length, [rules]);

  // Filtered Logs
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      if (logFilterCity !== 'all' && log.currentCity?.toLowerCase() !== logFilterCity.toLowerCase()) {
        return false;
      }
      if (logSearchQuery.trim()) {
        const q = logSearchQuery.toLowerCase();
        const inPrompt = (log.userPrompt || log.latestPrompt)?.toLowerCase().includes(q);
        const inResponse = (log.spokenText || log.latestResponse)?.toLowerCase().includes(q);
        const inStops = log.stops?.some((s: any) => s.businessName?.toLowerCase().includes(q));
        const inMessages = log.messages?.some((m) => m.text?.toLowerCase().includes(q));
        const inBiz = log.matchedBusinesses?.some((b) => b.name?.toLowerCase().includes(q));
        if (!inPrompt && !inResponse && !inStops && !inMessages && !inBiz) return false;
      }
      return true;
    });
  }, [logs, logFilterCity, logSearchQuery]);

  return (
    <div className="space-y-4 animate-in fade-in duration-150 pb-12">
      {/* 1. Sub-Tabs Navigation */}
      <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-white border border-slate-200 shadow-2xs overflow-x-auto no-scrollbar">
        <button
          type="button"
          onClick={() => setActiveSubTab('models')}
          className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer whitespace-nowrap ${
            activeSubTab === 'models'
              ? 'bg-[#007af7] text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <span>Modelos & Diagnóstico</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('rules')}
          className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer whitespace-nowrap ${
            activeSubTab === 'rules'
              ? 'bg-[#007af7] text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <span>Reglas del Asistente</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('logs')}
          className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer whitespace-nowrap ${
            activeSubTab === 'logs'
              ? 'bg-[#007af7] text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <span>Auditoría & Logs</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('whatsapp')}
          className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer whitespace-nowrap ${
            activeSubTab === 'whatsapp'
              ? 'bg-[#007af7] text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <span>WhatsApp Bot</span>
          {baileysStatus === 'connected' && (
            <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_6px_#10b981]" />
          )}
        </button>
      </div>

      {/* 2. Header Banner matching Admin tabs (Itinerarios, Publicaciones, etc.) */}
      <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-2xs space-y-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Bot className="w-5 h-5 text-[#007af7]" />
              <span>Centro de Control Asistente OLI</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Supervisión de modelos LLM, directrices y reglas para el agente, registro de auditoría conversacional e integración con WhatsApp
            </p>
          </div>
        </div>
      </div>

      {/* 3. Sub-Tab: Modelos & Diagnóstico */}
      {activeSubTab === 'models' && (
        <div className="space-y-6">
          {/* Models Architecture Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Groq Cloud */}
            <div
              onClick={() => handleSelectLlmCard('groq')}
              className={`p-4 sm:p-5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${
                selectedLlm === 'groq'
                  ? 'bg-blue-50/40 border-[#007af7] ring-2 ring-blue-500/15 shadow-xs'
                  : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-2xs'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold ${
                      selectedLlm === 'groq' ? 'bg-blue-100 text-[#007af7]' : 'bg-slate-100 text-slate-700'
                    }`}>
                      <Key className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 leading-tight">Groq Cloud</h4>
                      <span className="text-[11px] text-slate-500 font-medium">Llama 3.3 70B</span>
                    </div>
                  </div>
                  {provider === 'groq' ? (
                    <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Activo
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-semibold">
                      {selectedLlm === 'groq' ? 'Seleccionado' : 'Disponible'}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-600 leading-relaxed mb-4">
                  Inferencia ultra-rápida en la nube (~300 tokens/seg) con soporte nativo de JSON estructurado para armar planes sin latencia.
                </p>
              </div>
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-500 font-medium">Estado API:</span>
                <span className="font-semibold flex items-center gap-1.5 text-slate-700">
                  <span className={`w-2 h-2 rounded-full ${groqApiKey ? 'bg-emerald-500 shadow-[0_0_6px_#10b981]' : 'bg-slate-300'}`} />
                  {groqApiKey ? 'Configurada' : 'Sin configurar'}
                </span>
              </div>
            </div>

            {/* Google Gemini */}
            <div
              onClick={() => handleSelectLlmCard('gemini')}
              className={`p-4 sm:p-5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${
                selectedLlm === 'gemini'
                  ? 'bg-blue-50/40 border-[#007af7] ring-2 ring-blue-500/15 shadow-xs'
                  : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-2xs'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold ${
                      selectedLlm === 'gemini' ? 'bg-blue-100 text-[#007af7]' : 'bg-slate-100 text-slate-700'
                    }`}>
                      <Key className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 leading-tight">Google Gemini</h4>
                      <span className="text-[11px] text-slate-500 font-medium">Gemini 2.5 Flash</span>
                    </div>
                  </div>
                  {provider === 'gemini' ? (
                    <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Activo
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-semibold">
                      {selectedLlm === 'gemini' ? 'Seleccionado' : 'Disponible'}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-600 leading-relaxed mb-4">
                  Comprensión contextual profunda de modismos colombianos y cálculo presupuestario riguroso en caso de consultas complejas.
                </p>
              </div>
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-500 font-medium">Estado API:</span>
                <span className="font-semibold flex items-center gap-1.5 text-slate-700">
                  <span className={`w-2 h-2 rounded-full ${geminiApiKey ? 'bg-emerald-500 shadow-[0_0_6px_#10b981]' : 'bg-slate-300'}`} />
                  {geminiApiKey ? 'Configurada' : 'Sin configurar'}
                </span>
              </div>
            </div>

            {/* Motor Semántico Local */}
            <div
              onClick={() => handleSelectLlmCard('local')}
              className={`p-4 sm:p-5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${
                selectedLlm === 'local'
                  ? 'bg-blue-50/40 border-[#007af7] ring-2 ring-blue-500/15 shadow-xs'
                  : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-2xs'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold ${
                      selectedLlm === 'local' ? 'bg-blue-100 text-[#007af7]' : 'bg-slate-100 text-slate-700'
                    }`}>
                      <Key className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 leading-tight">Motor Semántico</h4>
                      <span className="text-[11px] text-slate-500 font-medium">Ensamble Local Offline</span>
                    </div>
                  </div>
                  {provider === 'local' ? (
                    <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Activo
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-semibold">
                      {selectedLlm === 'local' ? 'Seleccionado' : 'Disponible'}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-600 leading-relaxed mb-4">
                  Garantiza que la app responda siempre de manera determinística y local, sin costos de API externa ni latencia de red.
                </p>
              </div>
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-500 font-medium">Estado API:</span>
                <span className="font-semibold flex items-center gap-1.5 text-slate-700">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_6px_#10b981]" />
                  Integrado 100% offline
                </span>
              </div>
            </div>
          </div>

          {/* Dynamic API Configuration Panel for Selected LLM */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-50 text-[#007af7] flex items-center justify-center shrink-0">
                  <Key className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    {selectedLlm === 'groq'
                      ? 'Configuración de Llave API: Groq Cloud (Llama 3.3 70B)'
                      : selectedLlm === 'gemini'
                      ? 'Configuración de Llave API: Google Gemini (Flash)'
                      : 'Motor Semántico Local OleVeci (Modo Offline)'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {selectedLlm === 'groq'
                      ? 'Inferencia ultra-rápida. Llave de acceso de Groq (inicia con gsk_...)'
                      : selectedLlm === 'gemini'
                      ? 'Comprensión contextual de Google AI Studio. Llave de acceso (inicia con AIzaSy...)'
                      : 'Opera de forma 100% local en el servidor, sin requerir ninguna llave API externa ni conexión exterior.'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={fetchConfig}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                  title="Verificar estado de configuración"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
                  <span>Verificar Estado</span>
                </button>
              </div>
            </div>

            {/* Unified Single Input Form for Groq and Gemini */}
            {selectedLlm !== 'local' ? (
              <form onSubmit={handleSaveApiKey} className="flex flex-col sm:flex-row gap-3 pt-1">
                <div className="relative flex-1">
                  <input
                    type={showKey ? 'text' : 'password'}
                    value={inputApiKey}
                    onChange={(e) => setInputApiKey(e.target.value)}
                    placeholder={
                      selectedLlm === 'groq'
                        ? 'Clave de Groq (inicia con gsk_...)'
                        : 'Clave de Google AI Studio (inicia con AIzaSy...)'
                    }
                    className="w-full pl-4 pr-20 py-2.5 rounded-xl border border-slate-200 focus:border-[#007af7] focus:ring-2 focus:ring-blue-500/10 outline-none text-xs sm:text-sm font-mono text-slate-800 placeholder:text-slate-400 bg-slate-50/50 hover:bg-white focus:bg-white transition-all shadow-2xs"
                  />
                  {inputApiKey && (
                    <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1 text-slate-400">
                      <button
                        type="button"
                        onClick={() => setShowKey(!showKey)}
                        className="p-1.5 rounded-lg hover:bg-slate-100 hover:text-slate-700 transition cursor-pointer"
                        title={showKey ? 'Ocultar clave' : 'Ver clave'}
                        aria-label={showKey ? 'Ocultar clave' : 'Ver clave'}
                      >
                        {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleCopyCurrentKey(inputApiKey)}
                        className="p-1.5 rounded-lg hover:bg-slate-100 hover:text-slate-700 transition cursor-pointer"
                        title={copiedKey ? '¡Clave copiada!' : 'Copiar clave'}
                        aria-label="Copiar clave"
                      >
                        {copiedKey ? (
                          <Check className="w-4 h-4 text-emerald-600" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  )}
                </div>
                <button
                  type="submit"
                  disabled={isSavingKey || !inputApiKey.trim()}
                  className="px-5 py-2.5 rounded-xl bg-[#007af7] hover:bg-blue-600 disabled:bg-slate-200 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs active:scale-95 shrink-0"
                >
                  {isSavingKey ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Guardando...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Guardar y Activar {selectedLlm === 'groq' ? 'Groq' : 'Gemini'}</span>
                    </>
                  )}
                </button>
              </form>
            ) : (
              /* Local engine action */
              <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2 text-emerald-950 font-medium">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    El motor local no consume tokens ni requiere conexión a internet exterior. Las respuestas se ensamblan determinísticamente con el catálogo local.
                  </span>
                </div>
                {provider !== 'local' && (
                  <button
                    type="button"
                    onClick={() => handleSaveApiKey()}
                    disabled={isSavingKey}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs cursor-pointer shrink-0 active:scale-95"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Activar Motor Local</span>
                  </button>
                )}
              </div>
            )}

            {keySaveMessage && (
              <div className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2 ${
                keySaveMessage.type === 'success'
                  ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                  : 'bg-rose-50 border border-rose-200 text-rose-800'
              }`}>
                {keySaveMessage.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertTriangle className="w-4 h-4 text-rose-600" />}
                <span>{keySaveMessage.text}</span>
              </div>
            )}
          </div>

          {/* Playground / Test Bench */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
                  <Play className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Banco de Pruebas en Vivo (Playground)</h3>
                  <p className="text-xs text-slate-500">
                    Envía cualquier consulta para comprobar las reglas activas de Oli, medir latencia y ver la respuesta generada.
                  </p>
                </div>
              </div>

              {testResult && (
                <div className="flex items-center gap-2 text-xs font-semibold">
                  <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">
                    ⏱️ {testResult.durationMs} ms
                  </span>
                  <span className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 border border-blue-200">
                    🚀 {testResult.providerUsed}
                  </span>
                </div>
              )}
            </div>

            {/* Quick Test Chips */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Pruebas rápidas:</span>
              {[
                'quiero un capuchino en cajica',
                'lavar el carro y luego motilarme en cajica',
                'muestrame las promociones de oleveci',
                'comer sushi en chia con 60 mil pesos',
                'plan familiar domingo con ninos',
              ].map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => setTestPrompt(chip)}
                  className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs transition-colors cursor-pointer"
                >
                  {chip}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div className="sm:col-span-3">
                <input
                  type="text"
                  value={testPrompt}
                  onChange={(e) => setTestPrompt(e.target.value)}
                  placeholder="Escribe la consulta del usuario..."
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-[#0066FF] outline-none text-xs sm:text-sm text-slate-800"
                />
              </div>
              <div className="flex gap-2">
                <select
                  value={testCity}
                  onChange={(e) => setTestCity(e.target.value)}
                  className="px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 bg-white"
                >
                  <option value="Cajicá">Cajicá</option>
                  <option value="Chía">Chía</option>
                  <option value="Cota">Cota</option>
                  <option value="Zipaquirá">Zipaquirá</option>
                  <option value="Tabio">Tabio</option>
                  <option value="Sopó">Sopó</option>
                </select>

                <button
                  type="button"
                  onClick={handleRunTest}
                  disabled={isTesting || !testPrompt.trim()}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-[#0066FF] hover:bg-[#0052cc] disabled:bg-slate-200 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs active:scale-95"
                >
                  {isTesting ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Play className="w-4 h-4 fill-white" />
                      <span>Probar</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {testError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{testError}</span>
              </div>
            )}

            {testResult && (
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3 animate-in fade-in">
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider block mb-1">
                    Respuesta Hablada de Oli:
                  </span>
                  <p className="text-xs sm:text-sm text-slate-800 bg-white p-3 rounded-xl border border-slate-200/90 font-medium leading-relaxed">
                    "{testResult.response.spokenText}"
                  </p>
                </div>

                {testResult.response.stops && testResult.response.stops.length > 0 && (
                  <div>
                    <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider block mb-1.5">
                      Itinerario generado ({testResult.response.stops.length} paradas | Total: $ {testResult.response.totalEstimatedCost?.toLocaleString('es-CO')}):
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                      {testResult.response.stops.map((stop, sIdx) => (
                        <div key={sIdx} className="bg-white p-2.5 rounded-xl border border-slate-200 text-xs space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-[#0066FF]">Parada #{sIdx + 1}</span>
                            <span className="font-bold text-emerald-600">$ {stop.cost?.toLocaleString('es-CO')}</span>
                          </div>
                          <p className="font-bold text-slate-800 truncate">{stop.businessName}</p>
                          <p className="text-slate-500 text-[11px] truncate">{stop.activity}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 4. Sub-Tab: Reglas del Asistente (Dynamic, Editable & Active in LLM) */}
      {activeSubTab === 'rules' && (
        <div className="space-y-5">
          {/* Header & Actions Bar */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Sliders className="w-5 h-5 text-[#0066FF]" />
                <h3 className="text-base font-bold text-slate-900">
                  Reglas de Negocio & Directrices para OLI
                </h3>
              </div>
              <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
                Todas las reglas activas se inyectan en tiempo real a las instrucciones de los modelos LLM (Groq y Gemini). Puedes agregar nuevas reglas, editarlas o pausarlas con el switch.
              </p>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end flex-wrap">
              <button
                type="button"
                onClick={handleOpenCreateRule}
                className="px-4 py-2.5 rounded-xl bg-[#0066FF] hover:bg-[#0052cc] text-white text-xs font-bold flex items-center gap-2 transition-all cursor-pointer shadow-xs active:scale-95"
              >
                <Plus className="w-4 h-4" />
                <span>Nueva Regla</span>
              </button>

              <button
                type="button"
                onClick={handleResetRules}
                className="px-3.5 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                title="Restablecer reglas por defecto"
              >
                <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                <span>Restablecer</span>
              </button>
            </div>
          </div>

          {/* Search bar & summary */}
          <div className="flex items-center justify-between gap-3 px-1">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={rulesSearchQuery}
                onChange={(e) => setRulesSearchQuery(e.target.value)}
                placeholder="Buscar entre las reglas configuradas..."
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-white border border-slate-200 text-xs outline-none focus:border-[#0066FF]"
              />
            </div>

            <span className="text-xs text-slate-500 font-medium">
              {activeRulesCount} de {rules.length} activas
            </span>
          </div>

          {/* Rules List Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredRules.map((rule, idx) => {
              return (
                <div
                  key={rule.id}
                  className={`p-4 sm:p-5 rounded-2xl border transition-all space-y-3 bg-white ${
                    rule.active
                      ? 'border-slate-200/90 shadow-2xs hover:border-blue-300'
                      : 'border-slate-200 bg-slate-50/50 opacity-75'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <h4 className="text-xs font-black text-slate-900 leading-snug">
                        {idx + 1}. {rule.title}
                      </h4>
                    </div>

                    {/* Toggle Switch */}
                    <button
                      type="button"
                      onClick={() => handleToggleRule(rule.id)}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        rule.active ? 'bg-[#0066FF]' : 'bg-slate-200'
                      }`}
                      title={rule.active ? 'Pausar regla' : 'Activar regla'}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          rule.active ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  <p className="text-xs text-slate-600 leading-relaxed font-normal bg-slate-50 p-3 rounded-xl border border-slate-100">
                    "{rule.instruction}"
                  </p>

                  <div className="flex items-center justify-end pt-1 text-[11px] border-t border-slate-100">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleOpenEditRule(rule)}
                        className="px-2.5 py-1 rounded-lg hover:bg-blue-50 text-[#0066FF] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                        title="Editar regla"
                      >
                        <Pencil className="w-3 h-3" />
                        <span>Editar</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteRule(rule.id, rule.title)}
                        className="px-2.5 py-1 rounded-lg hover:bg-rose-50 text-rose-600 font-bold flex items-center gap-1 transition-colors cursor-pointer"
                        title="Eliminar regla"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Eliminar</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {filteredRules.length === 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                <Sliders className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-slate-800">No hay reglas que coincidan</h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Puedes agregar una nueva regla haciendo clic en el botón superior "Nueva Regla".
              </p>
            </div>
          )}
        </div>
      )}

      {/* 5. Sub-Tab: Auditoría & Logs */}
      {activeSubTab === 'logs' && (
        <div className="space-y-4">
          {/* Controls Bar */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-64">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={logSearchQuery}
                  onChange={(e) => setLogSearchQuery(e.target.value)}
                  placeholder="Buscar en preguntas o comercios..."
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs outline-none focus:border-[#0066FF]"
                />
              </div>

              <select
                value={logFilterCity}
                onChange={(e) => setLogFilterCity(e.target.value)}
                className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 bg-white"
              >
                <option value="all">Todos los municipios</option>
                <option value="Cajicá">Cajicá</option>
                <option value="Chía">Chía</option>
                <option value="Cota">Cota</option>
                <option value="Zipaquirá">Zipaquirá</option>
              </select>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={fetchLogs}
                disabled={isLoadingLogs}
                className="px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                title="Actualizar registros"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${isLoadingLogs ? 'animate-spin' : ''}`} />
                <span>Actualizar</span>
              </button>

              <button
                type="button"
                onClick={handleExportLogs}
                disabled={logs.length === 0}
                className="px-3 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-[#0066FF] border border-blue-200 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                title="Exportar archivo de análisis a Markdown"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Exportar .MD</span>
              </button>

              <button
                type="button"
                onClick={handleClearLogs}
                disabled={isClearingLogs || logs.length === 0}
                className="px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                title="Limpiar historial"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Limpiar</span>
              </button>
            </div>
          </div>

          {/* Logs List */}
          {filteredLogs.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                <ScrollText className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-slate-800">No hay registros de conversación que coincidan</h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Las conversaciones realizadas por usuarios o en el Playground se registrarán automáticamente aquí.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredLogs.map((log, idx) => {
                const isExpanded = expandedLogId === log.id;
                const messagesList: OliLogMessage[] =
                  log.messages && Array.isArray(log.messages) && log.messages.length > 0
                    ? log.messages
                    : [
                        { sender: 'user', text: log.userPrompt || log.latestPrompt || '', timestamp: log.timestamp || log.startedAt || '' },
                        { sender: 'oli', text: log.spokenText || log.latestResponse || '', timestamp: log.timestamp || log.lastUpdatedAt || '', responseType: log.responseType, stopsCount: log.stopsCount, stops: log.stops, matchedBusinesses: log.matchedBusinesses }
                      ];

                const turnsCount = log.totalTurns || Math.ceil(messagesList.length / 2) || 1;
                const firstUserMsg = messagesList.find((m) => m.sender === 'user')?.text || log.userPrompt || log.latestPrompt || 'Consulta a Oli';
                const latestReply = log.latestResponse || log.spokenText || messagesList.filter((m) => m.sender === 'oli').pop()?.text || '';
                const lastDate = log.lastUpdatedAt || log.timestamp || log.startedAt || new Date().toISOString();

                return (
                  <div
                    key={log.id}
                    className="bg-white rounded-2xl border border-slate-200/90 hover:border-blue-300 transition-all shadow-2xs overflow-hidden"
                  >
                    <div
                      onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                      className="p-4 flex items-center justify-between gap-3 cursor-pointer select-none hover:bg-slate-50/50"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <span className="w-8 h-8 rounded-full bg-blue-100 text-[#0066FF] font-black text-xs flex items-center justify-center shrink-0">
                          #{filteredLogs.length - idx}
                        </span>

                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs sm:text-sm font-bold text-slate-900 truncate max-w-md">
                              "{firstUserMsg}"
                            </span>

                            {/* Channel Badge */}
                            {log.channel === 'whatsapp' ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <WhatsAppIcon className="w-3 h-3 fill-emerald-600" />
                                WhatsApp
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-200">
                                <Globe className="w-3 h-3 text-sky-600" />
                                Web / App
                              </span>
                            )}

                            {/* Turns Count Badge */}
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                              <MessageSquare className="w-2.5 h-2.5 text-indigo-600" />
                              {turnsCount} {turnsCount === 1 ? 'interacción' : 'interacciones'}
                            </span>

                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                              {log.currentCity || 'Sabana Centro'}
                            </span>
                          </div>

                          <p className="text-[11px] text-slate-500 line-clamp-1">
                            {latestReply}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] text-slate-400 font-medium hidden sm:inline">
                          {new Date(lastDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4 text-slate-400" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-slate-400" />
                        )}
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="px-4 pb-4 pt-3 border-t border-slate-100 bg-slate-50/70 space-y-3.5 text-xs">
                        <div className="flex items-center justify-between text-[11px] text-slate-500 pb-1 border-b border-slate-200/60">
                          <span className="font-bold uppercase tracking-wider text-slate-400">
                            Transcripción Completa del Chat ({messagesList.length} turnos)
                          </span>
                          <span>
                            {log.startedAt ? `Iniciado: ${new Date(log.startedAt).toLocaleString('es-CO')}` : ''}
                          </span>
                        </div>

                        {/* Conversational message thread in chronological order */}
                        <div className="space-y-3 max-h-[460px] overflow-y-auto pr-1">
                          {messagesList.map((m, mIdx) => (
                            <div
                              key={mIdx}
                              className={`flex gap-2.5 items-start ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                            >
                              {m.sender === 'oli' && (
                                <div className="w-7 h-7 rounded-full bg-blue-50 border border-blue-200 flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                                  <Bot className="w-4 h-4 text-[#0066FF]" />
                                </div>
                              )}

                              <div
                                className={`max-w-[85%] rounded-2xl p-3 sm:p-3.5 space-y-1.5 shadow-2xs ${
                                  m.sender === 'user'
                                    ? 'bg-[#0066FF] text-white rounded-br-xs'
                                    : 'bg-white text-slate-800 border border-slate-200/90 rounded-tl-xs'
                                }`}
                              >
                                <div className="flex items-center justify-between gap-3">
                                  <span
                                    className={`text-[10px] font-bold ${
                                      m.sender === 'user' ? 'text-blue-100' : 'text-[#0066FF]'
                                    }`}
                                  >
                                    {m.sender === 'user' ? 'Usuario' : 'Oli Asistente'}
                                  </span>
                                  {m.timestamp && (
                                    <span
                                      className={`text-[9px] ${
                                        m.sender === 'user' ? 'text-blue-200' : 'text-slate-400'
                                      }`}
                                    >
                                      {new Date(m.timestamp).toLocaleTimeString([], {
                                        hour: '2-digit',
                                        minute: '2-digit',
                                      })}
                                    </span>
                                  )}
                                </div>

                                <p className="text-xs leading-relaxed whitespace-pre-wrap break-words font-medium">
                                  {m.text}
                                </p>

                                {/* Stops preview */}
                                {m.stops && m.stops.length > 0 && (
                                  <div className="pt-2 border-t border-slate-100 space-y-1">
                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                                      Paradas propuestas ({m.stops.length}):
                                    </span>
                                    <div className="flex flex-wrap gap-1.5">
                                      {m.stops.map((s: any, sIdx: number) => (
                                        <span
                                          key={sIdx}
                                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-blue-50 text-blue-700 border border-blue-100 text-[10px] font-semibold"
                                        >
                                          #{sIdx + 1} {s.businessName}{' '}
                                          {s.cost ? `($${s.cost.toLocaleString('es-CO')})` : ''}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* Matched businesses preview */}
                                {m.matchedBusinesses &&
                                  m.matchedBusinesses.length > 0 &&
                                  (!m.stops || m.stops.length === 0) && (
                                    <div className="pt-2 border-t border-slate-100 space-y-1">
                                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                                        Comercios vinculados:
                                      </span>
                                      <div className="flex flex-wrap gap-1.5">
                                        {m.matchedBusinesses.map((b: any, bIdx: number) => (
                                          <span
                                            key={bIdx}
                                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-100 text-[10px] font-semibold"
                                          >
                                            <Store className="w-2.5 h-2.5 text-emerald-600" />
                                            {b.name} ({b.city})
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                              </div>

                              {m.sender === 'user' && (
                                <div className="w-7 h-7 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                                  <User className="w-3.5 h-3.5" />
                                </div>
                              )}
                            </div>
                          ))}
                        </div>

                        <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between text-[11px] text-slate-400">
                          <span className="font-mono">ID Sesión: {log.id}</span>
                          <span>
                            Última actividad: {new Date(lastDate).toLocaleString('es-CO')}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 6. Sub-Tab: WhatsApp Bot */}
      {activeSubTab === 'whatsapp' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Panel 1: Baileys WhatsApp Web Pairing */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                    <WhatsAppIcon className="w-5 h-5 fill-emerald-600" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-slate-900 truncate">WhatsApp Web (Baileys)</h3>
                    <p className="text-xs text-slate-500 line-clamp-1">Conexión directa escaneando código QR con cualquier celular</p>
                  </div>
                </div>

                <div className="shrink-0">
                  {baileysStatus === 'connected' ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-emerald-50 border border-emerald-200 text-emerald-700 shadow-2xs whitespace-nowrap">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_6px_#10b981]" />
                      <span>Conectado</span>
                    </span>
                  ) : baileysStatus === 'connecting' ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-amber-50 border border-amber-200 text-amber-700 shadow-2xs whitespace-nowrap">
                      <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                      <span>Esperando QR</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-slate-100 border border-slate-200 text-slate-600 shadow-2xs whitespace-nowrap">
                      <span className="w-2 h-2 rounded-full bg-slate-400" />
                      <span>Desconectado</span>
                    </span>
                  )}
                </div>
              </div>

              {baileysStatus === 'connected' ? (
                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 space-y-3">
                  <div className="flex items-center gap-2 text-emerald-800 text-xs font-bold">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Sesión de WhatsApp activa y respondiendo como Oli</span>
                  </div>
                  <p className="text-xs text-emerald-700">
                    Número vinculado: <strong className="font-mono">+{baileysPhone}</strong>
                  </p>
                  <button
                    type="button"
                    onClick={handleDisconnectBaileys}
                    disabled={baileysLoading}
                    className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition-colors cursor-pointer"
                  >
                    Desconectar WhatsApp Web
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {baileysQr ? (
                    <div className="text-center p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                      <p className="text-xs font-bold text-slate-700">
                        Escanea este código con tu WhatsApp:
                      </p>
                      <div className="inline-block p-2 bg-white rounded-xl shadow-xs border border-slate-200">
                        <img src={baileysQr} alt="WhatsApp QR Code" className="w-48 h-48 mx-auto" />
                      </div>
                      <p className="text-[11px] text-slate-500">
                        WhatsApp &gt; Dispositivos vinculados &gt; Vincular dispositivo
                      </p>
                    </div>
                  ) : (
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-center space-y-3">
                      <p className="text-xs text-slate-600">
                        El bot de WhatsApp Web no está activo en este momento. Puedes iniciar la conexión para generar un código QR.
                      </p>
                      <button
                        type="button"
                        onClick={handleConnectBaileys}
                        disabled={baileysLoading}
                        className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-2 mx-auto transition-all cursor-pointer shadow-xs"
                      >
                        {baileysLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <QrCode className="w-4 h-4" />}
                        <span>Generar Código QR</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Panel 2: Meta Cloud API Webhook */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-4">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#0066FF] flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-5 h-5 text-[#0066FF]" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Meta Cloud API (Webhook Oficial)</h3>
                  <p className="text-xs text-slate-500">Para empresas con número oficial verificado en Meta for Developers</p>
                </div>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-400 block mb-1">
                    URL de Retrollamada (Webhook URL):
                  </span>
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 font-mono text-slate-700 flex items-center justify-between">
                    <span className="truncate">https://oleveci.com/api/whatsapp/webhook</span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText('https://oleveci.com/api/whatsapp/webhook');
                        alert('URL copiada al portapapeles');
                      }}
                      className="text-blue-600 font-bold ml-2 cursor-pointer"
                    >
                      Copiar
                    </button>
                  </div>
                </div>

                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-400 block mb-1">
                    Token de Verificación (Verify Token):
                  </span>
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 font-mono text-slate-700 flex items-center justify-between">
                    <span>oleveci_token_2026</span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText('oleveci_token_2026');
                        alert('Token copiado al portapapeles');
                      }}
                      className="text-blue-600 font-bold ml-2 cursor-pointer"
                    >
                      Copiar
                    </button>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Acceso para usuarios:</span>
                  <button
                    type="button"
                    onClick={() => setIsWhatsAppModalOpen(true)}
                    className="px-3.5 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <WhatsAppIcon className="w-3.5 h-3.5 fill-emerald-600" />
                    <span>Ver QR y Número WhatsApp</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Crear / Editar Regla */}
      {isRuleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full overflow-hidden space-y-4">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Sliders className="w-5 h-5 text-[#0066FF]" />
                <h3 className="text-base font-bold text-slate-900">
                  {editingRule ? 'Editar Regla de Oli' : 'Nueva Regla para Oli'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsRuleModalOpen(false)}
                className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveRule} className="p-5 pt-0 space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Título de la Regla
                </label>
                <input
                  type="text"
                  value={ruleModalTitle}
                  onChange={(e) => setRuleModalTitle(e.target.value)}
                  placeholder="ej: Prioridad Mascotas Pet-Friendly"
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-[#0066FF] outline-none text-xs sm:text-sm text-slate-900"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Categoría
                </label>
                <select
                  value={ruleModalCategory}
                  onChange={(e) => setRuleModalCategory(e.target.value as any)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm font-medium text-slate-800 bg-white"
                >
                  <option value="custom">Personalizada (General)</option>
                  <option value="tone">Tono de Voz & Lenguaje Sabanero</option>
                  <option value="business">Comercio Local & Validación</option>
                  <option value="itinerary">Itinerarios & Paradas</option>
                  <option value="budget">Control Presupuestario</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Instrucción Exacta para el LLM (Groq & Gemini)
                </label>
                <textarea
                  value={ruleModalInstruction}
                  onChange={(e) => setRuleModalInstruction(e.target.value)}
                  placeholder="Escribe la instrucción directa para el asistente. Ej: Si el usuario menciona que va con perro o mascota, dale prioridad estricta a comercios con terraza o pet-friendly..."
                  rows={4}
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-[#0066FF] outline-none text-xs sm:text-sm text-slate-900 resize-none leading-relaxed"
                />
                <span className="text-[11px] text-slate-400 block mt-1">
                  Esta instrucción será inyectada en el prompt del sistema y aplicada en cada respuesta.
                </span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-xs font-bold text-slate-800">
                  Activar regla inmediatamente
                </span>
                <input
                  type="checkbox"
                  checked={ruleModalActive}
                  onChange={(e) => setRuleModalActive(e.target.checked)}
                  className="w-4 h-4 rounded text-[#0066FF] focus:ring-0 cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsRuleModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-bold transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingRule || !ruleModalTitle.trim() || !ruleModalInstruction.trim()}
                  className="px-5 py-2.5 rounded-xl bg-[#0066FF] hover:bg-[#0052cc] text-white text-xs font-bold transition-all cursor-pointer shadow-xs active:scale-95"
                >
                  {isSavingRule ? 'Guardando...' : 'Guardar Regla'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* WhatsApp Modal Simulator */}
      <OliWhatsAppModal
        isOpen={isWhatsAppModalOpen}
        onClose={() => setIsWhatsAppModalOpen(false)}
      />
    </div>
  );
};

import React, { useState } from 'react';
import {
  X,
  ScrollText,
  Copy,
  Check,
  Download,
  Printer,
  Sparkles,
  Bot,
  User,
  MapPin,
  DollarSign,
  Layers,
  Key,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Code2,
  Share2,
  MessageSquare,
  Phone,
  Store,
  Calendar,
  Clock,
  Send,
  HelpCircle,
} from 'lucide-react';
import { Post, Business } from '../types';
import { OliPlanResponse } from '../../server/oliAssistant';

export interface ChatLogMessage {
  sender: 'user' | 'oli';
  text: string;
  plan?: OliPlanResponse;
  matchedBusinesses?: Business[];
  matchedPosts?: Post[];
  responseType?: 'plan' | 'search';
  timestamp?: string;
}

interface OliChatLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  chatHistory: ChatLogMessage[];
  currentCity?: string;
  currentPlan?: OliPlanResponse | null;
  hasApiKey?: boolean;
  onApiKeySaved?: () => void;
}

export const OliChatLogModal: React.FC<OliChatLogModalProps> = ({
  isOpen,
  onClose,
  chatHistory,
  currentCity = 'Cajicá',
  currentPlan = null,
  hasApiKey = false,
  onApiKeySaved,
}) => {
  const [activeTab, setActiveTab] = useState<'timeline' | 'prompt_preview' | 'config'>('timeline');
  const [copiedFormat, setCopiedFormat] = useState<string | null>(null);
  const [customNotes, setCustomNotes] = useState('');
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [isSavingKey, setIsSavingKey] = useState(false);
  const [keyStatusMsg, setKeyStatusMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  if (!isOpen) return null;

  // Group messages into chronological conversational turns
  const turns: Array<{
    turnIndex: number;
    userMessage?: ChatLogMessage;
    oliMessage?: ChatLogMessage;
  }> = [];

  let currentTurnIndex = 1;
  for (let i = 0; i < chatHistory.length; i++) {
    const msg = chatHistory[i];
    if (msg.sender === 'user') {
      const nextMsg = chatHistory[i + 1]?.sender === 'oli' ? chatHistory[i + 1] : undefined;
      turns.push({
        turnIndex: currentTurnIndex++,
        userMessage: msg,
        oliMessage: nextMsg,
      });
      if (nextMsg) {
        i++; // skip next since it's paired
      }
    } else {
      turns.push({
        turnIndex: currentTurnIndex++,
        oliMessage: msg,
      });
    }
  }

  const userMessagesCount = chatHistory.filter((m) => m.sender === 'user').length;
  const oliMessagesCount = chatHistory.filter((m) => m.sender === 'oli').length;

  // Format currency helper
  const formatCOP = (val?: number | null) => {
    if (val === undefined || val === null) return 'No especificado';
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0,
    }).format(val);
  };

  // Build structured Markdown report optimized for feeding into AI
  const generateAIPromptMarkdown = () => {
    const dateStr = new Date().toLocaleString('es-CO', {
      dateStyle: 'full',
      timeStyle: 'medium',
      timeZone: 'America/Bogota',
    });

    let md = `# REGISTRO DE CONVERSACIÓN CON ASISTENTE OLI (OLEVECI)\n\n`;
    md += `> **Fecha y Hora:** ${dateStr}\n`;
    md += `> **Municipio de Referencia:** ${currentCity}\n`;
    md += `> **Presupuesto Registrado:** ${formatCOP(currentPlan?.userBudget || 100000)}\n`;
    const lastTrace = chatHistory.slice().reverse().find((m) => m.auditTrace)?.auditTrace;
    const engineName = lastTrace?.modelUsed || (hasApiKey ? 'Google Gemini' : 'Motor Determinista Local de Respaldo');
    const modeNote = lastTrace?.executionMode === 'deterministic_fallback' ? ' (Modo Respaldo Local por Cuota/Fallo API)' : '';
    md += `> **Motor de Ejecución:** ${engineName}${modeNote}\n`;
    md += `> **Total de Interacciones:** ${chatHistory.length} mensajes (${userMessagesCount} del usuario, ${oliMessagesCount} de OLI)\n\n`;

    md += `---\n\n`;
    md += `## 🎯 OBJETIVO DE ANÁLISIS PARA LA INTELIGENCIA ARTIFICIAL\n`;
    md += `Actúa como auditor experto en asistentes conversacionales de comercio local y recomendación para OleVeci en Sabana Centro (Colombia).\n`;
    md += `Analiza el siguiente diálogo completo entre el usuario y OLI y evalúa:\n`;
    md += `1. **Retención de contexto multi-turno:** ¿OLI recordó el municipio, presupuesto, paradas previas o cambios solicitados (ej. quitar paradas, cambiar ciudad, número de personas)?\n`;
    md += `2. **Pertinencia de respuestas y recomendaciones:** ¿Los comercios y paradas sugeridas realmente responden a la intención del usuario o hubo recomendaciones fuera de lugar?\n`;
    md += `3. **Tono y lenguaje colombiano sabanero:** ¿La narración suena natural, cercana ("veci"), sin tecnicismos ni formatos rotos?\n`;
    md += `4. **Errores o alucinaciones:** ¿Hubo precios inventados, negocios inexistentes o contradicciones en horarios?\n`;
    md += `5. **Plan de mejora concreto:** Proporciona sugerencias exactas de prompt engineering, lógica o datos para corregir cualquier fallo encontrado.\n\n`;

    if (customNotes.trim()) {
      md += `### 📌 Observaciones o Dudas Específicas del Tester/Usuario:\n`;
      md += `${customNotes.trim()}\n\n`;
    }

    md += `---\n\n`;
    md += `## 📜 HISTORIAL CRONOLÓGICO DE LA CONVERSACIÓN\n\n`;

    if (turns.length === 0) {
      md += `*(No hay mensajes en esta sesión aún)*\n\n`;
    } else {
      turns.forEach((turn) => {
        md += `### 🔄 Turno #${turn.turnIndex}\n`;
        if (turn.userMessage) {
          md += `- 👤 **Usuario (${turn.userMessage.timestamp || 'Sin hora'}):**\n`;
          md += `  > "${turn.userMessage.text}"\n\n`;
        }

        if (turn.oliMessage) {
          md += `- 🤖 **OLI Asistente (${turn.oliMessage.timestamp || 'Sin hora'}):**\n`;
          md += `  > "${turn.oliMessage.text}"\n\n`;

          // If plan exists
          if (turn.oliMessage.plan && turn.oliMessage.plan.stops && turn.oliMessage.plan.stops.length > 0) {
            const plan = turn.oliMessage.plan;
            md += `  *📍 Plan generado (${plan.stops.length} paradas) | Presupuesto total: ${formatCOP(plan.totalEstimatedCost)} (Estado: ${plan.budgetStatus})*\n`;
            plan.stops.forEach((stop, sIdx) => {
              md += `    ${sIdx + 1}. **${stop.businessName}** (${stop.businessCity || currentCity}) - *${stop.activity}* [Hora: ${stop.time || 'N/A'}] - Costo: ${formatCOP(stop.cost)}\n`;
              if (stop.whySelected) md += `       *Motivo:* ${stop.whySelected}\n`;
            });
            md += `\n`;
          }

          // If matched posts (announcements / promotions shown on screen)
          if (turn.oliMessage.matchedPosts && turn.oliMessage.matchedPosts.length > 0) {
            md += `  *🏷️ Opciones y anuncios disponibles mostrados en pantalla (${turn.oliMessage.matchedPosts.length}):*\n`;
            turn.oliMessage.matchedPosts.forEach((p, pIdx) => {
              const price = p.promotionalPrice || p.originalPrice || p.approximatePrice;
              const priceStr = price ? ` - Precio: ${formatCOP(price)}` : '';
              md += `    ${pIdx + 1}. **${p.title}** (${p.businessName} · ${p.businessCity || currentCity})${priceStr}\n`;
              if (p.businessAddress) md += `       *Ubicación:* ${p.businessAddress}\n`;
              if (p.businessPhone || p.businessWhatsapp) md += `       *WhatsApp/Tel:* ${p.businessWhatsapp || p.businessPhone}\n`;
              if (p.description) {
                const cleanDesc = p.description.replace(/\n+/g, ' ').trim();
                md += `       *Descripción:* ${cleanDesc.substring(0, 110)}${cleanDesc.length > 110 ? '...' : ''}\n`;
              }
            });
            md += `\n`;
          }

          // If matched businesses exist
          if (turn.oliMessage.matchedBusinesses && turn.oliMessage.matchedBusinesses.length > 0) {
            md += `  *🏢 Comercios destacados encontrados (${turn.oliMessage.matchedBusinesses.length}):*\n`;
            turn.oliMessage.matchedBusinesses.slice(0, 5).forEach((b) => {
              md += `    - **${b.name}** (${b.city}) - Tel/WhatsApp: ${b.phone || 'N/A'} - Dirección: ${b.address || 'N/A'}\n`;
            });
            md += `\n`;
          }
        }
        md += `\n`;
      });
    }

    if (currentPlan) {
      md += `---\n\n`;
      md += `## 📊 ESTADO ACTUAL DEL PLAN EN MEMORIA\n`;
      md += `- **Municipio:** ${currentCity}\n`;
      md += `- **Costo Total:** ${formatCOP(currentPlan.totalEstimatedCost)}\n`;
      md += `- **Presupuesto del Usuario:** ${formatCOP(currentPlan.userBudget)}\n`;
      md += `- **Estado de Presupuesto:** ${currentPlan.budgetStatus}\n`;
      md += `- **Número de Paradas Activas:** ${currentPlan.stops?.length || 0}\n`;
      if (currentPlan.stops && currentPlan.stops.length > 0) {
        currentPlan.stops.forEach((st, idx) => {
          md += `  ${idx + 1}. ${st.businessName} - ${st.activity} (${formatCOP(st.cost)})\n`;
        });
      }
      md += `\n`;
    }

    return md;
  };

  // Build clean plain text version
  const generatePlainText = () => {
    return generateAIPromptMarkdown()
      .replace(/[#*`>]/g, '')
      .replace(/\n\n+/g, '\n\n');
  };

  // Build structured JSON log
  const generateJSON = () => {
    return JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        currentCity,
        hasApiKey,
        currentPlan,
        customNotes: customNotes.trim() || undefined,
        summary: {
          totalTurns: turns.length,
          userMessagesCount,
          oliMessagesCount,
        },
        chatHistory,
      },
      null,
      2
    );
  };

  // Copy to clipboard helper
  const handleCopy = (text: string, formatId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedFormat(formatId);
    setTimeout(() => {
      setCopiedFormat(null);
    }, 2500);
  };

  // File download helper
  const handleDownload = (filename: string, content: string, mime: string) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Print as PDF helper
  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Por favor habilita las ventanas emergentes para imprimir o guardar como PDF.');
      return;
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Log de Conversación OLI - OleVeci</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; padding: 40px; color: #1e293b; line-height: 1.5; font-size: 13px; }
            h1 { color: #0066FF; font-size: 20px; border-bottom: 2px solid #0066FF; padding-bottom: 8px; margin-bottom: 12px; }
            h2 { color: #0f172a; font-size: 16px; margin-top: 24px; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; }
            h3 { color: #334155; font-size: 14px; margin-top: 16px; }
            .meta { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; margin-bottom: 20px; font-size: 12px; }
            .turn { background: #ffffff; border: 1px solid #cbd5e1; border-radius: 8px; padding: 14px; margin-bottom: 14px; page-break-inside: avoid; }
            .user-msg { background: #eff6ff; border-left: 4px solid #0066FF; padding: 8px 12px; border-radius: 4px; margin-bottom: 10px; }
            .oli-msg { background: #f8fafc; border-left: 4px solid #10b981; padding: 8px 12px; border-radius: 4px; }
            .plan-box { background: #f0fdf4; border: 1px dashed #86efac; padding: 10px; border-radius: 6px; margin-top: 8px; font-size: 12px; }
            @media print {
              body { padding: 10mm; }
              button { display: none; }
            }
          </style>
        </head>
        <body>
          <h1>OleVeci - Registro Integral de Conversación OLI</h1>
          <div class="meta">
            <strong>Fecha:</strong> ${new Date().toLocaleString('es-CO')}<br/>
            <strong>Municipio:</strong> ${currentCity} | <strong>Presupuesto:</strong> ${formatCOP(currentPlan?.userBudget || 100000)} | <strong>Turnos:</strong> ${turns.length}<br/>
            <strong>Motor:</strong> ${hasApiKey ? 'Google Gemini 2.5 Flash' : 'Motor Local de Respaldo'}
          </div>
          ${customNotes ? `<div style="background:#fffbeb;border:1px solid #fef3c7;padding:10px;border-radius:6px;margin-bottom:15px;"><strong>Notas del Tester:</strong><br/>${customNotes}</div>` : ''}
          <h2>Historial de la Conversación</h2>
          ${turns
            .map(
              (t) => `
            <div class="turn">
              <strong>Turno #${t.turnIndex}</strong>
              ${t.userMessage ? `<div class="user-msg"><strong>👤 Usuario:</strong> ${t.userMessage.text}</div>` : ''}
              ${t.oliMessage ? `<div class="oli-msg"><strong>🤖 OLI Asistente:</strong> ${t.oliMessage.text}</div>` : ''}
              ${
                t.oliMessage?.plan?.stops && t.oliMessage.plan.stops.length > 0
                  ? `<div class="plan-box">
                      <strong>Itinerario:</strong><br/>
                      ${t.oliMessage.plan.stops
                        .map(
                          (s, idx) =>
                            `· Parada ${idx + 1}: <b>${s.businessName}</b> - ${s.activity} (${formatCOP(s.cost)})`
                        )
                        .join('<br/>')}
                    </div>`
                  : ''
              }
            </div>
          `
            )
            .join('')}
        </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 400);
  };

  // API Key Save handler
  const handleSaveApiKey = async (e: React.FormEvent) => {
    e.preventDefault();
    const key = apiKeyInput.trim();
    if (!key) return;

    setIsSavingKey(true);
    setKeyStatusMsg(null);

    try {
      const res = await fetch('/api/oli/set-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: key }),
      });

      if (res.ok) {
        setKeyStatusMsg({
          text: '¡Clave API configurada con éxito! OLI utilizará Gemini para contextualizar el chat.',
          type: 'success',
        });
        setApiKeyInput('');
        if (onApiKeySaved) onApiKeySaved();
      } else {
        const data = await res.json().catch(() => ({}));
        setKeyStatusMsg({
          text: data.error || 'Error al guardar la clave API',
          type: 'error',
        });
      }
    } catch (err: any) {
      setKeyStatusMsg({
        text: err?.message || 'Error de conexión',
        type: 'error',
      });
    } finally {
      setIsSavingKey(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="w-full max-w-4xl max-h-[92vh] bg-white rounded-3xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 sm:px-6 py-4 bg-gradient-to-r from-slate-950 via-blue-950 to-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#0066FF]/20 border border-blue-400/30 flex items-center justify-center text-blue-300 shadow-inner">
              <ScrollText className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  Registro y Diagnóstico del Chat de OLI
                </h3>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/30">
                  Contexto Integral
                </span>
              </div>
              <p className="text-xs text-slate-300">
                Historial completo de turnos, coherencia conversacional y exportación lista para análisis con IA
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Global Context Stat Bar */}
        <div className="px-5 sm:px-6 py-3 bg-slate-50 border-b border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
              <MapPin className="w-3.5 h-3.5" />
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] font-medium">Municipio</span>
              <span className="font-bold text-slate-800">{currentCity}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <DollarSign className="w-3.5 h-3.5" />
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] font-medium">Presupuesto</span>
              <span className="font-bold text-slate-800">
                {formatCOP(currentPlan?.userBudget || 100000)}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center">
              <Layers className="w-3.5 h-3.5" />
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] font-medium">Turnos de Chat</span>
              <span className="font-bold text-slate-800">
                {turns.length} ({chatHistory.length} msgs)
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div
              className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                hasApiKey ? 'bg-purple-100 text-purple-700' : 'bg-amber-100 text-amber-700'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] font-medium">Motor OLI</span>
              <span className="font-bold text-slate-800">
                {hasApiKey ? 'Gemini 2.5' : 'Motor Local'}
              </span>
            </div>
          </div>
        </div>

        {/* Action Bar: Prominent AI Sharing & Download Formats */}
        <div className="px-5 sm:px-6 py-3.5 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          {/* Main 1-Click Prompt Sharing Button */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleCopy(generateAIPromptMarkdown(), 'ai_prompt')}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-[#0066FF] to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-xs shadow-md shadow-blue-500/20 active:scale-95 transition-all cursor-pointer"
            >
              {copiedFormat === 'ai_prompt' ? (
                <>
                  <Check className="w-4 h-4 text-emerald-300" />
                  <span>¡Copiado para IA! Pégalo aquí 🚀</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-amber-300" />
                  <span>Copiar para Análisis IA</span>
                  <Copy className="w-3.5 h-3.5 text-blue-100" />
                </>
              )}
            </button>
          </div>

          {/* Export Options (Markdown, Text, JSON, PDF) */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => {
                const dateTag = new Date().toISOString().slice(0, 10);
                handleDownload(`conversacion_oli_${dateTag}.md`, generateAIPromptMarkdown(), 'text/markdown');
              }}
              className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer border border-slate-200"
              title="Descargar conversación en formato Markdown"
            >
              <Download className="w-3 h-3 text-slate-600" />
              <span>.MD</span>
            </button>

            <button
              type="button"
              onClick={() => {
                const dateTag = new Date().toISOString().slice(0, 10);
                handleDownload(`conversacion_oli_${dateTag}.txt`, generatePlainText(), 'text/plain');
              }}
              className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer border border-slate-200"
              title="Descargar en texto plano"
            >
              <FileText className="w-3 h-3 text-slate-600" />
              <span>.TXT</span>
            </button>

            <button
              type="button"
              onClick={() => {
                const dateTag = new Date().toISOString().slice(0, 10);
                handleDownload(`conversacion_oli_${dateTag}.json`, generateJSON(), 'application/json');
              }}
              className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer border border-slate-200"
              title="Descargar datos en formato JSON"
            >
              <Code2 className="w-3 h-3 text-slate-600" />
              <span>.JSON</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer border border-slate-200"
              title="Imprimir o guardar como PDF"
            >
              <Printer className="w-3 h-3 text-slate-600" />
              <span>PDF / Imprimir</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="px-5 sm:px-6 bg-slate-100 border-b border-slate-200 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('timeline')}
            className={`py-2.5 px-3 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'timeline'
                ? 'border-[#0066FF] text-[#0066FF]'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Historial y Contexto ({turns.length} Turnos)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('prompt_preview')}
            className={`py-2.5 px-3 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'prompt_preview'
                ? 'border-[#0066FF] text-[#0066FF]'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Previsualizar Prompt de Análisis</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('config')}
            className={`py-2.5 px-3 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'config'
                ? 'border-[#0066FF] text-[#0066FF]'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Key className="w-3.5 h-3.5" />
            <span>Clave Gemini {hasApiKey && '✓'}</span>
          </button>
        </div>

        {/* Modal Body / Tab Content */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
          {/* TAB 1: TIMELINE WITH FULL CONTEXT */}
          {activeTab === 'timeline' && (
            <div className="space-y-4">
              {turns.length === 0 ? (
                <div className="py-12 text-center text-slate-400 space-y-2">
                  <ScrollText className="w-10 h-10 mx-auto text-slate-300" />
                  <p className="font-semibold text-slate-600">Aún no hay mensajes en esta sesión de chat.</p>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto">
                    Haz una consulta o pídele un plan a OLI en el chat principal para registrar todo el diálogo y analizar el contexto.
                  </p>
                </div>
              ) : (
                turns.map((turn) => (
                  <div
                    key={turn.turnIndex}
                    className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xs space-y-3.5 hover:border-blue-200 transition-colors"
                  >
                    {/* Turn Header */}
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-extrabold text-[11px]">
                          TURNO #{turn.turnIndex}
                        </span>
                        {turn.oliMessage?.responseType && (
                          <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 font-semibold text-[10px] border border-blue-100">
                            {turn.oliMessage.responseType === 'plan' ? 'Itinerario / Plan' : 'Búsqueda Directa'}
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-slate-400">
                        {turn.userMessage?.timestamp || turn.oliMessage?.timestamp || 'Reciente'}
                      </span>
                    </div>

                    {/* User Query Turn */}
                    {turn.userMessage && (
                      <div className="flex items-start gap-2.5">
                        <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shrink-0 mt-0.5">
                          <User className="w-3.5 h-3.5" />
                        </div>
                        <div className="flex-1 bg-blue-50/60 rounded-xl p-3 border border-blue-100/80">
                          <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wider block mb-0.5">
                            Consulta del Usuario:
                          </span>
                          <p className="text-xs sm:text-sm text-slate-900 font-medium whitespace-pre-wrap">
                            {turn.userMessage.text}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Oli Response Turn */}
                    {turn.oliMessage && (
                      <div className="flex items-start gap-2.5">
                        <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5">
                          <Bot className="w-3.5 h-3.5" />
                        </div>
                        <div className="flex-1 bg-slate-50 rounded-xl p-3 border border-slate-200 space-y-2.5">
                          <div>
                            <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block mb-0.5">
                              Respuesta Hablada de OLI:
                            </span>
                            <p className="text-xs sm:text-sm text-slate-800 whitespace-pre-wrap">
                              {turn.oliMessage.text}
                            </p>
                          </div>

                          {/* Plan Details if attached */}
                          {turn.oliMessage.plan?.stops && turn.oliMessage.plan.stops.length > 0 && (
                            <div className="bg-emerald-50/60 rounded-lg p-2.5 border border-emerald-200/80 space-y-1.5 text-xs">
                              <div className="flex items-center justify-between font-bold text-emerald-900 text-[11px]">
                                <span>Itinerario propuesto ({turn.oliMessage.plan.stops.length} paradas)</span>
                                <span>Total: {formatCOP(turn.oliMessage.plan.totalEstimatedCost)}</span>
                              </div>
                              <div className="space-y-1 pt-1">
                                {turn.oliMessage.plan.stops.map((st, sIdx) => (
                                  <div
                                    key={sIdx}
                                    className="flex items-start justify-between gap-2 text-[11px] bg-white/70 p-1.5 rounded border border-emerald-100"
                                  >
                                    <div>
                                      <span className="font-bold text-slate-800">
                                        {sIdx + 1}. {st.businessName}
                                      </span>
                                      <span className="text-slate-500 block">
                                        {st.activity} ({st.time || 'Horario flexible'})
                                      </span>
                                    </div>
                                    <span className="font-semibold text-emerald-700 shrink-0">
                                      {formatCOP(st.cost)}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Matched Businesses if attached */}
                          {turn.oliMessage.matchedBusinesses && turn.oliMessage.matchedBusinesses.length > 0 && (
                            <div className="bg-white rounded-lg p-2.5 border border-slate-200 space-y-1 text-xs">
                              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                                Comercios sugeridos ({turn.oliMessage.matchedBusinesses.length}):
                              </span>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
                                {turn.oliMessage.matchedBusinesses.map((b) => (
                                  <div
                                    key={b.id}
                                    className="p-1.5 rounded bg-slate-50 border border-slate-100 flex items-center justify-between text-[11px]"
                                  >
                                    <div className="truncate mr-2">
                                      <span className="font-bold text-slate-800 block truncate">{b.name}</span>
                                      <span className="text-slate-500 text-[10px] truncate block">{b.city}</span>
                                    </div>
                                    {b.phone && (
                                      <span className="text-[10px] font-mono text-emerald-700 bg-emerald-50 px-1 py-0.5 rounded shrink-0">
                                        {b.phone}
                                      </span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}

              {/* Optional user feedback notes box for export */}
              <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4 space-y-2">
                <label className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                  <HelpCircle className="w-3.5 h-3.5 text-amber-700" />
                  <span>¿Notas alguna respuesta que OLI deba mejorar? Agrega tus notas aquí:</span>
                </label>
                <textarea
                  value={customNotes}
                  onChange={(e) => setCustomNotes(e.target.value)}
                  placeholder="Ej: En el turno 2 le pedí quitar la hamburguesa y no recalculó el total, o en el turno 3 me recomendó un local de Chía cuando estaba en Cajicá..."
                  rows={2}
                  className="w-full text-xs p-2.5 rounded-xl border border-amber-200 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-400 placeholder:text-slate-400 resize-none"
                />
                <span className="text-[10px] text-amber-700 block">
                  Estas notas se incluirán automáticamente al pulsar "Copiar para Análisis IA" o al descargar los reportes.
                </span>
              </div>
            </div>
          )}

          {/* TAB 2: PROMPT PREVIEW */}
          {activeTab === 'prompt_preview' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-600 font-medium">
                  Este es el texto estructurado en Markdown que puedes copiar y pegar directamente a Antigravity o a tu modelo de IA para recibir sugerencias de mejora del diálogo:
                </p>
                <button
                  type="button"
                  onClick={() => handleCopy(generateAIPromptMarkdown(), 'preview')}
                  className="px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer border border-blue-200"
                >
                  {copiedFormat === 'preview' ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span>¡Copiado!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copiar texto</span>
                    </>
                  )}
                </button>
              </div>

              <pre className="p-4 bg-slate-900 text-slate-100 rounded-2xl text-xs font-mono leading-relaxed overflow-x-auto whitespace-pre-wrap max-h-[50vh] border border-slate-800 selection:bg-blue-600 selection:text-white">
                {generateAIPromptMarkdown()}
              </pre>
            </div>
          )}

          {/* TAB 3: CONFIGURATION (GEMINI API KEY) */}
          {activeTab === 'config' && (
            <div className="max-w-xl mx-auto py-4 space-y-5">
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center">
                    <Key className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">
                      Clave de API de Google Gemini (Opcional)
                    </h4>
                    <p className="text-xs text-slate-500">
                      Permite que OLI utilice el modelo Gemini 2.5 Flash para un razonamiento conversacional fluido.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 p-3 bg-white rounded-xl border border-slate-200 text-xs">
                  <span className="text-slate-500 font-medium">Estado actual:</span>
                  {hasApiKey ? (
                    <span className="font-bold text-emerald-600 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Clave configurada y activa
                    </span>
                  ) : (
                    <span className="font-bold text-amber-600 flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" /> Operando con motor local determinista de respaldo
                    </span>
                  )}
                </div>

                <form onSubmit={handleSaveApiKey} className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Ingresar o cambiar clave API:
                    </label>
                    <input
                      type="password"
                      value={apiKeyInput}
                      onChange={(e) => setApiKeyInput(e.target.value)}
                      placeholder="AIzaSy..."
                      className="w-full text-xs p-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#0066FF] font-mono"
                    />
                  </div>

                  {keyStatusMsg && (
                    <div
                      className={`p-3 rounded-xl text-xs font-medium ${
                        keyStatusMsg.type === 'success'
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                          : 'bg-rose-50 text-rose-800 border border-rose-200'
                      }`}
                    >
                      {keyStatusMsg.text}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isSavingKey || !apiKeyInput.trim()}
                    className="w-full py-2.5 rounded-xl bg-[#0066FF] hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs shadow-sm transition-all cursor-pointer flex items-center justify-center gap-2"
                  >
                    {isSavingKey ? 'Guardando clave...' : 'Guardar y Activar Clave Gemini'}
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 sm:px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <span>OleVeci IA · Sabana Centro</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold cursor-pointer transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};

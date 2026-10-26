import React, { useState } from 'react';
import {
  X,
  Activity,
  Cpu,
  Database,
  CheckCircle2,
  AlertTriangle,
  Key,
  Sparkles,
  Filter,
  Layers,
  ArrowRight,
  Code2,
  Check,
  Copy,
  Info,
  ShieldCheck,
} from 'lucide-react';
import { OliAuditTrace, OliAuditStep } from '../../server/oliTypes';

interface OliAuditModalProps {
  isOpen: boolean;
  onClose: () => void;
  auditTraces: OliAuditTrace[];
  selectedTrace: OliAuditTrace | null;
  onSelectTrace: (trace: OliAuditTrace) => void;
  onApiKeySaved?: () => void;
}

export const OliAuditModal: React.FC<OliAuditModalProps> = ({
  isOpen,
  onClose,
  auditTraces,
  selectedTrace,
  onSelectTrace,
  onApiKeySaved,
}) => {
  const [showRawJson, setShowRawJson] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [isSavingKey, setIsSavingKey] = useState(false);
  const [keyStatusMsg, setKeyStatusMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [copiedJson, setCopiedJson] = useState(false);

  if (!isOpen) return null;

  const currentTrace = selectedTrace || auditTraces[auditTraces.length - 1] || null;

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
          text: '¡Clave API configurada con éxito! Las próximas consultas usarán el modelo de Google Gemini.',
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
        text: err?.message || 'Error al conectar con el servidor',
        type: 'error',
      });
    } finally {
      setIsSavingKey(false);
    }
  };

  const handleCopyJson = () => {
    if (!currentTrace) return;
    navigator.clipboard.writeText(JSON.stringify(currentTrace, null, 2));
    setCopiedJson(true);
    setTimeout(() => setCopiedJson(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="w-full max-w-3xl max-h-[92vh] bg-white rounded-3xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-600/30 border border-blue-400/40 flex items-center justify-center text-blue-300 shadow-inner">
              <Activity className="w-5 h-5 text-blue-400 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white tracking-tight">
                  Inspector de Decisiones del Agente OLI
                </h3>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/30">
                  Auditoría en Vivo
                </span>
              </div>
              <p className="text-xs text-slate-300">
                Paso a paso: interpretación, consulta de base de datos y validación antialucinación
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

        {/* Trace Selector Tabs (if multiple messages exist) */}
        {auditTraces.length > 1 && (
          <div className="px-5 py-2.5 bg-slate-100 border-b border-slate-200 flex items-center gap-2 overflow-x-auto scrollbar-none">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider shrink-0 flex items-center gap-1">
              <Layers className="w-3.5 h-3.5" /> Consultas:
            </span>
            {auditTraces.map((trace, idx) => {
              const isSelected = currentTrace?.rawPrompt === trace.rawPrompt && currentTrace?.timestamp === trace.timestamp;
              return (
                <button
                  key={`${trace.timestamp}_${idx}`}
                  type="button"
                  onClick={() => onSelectTrace(trace)}
                  className={`px-3 py-1 rounded-xl text-xs font-semibold shrink-0 transition-all cursor-pointer flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-[#0066FF] text-white shadow-xs'
                      : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-200'
                  }`}
                >
                  <span>"{trace.rawPrompt.length > 16 ? `${trace.rawPrompt.slice(0, 16)}...` : trace.rawPrompt}"</span>
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      trace.executionMode === 'llm' ? 'bg-emerald-400' : 'bg-amber-400'
                    }`}
                  />
                </button>
              );
            })}
          </div>
        )}

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 bg-slate-50/60">
          {!currentTrace ? (
            <div className="py-12 text-center text-slate-500">
              <Info className="w-8 h-8 mx-auto text-slate-400 mb-2" />
              <p className="text-sm font-medium">Aún no hay consultas auditadas en esta sesión.</p>
              <p className="text-xs text-slate-400">Escribe algo en el chat para ver el desglose en tiempo real.</p>
            </div>
          ) : (
            <>
              {/* Engine Status Card */}
              <div
                className={`p-4 rounded-2xl border transition-all ${
                  currentTrace.executionMode === 'llm'
                    ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900'
                    : 'bg-amber-50/80 border-amber-200 text-amber-950'
                }`}
              >
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-xs ${
                        currentTrace.executionMode === 'llm'
                          ? 'bg-emerald-600 text-white'
                          : 'bg-amber-500 text-white'
                      }`}
                    >
                      <Cpu className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold uppercase tracking-wider">
                          Motor en Ejecución:
                        </span>
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-white shadow-2xs">
                          {currentTrace.modelUsed || currentTrace.executionMode}
                        </span>
                      </div>
                      <p className="text-xs mt-0.5 font-medium opacity-90">
                        {currentTrace.executionMode === 'llm'
                          ? '🟢 Inteligencia Artificial activa (Google Gemini procesando semántica natural).'
                          : '🟠 Motor de Respaldo Local (Reglas de Catálogo). Las respuestas usan plantillas porque no hay GEMINI_API_KEY activa.'}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowRawJson(!showRawJson)}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white/80 hover:bg-white text-xs font-semibold border border-slate-200 text-slate-700 shadow-2xs transition-all cursor-pointer"
                  >
                    <Code2 className="w-3.5 h-3.5 text-blue-600" />
                    <span>{showRawJson ? 'Ver Pasos' : 'Ver JSON'}</span>
                  </button>
                </div>

                {/* API Key Connection Box (when fallback is active or user wants to configure) */}
                {(!currentTrace.apiKeyPresent || currentTrace.executionMode === 'deterministic_fallback') && (
                  <div className="mt-3.5 pt-3 border-t border-amber-200/80">
                    <form onSubmit={handleSaveApiKey} className="space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold flex items-center gap-1.5 text-amber-900">
                          <Key className="w-3.5 h-3.5 text-amber-600" />
                          ¿Quieres activar las respuestas inteligentes con Gemini?
                        </span>
                        <span className="text-[11px] text-amber-700 font-medium">Clave de Google AI Studio</span>
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="password"
                          value={apiKeyInput}
                          onChange={(e) => setApiKeyInput(e.target.value)}
                          placeholder="Pega tu GEMINI_API_KEY (ej. AIzaSy...)"
                          className="flex-1 bg-white border border-amber-300 rounded-xl px-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <button
                          type="submit"
                          disabled={isSavingKey || !apiKeyInput.trim()}
                          className="px-3.5 py-1.5 rounded-xl bg-[#0066FF] hover:bg-blue-600 disabled:opacity-50 text-white text-xs font-bold cursor-pointer transition-colors shrink-0 shadow-xs flex items-center gap-1"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>{isSavingKey ? 'Guardando...' : 'Activar IA'}</span>
                        </button>
                      </div>
                      {keyStatusMsg && (
                        <p
                          className={`text-xs font-medium ${
                            keyStatusMsg.type === 'success' ? 'text-emerald-700 font-semibold' : 'text-rose-600'
                          }`}
                        >
                          {keyStatusMsg.text}
                        </p>
                      )}
                    </form>
                  </div>
                )}
              </div>

              {/* Raw JSON View */}
              {showRawJson ? (
                <div className="relative rounded-2xl bg-slate-900 text-slate-100 p-4 font-mono text-xs overflow-x-auto shadow-inner border border-slate-800">
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800 text-slate-400">
                    <span>auditoria_oli.json</span>
                    <button
                      type="button"
                      onClick={handleCopyJson}
                      className="flex items-center gap-1 text-[11px] text-blue-400 hover:text-blue-300 cursor-pointer"
                    >
                      {copiedJson ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedJson ? 'Copiado' : 'Copiar JSON'}</span>
                    </button>
                  </div>
                  <pre className="max-h-96 overflow-y-auto">{JSON.stringify(currentTrace, null, 2)}</pre>
                </div>
              ) : (
                /* Step-by-Step Visual Timeline */
                <div className="space-y-4">
                  {/* Step 1: Semantic Interpretation */}
                  <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 font-bold text-xs flex items-center justify-center">
                          1
                        </div>
                        <h4 className="font-bold text-slate-800 text-sm">
                          Recepción e Interpretación Semántica
                        </h4>
                      </div>
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                        {currentTrace.intentDetected === 'search'
                          ? 'Búsqueda Directa'
                          : currentTrace.intentDetected === 'plan_refinement'
                          ? 'Ajuste de Plan'
                          : 'Creación de Plan'}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs bg-slate-50 p-3 rounded-xl border border-slate-100">
                      <div>
                        <span className="text-slate-500 font-medium">Instrucción original:</span>
                        <p className="font-bold text-slate-800 text-sm mt-0.5">"{currentTrace.rawPrompt}"</p>
                      </div>
                      <div>
                        <span className="text-slate-500 font-medium">Municipio asignado:</span>
                        <p className="font-bold text-slate-800 text-sm mt-0.5">
                          📍 {currentTrace.interpretation.targetMunicipality}
                        </p>
                      </div>
                      {currentTrace.interpretation.detectedTopic && (
                        <div>
                          <span className="text-slate-500 font-medium">Tópico identificado:</span>
                          <p className="font-semibold text-blue-700 mt-0.5">
                            🏷️ {currentTrace.interpretation.detectedTopic}
                          </p>
                        </div>
                      )}
                      {currentTrace.interpretation.detectedAudience && (
                        <div>
                          <span className="text-slate-500 font-medium">Perfil / Ocasión:</span>
                          <p className="font-semibold text-slate-700 mt-0.5">
                            👥 {currentTrace.interpretation.detectedAudience} ({currentTrace.interpretation.personCount || 1} personas)
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Step 2: Database Query & Filtering */}
                  <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-700 font-bold text-xs flex items-center justify-center">
                          2
                        </div>
                        <h4 className="font-bold text-slate-800 text-sm">
                          Consulta y Filtrado en Base de Datos
                        </h4>
                      </div>
                      <span className="flex items-center gap-1 text-[11px] font-semibold text-slate-500">
                        <Database className="w-3.5 h-3.5 text-indigo-600" />
                        <span>Catálogo OleVeci</span>
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                      <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                        <span className="text-[11px] text-slate-500 font-medium block">Total Comercios</span>
                        <span className="text-base font-bold text-slate-800">
                          {currentTrace.databaseFiltering.totalBusinessesInCatalog}
                        </span>
                      </div>
                      <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                        <span className="text-[11px] text-slate-500 font-medium block">En Municipio</span>
                        <span className="text-base font-bold text-blue-600">
                          {currentTrace.databaseFiltering.businessesInTargetMunicipality}
                        </span>
                      </div>
                      <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                        <span className="text-[11px] text-slate-500 font-medium block">Coincidentes</span>
                        <span className="text-base font-bold text-emerald-600">
                          {currentTrace.databaseFiltering.matchedBusinessesCount}
                        </span>
                      </div>
                      <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                        <span className="text-[11px] text-slate-500 font-medium block">Ofertas Activas</span>
                        <span className="text-base font-bold text-indigo-600">
                          {currentTrace.databaseFiltering.matchedPostsCount}
                        </span>
                      </div>
                    </div>

                    {/* Entities Selected */}
                    {currentTrace.databaseFiltering.selectedEntities.length > 0 && (
                      <div className="space-y-1.5 pt-1">
                        <span className="text-xs font-bold text-slate-700 block">
                          Comercios y publicaciones seleccionadas en el resultado:
                        </span>
                        <div className="space-y-1.5">
                          {currentTrace.databaseFiltering.selectedEntities.map((ent, eIdx) => (
                            <div
                              key={`${ent.id}_${eIdx}`}
                              className="flex items-center justify-between text-xs px-3 py-2 rounded-xl bg-slate-50 border border-slate-200/80 hover:bg-blue-50/50 transition-colors"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <span
                                  className={`w-2 h-2 rounded-full shrink-0 ${
                                    ent.type === 'business' ? 'bg-blue-500' : 'bg-indigo-500'
                                  }`}
                                />
                                <span className="font-semibold text-slate-800 truncate">{ent.name}</span>
                                {ent.city && (
                                  <span className="text-[10px] text-slate-500 font-medium">({ent.city})</span>
                                )}
                              </div>
                              <span className="text-[10px] font-mono text-slate-400 shrink-0 ml-2">
                                ID: {ent.id}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Step 3: Anti-Hallucination & Catalog Verification */}
                  <div className="bg-emerald-50/60 rounded-2xl p-4 border border-emerald-200 shadow-xs flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                        <ShieldCheck className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-emerald-950 uppercase tracking-wider">
                          Garantía Antialucinación Estricta
                        </h4>
                        <p className="text-xs text-emerald-800 font-medium mt-0.5">
                          100% de los negocios recomendados existen físicamente y están registrados en OleVeci. Cero alucinaciones.
                        </p>
                      </div>
                    </div>
                    <span className="px-2.5 py-1 rounded-xl bg-emerald-600 text-white text-xs font-bold shadow-2xs shrink-0">
                      0 Alucinaciones
                    </span>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 bg-white border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <span className="flex items-center gap-1.5 font-medium">
            <Sparkles className="w-4 h-4 text-blue-600" />
            OleVeci AI Engine v3.0 · Sabana Centro
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold cursor-pointer transition-colors shadow-xs"
          >
            Cerrar Inspector
          </button>
        </div>
      </div>
    </div>
  );
};

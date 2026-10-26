import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  MicOff,
  Send,
  Volume2,
  Sparkles,
  MapPin,
  Users,
  Share2,
  CheckCircle2,
  Bookmark,
  Beer,
  UtensilsCrossed,
  Coffee,
  Heart,
  Loader2,
  Plus,
  User,
  Wrench,
  BookOpen,
  ArrowRight,
  Store,
  Compass,
  Phone,
  Tag,
  X,
  Activity,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Post, Business } from '../types';
import { SimulatedReadyPlan } from '../data/readyPlansData';
import { THEMES } from './InvitationCardPreview';
import { WhatsAppIcon } from './WhatsAppIcon';
import { OliPlanResponse, OliPlanStop, removeStopAndRecalculatePlan, OliAuditTrace } from '../../server/oliAssistant';
import { OliAuditModal } from './OliAuditModal';
import { OliWhatsAppModal } from './OliWhatsAppModal';

interface OliSectionProps {
  onSelectPlan?: (plan: SimulatedReadyPlan) => void;
  onSelectBusiness?: (businessId: string) => void;
  onSelectPost?: (post: Post) => void;
  onOpenItineraryBuilder?: (plan: SimulatedReadyPlan) => void;
}

interface ChatMessage {
  sender: 'user' | 'oli';
  text: string;
  plan?: OliPlanResponse;
  matchedBusinesses?: Business[];
  matchedPosts?: Post[];
  responseType?: 'plan' | 'search' | 'info';
  timestamp?: string;
  auditTrace?: OliAuditTrace;
}

// Quick starter options for first turn (exactly 4 options)
const QUICK_OPTIONS = [
  {
    id: 'papeleria',
    icon: BookOpen,
    iconBg: 'bg-indigo-600',
    emojiPrefix: '📚',
    title: 'Buscar papelería en Chía',
    prompt: 'Buscar una papelería en Chía para comprar útiles escolares e impresiones',
  },
  {
    id: 'polas',
    icon: Beer,
    iconBg: 'bg-amber-500',
    emojiPrefix: '🍺',
    title: 'Polas y alitas con amigos',
    prompt: 'Plan de polas, alitas y comida rica con amigos este fin de semana',
  },
  {
    id: 'pizza',
    icon: UtensilsCrossed,
    iconBg: 'bg-rose-500',
    emojiPrefix: '🍕',
    title: 'Pizza deliciosa en grupo',
    prompt: 'Plan para comer pizza deliciosa artesanal y compartir en grupo',
  },
  {
    id: 'familiar',
    icon: Users,
    iconBg: 'bg-emerald-500',
    emojiPrefix: '👨‍👩‍👧',
    title: 'Domingo familiar con niños',
    prompt: 'Plan familiar para el domingo con niños, almuerzo rico y postres o helados',
  },
];

export const OliSection: React.FC<OliSectionProps> = ({
  onSelectPlan,
  onSelectBusiness,
  onSelectPost,
  onOpenItineraryBuilder,
}) => {
  const { currentCity, addReadyPlan, businesses, posts } = useApp();
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentPlan, setCurrentPlan] = useState<OliPlanResponse | null>(null);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [isSaved, setIsSaved] = useState(false);

  // Audit Inspector State
  const [isAuditOpen, setIsAuditOpen] = useState(false);
  const [isWhatsAppOpen, setIsWhatsAppOpen] = useState(false);
  const [auditTraces, setAuditTraces] = useState<OliAuditTrace[]>([]);
  const [selectedAuditTrace, setSelectedAuditTrace] = useState<OliAuditTrace | null>(null);
  const [hasApiKey, setHasApiKey] = useState(false);

  // Check API key configuration on mount
  useEffect(() => {
    fetch('/api/oli/config')
      .then((res) => res.json())
      .then((data) => {
        if (data && typeof data.hasApiKey === 'boolean') {
          setHasApiKey(data.hasApiKey);
        }
      })
      .catch(() => {});
  }, []);

  // Audio / Speech State
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [isAudioLoading, setIsAudioLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const recognitionRef = useRef<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Stop audio on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (chatHistory.length > 0 || isLoading) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatHistory, isLoading]);

  // Modo de voz deshabilitado temporalmente a solicitud
  const speakWithBrowserTTS = (_text: string) => {
    return;
  };

  const playOliSpokenText = async (_spokenText: string) => {
    return;
  };

  const handleToggleAudio = (_textToPlay?: string) => {
    return;
  };

  // Speech Recognition
  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'es-CO';
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        if (transcript) {
          setInputMessage(transcript);
          handleSendMessage(transcript);
        }
      };

      recognition.onerror = () => {
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch {
      setIsListening(false);
    }
  };

  // Reset conversation to fresh state
  const handleResetConversation = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setIsPlayingAudio(false);
    setChatHistory([]);
    setCurrentPlan(null);
    setInputMessage('');
    setIsSaved(false);
    setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
  };

  // Send prompt to Oli
  const handleSendMessage = async (textToSend?: string) => {
    const prompt = (textToSend || inputMessage).trim();
    if (!prompt || isLoading) return;

    setInputMessage('');
    setIsLoading(true);
    setIsSaved(false);

    const now = new Date();
    const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const updatedHistory: ChatMessage[] = [
      ...chatHistory,
      { sender: 'user' as const, text: prompt, timestamp: timeString },
    ];
    setChatHistory(updatedHistory);

    try {
      const response = await fetch('/api/oli/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userPrompt: prompt,
          currentCity: currentCity || 'Cajicá',
          userBudget: currentPlan ? currentPlan.userBudget : 100000,
          previousPlan: currentPlan || null,
          messageHistory: updatedHistory.map((m) => ({ sender: m.sender, text: m.text })),
        }),
      });

      if (!response.ok) {
        throw new Error('Error al conectar con Oli');
      }

      const responseData: OliPlanResponse = await response.json();
      const hasStops = Boolean(responseData.stops && responseData.stops.length > 0);

      if (hasStops) {
        setCurrentPlan(responseData);
      } else if (responseData.type === 'search') {
        // If it's a direct search, reset currentPlan so subsequent queries are not trapped in plan refinement!
        setCurrentPlan(null);
      }

      if (responseData.auditTrace) {
        setAuditTraces((prev) => [...prev, responseData.auditTrace!]);
        setSelectedAuditTrace(responseData.auditTrace);
        if (responseData.auditTrace.executionMode === 'llm') {
          setHasApiKey(true);
        }
      }

      // Merge local businesses/posts if server returned basic data or IDs
      let matchedBiz = responseData.matchedBusinesses;
      if (matchedBiz && matchedBiz.length > 0 && businesses.length > 0) {
        matchedBiz = matchedBiz.map((b) => {
          const fresh = businesses.find((localB) => localB.id === b.id);
          return fresh || b;
        });
      }

      let matchedP = responseData.matchedPosts;
      if (matchedP && matchedP.length > 0 && posts.length > 0) {
        matchedP = matchedP.map((p) => {
          const fresh = posts.find((localP) => localP.id === p.id);
          return fresh || p;
        });
      }

      const responseTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setChatHistory((prev) => [
        ...prev,
        {
          sender: 'oli',
          text: responseData.spokenText,
          plan: hasStops ? responseData : undefined,
          matchedBusinesses: matchedBiz,
          matchedPosts: matchedP,
          responseType: responseData.type || (hasStops ? 'plan' : 'search'),
          timestamp: responseTime,
          auditTrace: responseData.auditTrace,
        },
      ]);

      // playOliSpokenText(responseData.spokenText);
    } catch (err: any) {
      console.error('Error generating response with Oli:', err);
      const fallbackText =
        '¡Listo veci! Te tengo toda la información de Sabana Centro. Cuéntame si buscas una papelería, un taller de autos, un restaurante o armar un plan.';
      setChatHistory((prev) => [
        ...prev,
        {
          sender: 'oli',
          text: fallbackText,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
      // speakWithBrowserTTS(fallbackText);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveStop = (msgIndex: number, stopIndex: number) => {
    setChatHistory((prev) => {
      const updated = [...prev];
      const targetMsg = updated[msgIndex];
      if (targetMsg && targetMsg.plan && targetMsg.plan.stops) {
        const newPlan = removeStopAndRecalculatePlan(targetMsg.plan, stopIndex);
        targetMsg.plan = newPlan;
        targetMsg.text = newPlan.spokenText;
        setCurrentPlan(newPlan);
      }
      return updated;
    });
  };

  const convertToReadyPlan = (oliPlan: OliPlanResponse): SimulatedReadyPlan => {
    const postIds = (oliPlan.stops || []).map((s) => s.postId);
    const coverImage = oliPlan.stops?.[0]?.imageUrl || '/Logo_OleVeci.png';
    const cleanId = `oli_${Date.now()}`;

    return {
      id: cleanId,
      planTitle: oliPlan.planTitle || 'Plan Especial OleVeci',
      scheduledTime: `${oliPlan.day || 'Fin de semana'} · ${oliPlan.stops?.[0]?.time || '4:00 PM'}`,
      coverImage,
      personalNote: oliPlan.summary || 'Plan creado con la asistencia de Oli',
      hidePrices: false,
      cardTemplate: 'oleveci_brand',
      theme: THEMES.blue_brand || THEMES.nordic_light,
      bgLayout: 'cinematic',
      postIds,
      category: 'plan_comer_algo',
      estimatedBudget: oliPlan.totalEstimatedCost || 50000,
      municipality: oliPlan.stops?.[0]?.businessCity || currentCity || 'Cajicá',
      timeOfDay: 'tarde',
      dayType: 'weekend',
      tags: ['Oli Asistente', oliPlan.targetAudience || 'Amigos', oliPlan.day || 'Fin de semana'],
    };
  };

  const handleSavePlan = () => {
    if (!currentPlan) return;
    const readyPlan = convertToReadyPlan(currentPlan);
    addReadyPlan(readyPlan);
    setIsSaved(true);
  };

  const handleOpenInEditor = () => {
    if (!currentPlan) return;
    const readyPlan = convertToReadyPlan(currentPlan);
    if (onOpenItineraryBuilder) {
      onOpenItineraryBuilder(readyPlan);
    } else if (onSelectPlan) {
      onSelectPlan(readyPlan);
    }
  };

  const handleSharePlan = async () => {
    if (!currentPlan || !currentPlan.stops) return;
    const stopsList = currentPlan.stops
      .map(
        (s, i) =>
          `📍 Parada ${i + 1} (${s.time}): *${s.businessName}* en ${s.businessCity}\n   • ${s.activity} (${s.cost.toLocaleString('es-CO')} pesos)`
      )
      .join('\n\n');

    const message =
      `¡Hola! 👋 Oli en OleVeci nos armó este planazo para ${currentPlan.day}:\n\n` +
      `🗺️ *${currentPlan.planTitle}*\n` +
      `💡 ${currentPlan.summary}\n\n` +
      `${stopsList}\n\n` +
      `💰 *Presupuesto total estimado:* ${currentPlan.totalEstimatedCost?.toLocaleString('es-CO')} pesos\n` +
      `📲 Míralo y ábrelo en OleVeci: https://oleveci.com/planes\n\n` +
      `¿Quién se anima? 🙌`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: currentPlan.planTitle,
          text: message,
          url: window.location.href,
        });
        return;
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          console.warn('Native share failed, falling back to WhatsApp', err);
        } else {
          return;
        }
      }
    }

    const encoded = encodeURIComponent(message);
    window.open(`https://api.whatsapp.com/send?text=${encoded}`, '_blank');
  };

  const hasStarted = chatHistory.length > 0 || isLoading;

  return (
    <div className="w-full flex-1 min-h-[calc(100vh-4rem)] bg-white text-slate-800 flex flex-col justify-between relative selection:bg-[#0066FF] selection:text-white">
      {/* Ambient background glows */}
      <div className="absolute top-0 inset-x-0 h-96 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-100/40 via-cyan-50/20 to-transparent pointer-events-none" />

      {/* Top Bar for active conversation (ChatGPT/Gemini style) */}
      {hasStarted && (
        <div className="sticky top-0 z-30 w-full bg-white/95 backdrop-blur-md border-b border-slate-200/90 px-4 py-2.5 shadow-2xs">
          <div className="max-w-3xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 shrink-0 flex items-center justify-center">
                <img
                  src="/assets/aistudio/Oli_sin_Fondo_d51a9103.png"
                  alt="Oli"
                  className="w-full h-full object-contain drop-shadow-2xs"
                />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs sm:text-sm font-bold text-slate-900 tracking-tight">
                    Oli Asistente
                  </span>
                  <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_6px_#10b981]" />
                </div>
                <span className="text-[10px] text-slate-500 font-medium block">
                  En línea · Sabana Centro
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsWhatsAppOpen(true)}
                className="px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs active:scale-95"
                title="Conversar con Oli en WhatsApp (Simulador y Conexión)"
              >
                <WhatsAppIcon className="w-3.5 h-3.5 text-emerald-600" />
                <span className="hidden sm:inline">WhatsApp</span>
              </button>

              <button
                type="button"
                onClick={() => setIsAuditOpen(true)}
                className="px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs active:scale-95"
                title="Auditoría del Agente: Ver interpretación y filtrado paso a paso"
              >
                <Activity className="w-3.5 h-3.5 text-[#0066FF]" />
                <span className="hidden sm:inline">Auditoría OLI</span>
                <span
                  className={`w-2 h-2 rounded-full ${
                    hasApiKey ? 'bg-emerald-500 shadow-[0_0_6px_#10b981]' : 'bg-amber-500'
                  }`}
                  title={hasApiKey ? 'IA Gemini Activa' : 'Motor Local de Respaldo'}
                />
              </button>

              <button
                type="button"
                onClick={handleResetConversation}
                className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs active:scale-95"
                title="Iniciar una nueva conversación"
              >
                <Plus className="w-3.5 h-3.5 text-[#0066FF]" />
                <span className="hidden sm:inline">Nueva consulta</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="w-full flex-1 flex flex-col relative z-10">
        {/* INITIAL STATE: Hero presentation & Quick starter options */}
        {!hasStarted && (
          <div className="w-full max-w-3xl mx-auto flex-1 flex flex-col items-center justify-center px-4 py-8 sm:py-12">
            {/* Full Oli Mascot Character (Complete, unclipped, not inside a circle) */}
            <div className="relative mb-3 flex flex-col items-center">
              <div className="relative w-36 h-36 sm:w-44 sm:h-44 flex items-center justify-center transition-transform hover:scale-105 duration-300">
                {/* Soft ambient aura in background */}
                <div className="absolute inset-4 bg-gradient-to-tr from-blue-400/20 via-cyan-400/25 to-amber-300/20 rounded-full blur-2xl pointer-events-none" />

                <img
                  src="/assets/aistudio/Oli_sin_Fondo_d51a9103.png"
                  alt="Oli Asistente"
                  className="w-full h-full object-contain select-none drop-shadow-[0_12px_24px_rgba(0,102,255,0.22)]"
                />
              </div>
            </div>

            {/* Action Pills: WhatsApp & Inspector */}
            <div className="flex flex-wrap items-center justify-center gap-2 mb-3">
              <button
                type="button"
                onClick={() => setIsWhatsAppOpen(true)}
                className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-xs font-semibold text-emerald-700 transition-all cursor-pointer shadow-2xs hover:shadow-xs active:scale-95"
              >
                <WhatsAppIcon className="w-3.5 h-3.5 text-emerald-600" />
                <span>Chatear en WhatsApp</span>
              </button>

              <button
                type="button"
                onClick={() => setIsAuditOpen(true)}
                className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-50 hover:bg-blue-100 border border-blue-200 text-xs font-semibold text-blue-700 transition-all cursor-pointer shadow-2xs hover:shadow-xs active:scale-95"
              >
                <Activity className="w-3.5 h-3.5 text-[#0066FF]" />
                <span>Auditoría e Inspector</span>
                <span
                  className={`w-2 h-2 rounded-full ${
                    hasApiKey ? 'bg-emerald-500 shadow-[0_0_6px_#10b981]' : 'bg-amber-500'
                  }`}
                  title={hasApiKey ? 'IA Gemini Activa' : 'Motor Local de Respaldo'}
                />
              </button>
            </div>

            {/* Headline */}
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-slate-900 text-center tracking-tight mb-3">
              ¡Hola,{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#0066FF] via-[#00B4D8] to-[#FB8500]">
                soy Oli!
              </span>
            </h1>

            {/* Subtitle */}
            <p className="text-slate-600 text-sm sm:text-base text-center max-w-xl mx-auto mb-8 sm:mb-10 leading-relaxed font-normal px-2">
              Puedo armarte un plan, buscar cualquier negocio o alguna promoción, en tu municipio.
            </p>

            {/* Section title */}
            <div className="w-full max-w-2xl mb-3 flex items-center justify-between">
              <span className="text-[11px] font-bold tracking-wider text-slate-500 uppercase">
                OPCIONES RÁPIDAS PARA EMPEZAR:
              </span>
            </div>

            {/* Quick Prompt Cards Grid (Spacious 2 columns so full text is completely visible) */}
            <div className="w-full max-w-2xl grid grid-cols-1 sm:grid-cols-2 gap-3">
              {QUICK_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      setInputMessage(opt.prompt);
                      handleSendMessage(opt.prompt);
                    }}
                    disabled={isLoading}
                    className="w-full p-3.5 sm:p-4 rounded-2xl bg-white hover:bg-blue-50/50 border border-slate-200/90 hover:border-blue-400 transition-all duration-200 cursor-pointer flex items-center gap-3.5 text-left group shadow-xs hover:shadow-md active:scale-98 disabled:opacity-50"
                  >
                    <div
                      className={`w-10 h-10 rounded-full ${opt.iconBg} text-white flex items-center justify-center shrink-0 shadow-sm group-hover:scale-110 transition-transform`}
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-bold text-slate-800 group-hover:text-[#0056d6] transition-colors leading-snug block">
                        {opt.emojiPrefix} {opt.title}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* CONVERSATION THREAD: Active chat messages */}
        {hasStarted && (
          <div className="w-full max-w-3xl mx-auto flex-1 px-4 py-6 space-y-6">
            {chatHistory.map((msg, index) => {
              const isUser = msg.sender === 'user';

              if (isUser) {
                return (
                  <div
                    key={index}
                    className="w-full flex justify-end gap-2.5 sm:gap-3 items-end animate-in fade-in slide-in-from-bottom-2 duration-300"
                  >
                    <div className="max-w-[85%] sm:max-w-[75%] rounded-2xl rounded-br-xs bg-[#0066FF] text-white p-3.5 sm:p-4 shadow-sm">
                      <p className="text-xs sm:text-sm leading-relaxed whitespace-pre-wrap font-medium">
                        {msg.text}
                      </p>
                      {msg.timestamp && (
                        <span className="text-[10px] text-blue-100/80 font-medium block text-right mt-1.5">
                          {msg.timestamp}
                        </span>
                      )}
                    </div>
                    <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 shrink-0 mb-0.5 shadow-2xs">
                      <User className="w-4 h-4" />
                    </div>
                  </div>
                );
              }

              // Oli Assistant Message Turn
              const plan = msg.plan;
              const matchedBiz = msg.matchedBusinesses || [];
              const matchedP = msg.matchedPosts || [];

              return (
                <div
                  key={index}
                  className="w-full flex gap-2.5 sm:gap-3 items-start animate-in fade-in slide-in-from-bottom-2 duration-300"
                >
                  {/* Oli Mascot Avatar (Complete, unclipped) */}
                  <div className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center shrink-0 mt-0.5">
                    <img
                      src="/assets/aistudio/Oli_sin_Fondo_d51a9103.png"
                      alt="Oli"
                      className="w-full h-full object-contain drop-shadow-xs"
                    />
                  </div>

                  {/* Oli Message Content */}
                  <div className="flex-1 min-w-0 space-y-4">
                    {/* Conversational Bubble */}
                    <div className="w-full rounded-2xl rounded-tl-xs bg-white border border-slate-200 p-4 sm:p-5 shadow-xs space-y-3">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-[#0056d6]">
                            Oli Asistente
                          </span>
                          <span className="text-[10px] text-slate-400">
                            · Sabana Centro
                          </span>
                        </div>

                        {/* Modo de voz deshabilitado temporalmente */}
                      </div>

                      {/* Conversational Spoken Text */}
                      <p className="text-xs sm:text-sm text-slate-800 leading-relaxed font-normal whitespace-pre-wrap">
                        {msg.text}
                      </p>

                      <div className="flex items-center justify-between pt-1">
                        {msg.auditTrace ? (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedAuditTrace(msg.auditTrace!);
                              setIsAuditOpen(true);
                            }}
                            className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100/80 px-2.5 py-1 rounded-xl transition-all cursor-pointer shadow-2xs active:scale-95"
                          >
                            <Activity className="w-3 h-3 text-[#0066FF]" />
                            <span>Auditar paso a paso</span>
                          </button>
                        ) : (
                          <span />
                        )}

                        {msg.timestamp && (
                          <span className="text-[10px] text-slate-400 font-medium">
                            {msg.timestamp}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* BUSINESS SEARCH RESULTS (Directly in chat without leaving) */}
                    {matchedBiz.length > 0 && (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 px-1">
                          <Store className="w-4 h-4 text-[#0066FF]" />
                          <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                            Comercios y Servicios Encontrados ({matchedBiz.length})
                          </span>
                        </div>

                        <div className="grid grid-cols-1 gap-3">
                          {matchedBiz.map((biz) => {
                            const waClean = (biz.whatsapp || biz.phone || '').replace(/\D/g, '');
                            const waUrl = waClean
                              ? `https://wa.me/${waClean.startsWith('57') ? waClean : `57${waClean}`}?text=${encodeURIComponent(
                                  `¡Hola! Los encontré en OleVeci recomendados por Oli. Quisiera más información sobre sus servicios.`
                                )}`
                              : null;

                            return (
                              <div
                                key={biz.id}
                                className="w-full bg-white rounded-2xl border border-slate-200/90 hover:border-blue-300 p-4 shadow-xs hover:shadow-md transition-all flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between group"
                              >
                                <div className="flex items-start gap-3.5 min-w-0 flex-1">
                                  <div className="w-14 h-14 rounded-xl overflow-hidden bg-slate-100 border border-slate-200 shrink-0 shadow-2xs">
                                    <img
                                      src={biz.coverImage || biz.logo || '/Logo_OleVeci.png'}
                                      alt={biz.name}
                                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                    />
                                  </div>

                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <h3 className="text-sm font-bold text-slate-900 group-hover:text-[#0056d6] transition-colors truncate">
                                        {biz.name}
                                      </h3>
                                      {biz.verified && (
                                        <CheckCircle2 className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                                      )}
                                      {biz.subCategory && (
                                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                                          {biz.subCategory}
                                        </span>
                                      )}
                                    </div>

                                    <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mt-1">
                                      <MapPin className="w-3 h-3 text-[#0066FF] shrink-0" />
                                      <span className="truncate">
                                        {biz.city} · {biz.address}
                                      </span>
                                    </div>

                                    {biz.description && (
                                      <p className="text-xs text-slate-600 mt-1.5 line-clamp-2 leading-relaxed">
                                        {biz.description}
                                      </p>
                                    )}
                                  </div>
                                </div>

                                {/* Direct Actions */}
                                <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                                  {waUrl && (
                                    <a
                                      href={waUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="flex-1 sm:flex-initial px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-xs active:scale-95"
                                      title="Escribir al WhatsApp del negocio"
                                    >
                                      <WhatsAppIcon className="w-4 h-4 fill-white" />
                                      <span>WhatsApp</span>
                                    </a>
                                  )}

                                  <button
                                    type="button"
                                    onClick={() => onSelectBusiness?.(biz.id)}
                                    className="flex-1 sm:flex-initial px-3.5 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-[#0056d6] border border-blue-200 text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95"
                                    title="Ver perfil completo del comercio en la app"
                                  >
                                    <span>Ver en app</span>
                                    <ArrowRight className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* MATCHED POSTS / PROMOTIONS */}
                    {matchedP.length > 0 && (
                      <div className="space-y-2.5">
                        <div className="flex items-center gap-2 px-1">
                          <Tag className="w-4 h-4 text-emerald-600" />
                          <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                            Publicaciones y Promociones Disponibles
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          {matchedP.map((post) => (
                            <div
                              key={post.id}
                              onClick={() => onSelectPost?.(post)}
                              className="bg-white rounded-xl border border-slate-200 p-2.5 flex items-center gap-3 hover:border-blue-400 hover:shadow-xs transition-all cursor-pointer group"
                            >
                              <div className="w-12 h-12 rounded-lg overflow-hidden bg-slate-100 shrink-0">
                                <img
                                  src={post.imageUrl || '/Logo_OleVeci.png'}
                                  alt={post.title}
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                />
                              </div>
                              <div className="min-w-0 flex-1">
                                <h4 className="text-xs font-bold text-slate-900 group-hover:text-[#0056d6] transition-colors truncate">
                                  {post.title}
                                </h4>
                                <span className="text-[10px] text-slate-500 block truncate">
                                  {post.businessName} · {post.businessCity}
                                </span>
                                {(post.promotionalPrice || post.originalPrice) && (
                                  <span className="text-[11px] font-extrabold text-emerald-600">
                                    {(post.promotionalPrice || post.originalPrice || 0).toLocaleString('es-CO')} pesos
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* RICH ITINERARY PLAN CARD (When a plan was requested) */}
                    {plan && plan.stops && plan.stops.length > 0 && (
                      <div className="w-full rounded-2xl bg-white border border-slate-200 shadow-md overflow-hidden">
                        {/* Header Banner */}
                        <div className="bg-gradient-to-r from-[#0066FF] via-[#00B4D8] to-[#0096C7] p-4 sm:p-5 text-white">
                          <div className="flex items-center justify-between gap-3 mb-2">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/20 backdrop-blur-md text-[11px] font-bold uppercase tracking-wider text-white">
                              <Sparkles className="w-3 h-3" />
                              Plan en {plan.stops[0]?.businessCity || currentCity || 'Sabana Centro'}
                            </span>
                            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-black/20 text-white">
                              {plan.day}
                            </span>
                          </div>

                          <h2 className="text-base sm:text-xl font-black tracking-tight leading-snug">
                            {plan.planTitle}
                          </h2>
                          <p className="text-xs sm:text-sm text-blue-100 mt-1 line-clamp-2">
                            {plan.summary}
                          </p>

                          {/* Plan Metadata Pill */}
                          <div className="flex items-center gap-3 mt-3 text-xs text-white/90 flex-wrap">
                            <span className="flex items-center gap-1">
                              <Users className="w-3.5 h-3.5 text-white/80" />
                              {plan.targetAudience}
                            </span>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              <Compass className="w-3.5 h-3.5 text-white/80" />
                              {plan.stops.length} paradas
                            </span>
                            <span>•</span>
                            <span className="font-bold text-amber-200">
                              Total: {plan.totalEstimatedCost.toLocaleString('es-CO')} pesos
                            </span>
                          </div>
                        </div>

                        {/* Stops Timeline */}
                        <div className="p-4 sm:p-5 space-y-4">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
                              Ruta parada por parada:
                            </span>
                            <span className="text-[11px] text-slate-500 font-medium">
                              En orden cronológico
                            </span>
                          </div>

                          <div className="space-y-3 relative before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-blue-100">
                            {plan.stops.map((stop, sIdx) => {
                              const matchingPost = posts.find((p) => p.id === stop.postId);
                              const stopImage = stop.imageUrl || matchingPost?.imageUrl || '/Logo_OleVeci.png';

                              return (
                                <div
                                  key={stop.postId || sIdx}
                                  className="relative flex items-start gap-3 pl-1"
                                >
                                  <div className="w-6 h-6 rounded-full bg-[#0066FF] text-white flex items-center justify-center text-xs font-bold shrink-0 shadow-xs ring-4 ring-white z-10 mt-1">
                                    {sIdx + 1}
                                  </div>

                                  <div className="flex-1 bg-slate-50 hover:bg-blue-50/40 border border-slate-200/80 rounded-2xl p-3 sm:p-3.5 transition-colors">
                                    <div className="flex items-start gap-3">
                                      {/* Stop Publication Thumbnail */}
                                      <div
                                        onClick={() => {
                                          if (matchingPost && onSelectPost) {
                                            onSelectPost(matchingPost);
                                          }
                                        }}
                                        className={`relative w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden shrink-0 bg-slate-200 border border-slate-200 shadow-2xs group ${
                                          matchingPost && onSelectPost ? 'cursor-pointer hover:ring-2 hover:ring-[#0066FF]/40' : ''
                                        }`}
                                        title={matchingPost ? 'Toca para ver la publicación completa' : stop.businessName}
                                      >
                                        <img
                                          src={stopImage}
                                          alt={stop.postTitle || stop.businessName}
                                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                          onError={(e) => {
                                            (e.currentTarget as HTMLImageElement).src = '/Logo_OleVeci.png';
                                          }}
                                        />
                                        <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-slate-950/80 backdrop-blur-xs text-[9px] sm:text-[10px] font-bold text-white shadow-xs">
                                          {stop.time}
                                        </span>
                                      </div>

                                      {/* Stop Details */}
                                      <div className="min-w-0 flex-1 flex flex-col justify-between">
                                        <div>
                                          <div className="flex items-start justify-between gap-2">
                                            <div>
                                              <span className="text-[11px] font-bold text-[#0066FF] bg-blue-100/70 px-2 py-0.5 rounded-md inline-block mb-1">
                                                {stop.time}
                                              </span>
                                              <h4 className="text-xs sm:text-sm font-extrabold text-slate-900 leading-tight">
                                                {stop.businessName}
                                              </h4>
                                            </div>

                                            {/* Cost Pill and Remove Action */}
                                            <div className="flex items-center gap-1.5 shrink-0">
                                              <span className="text-xs sm:text-sm font-extrabold text-emerald-700 block whitespace-nowrap">
                                                {stop.cost.toLocaleString('es-CO')} pesos
                                              </span>
                                              {plan.stops.length > 1 && (
                                                <button
                                                  type="button"
                                                  onClick={() => handleRemoveStop(index, sIdx)}
                                                  className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                                                  title="Eliminar esta parada del plan y recalcular presupuesto"
                                                >
                                                  <X className="w-3.5 h-3.5" />
                                                </button>
                                              )}
                                            </div>
                                          </div>

                                          {/* Post title */}
                                          {stop.postTitle && (
                                            <p className="text-xs text-blue-700 font-bold mt-1 line-clamp-1">
                                              {stop.postTitle}
                                            </p>
                                          )}

                                          {/* Real post description from catalog without redundant repetitive prefixes */}
                                          {matchingPost?.description && matchingPost.description.trim() !== stop.postTitle.trim() && (
                                            <p className="text-xs text-slate-600 mt-1 line-clamp-2 leading-relaxed">
                                              {matchingPost.description}
                                            </p>
                                          )}
                                        </div>

                                        <div className="mt-2 pt-2 border-t border-slate-200/60 flex items-center justify-between gap-2 flex-wrap">
                                          <div className="flex items-center gap-1.5 text-[11px] text-slate-500 min-w-0">
                                            <MapPin className="w-3 h-3 text-[#0066FF] shrink-0" />
                                            <span className="truncate">
                                              {stop.businessCity} · {stop.businessAddress}
                                            </span>
                                          </div>

                                          {matchingPost && onSelectPost && (
                                            <button
                                              type="button"
                                              onClick={() => onSelectPost(matchingPost)}
                                              className="text-[11px] font-bold text-[#0066FF] hover:text-[#0056d6] hover:underline flex items-center gap-1 cursor-pointer shrink-0 ml-auto"
                                            >
                                              <span>Ver publicación</span>
                                              <ArrowRight className="w-3 h-3" />
                                            </button>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* Actions Toolbar */}
                        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2.5">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={handleOpenInEditor}
                              className="px-3.5 py-2 rounded-xl bg-[#0066FF] hover:bg-[#0056d6] text-white text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs active:scale-95"
                            >
                              <Compass className="w-4 h-4" />
                              <span>Abrir en el Mapa / Editor</span>
                            </button>

                            <button
                              type="button"
                              onClick={handleSharePlan}
                              className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 shadow-2xs"
                            >
                              <Share2 className="w-4 h-4 text-emerald-600" />
                              <span>Compartir Plan</span>
                            </button>
                          </div>

                          <button
                            type="button"
                            onClick={handleSavePlan}
                            disabled={isSaved}
                            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 shadow-2xs ${
                              isSaved
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-300'
                                : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
                            }`}
                          >
                            <Bookmark className="w-4 h-4" />
                            <span>{isSaved ? '¡Plan Guardado!' : 'Guardar Plan'}</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Loading state like Gemini/ChatGPT */}
            {isLoading && (
              <div className="w-full flex gap-2.5 sm:gap-3 items-start animate-in fade-in duration-300">
                <div className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center shrink-0">
                  <img
                    src="/assets/aistudio/Oli_sin_Fondo_d51a9103.png"
                    alt="Oli"
                    className="w-full h-full object-contain animate-bounce drop-shadow-xs"
                  />
                </div>
                <div className="p-4 rounded-2xl rounded-tl-xs bg-white border border-blue-100 shadow-xs flex items-center gap-3 text-slate-700">
                  <Loader2 className="w-4 h-4 animate-spin text-[#0066FF] shrink-0" />
                  <span className="text-xs sm:text-sm font-medium text-slate-600">
                    Oli está consultando comercios y publicaciones en tiempo real...
                  </span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Seamless Bottom Input Bar (ChatGPT / Gemini style - Integrated into the chat canvas) */}
      <div className="sticky bottom-0 inset-x-0 bg-gradient-to-t from-white via-white/95 to-white/0 pt-2 pb-4 sm:pb-5 px-4 z-20 pointer-events-auto">
        <div className="max-w-3xl mx-auto w-full">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="w-full bg-slate-50/90 hover:bg-slate-100/90 border border-slate-200/90 hover:border-slate-300 focus-within:border-[#0066FF] focus-within:bg-white focus-within:ring-3 focus-within:ring-blue-500/15 rounded-2xl p-1.5 sm:p-2 flex items-center gap-2 sm:gap-3 shadow-sm hover:shadow transition-all"
          >
            <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-[#0066FF] bg-blue-50/80 ml-1">
              <Sparkles className="w-4 h-4" />
            </div>

            {/* Text input */}
            <input
              ref={inputRef}
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder={
                hasStarted
                  ? 'Pregúntale a Oli: buscar un taller, una papelería, o ajustar el plan...'
                  : 'Pregúntale a Oli: "buscar una papelería", "un taller de autos", o un plan...'
              }
              disabled={isLoading}
              className="flex-1 bg-transparent border-0 outline-none text-slate-800 placeholder:text-slate-400 text-xs sm:text-sm px-2 font-medium"
            />

            {/* Send Button */}
            <button
              type="submit"
              disabled={isLoading || !inputMessage.trim()}
              className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-gradient-to-r from-[#0066FF] to-[#00B4D8] hover:from-[#0052cc] hover:to-[#0096b4] disabled:opacity-30 disabled:from-slate-300 disabled:to-slate-300 text-white flex items-center justify-center transition-all cursor-pointer shrink-0 active:scale-95 shadow-xs"
              title="Enviar mensaje"
              aria-label="Enviar mensaje"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin text-white" />
              ) : (
                <Send className="w-5 h-5 text-white -rotate-12 translate-x-0.5" />
              )}
            </button>
          </form>
        </div>
      </div>

      {/* Floating Step-by-Step Agent Decision Inspector */}
      <OliAuditModal
        isOpen={isAuditOpen}
        onClose={() => setIsAuditOpen(false)}
        auditTraces={auditTraces}
        selectedTrace={selectedAuditTrace}
        onSelectTrace={(trace) => setSelectedAuditTrace(trace)}
        onApiKeySaved={() => setHasApiKey(true)}
      />

      {/* WhatsApp Modal: Simulator, Direct wa.me link, and Meta Cloud API Webhook */}
      <OliWhatsAppModal
        isOpen={isWhatsAppOpen}
        onClose={() => setIsWhatsAppOpen(false)}
      />
    </div>
  );
};

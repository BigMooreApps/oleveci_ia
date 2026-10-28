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
  ScrollText,
  Pencil,
  Trash2,
  Check,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Post, Business } from '../types';
import { SimulatedReadyPlan } from '../data/readyPlansData';
import { THEMES } from './InvitationCardPreview';
import { WhatsAppIcon } from './WhatsAppIcon';
import { OliPlanResponse, OliPlanStop, removeStopAndRecalculatePlan } from '../../server/oliAssistant';
import { OliChatLogModal } from './OliChatLogModal';
import { OliWhatsAppModal } from './OliWhatsAppModal';

const formatPriceCOP = (amount?: number | null): string => {
  if (amount === undefined || amount === null || isNaN(amount)) {
    return 'Precio por confirmar';
  }
  return `${Math.round(amount).toLocaleString('es-CO')} pesos`;
};

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
  auditTrace?: any;
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
  const [editingMessageIndex, setEditingMessageIndex] = useState<number | null>(null);
  const [editingMessageText, setEditingMessageText] = useState('');
  const [expandedResults, setExpandedResults] = useState<Record<number, boolean>>({});

  // Full Chat Conversation Log & WhatsApp Modal State
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [isWhatsAppOpen, setIsWhatsAppOpen] = useState(false);
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

  // Edit & Delete handlers for user messages
  const handleStartEdit = (index: number, currentText: string) => {
    setEditingMessageIndex(index);
    setEditingMessageText(currentText);
  };

  const handleCancelEdit = () => {
    setEditingMessageIndex(null);
    setEditingMessageText('');
  };

  const handleSaveEdit = (index: number) => {
    const trimmed = editingMessageText.trim();
    if (!trimmed) {
      handleCancelEdit();
      return;
    }

    // 1. History prior to this message
    const priorHistory = chatHistory.slice(0, index);

    // 2. Recover the previousPlan as of that point in time
    let planAtThatPoint: OliPlanResponse | null = null;
    for (let i = index - 1; i >= 0; i--) {
      if (chatHistory[i]?.sender === 'oli' && chatHistory[i]?.plan?.stops?.length) {
        planAtThatPoint = chatHistory[i].plan!;
        break;
      }
    }

    setEditingMessageIndex(null);
    setEditingMessageText('');

    // 3. Re-send with edited text, prior history, and the previous plan as of that point
    handleSendMessage(trimmed, priorHistory, planAtThatPoint);
  };

  const handleDeleteMessage = (index: number) => {
    // 1. Slices history before this user turn (excluding this user message and any answer after it)
    const priorHistory = chatHistory.slice(0, index);

    // 2. Recover the previousPlan as of that point in time
    let planAtThatPoint: OliPlanResponse | null = null;
    for (let i = index - 1; i >= 0; i--) {
      if (chatHistory[i]?.sender === 'oli' && chatHistory[i]?.plan?.stops?.length) {
        planAtThatPoint = chatHistory[i].plan!;
        break;
      }
    }

    setCurrentPlan(planAtThatPoint);
    setChatHistory(priorHistory);
    if (editingMessageIndex === index) {
      handleCancelEdit();
    }
  };

  // Send prompt to Oli (supports history and plan overrides for message editing)
  const handleSendMessage = async (
    textToSend?: string,
    historyOverride?: ChatMessage[],
    previousPlanOverride?: OliPlanResponse | null
  ) => {
    const prompt = (textToSend || inputMessage).trim();
    if (!prompt || isLoading) return;

    setInputMessage('');
    setIsLoading(true);
    setIsSaved(false);

    const now = new Date();
    const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const baseHistory = historyOverride !== undefined ? historyOverride : chatHistory;
    const activePlan = previousPlanOverride !== undefined ? previousPlanOverride : currentPlan;

    const updatedHistory: ChatMessage[] = [
      ...baseHistory,
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
          userBudget: activePlan?.userBudget || 0,
          previousPlan: activePlan || null,
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
      }

      if (responseData.auditTrace?.executionMode === 'llm') {
        setHasApiKey(true);
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
      setChatHistory([
        ...updatedHistory,
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
    } catch (err: any) {
      console.error('Error generating response with Oli:', err);
      const fallbackText =
        '¡Listo veci! Te tengo toda la información de Sabana Centro. Cuéntame si buscas una papelería, un taller de autos, un restaurante o armar un plan.';
      setChatHistory([
        ...updatedHistory,
        {
          sender: 'oli',
          text: fallbackText,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
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
                onClick={() => setIsLogModalOpen(true)}
                className="px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs active:scale-95"
                title="Registro y Diagnóstico del Chat: Ver contexto completo y exportar para IA"
              >
                <ScrollText className="w-3.5 h-3.5 text-[#0066FF]" />
                <span className="hidden sm:inline">Log del Chat</span>
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
                onClick={() => setIsLogModalOpen(true)}
                className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-50 hover:bg-blue-100 border border-blue-200 text-xs font-semibold text-blue-700 transition-all cursor-pointer shadow-2xs hover:shadow-xs active:scale-95"
              >
                <ScrollText className="w-3.5 h-3.5 text-[#0066FF]" />
                <span>Log y Contexto del Chat</span>
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
                const isEditingThis = editingMessageIndex === index;

                return (
                  <div
                    key={index}
                    className="w-full flex justify-end gap-2.5 sm:gap-3 items-end animate-in fade-in slide-in-from-bottom-2 duration-300"
                  >
                    {isEditingThis ? (
                      <div className="w-full max-w-[90%] sm:max-w-[80%] rounded-2xl rounded-br-xs bg-[#0056d6] text-white p-3.5 sm:p-4 shadow-md border border-blue-400/50 space-y-3">
                        <div className="flex items-center justify-between text-xs text-blue-100 border-b border-blue-400/30 pb-1.5 font-medium">
                          <span className="flex items-center gap-1.5">
                            <Pencil className="w-3.5 h-3.5 text-blue-200" />
                            Editando solicitud
                          </span>
                          <span className="text-[10px] text-blue-200/80">Presiona Enter para actualizar</span>
                        </div>
                        <textarea
                          value={editingMessageText}
                          onChange={(e) => setEditingMessageText(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              handleSaveEdit(index);
                            } else if (e.key === 'Escape') {
                              handleCancelEdit();
                            }
                          }}
                          autoFocus
                          rows={2}
                          className="w-full bg-blue-900/60 border border-blue-300/40 rounded-xl p-2.5 text-xs sm:text-sm text-white placeholder-blue-300 focus:outline-none focus:ring-2 focus:ring-white resize-none"
                          placeholder="Modifica tu mensaje..."
                        />
                        <div className="flex items-center justify-end gap-2 pt-1">
                          <button
                            type="button"
                            onClick={handleCancelEdit}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/10 hover:bg-white/20 text-white transition-all cursor-pointer flex items-center gap-1"
                          >
                            <X className="w-3.5 h-3.5" />
                            Cancelar
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSaveEdit(index)}
                            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-white text-blue-700 hover:bg-blue-50 transition-all cursor-pointer shadow-sm flex items-center gap-1"
                          >
                            <Check className="w-3.5 h-3.5" />
                            Guardar y actualizar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="group relative max-w-[85%] sm:max-w-[75%]">
                        {/* Action buttons (Editar y Borrar) on hover */}
                        <div className="opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity absolute -top-3.5 right-2 hidden sm:flex items-center gap-1 bg-white border border-slate-200 rounded-full px-2 py-0.5 shadow-sm text-slate-500 z-10">
                          <button
                            type="button"
                            onClick={() => handleStartEdit(index, msg.text)}
                            className="hover:text-blue-600 p-1 rounded-full transition-colors cursor-pointer"
                            title="Editar mensaje y recalcular plan"
                          >
                            <Pencil className="w-3 h-3" />
                          </button>
                          <span className="w-px h-3 bg-slate-200" />
                          <button
                            type="button"
                            onClick={() => handleDeleteMessage(index)}
                            className="hover:text-rose-600 p-1 rounded-full transition-colors cursor-pointer"
                            title="Eliminar mensaje"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>

                        <div className="rounded-2xl rounded-br-xs bg-[#0066FF] text-white p-3.5 sm:p-4 shadow-sm">
                          <p className="text-xs sm:text-sm leading-relaxed whitespace-pre-wrap font-medium">
                            {msg.text}
                          </p>
                          <div className="flex items-center justify-between gap-2 mt-1.5">
                            {/* Botones de acción táctiles en móvil */}
                            <div className="flex sm:hidden items-center gap-2 text-[11px] text-blue-100/90 font-medium">
                              <button
                                type="button"
                                onClick={() => handleStartEdit(index, msg.text)}
                                className="inline-flex items-center gap-1 hover:underline cursor-pointer"
                              >
                                <Pencil className="w-2.5 h-2.5" />
                                Editar
                              </button>
                              <span>·</span>
                              <button
                                type="button"
                                onClick={() => handleDeleteMessage(index)}
                                className="inline-flex items-center gap-1 hover:underline text-rose-200 cursor-pointer"
                              >
                                <Trash2 className="w-2.5 h-2.5" />
                                Borrar
                              </button>
                            </div>
                            {msg.timestamp && (
                              <span className="text-[10px] text-blue-100/80 font-medium block ml-auto">
                                {msg.timestamp}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

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

                      {msg.timestamp && (
                        <div className="flex justify-end pt-0.5">
                          <span className="text-[10px] text-slate-400 font-medium">
                            {msg.timestamp}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* CONDITIONAL DISPLAY: IF PLAN EXISTS -> SHOW ONLY ITINERARY. IF NO PLAN -> SHOW UNIFIED POST-FIRST RESULTS */}
                    {plan && plan.stops && plan.stops.length > 0 ? (
                      /* RICH ITINERARY PLAN CARD (Plan takes priority, no duplicate satellite cards below) */
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
                          <p className="text-xs text-blue-100 mt-1 line-clamp-2 font-normal">
                            {plan.narrativeHook}
                          </p>

                          {/* Quick Stats Pill */}
                          <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-white/20 text-xs">
                            <div className="flex items-center gap-1.5 bg-black/20 px-2.5 py-1 rounded-lg">
                              <MapPin className="w-3.5 h-3.5 text-cyan-300" />
                              <span>{plan.stops.length} paradas</span>
                            </div>

                            <div className="flex items-center gap-1.5 bg-black/20 px-2.5 py-1 rounded-lg font-bold">
                              <span>Total estimado: {formatPriceCOP(plan.totalEstimatedCost)}</span>
                            </div>

                            {plan.costPerPerson && plan.personCount && plan.personCount > 1 && (
                              <div className="flex items-center gap-1.5 bg-white/20 px-2.5 py-1 rounded-lg font-semibold text-[11px]">
                                <span>~{formatPriceCOP(plan.costPerPerson)} / persona ({plan.personCount} personas)</span>
                              </div>
                            )}

                            {plan.budgetStatus === 'over_budget' && (
                              <span className="bg-amber-500/90 text-white font-bold text-[10px] px-2 py-0.5 rounded-md">
                                Supera presupuesto
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Stops List */}
                        <div className="p-4 sm:p-5 space-y-4">
                          <div className="space-y-3">
                            {plan.stops.map((stop, sIdx) => {
                              const waClean = (stop.businessWhatsapp || stop.businessPhone || '').replace(/\D/g, '');
                              const waUrl = waClean
                                ? `https://wa.me/${waClean.startsWith('57') ? waClean : `57${waClean}`}?text=${encodeURIComponent(
                                    `¡Hola! Vi en OleVeci su parada "${stop.activity}" en ${stop.businessName}. Quisiera más información.`
                                  )}`
                                : null;

                              return (
                                <div
                                  key={sIdx}
                                  className="relative flex gap-3.5 p-3 sm:p-4 rounded-xl bg-slate-50 border border-slate-200 hover:border-blue-300 hover:bg-blue-50/20 transition-all group"
                                >
                                  {/* Stop Order Badge */}
                                  <div className="w-7 h-7 rounded-full bg-[#0066FF] text-white font-black text-xs flex items-center justify-center shrink-0 shadow-2xs mt-0.5">
                                    {sIdx + 1}
                                  </div>

                                  {/* Thumbnail */}
                                  <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden bg-slate-200 shrink-0 border border-slate-200">
                                    <img
                                      src={stop.imageUrl || '/Logo_OleVeci.png'}
                                      alt={stop.businessName}
                                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                    />
                                  </div>

                                  {/* Details */}
                                  <div className="min-w-0 flex-1 space-y-1">
                                    <div className="flex items-center justify-between gap-2">
                                      <h4 className="text-xs sm:text-sm font-bold text-slate-900 group-hover:text-[#0056d6] transition-colors truncate">
                                        {stop.businessName}
                                      </h4>
                                      <span className="text-xs font-black text-emerald-600 shrink-0">
                                        {formatPriceCOP(stop.cost)}
                                      </span>
                                    </div>

                                    <p className="text-xs font-semibold text-[#0066FF] line-clamp-1">
                                      {stop.activity}
                                    </p>

                                    <div className="flex items-center gap-2 text-[11px] text-slate-500">
                                      {stop.time && <span>🕒 {stop.time}</span>}
                                      {stop.businessAddress && (
                                        <span className="truncate">📍 {stop.businessAddress}</span>
                                      )}
                                    </div>

                                    {stop.whySelected && (
                                      <p className="text-[11px] text-slate-600 italic line-clamp-1">
                                        "{stop.whySelected}"
                                      </p>
                                    )}

                                    {/* Action Links */}
                                    <div className="flex items-center gap-2 pt-1.5 flex-wrap">
                                      {waUrl && (
                                        <a
                                          href={waUrl}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold transition-all shadow-2xs"
                                        >
                                          <WhatsAppIcon className="w-3 h-3 fill-white" />
                                          <span>WhatsApp</span>
                                        </a>
                                      )}

                                      {stop.businessId && (
                                        <button
                                          type="button"
                                          onClick={() => onSelectBusiness?.(stop.businessId)}
                                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-[11px] font-semibold transition-all cursor-pointer"
                                        >
                                          <span>Ver comercio</span>
                                          <ArrowRight className="w-3 h-3 text-slate-400" />
                                        </button>
                                      )}

                                      {/* Remove stop button */}
                                      {plan.stops && plan.stops.length > 1 && (
                                        <button
                                          type="button"
                                          onClick={() => handleRemoveStop(index, sIdx)}
                                          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 text-[11px] transition-all cursor-pointer ml-auto"
                                          title="Quitar esta parada del plan"
                                        >
                                          <X className="w-3 h-3" />
                                          <span className="hidden sm:inline">Quitar</span>
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          {/* Footer Actions */}
                          <div className="pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100">
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={handleOpenInEditor}
                                className="px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-[#0066FF] to-[#0052cc] hover:from-blue-700 hover:to-blue-900 shadow-xs flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
                              >
                                <Compass className="w-4 h-4" />
                                <span>Abrir en Diseñador de Rutas</span>
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
                      </div>
                    ) : (
                      /* SEARCH / RECOMMENDATION MODE: POST-FIRST UNIFIED RESULTS (NO DUPLICATES) */
                      (() => {
                        const postsList = matchedP || [];
                        const businessesWithPosts = new Set(postsList.map((p) => p.businessId));
                        const directoryBusinesses = (matchedBiz || []).filter((b) => !businessesWithPosts.has(b.id));

                        const totalCount = postsList.length + directoryBusinesses.length;
                        if (totalCount === 0) return null;

                        const prevUserMsg = (index > 0 && chatHistory[index - 1]?.sender === 'user')
                          ? chatHistory[index - 1].text.toLowerCase()
                          : '';

                        const userAskedForAll =
                          prevUserMsg.includes('toda') ||
                          prevUserMsg.includes('todo') ||
                          prevUserMsg.includes('completo') ||
                          prevUserMsg.includes('completa') ||
                          prevUserMsg.includes('promocion') ||
                          prevUserMsg.includes('oferta') ||
                          prevUserMsg.includes('anuncio') ||
                          prevUserMsg.includes('descuento');

                        const isExpanded = expandedResults[index] !== undefined
                          ? expandedResults[index]
                          : userAskedForAll;

                        const INITIAL_LIMIT = 4;
                        const displayedPosts = isExpanded ? postsList : postsList.slice(0, INITIAL_LIMIT);
                        const remainingSlots = Math.max(0, INITIAL_LIMIT - displayedPosts.length);
                        const displayedBusinesses = isExpanded
                          ? directoryBusinesses
                          : (postsList.length === 0 ? directoryBusinesses.slice(0, INITIAL_LIMIT) : directoryBusinesses.slice(0, remainingSlots));

                        const totalRendered = displayedPosts.length + displayedBusinesses.length;
                        const canExpand = totalCount > INITIAL_LIMIT;

                        return (
                          <div className="space-y-3">
                            <div className="flex items-center justify-between px-1">
                              <div className="flex items-center gap-2">
                                <Tag className="w-4 h-4 text-[#0066FF]" />
                                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                                  {postsList.length > 0 ? 'Opciones y Anuncios Disponibles' : 'Comercios Encontrados'}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-[11px] text-slate-400 font-medium">
                                  {totalCount} {totalCount === 1 ? 'opción' : 'opciones'}
                                </span>
                                {canExpand && (
                                  <button
                                    type="button"
                                    onClick={() => setExpandedResults((prev) => ({ ...prev, [index]: !isExpanded }))}
                                    className="text-xs font-bold text-[#0066FF] hover:text-[#0052cc] bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-xl transition-all flex items-center gap-1 cursor-pointer active:scale-95 shadow-2xs"
                                    title={isExpanded ? 'Mostrar menos opciones' : `Ver todas las ${totalCount} opciones`}
                                  >
                                    <span>{isExpanded ? 'Ver menos' : `Ver todas (${totalCount})`}</span>
                                    {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                  </button>
                                )}
                              </div>
                            </div>

                            <div className="grid grid-cols-1 gap-2.5">
                              {/* 1. Prioritize Posts / Anuncios (The Differential Value of OleVeci) */}
                              {displayedPosts.map((post) => {
                                const waClean = (post.businessWhatsapp || post.businessPhone || '').replace(/\D/g, '');
                                const waUrl = waClean
                                  ? `https://wa.me/${waClean.startsWith('57') ? waClean : `57${waClean}`}?text=${encodeURIComponent(
                                      `¡Hola! Vi en OleVeci su publicación "${post.title}". Quisiera más información.`
                                    )}`
                                  : null;

                                return (
                                  <div
                                    key={post.id}
                                    className="w-full bg-white rounded-2xl border border-slate-200/90 hover:border-blue-400 p-3 sm:p-4 shadow-xs hover:shadow-md transition-all flex flex-col sm:flex-row gap-3.5 items-start sm:items-center justify-between group cursor-pointer"
                                    onClick={() => onSelectPost?.(post)}
                                  >
                                    <div className="flex items-start gap-3 min-w-0 flex-1">
                                      <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden bg-slate-100 border border-slate-200 shrink-0 shadow-2xs relative">
                                        <img
                                          src={post.imageUrl || '/Logo_OleVeci.png'}
                                          alt={post.title}
                                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                        />
                                        {(post.promotionalPrice || post.originalPrice) && (
                                          <div className="absolute bottom-0 inset-x-0 bg-slate-950/85 backdrop-blur-xs text-[10px] font-black text-emerald-400 text-center py-0.5">
                                            ${(post.promotionalPrice || post.originalPrice || 0).toLocaleString('es-CO')}
                                          </div>
                                        )}
                                      </div>

                                      <div className="min-w-0 flex-1 space-y-1">
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                          <h4 className="text-xs sm:text-sm font-bold text-slate-900 group-hover:text-[#0056d6] transition-colors leading-snug">
                                            {post.title}
                                          </h4>
                                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                                            Anuncio Destacado
                                          </span>
                                        </div>

                                        <p className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                                          <Store className="w-3 h-3 text-[#0066FF]" />
                                          <span>{post.businessName}</span>
                                          <span className="text-slate-400 font-normal">· {post.businessCity}</span>
                                        </p>

                                        {post.businessAddress && (
                                          <p className="text-[11px] text-slate-500 flex items-center gap-1 truncate">
                                            <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                                            <span className="truncate">{post.businessAddress}</span>
                                          </p>
                                        )}

                                        {post.description && (
                                          <p className="text-xs text-slate-600 line-clamp-1">
                                            {post.description}
                                          </p>
                                        )}
                                      </div>
                                    </div>

                                    {/* Action Buttons */}
                                    <div
                                      className="flex items-center gap-2 w-full sm:w-auto shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100"
                                      onClick={(e) => e.stopPropagation()}
                                    >
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
                                        onClick={() => onSelectPost?.(post)}
                                        className="flex-1 sm:flex-initial px-3.5 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-[#0056d6] border border-blue-200 text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95"
                                        title="Ver anuncio completo"
                                      >
                                        <span>Ver oferta</span>
                                        <ArrowRight className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}

                              {/* 2. Directory-Only Businesses (Only for businesses without active promotions) */}
                              {displayedBusinesses.length > 0 && postsList.length > 0 && (
                                <div className="pt-2 pb-0.5">
                                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                                    Otros comercios recomendados
                                  </span>
                                </div>
                              )}
                              {displayedBusinesses.map((biz) => {
                                const waClean = (biz.whatsapp || biz.phone || '').replace(/\D/g, '');
                                const waUrl = waClean
                                  ? `https://wa.me/${waClean.startsWith('57') ? waClean : `57${waClean}`}?text=${encodeURIComponent(
                                      `¡Hola! Los encontré en OleVeci recomendados por Oli. Quisiera más información sobre sus servicios.`
                                    )}`
                                  : null;

                                return (
                                  <div
                                    key={biz.id}
                                    className="w-full bg-white rounded-2xl border border-slate-200/90 hover:border-blue-300 p-3.5 sm:p-4 shadow-xs hover:shadow-md transition-all flex flex-col sm:flex-row gap-3.5 items-start sm:items-center justify-between group"
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
                                          <p className="text-xs text-slate-600 mt-1 line-clamp-1">
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

                            {/* Expand / Collapse Button at bottom when there are more items */}
                            {canExpand && (
                              <div className="pt-1">
                                <button
                                  type="button"
                                  onClick={() => setExpandedResults((prev) => ({ ...prev, [index]: !isExpanded }))}
                                  className="w-full py-2.5 px-4 rounded-xl border border-blue-200/90 bg-gradient-to-r from-blue-50/90 via-sky-50/70 to-indigo-50/90 hover:from-blue-100 hover:to-indigo-100 text-[#0056d6] font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-2xs hover:shadow-xs active:scale-[0.99]"
                                >
                                  {isExpanded ? (
                                    <>
                                      <ChevronUp className="w-4 h-4 text-[#0066FF]" />
                                      <span>Mostrar menos opciones (ver solo las primeras {INITIAL_LIMIT})</span>
                                    </>
                                  ) : (
                                    <>
                                      <ChevronDown className="w-4 h-4 text-[#0066FF]" />
                                      <span>
                                        Ver todas las {totalCount} opciones y promociones disponibles ({totalCount - totalRendered} más)
                                      </span>
                                    </>
                                  )}
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })()
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
              className="flex-1 bg-transparent border-0 outline-none text-slate-800 placeholder:text-slate-400 text-xs sm:text-sm px-3 sm:px-4 font-medium"
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

      {/* Floating Full Context Chat Log & AI Sharing Modal */}
      <OliChatLogModal
        isOpen={isLogModalOpen}
        onClose={() => setIsLogModalOpen(false)}
        chatHistory={chatHistory}
        currentCity={currentCity || 'Cajicá'}
        currentPlan={currentPlan}
        hasApiKey={hasApiKey}
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

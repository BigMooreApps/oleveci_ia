import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  MicOff,
  Send,
  Volume2,
  VolumeX,
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
  Route,
  Phone,
  Tag,
  X,
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
import { OliPlanResponse, OliPlanStop } from '../types';
import { removeStopAndRecalculatePlan, detectSearchFocus } from '../utils/oliPlanClientUtils';
import { OliWhatsAppModal } from './OliWhatsAppModal';
import { PlanRouteSection } from './PlanRouteSection';

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


export const OliSection: React.FC<OliSectionProps> = ({
  onSelectPlan,
  onSelectBusiness,
  onSelectPost,
  onOpenItineraryBuilder,
}) => {
  const { currentCity, addReadyPlan, businesses, posts, setCurrentRole } = useApp();
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentPlan, setCurrentPlan] = useState<OliPlanResponse | null>(null);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const hasStarted = chatHistory.length > 0 || isLoading;
  const [isSaved, setIsSaved] = useState(false);
  const [editingMessageIndex, setEditingMessageIndex] = useState<number | null>(null);
  const [editingMessageText, setEditingMessageText] = useState('');
  const [expandedResults, setExpandedResults] = useState<Record<number, boolean>>({});
  const [expandedRoutePlanIndex, setExpandedRoutePlanIndex] = useState<number | null>(null);

  // WhatsApp Modal State
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
  const [currentPlayingText, setCurrentPlayingText] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const wasVoicePromptRef = useRef(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const recognitionRef = useRef<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const sessionIdRef = useRef<string>(
    `chat_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
  );
  const [viewportBottomOffset, setViewportBottomOffset] = useState(0);

  // Mobile virtual keyboard handling via VisualViewport API
  useEffect(() => {
    if (typeof window === 'undefined' || !window.visualViewport) return;

    const handleViewportChange = () => {
      const vv = window.visualViewport;
      if (!vv) return;
      const offset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      setViewportBottomOffset(offset);
      if (offset > 80) {
        setTimeout(() => {
          inputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }, 150);
      }
    };

    const vv = window.visualViewport;
    vv.addEventListener('resize', handleViewportChange);
    vv.addEventListener('scroll', handleViewportChange);

    return () => {
      vv.removeEventListener('resize', handleViewportChange);
      vv.removeEventListener('scroll', handleViewportChange);
    };
  }, []);

  const handleInputFocus = () => {
    setTimeout(() => {
      inputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 250);
  };

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

  // Web Speech Synthesis Fallback
  const speakWithBrowserTTS = (text: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      const cleanText = text.replace(/\$/g, '').trim();
      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.lang = 'es-CO';
      utterance.rate = 1.05;
      utterance.pitch = 1.15;

      const voices = window.speechSynthesis.getVoices();
      const preferredVoice =
        voices.find((v) => v.lang.includes('es-CO') || v.lang.includes('es-419')) ||
        voices.find((v) => v.lang.includes('es') && (v.name.includes('Female') || v.name.includes('Sofia') || v.name.includes('Paulina') || v.name.includes('Helena') || v.name.includes('Lucia'))) ||
        voices.find((v) => v.lang.includes('es'));

      if (preferredVoice) utterance.voice = preferredVoice;

      utterance.onstart = () => setIsPlayingAudio(true);
      utterance.onend = () => {
        setIsPlayingAudio(false);
        setCurrentPlayingText(null);
      };
      utterance.onerror = () => {
        setIsPlayingAudio(false);
        setCurrentPlayingText(null);
      };

      window.speechSynthesis.speak(utterance);
    } catch {
      setIsPlayingAudio(false);
      setCurrentPlayingText(null);
    }
  };

  const playOliSpokenText = async (spokenText: string) => {
    if (!spokenText) return;

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }

    setIsAudioLoading(true);
    setIsPlayingAudio(true);
    setCurrentPlayingText(spokenText);

    try {
      const response = await fetch('/api/oli/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ spokenText }),
      });

      if (!response.ok) {
        throw new Error('TTS fetch failed');
      }

      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const json = await response.json();
        if (json.fallback) {
          setIsAudioLoading(false);
          speakWithBrowserTTS(json.spokenText || spokenText);
          return;
        }
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);

      const audio = new Audio(url);
      audioRef.current = audio;

      audio.onended = () => {
        setIsPlayingAudio(false);
        setIsAudioLoading(false);
        setCurrentPlayingText(null);
      };

      audio.onerror = () => {
        setIsAudioLoading(false);
        speakWithBrowserTTS(spokenText);
      };

      await audio.play();
      setIsAudioLoading(false);
    } catch {
      setIsAudioLoading(false);
      speakWithBrowserTTS(spokenText);
    }
  };

  const handleToggleAudio = (textToPlay?: string) => {
    if (isPlayingAudio) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      setIsPlayingAudio(false);
      setIsAudioLoading(false);
      setCurrentPlayingText(null);
      return;
    }

    if (textToPlay) {
      playOliSpokenText(textToPlay);
    }
  };

  // Speech Recognition
  const toggleListening = () => {
    if (isListening) {
      try {
        recognitionRef.current?.stop();
      } catch {}
      setIsListening(false);
      return;
    }

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert(
        'Tu navegador no tiene activado el reconocimiento de voz nativo. Puedes escribirle a Oli en la barra de búsqueda o chatear por WhatsApp.'
      );
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
        const transcript = event.results?.[0]?.[0]?.transcript;
        if (transcript) {
          setInputMessage(transcript);
          wasVoicePromptRef.current = true;
          handleSendMessage(transcript);
        }
      };

      recognition.onerror = (err: any) => {
        console.warn('Speech recognition error:', err);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.warn('Failed to start speech recognition:', err);
      setIsListening(false);
    }
  };

  // Reset conversation to fresh state
  const handleResetConversation = () => {
    sessionIdRef.current = `chat_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
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
          sessionId: sessionIdRef.current,
          channel: 'web',
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

      // If user queried with voice, play spoken reply automatically
      if (wasVoicePromptRef.current && responseData.spokenText) {
        wasVoicePromptRef.current = false;
        setTimeout(() => {
          handleToggleAudio(responseData.spokenText);
        }, 300);
      }
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
      if (wasVoicePromptRef.current) {
        wasVoicePromptRef.current = false;
        setTimeout(() => {
          handleToggleAudio(fallbackText);
        }, 300);
      }
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

  const handleSavePlan = (planParam?: OliPlanResponse) => {
    const p = planParam || currentPlan;
    if (!p) return;
    const readyPlan = convertToReadyPlan(p);
    addReadyPlan(readyPlan);
    setIsSaved(true);
  };

  const handleOpenInEditor = (planParam?: OliPlanResponse) => {
    const p = planParam || currentPlan;
    if (!p) return;
    const readyPlan = convertToReadyPlan(p);
    if (onOpenItineraryBuilder) {
      onOpenItineraryBuilder(readyPlan);
    } else if (onSelectPlan) {
      onSelectPlan(readyPlan);
    }
  };

  const handleSharePlan = async (planParam?: OliPlanResponse) => {
    const p = planParam || currentPlan;
    if (!p || !p.stops) return;
    const stopsList = p.stops
      .map(
        (s, i) =>
          `📍 Parada ${i + 1} (${s.time}): *${s.businessName}* en ${s.businessCity}\n   • ${s.activity} (${s.cost.toLocaleString('es-CO')} pesos)`
      )
      .join('\n\n');

    const message =
      `¡Hola! 👋 Oli en OleVeci nos armó este planazo para ${p.day}:\n\n` +
      `🗺️ *${p.planTitle}*\n` +
      `💡 ${p.summary}\n\n` +
      `${stopsList}\n\n` +
      `💰 *Presupuesto total estimado:* ${p.totalEstimatedCost?.toLocaleString('es-CO')} pesos\n` +
      `📲 Míralo y ábrelo en OleVeci: https://oleveci.com/planes\n\n` +
      `¿Quién se anima? 🙌`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: p.planTitle,
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

  return (
    <div className="w-full flex-1 min-h-[calc(100dvh-4rem)] bg-white text-slate-800 flex flex-col justify-between relative selection:bg-[#0066FF] selection:text-white">
      {/* Ambient background glows */}
      <div className="absolute top-0 inset-x-0 h-96 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-100/40 via-cyan-50/20 to-transparent pointer-events-none" />

      {/* Top Bar for active conversation (ChatGPT/Gemini style) */}
      {hasStarted && (
        <div className="sticky top-0 z-30 w-full bg-white/95 backdrop-blur-md border-b border-slate-200/90 px-3 sm:px-4 py-2.5 shadow-2xs">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
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
                title="Conversar con Oli en WhatsApp"
              >
                <WhatsAppIcon className="w-3.5 h-3.5 text-emerald-600" />
                <span className="hidden sm:inline">WhatsApp</span>
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
        {/* INITIAL STATE: Hero presentation & Enlarged Mascot */}
        {!hasStarted && (
          <div className="w-full max-w-4xl mx-auto flex-1 flex flex-col items-center justify-center px-4 py-6 sm:py-12">
            {/* Full Oli Mascot Character (Enlarged, heroic and prominent) */}
            <div className="relative mb-3 sm:mb-5 flex flex-col items-center">
              <div className="relative w-44 h-44 sm:w-60 sm:h-60 md:w-72 md:h-72 flex items-center justify-center transition-transform hover:scale-105 duration-300">
                {/* Soft ambient aura in background */}
                <div className="absolute inset-2 sm:inset-4 bg-gradient-to-tr from-blue-400/25 via-cyan-400/30 to-amber-300/25 rounded-full blur-3xl pointer-events-none" />

                <img
                  src="/assets/aistudio/Oli_sin_Fondo_d51a9103.png"
                  alt="Oli Asistente"
                  className="w-full h-full object-contain select-none drop-shadow-[0_16px_36px_rgba(0,102,255,0.28)]"
                />
              </div>
            </div>

            {/* Headline */}
            <h1 className="text-2xl sm:text-4xl md:text-5xl font-black text-slate-900 text-center tracking-tight mb-2 sm:mb-3">
              ¡Hola,{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#0066FF] via-[#00B4D8] to-[#FB8500]">
                soy Oli!
              </span>
            </h1>

            {/* Subtitle */}
            <p className="text-slate-600 text-xs sm:text-base text-center max-w-md sm:max-w-xl mx-auto leading-relaxed font-normal px-2">
              Puedo armarte un plan, buscar cualquier negocio o alguna promoción, en tu municipio.
            </p>
          </div>
        )}

        {/* CONVERSATION THREAD: Active chat messages */}
        {hasStarted && (
          <div className="w-full max-w-4xl mx-auto flex-1 px-2.5 sm:px-4 py-3 sm:py-6 space-y-4 sm:space-y-6">
            {chatHistory.map((msg, index) => {
              const isUser = msg.sender === 'user';

              if (isUser) {
                const isEditingThis = editingMessageIndex === index;

                return (
                  <div
                    key={index}
                    className="w-full flex justify-end gap-2 sm:gap-2.5 items-end animate-in fade-in slide-in-from-bottom-2 duration-300"
                  >
                    {isEditingThis ? (
                      <div className="w-full max-w-[95%] sm:max-w-[85%] rounded-2xl rounded-br-xs bg-[#0056d6] text-white p-3.5 sm:p-4 shadow-md border border-blue-400/50 space-y-3">
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
                      <div className="group relative max-w-[90%] sm:max-w-[78%]">
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
                  className="w-full space-y-3 sm:space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300"
                >
                  {/* Conversational Bubble */}
                  <div className="w-full rounded-2xl bg-white border border-slate-200/90 p-3.5 sm:p-5 shadow-xs space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                      <div className="flex items-center gap-2">
                        <img
                          src="/assets/aistudio/Oli_sin_Fondo_d51a9103.png"
                          alt="Oli"
                          className="w-6 h-6 sm:w-7 sm:h-7 object-contain drop-shadow-2xs shrink-0"
                        />
                        <span className="text-xs sm:text-sm font-bold text-[#0056d6]">
                          Oli Asistente
                        </span>
                        <span className="text-[10px] sm:text-xs text-slate-400">
                          · Sabana Centro
                        </span>
                      </div>

                      {/* Botón interactivo de voz de Oli */}
                        <button
                          type="button"
                          onClick={() => handleToggleAudio(msg.text)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                            isPlayingAudio && currentPlayingText === msg.text
                              ? 'bg-blue-100 text-[#0066FF] border border-blue-300 shadow-xs animate-pulse'
                              : 'text-slate-500 hover:text-[#0066FF] hover:bg-blue-50/70 border border-slate-200/80 bg-slate-50'
                          }`}
                          title={isPlayingAudio && currentPlayingText === msg.text ? 'Detener voz' : 'Escuchar a Oli'}
                        >
                          {isPlayingAudio && currentPlayingText === msg.text ? (
                            <>
                              <VolumeX className="w-3.5 h-3.5 text-blue-600" />
                              <span className="text-[11px] font-bold">Detener</span>
                            </>
                          ) : (
                            <>
                              <Volume2 className="w-3.5 h-3.5 text-slate-500 hover:text-blue-600" />
                              <span className="text-[11px] font-medium hidden sm:inline">Escuchar</span>
                            </>
                          )}
                        </button>
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
                      (() => {
                        const isRouteExpanded = expandedRoutePlanIndex === index;

                        const planPosts: Post[] = plan.stops.map((stop, sIdx) => {
                          const matchingPost = (posts || []).find((p) => p.id === stop.postId) ||
                            (stop.postTitle ? (posts || []).find((p) => p.title.toLowerCase().trim() === stop.postTitle.toLowerCase().trim()) : undefined) ||
                            (posts || []).find((p) => p.businessId === stop.businessId);

                          const matchingBiz = (businesses || []).find((b) => b.id === stop.businessId || (stop.businessName && b.name.toLowerCase().trim() === stop.businessName.toLowerCase().trim()));

                          const coords = (matchingPost?.coordinates && matchingPost.coordinates.lat)
                            ? matchingPost.coordinates
                            : (matchingBiz?.coordinates && matchingBiz.coordinates.lat)
                              ? matchingBiz.coordinates
                              : undefined;

                          if (matchingPost) {
                            return {
                              ...matchingPost,
                              businessName: stop.businessName || matchingPost.businessName,
                              businessAddress: stop.businessAddress || matchingPost.businessAddress || matchingBiz?.address || '',
                              businessCity: stop.businessCity || matchingPost.businessCity || matchingBiz?.city || currentCity || 'Cajicá',
                              businessSector: matchingBiz?.sector || matchingPost.businessSector || '',
                              businessWhatsapp: stop.businessWhatsapp || matchingPost.businessWhatsapp || matchingBiz?.whatsapp || '',
                              businessPhone: stop.businessPhone || matchingPost.businessPhone || matchingBiz?.phone || '',
                              businessLogo: stop.imageUrl || matchingPost.businessLogo || matchingBiz?.logo || '/Logo_OleVeci.png',
                              coordinates: coords || matchingPost.coordinates || { lat: 4.9184, lng: -74.0259 },
                            };
                          }

                          return {
                            id: stop.postId || `stop-post-${stop.businessId || sIdx}`,
                            businessId: stop.businessId || matchingBiz?.id || `biz-${sIdx}`,
                            businessName: stop.businessName || matchingBiz?.name || 'Comercio Local',
                            businessLogo: stop.imageUrl || matchingBiz?.logo || '/Logo_OleVeci.png',
                            businessCity: stop.businessCity || matchingBiz?.city || currentCity || 'Cajicá',
                            businessSector: matchingBiz?.sector || '',
                            businessWhatsapp: stop.businessWhatsapp || stop.businessPhone || matchingBiz?.whatsapp || '',
                            businessPhone: stop.businessPhone || matchingBiz?.phone || '',
                            businessAddress: stop.businessAddress || matchingBiz?.address || 'Dirección registrada',
                            coordinates: coords || { lat: 4.9184, lng: -74.0259 },
                            type: 'promo' as const,
                            title: stop.postTitle || stop.activity || stop.businessName,
                            description: stop.postDescription || stop.whySelected || stop.activity || '',
                            imageUrl: stop.imageUrl || matchingBiz?.coverImage || '/Logo_OleVeci.png',
                            promotionalPrice: stop.cost,
                            startsAt: new Date().toISOString(),
                            categoryId: matchingBiz?.categoryId || 'general',
                            tags: ['itinerario', 'oli'],
                            status: 'active' as const,
                          };
                        });

                        return (
                          <div className="w-full rounded-2xl bg-white border border-slate-200 shadow-md overflow-hidden">
                            {/* Header Banner */}
                            <div className="bg-gradient-to-r from-[#0066FF] via-[#00B4D8] to-[#0096C7] p-3.5 sm:p-5 text-white">
                              <h2 className="text-base sm:text-xl font-black tracking-tight leading-snug">
                                {plan.planTitle}
                              </h2>
                              <p className="text-xs text-blue-100 mt-1 line-clamp-2 font-normal">
                                {plan.narrativeHook}
                              </p>

                              {/* Quick Stats Pill */}
                              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mt-2 sm:mt-3 pt-2 sm:pt-3 border-t border-white/20 text-[10px] sm:text-xs">
                                <div className="flex items-center gap-1 sm:gap-1.5 bg-black/20 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-md sm:rounded-lg">
                                  <MapPin className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-cyan-300 shrink-0" />
                                  <span>{plan.stops.length} paradas</span>
                                </div>

                                <div className="flex items-center gap-1 sm:gap-1.5 bg-black/20 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-md sm:rounded-lg">
                                  <span>Total estimado: {formatPriceCOP(plan.totalEstimatedCost)}</span>
                                </div>

                                {plan.budgetStatus === 'over_budget' && (
                                  <span className="bg-amber-500/90 text-white font-bold text-[9px] sm:text-[10px] px-1.5 py-0.5 rounded sm:rounded-md">
                                    Supera presupuesto
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Stops List with Timeline Style */}
                            <div className="p-2.5 sm:p-5 space-y-2.5 sm:space-y-3.5">
                              {/* Punto de Inicio en el Timeline */}
                              <div className="relative pl-6 sm:pl-7 pb-1.5 sm:pb-2">
                                {/* Línea vertical conectora hacia abajo */}
                                <div className="absolute left-2.5 sm:left-3 top-2.5 bottom-0 w-0.5 bg-gradient-to-b from-blue-400 to-blue-200 border-dashed" />

                                <div className="absolute left-1 sm:left-1.5 top-1 w-3 sm:w-3.5 h-3 sm:h-3.5 rounded-full bg-white border-2 border-[#007af7] shadow-xs flex items-center justify-center">
                                  <div className="w-1 sm:w-1.5 h-1 sm:h-1.5 rounded-full bg-[#007af7]" />
                                </div>

                                <div className="text-[10px] sm:text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
                                  <span className="text-slate-400 font-medium">Inicio:</span>
                                  <span className="text-[#0056d6] font-extrabold truncate">
                                    {plan.stops[0]?.businessName || `Centro de ${currentCity || 'Cajicá'}`}
                                  </span>
                                </div>
                              </div>

                              {/* Lista secuencial de paradas con estilo Timeline */}
                              <div className="space-y-2.5 sm:space-y-3">
                                {plan.stops.map((stop, sIdx) => {
                                  const isLast = sIdx === plan.stops.length - 1;

                                  const matchingPost = (posts || []).find((p) => p.id === stop.postId) ||
                                    (stop.postTitle ? (posts || []).find((p) => p.title.toLowerCase().trim() === stop.postTitle.toLowerCase().trim()) : undefined) ||
                                    (posts || []).find((p) => p.businessId === stop.businessId) || {
                                      id: stop.postId || `stop-post-${stop.businessId || sIdx}`,
                                      businessId: stop.businessId,
                                      businessName: stop.businessName,
                                      businessLogo: stop.imageUrl || '/Logo_OleVeci.png',
                                      businessCity: stop.businessCity || currentCity || 'Sabana Centro',
                                      businessSector: '',
                                      businessWhatsapp: stop.businessWhatsapp || stop.businessPhone || '',
                                      businessPhone: stop.businessPhone || '',
                                      businessAddress: stop.businessAddress || '',
                                      coordinates: { lat: 4.93, lng: -74.03 },
                                      type: 'promo' as const,
                                      title: stop.postTitle || stop.activity || stop.businessName,
                                      description: stop.postDescription || stop.whySelected || stop.activity || '',
                                      imageUrl: stop.imageUrl || '/Logo_OleVeci.png',
                                      promotionalPrice: stop.cost,
                                      startsAt: new Date().toISOString(),
                                      categoryId: 'general',
                                      tags: ['itinerario', 'oli'],
                                      status: 'active' as const,
                                    };

                                  const displayTitle = matchingPost.title || stop.postTitle || stop.businessName;
                                  const displayDescription = matchingPost.description || stop.postDescription || stop.whySelected || stop.activity || '';
                                  const displayImage = matchingPost.imageUrl || stop.imageUrl || '/Logo_OleVeci.png';
                                  const displayBusiness = stop.businessName || matchingPost.businessName;
                                  const displayCity = stop.businessCity || matchingPost.businessCity;
                                  const displayAddress = stop.businessAddress || matchingPost.businessAddress || 'Dirección registrada';
                                  const displayCost = stop.cost || matchingPost.promotionalPrice || matchingPost.originalPrice;

                                  const fullAddress = `${displayAddress}${
                                    displayCity ? `, ${displayCity}` : ''
                                  }`;

                                  return (
                                    <div key={sIdx} className="relative pl-6 sm:pl-8">
                                      {/* Línea vertical conectora entre paradas */}
                                      {!isLast && (
                                        <div className="absolute left-2.5 sm:left-3 top-7 sm:top-8 bottom-[-12px] sm:bottom-[-14px] w-0.5 bg-gradient-to-b from-blue-300 via-indigo-200 to-slate-200" />
                                      )}

                                      {/* Badge numérico circular del paso en el timeline */}
                                      <div className="absolute left-0 top-2.5 sm:top-3 w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-gradient-to-br from-[#0056d6] to-[#041f5e] text-white flex items-center justify-center text-[10px] sm:text-xs font-black shadow-xs ring-2 ring-white">
                                        {sIdx + 1}
                                      </div>

                                      {/* Tarjeta de la parada: Clic abre el anuncio */}
                                      <div
                                        onClick={() => onSelectPost?.(matchingPost)}
                                        className="w-full rounded-xl sm:rounded-2xl bg-slate-100 hover:bg-slate-200/70 border border-slate-200 shadow-2xs hover:shadow-md hover:border-blue-300 transition-all duration-200 p-2 sm:p-3.5 space-y-1.5 sm:space-y-2 cursor-pointer group active:scale-[0.99] select-none"
                                        title="Toca para ver el anuncio completo"
                                      >
                                        {/* 1. Encabezado: Imagen con precio + Título y Comercio + Botón Quitar */}
                                        <div className="flex items-start gap-2 sm:gap-3">
                                          {/* Imagen con precio sobrepuesto (estilo OleVeci, compacta en móvil) */}
                                          <div className="w-14 h-14 sm:w-20 sm:h-20 rounded-lg sm:rounded-xl overflow-hidden bg-white border border-slate-200 shrink-0 shadow-2xs relative group-hover:scale-105 transition-transform">
                                            <img
                                              src={displayImage}
                                              alt={displayTitle}
                                              className="w-full h-full object-cover"
                                            />
                                            {displayCost ? (
                                              <div className="absolute bottom-0 inset-x-0 bg-slate-950/85 backdrop-blur-xs text-[9px] sm:text-[11px] font-black text-emerald-400 text-center py-0.5 px-0.5 truncate leading-tight">
                                                ${Math.round(displayCost).toLocaleString('es-CO')}
                                              </div>
                                            ) : null}
                                          </div>

                                          {/* Título, Comercio y Dirección con tipografía compacta y ordenada */}
                                          <div className="min-w-0 flex-1 space-y-0.5 sm:space-y-1">
                                            <div className="flex items-start justify-between gap-1">
                                              <h5 className="text-[11px] sm:text-sm font-bold text-slate-900 group-hover:text-[#0056d6] transition-colors leading-snug break-words line-clamp-2 sm:line-clamp-none">
                                                {displayTitle}
                                              </h5>

                                              {/* Botón Quitar parada (arriba a la derecha, sutil) */}
                                              {plan.stops && plan.stops.length > 1 && (
                                                <button
                                                  type="button"
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleRemoveStop(index, sIdx);
                                                  }}
                                                  className="w-5 h-5 sm:w-6 sm:h-6 -mr-0.5 -mt-0.5 rounded-md sm:rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center transition shrink-0 cursor-pointer"
                                                  title="Quitar esta parada del plan"
                                                >
                                                  <X className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                                                </button>
                                              )}
                                            </div>

                                            {/* Nombre del comercio con icono (ordenado, sin redundancia de municipio) */}
                                            <div className="flex items-center gap-1 text-[10px] sm:text-xs font-semibold text-slate-700 min-w-0">
                                              <Store className="w-3 h-3 text-[#0066FF] shrink-0" />
                                              <span className="truncate">{displayBusiness}</span>
                                            </div>

                                            {/* Dirección compacta */}
                                            <div className="flex items-center gap-1 text-[9.5px] sm:text-[11px] text-slate-500 min-w-0">
                                              <MapPin className="w-2.5 h-2.5 text-[#ff7700] shrink-0" />
                                              <span className="truncate">{fullAddress}</span>
                                            </div>
                                          </div>
                                        </div>

                                        {/* 2. Cuerpo: Descripción completa a todo lo ancho de la tarjeta */}
                                        {displayDescription && (
                                          <div className="bg-white/70 sm:bg-white/80 rounded-lg sm:rounded-xl p-1.5 sm:p-2.5 border border-slate-200/60 shadow-2xs">
                                            <p className="text-[10px] sm:text-xs text-slate-600 leading-snug sm:leading-relaxed break-words line-clamp-2 sm:line-clamp-none">
                                              {displayDescription}
                                            </p>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>

                            {/* Sección Expandible: Ver la Ruta Directamente Dentro del Chat sin Salir */}
                            {isRouteExpanded && (
                              <div className="p-3 sm:p-5 pt-1 border-t border-slate-200/80 bg-slate-50/70 animate-in fade-in duration-300 space-y-3">
                                <div className="flex items-center justify-between pb-1 px-1">
                                  <div className="flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-[#0066FF] animate-pulse" />
                                    <h4 className="text-xs sm:text-sm font-bold text-slate-800">
                                      Ruta del Plan ({plan.stops.length} paradas)
                                    </h4>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => setExpandedRoutePlanIndex(null)}
                                    className="w-6 h-6 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-200/70 flex items-center justify-center transition cursor-pointer"
                                    title="Ocultar ruta"
                                    aria-label="Ocultar ruta"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>

                                <PlanRouteSection
                                  posts={planPosts}
                                  planTitle={plan.planTitle || 'Itinerario OleVeci'}
                                  currentCity={plan.stops[0]?.businessCity || currentCity || 'Cajicá'}
                                  scheduledTime={plan.day || 'Fin de semana'}
                                  hideStopsTimeline={true}
                                  onSelectPost={(p) => onSelectPost?.(p)}
                                />
                              </div>
                            )}

                            {/* Footer Actions: Solo Iconos */}
                            <div className="p-2 sm:p-2.5 bg-white flex items-center justify-between gap-1.5 border-t border-slate-100">
                              <div className="flex items-center gap-1.5 sm:gap-2">
                                {/* Botón Ver/Ocultar Ruta (Solo Icono) */}
                                <button
                                  type="button"
                                  onClick={() => setExpandedRoutePlanIndex(isRouteExpanded ? null : index)}
                                  className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center transition-all cursor-pointer active:scale-95 shadow-xs ${
                                    isRouteExpanded
                                      ? 'bg-slate-800 hover:bg-slate-900 text-white shadow-slate-900/20 ring-2 ring-blue-500/50'
                                      : 'text-white bg-gradient-to-r from-[#0066FF] to-[#0052cc] hover:from-blue-700 hover:to-blue-900 shadow-blue-600/20'
                                  }`}
                                  title={isRouteExpanded ? 'Ocultar ruta' : 'Ver la ruta en el mapa'}
                                  aria-label={isRouteExpanded ? 'Ocultar ruta' : 'Ver la ruta en el mapa'}
                                >
                                  <Route className="w-4 h-4" />
                                </button>

                                {/* Botón Compartir Plan (Solo Icono) */}
                                <button
                                  type="button"
                                  onClick={() => handleSharePlan(plan)}
                                  className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-white hover:bg-emerald-50 text-slate-700 hover:text-emerald-600 border border-slate-200 flex items-center justify-center transition-all cursor-pointer active:scale-95 shadow-2xs"
                                  title="Compartir Plan"
                                  aria-label="Compartir Plan"
                                >
                                  <Share2 className="w-4 h-4 text-emerald-600" />
                                </button>
                              </div>

                              <div className="flex items-center gap-1.5 sm:gap-2">
                                {/* Botón Guardar Plan (Solo Icono) */}
                                <button
                                  type="button"
                                  onClick={() => handleSavePlan(plan)}
                                  disabled={isSaved}
                                  className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center transition-all cursor-pointer active:scale-95 shadow-2xs ${
                                    isSaved
                                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-300'
                                      : 'bg-white hover:bg-slate-50 text-slate-700 hover:text-[#0066FF] border border-slate-200'
                                  }`}
                                  title={isSaved ? '¡Plan Guardado!' : 'Guardar Plan'}
                                  aria-label={isSaved ? '¡Plan Guardado!' : 'Guardar Plan'}
                                >
                                  {isSaved ? (
                                    <Check className="w-4 h-4 text-emerald-600" />
                                  ) : (
                                    <Bookmark className="w-4 h-4" />
                                  )}
                                </button>

                                {/* Botón Diseñador (Solo Icono) */}
                                <button
                                  type="button"
                                  onClick={() => handleOpenInEditor(plan)}
                                  className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-500 hover:text-[#0066FF] border border-slate-200 flex items-center justify-center transition-all cursor-pointer active:scale-95 shadow-2xs"
                                  title="Abrir en Diseñador de Rutas"
                                  aria-label="Abrir en Diseñador de Rutas"
                                >
                                  <Compass className="w-4 h-4 text-blue-600" />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })()
                    ) : (
                      /* SEARCH / RECOMMENDATION MODE: SEMANTIC DIFFERENTIATION (BUSINESS vs POST) */
                      (() => {
                        const postsList = matchedP || [];
                        const prevUserMsg = (index > 0 && chatHistory[index - 1]?.sender === 'user')
                          ? chatHistory[index - 1].text
                          : '';

                        const searchFocus: 'business' | 'post' =
                          msg.plan?.searchFocus ||
                          (prevUserMsg ? detectSearchFocus(prevUserMsg) : (matchedBiz.length > 0 && postsList.length === 0 ? 'business' : 'post'));

                        const isBusinessFocus = searchFocus === 'business' && matchedBiz.length > 0;

                        // 1. BUSINESS-FOCUSED VIEW (When user asks for places, establishments, trades, stores, fruvers, etc.)
                        if (isBusinessFocus) {
                          const totalCount = matchedBiz.length;
                          if (totalCount === 0) return null;

                          const isExpanded = expandedResults[index] !== undefined ? expandedResults[index] : false;
                          const INITIAL_LIMIT = 4;
                          const displayedBusinesses = isExpanded ? matchedBiz : matchedBiz.slice(0, INITIAL_LIMIT);
                          const canExpand = totalCount > INITIAL_LIMIT;
                          const totalRendered = displayedBusinesses.length;

                          return (
                            <div className="space-y-3">
                              <div className="flex items-center justify-between px-1">
                                <div className="flex items-center gap-2">
                                  <Store className="w-4 h-4 text-[#0066FF]" />
                                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                                    Comercios Encontrados
                                  </span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-[11px] text-slate-400 font-medium">
                                    {totalCount} {totalCount === 1 ? 'comercio' : 'comercios'}
                                  </span>
                                  {canExpand && (
                                    <button
                                      type="button"
                                      onClick={() => setExpandedResults((prev) => ({ ...prev, [index]: !isExpanded }))}
                                      className="text-xs font-bold text-[#0066FF] hover:text-[#0052cc] bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-xl transition-all flex items-center gap-1 cursor-pointer active:scale-95 shadow-2xs"
                                      title={isExpanded ? 'Mostrar menos comercios' : `Ver todos los ${totalCount} comercios`}
                                    >
                                      <span>{isExpanded ? 'Ver menos' : `Ver todos (${totalCount})`}</span>
                                      {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                    </button>
                                  )}
                                </div>
                              </div>

                              <div className="grid grid-cols-1 gap-3">
                                {displayedBusinesses.map((biz) => {
                                  const fullBizAddress = `${biz.address || 'Dirección registrada'}${
                                    biz.city ? `, ${biz.city}` : ''
                                  }`;
                                  const bizPosts = postsList.filter((p) => p.businessId === biz.id);

                                  return (
                                    <div
                                      key={biz.id}
                                      onClick={() => onSelectBusiness?.(biz.id)}
                                      className="w-full rounded-xl sm:rounded-2xl bg-white hover:bg-slate-50/80 border border-slate-200/90 shadow-2xs hover:shadow-md hover:border-blue-300 transition-all duration-200 p-3 sm:p-4 space-y-2.5 group select-none cursor-pointer"
                                      title="Toca para ver el perfil del comercio"
                                    >
                                      {/* Header: Logo, Name, Category, Address */}
                                      <div className="flex items-start gap-2.5 sm:gap-3 min-w-0">
                                        <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl overflow-hidden bg-slate-100 border border-slate-200 shrink-0 shadow-2xs relative group-hover:scale-105 transition-transform">
                                          <img
                                            src={biz.coverImage || biz.logo || '/Logo_OleVeci.png'}
                                            alt={biz.name}
                                            className="w-full h-full object-cover"
                                          />
                                        </div>

                                        <div className="min-w-0 flex-1 space-y-0.5 sm:space-y-1">
                                          <div className="flex items-center gap-1.5 flex-wrap">
                                            <h5 className="text-xs sm:text-sm font-bold text-slate-900 group-hover:text-[#0056d6] transition-colors leading-snug break-words">
                                              {biz.name}
                                            </h5>
                                            {biz.verified && (
                                              <CheckCircle2 className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                                            )}
                                          </div>

                                          <div className="flex items-center gap-1 text-[10px] sm:text-xs text-slate-500 min-w-0">
                                            <MapPin className="w-3 h-3 text-[#ff7700] shrink-0" />
                                            <span className="truncate">{fullBizAddress}</span>
                                          </div>

                                          {biz.description && (
                                            <p className="text-[10.5px] sm:text-xs text-slate-600 line-clamp-2 leading-relaxed pt-0.5">
                                              {biz.description}
                                            </p>
                                          )}
                                        </div>
                                      </div>

                                      {/* Related Products or Promotions if available for this merchant */}
                                      {bizPosts.length > 0 && (
                                        <div className="pt-2.5 border-t border-slate-200/80 space-y-1.5">
                                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                                            Ofertas o especialidades de este comercio:
                                          </span>
                                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                            {bizPosts.map((p) => {
                                              const pCost = p.promotionalPrice || p.originalPrice;
                                              return (
                                                <div
                                                  key={p.id}
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    onSelectPost?.(p);
                                                  }}
                                                  className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200/80 border border-slate-300/80 hover:border-blue-400 transition-all flex items-center gap-2.5 cursor-pointer group/post shadow-2xs"
                                                  title="Toca para ver el anuncio completo"
                                                >
                                                  <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-lg overflow-hidden bg-white shrink-0 relative border border-slate-300/90 shadow-2xs">
                                                    <img
                                                      src={p.imageUrl || '/Logo_OleVeci.png'}
                                                      alt={p.title}
                                                      className="w-full h-full object-cover group-hover/post:scale-105 transition-transform"
                                                    />
                                                    {pCost ? (
                                                      <div className="absolute bottom-0 inset-x-0 bg-slate-950/85 text-[8.5px] font-black text-emerald-400 text-center py-0.5 truncate leading-none">
                                                        ${Math.round(pCost).toLocaleString('es-CO')}
                                                      </div>
                                                    ) : null}
                                                  </div>
                                                  <div className="min-w-0 flex-1">
                                                    <p className="text-xs font-bold text-slate-900 group-hover/post:text-[#0056d6] truncate">
                                                      {p.title}
                                                    </p>
                                                    {p.description && (
                                                      <p className="text-[10px] text-slate-600 line-clamp-1">
                                                        {p.description}
                                                      </p>
                                                    )}
                                                  </div>
                                                </div>
                                              );
                                            })}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        }

                        // 2. POST-FOCUSED VIEW (When user asks for a dish, craving, combo, or promo: pizza, burgers, wings, etc.)
                        const businessesWithPosts = new Set(postsList.map((p) => p.businessId));
                        const directoryBusinesses = (matchedBiz || []).filter((b) => !businessesWithPosts.has(b.id));

                        const totalCount = postsList.length + directoryBusinesses.length;
                        if (totalCount === 0) return null;

                        const userAskedForAll =
                          prevUserMsg.toLowerCase().includes('toda') ||
                          prevUserMsg.toLowerCase().includes('todo') ||
                          prevUserMsg.toLowerCase().includes('completo') ||
                          prevUserMsg.toLowerCase().includes('completa') ||
                          prevUserMsg.toLowerCase().includes('promocion') ||
                          prevUserMsg.toLowerCase().includes('oferta') ||
                          prevUserMsg.toLowerCase().includes('anuncio') ||
                          prevUserMsg.toLowerCase().includes('descuento');

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
                              {/* 1. Prioritize Posts / Anuncios */}
                              {displayedPosts.map((post) => {
                                const fullPostAddress = `${post.businessAddress || 'Dirección registrada'}${
                                  post.businessCity ? `, ${post.businessCity}` : ''
                                }`;
                                const postCost = post.promotionalPrice || post.originalPrice;

                                return (
                                  <div
                                    key={post.id}
                                    onClick={() => onSelectPost?.(post)}
                                    className="w-full rounded-xl sm:rounded-2xl bg-slate-100 hover:bg-slate-200/70 border border-slate-200 shadow-2xs hover:shadow-md hover:border-blue-300 transition-all duration-200 p-2 sm:p-3.5 space-y-1.5 sm:space-y-2 cursor-pointer group active:scale-[0.99] select-none"
                                    title="Toca para ver el anuncio completo"
                                  >
                                    {/* 1. Encabezado: Imagen con precio + Título y Comercio */}
                                    <div className="flex items-start gap-2 sm:gap-3">
                                      {/* Imagen con precio sobrepuesto (estilo OleVeci, compacta en móvil) */}
                                      <div className="w-14 h-14 sm:w-20 sm:h-20 rounded-lg sm:rounded-xl overflow-hidden bg-white border border-slate-200 shrink-0 shadow-2xs relative group-hover:scale-105 transition-transform">
                                        <img
                                          src={post.imageUrl || '/Logo_OleVeci.png'}
                                          alt={post.title}
                                          className="w-full h-full object-cover"
                                        />
                                        {postCost ? (
                                          <div className="absolute bottom-0 inset-x-0 bg-slate-950/85 backdrop-blur-xs text-[9px] sm:text-[11px] font-black text-emerald-400 text-center py-0.5 px-0.5 truncate leading-tight">
                                            ${Math.round(postCost).toLocaleString('es-CO')}
                                          </div>
                                        ) : null}
                                      </div>

                                      {/* Título, Comercio y Dirección con tipografía compacta y ordenada */}
                                      <div className="min-w-0 flex-1 space-y-0.5 sm:space-y-1">
                                        <div className="flex items-start justify-between gap-1">
                                          <h5 className="text-[11px] sm:text-sm font-bold text-slate-900 group-hover:text-[#0056d6] transition-colors leading-snug break-words line-clamp-2 sm:line-clamp-none">
                                            {post.title}
                                          </h5>
                                        </div>

                                        {/* Nombre del comercio con icono (ordenado, sin redundancia de municipio) */}
                                        <div className="flex items-center gap-1 text-[10px] sm:text-xs font-semibold text-slate-700 min-w-0">
                                          <Store className="w-3 h-3 text-[#0066FF] shrink-0" />
                                          <span className="truncate">{post.businessName}</span>
                                        </div>

                                        {/* Dirección compacta */}
                                        <div className="flex items-center gap-1 text-[9.5px] sm:text-[11px] text-slate-500 min-w-0">
                                          <MapPin className="w-2.5 h-2.5 text-[#ff7700] shrink-0" />
                                          <span className="truncate">{fullPostAddress}</span>
                                        </div>
                                      </div>
                                    </div>

                                    {/* 2. Cuerpo: Descripción completa a todo lo ancho de la tarjeta */}
                                    {post.description && (
                                      <div className="bg-white/70 sm:bg-white/80 rounded-lg sm:rounded-xl p-1.5 sm:p-2.5 border border-slate-200/60 shadow-2xs">
                                        <p className="text-[10px] sm:text-xs text-slate-600 leading-snug sm:leading-relaxed break-words line-clamp-2 sm:line-clamp-none">
                                          {post.description}
                                        </p>
                                      </div>
                                    )}
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
                                const fullBizAddress = `${biz.address || 'Dirección registrada'}${
                                  biz.city ? `, ${biz.city}` : ''
                                }`;

                                return (
                                  <div
                                    key={biz.id}
                                    className="w-full rounded-xl sm:rounded-2xl bg-slate-100 hover:bg-slate-200/70 border border-slate-200 shadow-2xs hover:shadow-md hover:border-blue-300 transition-all duration-200 p-2 sm:p-3.5 space-y-1.5 sm:space-y-2 cursor-pointer group active:scale-[0.99] select-none"
                                    onClick={() => onSelectBusiness?.(biz.id)}
                                    title="Toca para ver el perfil del comercio"
                                  >
                                    <div className="flex items-start gap-2 sm:gap-3">
                                      <div className="w-14 h-14 sm:w-20 sm:h-20 rounded-lg sm:rounded-xl overflow-hidden bg-white border border-slate-200 shrink-0 shadow-2xs relative group-hover:scale-105 transition-transform">
                                        <img
                                          src={biz.coverImage || biz.logo || '/Logo_OleVeci.png'}
                                          alt={biz.name}
                                          className="w-full h-full object-cover"
                                        />
                                      </div>

                                      <div className="min-w-0 flex-1 space-y-0.5 sm:space-y-1">
                                        <div className="flex items-start justify-between gap-1">
                                          <h5 className="text-[11px] sm:text-sm font-bold text-slate-900 group-hover:text-[#0056d6] transition-colors leading-snug break-words">
                                            {biz.name}
                                          </h5>
                                        </div>

                                        <div className="flex items-center gap-1 text-[10px] sm:text-xs font-semibold text-slate-700 min-w-0">
                                          <Store className="w-3 h-3 text-[#0066FF] shrink-0" />
                                          <span className="truncate">{biz.name}</span>
                                          {biz.verified && (
                                            <CheckCircle2 className="w-3 h-3 text-blue-500 shrink-0" />
                                          )}
                                        </div>

                                        <div className="flex items-center gap-1 text-[9.5px] sm:text-[11px] text-slate-500 min-w-0">
                                          <MapPin className="w-2.5 h-2.5 text-[#ff7700] shrink-0" />
                                          <span className="truncate">{fullBizAddress}</span>
                                        </div>
                                      </div>
                                    </div>

                                    {biz.description && (
                                      <div className="bg-white/70 sm:bg-white/80 rounded-lg sm:rounded-xl p-1.5 sm:p-2.5 border border-slate-200/60 shadow-2xs">
                                        <p className="text-[10px] sm:text-xs text-slate-600 leading-snug sm:leading-relaxed break-words line-clamp-2 sm:line-clamp-none">
                                          {biz.description}
                                        </p>
                                      </div>
                                    )}
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
              );
            })}

            {/* Loading state like Gemini/ChatGPT */}
            {isLoading && (
              <div className="w-full animate-in fade-in duration-300">
                <div className="p-3.5 sm:p-4 rounded-2xl bg-white border border-blue-100/90 shadow-xs flex items-center gap-3 text-slate-700 w-full">
                  <img
                    src="/assets/aistudio/Oli_sin_Fondo_d51a9103.png"
                    alt="Oli"
                    className="w-6 h-6 object-contain animate-bounce shrink-0 drop-shadow-2xs"
                  />
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
      <div
        className="sticky inset-x-0 bg-gradient-to-t from-white via-white/95 to-white/0 pt-2 px-2.5 sm:px-4 z-20 pointer-events-auto transition-[bottom] duration-150"
        style={{
          bottom: viewportBottomOffset > 0 ? `${viewportBottomOffset}px` : 0,
          paddingBottom: viewportBottomOffset > 0 ? '0.75rem' : 'max(1rem, env(safe-area-inset-bottom, 1rem))',
        }}
      >
        <div className="max-w-4xl mx-auto w-full">
          {/* Action Pill: Chatear en WhatsApp */}
          <div className="flex items-center justify-center sm:justify-start gap-2 mb-2 sm:mb-2.5">
            {/* WhatsApp button */}
            <button
              type="button"
              onClick={() => setIsWhatsAppOpen(true)}
              className="inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-3.5 py-1.5 rounded-full bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-xs font-semibold text-emerald-700 transition-all cursor-pointer shadow-2xs hover:shadow-xs active:scale-95"
              title="Chatear con Oli en WhatsApp"
            >
              <WhatsAppIcon className="w-3.5 h-3.5 text-emerald-600" />
              <span>Chatear en WhatsApp</span>
            </button>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="w-full relative bg-slate-50/90 hover:bg-slate-100/90 border border-slate-200/90 hover:border-slate-300 focus-within:border-[#0066FF] focus-within:bg-white focus-within:ring-3 focus-within:ring-blue-500/15 rounded-2xl p-1.5 sm:p-2 flex items-center gap-1.5 sm:gap-2.5 shadow-sm hover:shadow transition-all overflow-hidden"
          >
            {/* Input wrapper with slow displacement ticker */}
            <div className="flex-1 min-w-0 relative flex items-center h-10 sm:h-11 overflow-hidden">
              {/* Animated slow scrolling text ticker when input is empty and not focused */}
              {!inputMessage && !isInputFocused && (
                <div className="absolute inset-0 overflow-hidden pointer-events-none flex items-center select-none">
                  <div className="animate-oli-marquee flex items-center whitespace-nowrap text-slate-400 font-medium text-xs sm:text-sm">
                    <span className="inline-block pr-12">
                      Pregúntale a Oli: "buscar una papelería en Chía" &nbsp;•&nbsp; "¿dónde hacer mercado hoy?" &nbsp;•&nbsp; "taller mecánico de confianza" &nbsp;•&nbsp; "pizza artesanal en grupo" &nbsp;•&nbsp; "veterinaria 24 horas" &nbsp;•&nbsp; "plan familiar con niños el domingo" &nbsp;•&nbsp;
                    </span>
                    <span className="inline-block pr-12">
                      Pregúntale a Oli: "buscar una papelería en Chía" &nbsp;•&nbsp; "¿dónde hacer mercado hoy?" &nbsp;•&nbsp; "taller mecánico de confianza" &nbsp;•&nbsp; "pizza artesanal en grupo" &nbsp;•&nbsp; "veterinaria 24 horas" &nbsp;•&nbsp; "plan familiar con niños el domingo" &nbsp;•&nbsp;
                    </span>
                  </div>
                </div>
              )}

              {/* Text input */}
              <input
                ref={inputRef}
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onFocus={() => {
                  setIsInputFocused(true);
                  handleInputFocus();
                }}
                onBlur={() => setIsInputFocused(false)}
                placeholder={isInputFocused ? 'Escribe aquí tu consulta o plan...' : ''}
                disabled={isLoading}
                className="w-full h-full bg-transparent border-0 outline-none text-slate-800 placeholder:text-slate-400 text-xs sm:text-sm px-3 sm:px-4 font-medium relative z-10"
              />
            </div>

            {/* Mic button */}
            <button
              type="button"
              onClick={toggleListening}
              className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center transition-all cursor-pointer shrink-0 active:scale-95 shadow-2xs ${
                isListening
                  ? 'bg-red-500 text-white animate-pulse shadow-red-200'
                  : 'bg-slate-200/80 hover:bg-blue-50 text-slate-600 hover:text-[#0066FF]'
              }`}
              title={isListening ? 'Detener micrófono' : 'Hablar por micrófono'}
              aria-label="Hablar por micrófono"
            >
              {isListening ? (
                <MicOff className="w-5 h-5 text-white animate-bounce" />
              ) : (
                <Mic className="w-5 h-5" />
              )}
            </button>

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

      {/* WhatsApp Modal: Direct wa.me link and QR */}
      <OliWhatsAppModal
        isOpen={isWhatsAppOpen}
        onClose={() => setIsWhatsAppOpen(false)}
      />
    </div>
  );
};

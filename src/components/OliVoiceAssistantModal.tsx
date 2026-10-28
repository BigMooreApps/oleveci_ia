import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  X,
  Mic,
  MicOff,
  Send,
  Volume2,
  VolumeX,
  Play,
  Pause,
  RotateCcw,
  Sparkles,
  MapPin,
  Clock,
  Wallet,
  Users,
  Calendar,
  Share2,
  ChevronRight,
  ExternalLink,
  Phone,
  CheckCircle2,
  Store,
  Compass,
  ArrowRight,
  Pencil,
  AlertCircle,
  HelpCircle,
  Wand2,
  Bookmark,
  MessageCircle,
  Trash2,
  Check,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Post, Business } from '../types';
import { SimulatedReadyPlan } from '../data/readyPlansData';
import { THEMES } from './InvitationCardPreview';
import { WhatsAppIcon } from './WhatsAppIcon';
import type { OliPlanResponse, OliPlanStop } from '../../server/oliAssistant';

interface OliVoiceAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenItineraryBuilder?: (plan: SimulatedReadyPlan) => void;
  initialPrompt?: string;
}

// Quick suggested prompts
const SUGGESTED_PROMPTS = [
  'Plan familiar este domingo en Chía',
  'Cita romántica con cena y postre',
  'Parche con amigos y cervezas artesanales',
  'Almorzar rico hoy presupuesto 80 mil',
  'Plan relajado en Cajicá o Zipaquirá',
];

const REFINEMENT_CHIPS = [
  'Cambiar a pizza artesanal',
  'Bajarle al presupuesto',
  'Cambiar de municipio a Cajicá',
  'Agregar café con postre',
  'Buscar opciones al aire libre',
];

export const OliVoiceAssistantModal: React.FC<OliVoiceAssistantModalProps> = ({
  isOpen,
  onClose,
  onOpenItineraryBuilder,
  initialPrompt,
}) => {
  const { currentCity, posts, businesses, addReadyPlan } = useApp();

  const [inputMessage, setInputMessage] = useState(initialPrompt || '');
  const [isLoading, setIsLoading] = useState(false);
  const [currentPlan, setCurrentPlan] = useState<OliPlanResponse | null>(null);
  const [chatHistory, setChatHistory] = useState<
    Array<{ sender: 'user' | 'oli'; text: string; plan?: OliPlanResponse }>
  >([]);
  const [isSaved, setIsSaved] = useState(false);
  const [editingMessageIndex, setEditingMessageIndex] = useState<number | null>(null);
  const [editingMessageText, setEditingMessageText] = useState('');

  // Audio / Speech State
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [isAudioLoading, setIsAudioLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const recognitionRef = useRef<any>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Scroll to bottom of chat smoothly
  const scrollToBottom = () => {
    setTimeout(() => {
      chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 150);
  };

  // Stop audio on close or unmount
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

  // Web Speech Synthesis Fallback
  const speakWithBrowserTTS = (text: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      const cleanText = text.replace(/\$/g, '').trim();
      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.lang = 'es-CO';
      utterance.rate = 1.05;
      utterance.pitch = 1.15; // Cheerful, juvenile pitch for Oli

      // Look for a Latin American / Spanish female voice
      const voices = window.speechSynthesis.getVoices();
      const preferredVoice =
        voices.find((v) => v.lang.includes('es-CO') || v.lang.includes('es-419')) ||
        voices.find((v) => v.lang.includes('es') && (v.name.includes('Female') || v.name.includes('Sofia') || v.name.includes('Paulina') || v.name.includes('Helena') || v.name.includes('Lucia'))) ||
        voices.find((v) => v.lang.includes('es'));

      if (preferredVoice) {
        utterance.voice = preferredVoice;
      }

      utterance.onstart = () => setIsPlayingAudio(true);
      utterance.onend = () => setIsPlayingAudio(false);
      utterance.onerror = () => setIsPlayingAudio(false);

      window.speechSynthesis.speak(utterance);
    } catch {
      setIsPlayingAudio(false);
    }
  };

  // Play audio response from Gemini TTS (/api/oli/tts) or fallback
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

    try {
      const response = await fetch('/api/oli/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ spokenText }),
      });

      if (!response.ok) {
        throw new Error('TTS response not ok');
      }

      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('audio/wav') || contentType.includes('audio/')) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);

        const audio = new Audio(url);
        audioRef.current = audio;
        audio.onended = () => {
          setIsPlayingAudio(false);
        };
        audio.onerror = () => {
          // Fallback to browser TTS if audio decoding fails
          speakWithBrowserTTS(spokenText);
        };
        await audio.play();
        setIsAudioLoading(false);
      } else {
        // Fallback flag returned as JSON
        setIsAudioLoading(false);
        speakWithBrowserTTS(spokenText);
      }
    } catch {
      setIsAudioLoading(false);
      speakWithBrowserTTS(spokenText);
    }
  };

  // Toggle play/pause
  const handleToggleAudio = () => {
    if (isPlayingAudio) {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      setIsPlayingAudio(false);
    } else if (currentPlan?.spokenText) {
      playOliSpokenText(currentPlan.spokenText);
    }
  };

  // Web Speech Recognition for mic input
  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert('Tu navegador no soporta reconocimiento de voz nativo. Puedes escribir tu plan con el teclado.');
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

  // Edit & Delete handlers for user messages in modal
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

  // Send request to Oli backend
  const handleSendMessage = async (
    textToSend?: string,
    historyOverride?: any[],
    previousPlanOverride?: OliPlanResponse | null
  ) => {
    const prompt = (textToSend || inputMessage).trim();
    if (!prompt || isLoading) return;

    setInputMessage('');
    setIsLoading(true);
    setIsSaved(false);

    const baseHistory = historyOverride !== undefined ? historyOverride : chatHistory;
    const activePlan = previousPlanOverride !== undefined ? previousPlanOverride : currentPlan;

    // Append to local history
    const updatedHistory = [
      ...baseHistory,
      { sender: 'user' as const, text: prompt },
    ];
    setChatHistory(updatedHistory);
    scrollToBottom();

    try {
      const response = await fetch('/api/oli/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userPrompt: prompt,
          currentCity: currentCity || 'Chía',
          userBudget: activePlan?.userBudget || 0,
          previousPlan: activePlan || null,
          messageHistory: updatedHistory.map((m) => ({ sender: m.sender, text: m.text })),
        }),
      });

      if (!response.ok) {
        throw new Error('Error al conectar con Oli');
      }

      const planData: OliPlanResponse = await response.json();
      if (planData.stops && planData.stops.length > 0) {
        setCurrentPlan(planData);
      }

      setChatHistory([
        ...updatedHistory,
        {
          sender: 'oli',
          text: planData.spokenText,
          plan: planData,
        },
      ]);

      scrollToBottom();

      // Trigger Oli voice output automatically
      playOliSpokenText(planData.spokenText);
    } catch (err: any) {
      console.error('Error generating plan with Oli:', err);
      const fallbackText =
        '¡Listo veci! Te tengo el plan perfecto para salir a disfrutar en la Sabana. Déjame organizarlo con calma o intenta decirme si prefieres algo familiar, romántico o con amigos.';
      setChatHistory([
        ...updatedHistory,
        {
          sender: 'oli',
          text: fallbackText,
        },
      ]);
      speakWithBrowserTTS(fallbackText);
      scrollToBottom();
    } finally {
      setIsLoading(false);
    }
  };

  // Convert Oli plan to SimulatedReadyPlan for Editor/Invitation Flyer
  const convertToReadyPlan = (oliPlan: OliPlanResponse): SimulatedReadyPlan => {
    const stops = oliPlan.stops || [];
    const postIds = stops.map((s) => s.postId);
    const coverImage = stops[0]?.imageUrl || '/Logo_OleVeci.png';
    const cleanId = `oli_${Date.now()}`;

    return {
      id: cleanId,
      planTitle: oliPlan.planTitle || 'Plan con Oli',
      scheduledTime: `${oliPlan.day || 'Hoy'} · ${stops[0]?.time || '4:00 PM'}`,
      coverImage,
      personalNote: oliPlan.summary || '',
      hidePrices: false,
      cardTemplate: 'oleveci_brand',
      theme: THEMES.blue_brand || THEMES.nordic_light,
      bgLayout: 'cinematic',
      postIds,
      category: 'plan_comer_algo',
      estimatedBudget: oliPlan.totalEstimatedCost || 50000,
      municipality: stops[0]?.businessCity || currentCity || 'Chía',
      timeOfDay: 'tarde',
      dayType: 'weekend',
      tags: ['Oli Asistente', oliPlan.targetAudience || 'General', oliPlan.day || 'Fin de semana'],
    };
  };

  // Handle Save Plan
  const handleSavePlan = () => {
    if (!currentPlan) return;
    const readyPlan = convertToReadyPlan(currentPlan);
    addReadyPlan(readyPlan);
    setIsSaved(true);
  };

  // Handle Open in Flyer/Card Editor
  const handleOpenInEditor = () => {
    if (!currentPlan) return;
    const readyPlan = convertToReadyPlan(currentPlan);
    if (onOpenItineraryBuilder) {
      onOpenItineraryBuilder(readyPlan);
      onClose();
    }
  };

  // Handle Share Plan (native share or WhatsApp fallback)
  const handleSharePlan = async () => {
    if (!currentPlan) return;
    const stopsList = currentPlan.stops
      .map(
        (s, i) =>
          `📍 Parada ${i + 1} (${s.time}): *${s.businessName}* en ${s.businessCity}\n   • ${s.activity} ($${s.cost.toLocaleString('es-CO')} COP)`
      )
      .join('\n\n');

    const message = `¡Hola! 👋 Oli en OleVeci nos armó este planazo para ${currentPlan.day}:\n\n` +
      `🗺️ *${currentPlan.planTitle}*\n` +
      `💡 ${currentPlan.summary}\n\n` +
      `${stopsList}\n\n` +
      `💰 *Presupuesto total estimado:* $${currentPlan.totalEstimatedCost.toLocaleString('es-CO')} COP\n` +
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
          return; // user cancelled share
        }
      }
    }

    const encoded = encodeURIComponent(message);
    window.open(`https://api.whatsapp.com/send?text=${encoded}`, '_blank');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[1100] flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl h-[92vh] max-h-[820px] bg-slate-900 border border-cyan-500/30 rounded-3xl shadow-2xl flex flex-col overflow-hidden text-white">
        {/* Glow ambient decoration */}
        <div className="absolute top-0 inset-x-0 h-40 bg-gradient-to-b from-cyan-600/20 via-blue-600/10 to-transparent pointer-events-none" />

        {/* Header Bar */}
        <div className="relative z-10 px-4 sm:px-6 py-3.5 bg-slate-900/90 border-b border-cyan-500/20 flex items-center justify-between backdrop-blur-md">
          <div className="flex items-center gap-3">
            {/* Oli Avatar with Animated Glow Rings */}
            <div className="relative flex items-center justify-center">
              <div
                className={`w-12 h-12 flex items-center justify-center transition-transform ${
                  isPlayingAudio ? 'scale-105 animate-bounce' : ''
                }`}
              >
                <img
                  src="/assets/aistudio/Oli_sin_Fondo_d51a9103.png"
                  alt="Oli"
                  className="w-full h-full object-contain drop-shadow-md"
                />
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 ring-2 ring-slate-900" />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-1.5">
                  Oli
                  <span className="px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-full">
                    Voz Oficial
                  </span>
                </h3>
              </div>
              <p className="text-xs text-cyan-200/80 font-medium">
                Tu vecina para armar y personalizar planes en Sabana Centro
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              aria-label="Cerrar modal de Oli"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Area / Conversation & Plan Preview */}
        <div className="relative flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-4 no-scrollbar">
          {/* Welcome Intro Card if no messages yet */}
          {chatHistory.length === 0 && (
            <div className="p-5 rounded-2xl bg-gradient-to-br from-cyan-950/60 via-slate-900/90 to-blue-950/60 border border-cyan-500/25 space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/20 text-cyan-300 flex items-center justify-center shrink-0">
                  <Wand2 className="w-5 h-5 text-cyan-400" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-cyan-200">¡Hola veci! Soy Oli</h4>
                  <p className="text-xs text-slate-300 leading-relaxed mt-1">
                    Dime qué quieres hacer (ej: <span className="text-cyan-300 font-semibold">"un plan familiar este domingo en Chía"</span>,{' '}
                    <span className="text-cyan-300 font-semibold">"una cita romántica con presupuesto de 80 mil"</span> o{' '}
                    <span className="text-cyan-300 font-semibold">"parche con amigos y cervezas"</span>).
                    Te armo la ruta completa parada por parada, con las publicaciones y ofertas activas en OleVeci, y te lo cuento todo con mi voz.
                  </p>
                </div>
              </div>

              {/* Quick suggestion prompt chips */}
              <div className="pt-2">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                  Prueba tocando una de estas ideas:
                </span>
                <div className="flex flex-wrap gap-1.5 sm:gap-2">
                  {SUGGESTED_PROMPTS.map((promptText) => (
                    <button
                      key={promptText}
                      onClick={() => {
                        setInputMessage(promptText);
                        handleSendMessage(promptText);
                      }}
                      className="text-xs px-3 py-1.5 rounded-full bg-white/5 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-200 hover:text-white transition-all text-left flex items-center gap-1.5 group cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-cyan-400 group-hover:scale-110 transition-transform" />
                      <span>{promptText}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Chat Messages */}
          {chatHistory.map((msg, index) => {
            const isUser = msg.sender === 'user';
            const isEditingThis = editingMessageIndex === index;

            return (
              <div
                key={index}
                className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} space-y-2`}
              >
                {isUser && isEditingThis ? (
                  <div className="w-full max-w-[90%] sm:max-w-[85%] rounded-2xl p-4 bg-slate-900 border border-cyan-500/50 shadow-xl space-y-3">
                    <div className="flex items-center justify-between text-xs text-cyan-300 border-b border-cyan-500/20 pb-1.5 font-medium">
                      <span className="flex items-center gap-1.5">
                        <Pencil className="w-3.5 h-3.5 text-cyan-400" />
                        Editando tu solicitud
                      </span>
                      <span className="text-[10px] text-slate-400">Presiona Enter para actualizar</span>
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
                      className="w-full bg-slate-950/80 border border-cyan-500/40 rounded-xl p-2.5 text-xs sm:text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-400 resize-none"
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
                        className="px-3 py-1.5 rounded-lg text-xs font-bold bg-cyan-500 hover:bg-cyan-400 text-slate-950 transition-all cursor-pointer shadow-sm flex items-center gap-1"
                      >
                        <Check className="w-3.5 h-3.5" />
                        Guardar y actualizar
                      </button>
                    </div>
                  </div>
                ) : isUser ? (
                  <div className="group relative max-w-[90%] sm:max-w-[85%]">
                    {/* Action buttons (Editar y Borrar) on hover */}
                    <div className="opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity absolute -top-3.5 right-2 hidden sm:flex items-center gap-1 bg-slate-800 border border-cyan-500/30 rounded-full px-2 py-0.5 shadow-sm text-slate-300 z-10">
                      <button
                        type="button"
                        onClick={() => handleStartEdit(index, msg.text)}
                        className="hover:text-cyan-400 p-1 rounded-full transition-colors cursor-pointer"
                        title="Editar mensaje"
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                      <span className="w-px h-3 bg-slate-700" />
                      <button
                        type="button"
                        onClick={() => handleDeleteMessage(index)}
                        className="hover:text-rose-400 p-1 rounded-full transition-colors cursor-pointer"
                        title="Eliminar mensaje"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>

                    <div className="rounded-2xl px-4 py-3 text-xs sm:text-sm leading-relaxed shadow-lg bg-gradient-to-r from-blue-600 to-cyan-600 text-white font-medium rounded-br-sm">
                      <p className="whitespace-pre-line">{msg.text}</p>
                      {/* Mobile action buttons */}
                      <div className="flex sm:hidden items-center gap-2 text-[11px] text-cyan-200/90 font-medium pt-1 mt-1 border-t border-white/20">
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
                    </div>
                  </div>
                ) : (
                  <div className="max-w-[90%] sm:max-w-[85%] rounded-2xl px-4 py-3 text-xs sm:text-sm leading-relaxed shadow-lg bg-slate-800/90 border border-cyan-500/30 text-slate-100 rounded-bl-sm">
                    <div className="flex items-center justify-between pb-2 mb-2 border-b border-cyan-500/20 text-cyan-300 text-xs font-semibold">
                      <span className="flex items-center gap-1.5">
                        <img
                          src="/assets/aistudio/Oli_sin_Fondo_d51a9103.png"
                          alt="Oli"
                          className="w-5 h-5 object-contain"
                        />
                        <Volume2 className="w-3.5 h-3.5 text-cyan-400" />
                        Oli dice:
                      </span>
                      <button
                        onClick={() => playOliSpokenText(msg.text)}
                        className="px-2 py-0.5 rounded-md bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-200 text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <RotateCcw className="w-3 h-3" />
                        Escuchar de nuevo
                      </button>
                    </div>
                    <p className="whitespace-pre-line">{msg.text}</p>
                  </div>
                )}

              {/* Render Plan Card if this Oli response produced an itinerary plan */}
              {msg.plan && msg.plan.stops && msg.plan.stops.length > 0 && (
                <div className="w-full mt-2 rounded-2xl bg-slate-950/90 border-2 border-cyan-500/40 shadow-2xl p-4 sm:p-5 space-y-4">
                  {/* Plan Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                          {msg.plan.day || 'Fin de semana'}
                        </span>
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                          {msg.plan.targetAudience || 'En pareja'}
                        </span>
                        {msg.plan.budgetStatus === 'under_budget' && (
                          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            Dentro del presupuesto
                          </span>
                        )}
                      </div>
                      <h4 className="text-base sm:text-lg font-extrabold text-white mt-1.5">
                        {msg.plan.planTitle || 'Tu Plan Personalizado'}
                      </h4>
                      <p className="text-xs text-slate-300 mt-0.5">{msg.plan.summary}</p>
                    </div>

                    {/* Cost pill */}
                    <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center p-2.5 rounded-xl bg-slate-900 border border-slate-800 shrink-0">
                      <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">
                        Total Estimado
                      </span>
                      <span className="text-sm sm:text-base font-extrabold text-cyan-300">
                        ${(msg.plan.totalEstimatedCost || 0).toLocaleString('es-CO')} COP
                      </span>
                    </div>
                  </div>

                  {/* Stops Timeline */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                        <Compass className="w-3.5 h-3.5 text-cyan-400" />
                        Paradas programadas ({msg.plan.stops.length})
                      </span>
                    </div>

                    <div className="space-y-2.5">
                      {msg.plan.stops.map((stop: OliPlanStop, idx: number) => (
                        <div
                          key={idx}
                          className="relative flex gap-3 p-3 rounded-xl bg-slate-900/90 border border-slate-800 hover:border-cyan-500/40 transition-all group"
                        >
                          {/* Photo of stop */}
                          <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-lg overflow-hidden shrink-0 bg-slate-800">
                            <img
                              src={stop.imageUrl || '/Logo_OleVeci.png'}
                              alt={stop.businessName}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                            <span className="absolute top-1 left-1 w-5 h-5 rounded-full bg-cyan-500 text-slate-950 font-black text-[11px] flex items-center justify-center shadow-md">
                              {idx + 1}
                            </span>
                            <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-slate-950/80 backdrop-blur-xs text-[9px] font-bold text-cyan-300">
                              {stop.time}
                            </span>
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0 flex flex-col justify-between">
                            <div>
                              <div className="flex items-center justify-between gap-1">
                                <h5 className="text-xs sm:text-sm font-bold text-white truncate">
                                  {stop.businessName}
                                </h5>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <span className="text-xs font-bold text-emerald-400">
                                    ${stop.cost.toLocaleString('es-CO')}
                                  </span>
                                  {stop.businessWhatsapp && (
                                    <a
                                      href={`https://api.whatsapp.com/send?phone=${stop.businessWhatsapp.replace(/\D/g, '')}&text=${encodeURIComponent(`¡Hola! Vi su oferta "${stop.postTitle}" en OleVeci y quiero visitarlos.`)}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="w-5 h-5 rounded-md bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 flex items-center justify-center transition-colors"
                                      title="Contactar al comercio por WhatsApp"
                                    >
                                      <WhatsAppIcon className="w-3 h-3 text-emerald-400" />
                                    </a>
                                  )}
                                </div>
                              </div>
                              <p className="text-[11px] text-cyan-200/80 font-medium flex items-center gap-1 mt-0.5">
                                <MapPin className="w-3 h-3 text-cyan-400 shrink-0" />
                                {stop.businessCity} · {stop.businessAddress}
                              </p>
                              <p className="text-xs text-slate-200 mt-1 line-clamp-2">
                                <span className="font-semibold text-white">{stop.postTitle}:</span>{' '}
                                {stop.activity}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Recommendations */}
                  {msg.plan.recommendations && msg.plan.recommendations.length > 0 && (
                    <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-xs text-slate-300 space-y-1">
                      <span className="font-bold text-cyan-300 text-[11px] block">
                        💡 Recomendaciones de Oli:
                      </span>
                      <ul className="list-disc list-inside space-y-0.5 text-[11px]">
                        {msg.plan.recommendations.map((rec, rIdx) => (
                          <li key={rIdx}>{rec}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Action Buttons for Plan */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t border-slate-800">
                    <button
                      onClick={handleOpenInEditor}
                      className="px-3 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer"
                    >
                      <Sparkles className="w-4 h-4" />
                      <span>Ver / Personalizar Invitación</span>
                    </button>

                    <button
                      onClick={handleSharePlan}
                      className="px-3 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
                    >
                      <Share2 className="w-4 h-4" />
                      <span>Compartir</span>
                    </button>

                    <button
                      onClick={handleSavePlan}
                      disabled={isSaved}
                      className={`px-3 py-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                        isSaved
                          ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                          : 'bg-white/10 hover:bg-white/20 border-white/20 text-white'
                      }`}
                    >
                      <Bookmark className="w-4 h-4" />
                      <span>{isSaved ? '¡Plan Guardado!' : 'Guardar Plan'}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Render Search & Recommendation Card if query was a specific food/service request */}
              {msg.plan && (msg.plan.type === 'search' || (msg.plan.matchedBusinesses && msg.plan.matchedBusinesses.length > 0)) && (
                <div className="w-full mt-2 rounded-2xl bg-slate-950/90 border-2 border-cyan-500/40 shadow-2xl p-4 sm:p-5 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                          Recomendaciones Directas
                        </span>
                        {msg.plan.targetMunicipality && (
                          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                            {msg.plan.targetMunicipality}
                          </span>
                        )}
                      </div>
                      <h4 className="text-base font-extrabold text-white mt-1">
                        Comercios destacados encontrados en OleVeci
                      </h4>
                    </div>
                  </div>

                  {/* Business cards */}
                  <div className="space-y-3">
                    {(msg.plan.matchedBusinesses || []).map((b) => {
                      const relatedPosts = (msg.plan?.matchedPosts || []).filter((p) => p.businessId === b.id);
                      return (
                        <div
                          key={b.id}
                          className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 hover:border-cyan-500/40 transition-all space-y-2.5"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3 min-w-0">
                              <img
                                src={b.coverImage || b.logo || '/Logo_OleVeci.png'}
                                alt={b.name}
                                className="w-12 h-12 rounded-xl object-cover shrink-0 border border-slate-700 bg-slate-800"
                              />
                              <div className="min-w-0">
                                <h5 className="text-sm font-bold text-white truncate">{b.name}</h5>
                                <p className="text-xs text-cyan-200/80 flex items-center gap-1 mt-0.5">
                                  <MapPin className="w-3 h-3 text-cyan-400 shrink-0" />
                                  {b.city} · {b.address}
                                </p>
                              </div>
                            </div>

                            {b.whatsapp && (
                              <a
                                href={`https://api.whatsapp.com/send?phone=${b.whatsapp.replace(/\D/g, '')}&text=${encodeURIComponent(`¡Hola ${b.name}! Vi su perfil en OleVeci y me gustaría saber más.`)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 shrink-0 transition-colors shadow-xs"
                              >
                                <WhatsAppIcon className="w-3.5 h-3.5 text-white" />
                                <span>WhatsApp</span>
                              </a>
                            )}
                          </div>

                          {b.description && (
                            <p className="text-xs text-slate-300 leading-relaxed">{b.description}</p>
                          )}

                          {/* Related Posts for this business */}
                          {relatedPosts.length > 0 && (
                            <div className="space-y-1.5 pt-1 border-t border-slate-800/80">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                                Publicaciones y Especialidades activas:
                              </span>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {relatedPosts.map((p) => (
                                  <div
                                    key={p.id}
                                    className="p-2 rounded-lg bg-slate-950/80 border border-slate-800 flex items-center gap-2"
                                  >
                                    <img
                                      src={p.imageUrl || '/Logo_OleVeci.png'}
                                      alt={p.title}
                                      className="w-10 h-10 rounded-md object-cover shrink-0 bg-slate-800"
                                    />
                                    <div className="min-w-0 flex-1">
                                      <p className="text-xs font-semibold text-white truncate">{p.title}</p>
                                      <p className="text-[11px] font-bold text-emerald-400">
                                        ${(p.promotionalPrice || p.originalPrice || p.approximatePrice || 0).toLocaleString('es-CO')} COP
                                      </p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Quick Plan Generator CTA */}
                          <div className="pt-1 flex justify-end">
                            <button
                              onClick={() => {
                                const promptText = `Armame un plan en ${b.city} que empiece en ${b.name}`;
                                setInputMessage(promptText);
                                handleSendMessage(promptText);
                              }}
                              className="text-xs text-cyan-300 hover:text-white font-bold flex items-center gap-1 px-2.5 py-1 rounded-md bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 transition-all cursor-pointer"
                            >
                              <Sparkles className="w-3 h-3 text-cyan-400" />
                              <span>Armar plan completo con este local</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Refinement Suggestions Chips for Itinerary */}
              {msg.plan && msg.plan.stops && msg.plan.stops.length > 0 && (
                <div className="w-full mt-2.5 p-3 rounded-2xl bg-slate-900/90 border border-slate-800/90 shadow-md">
                  <span className="text-[11px] font-bold text-slate-300 block mb-2 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                    ¿Quieres ajustar algo? Toca una opción o dímelo por voz:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {REFINEMENT_CHIPS.map((chipText) => (
                      <button
                        key={chipText}
                        onClick={() => {
                          setInputMessage(chipText);
                          handleSendMessage(chipText);
                        }}
                        className="px-2.5 py-1.5 rounded-xl bg-slate-800/90 hover:bg-cyan-500/20 border border-slate-700/60 hover:border-cyan-500/40 text-xs text-cyan-200 hover:text-white transition-all cursor-pointer active:scale-95 shadow-xs"
                      >
                        {chipText}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Suggestions Chips for Direct Recommendations */}
              {msg.plan && (msg.plan.type === 'search' || (msg.plan.matchedBusinesses && msg.plan.matchedBusinesses.length > 0)) && (
                <div className="w-full mt-2.5 p-3 rounded-2xl bg-slate-900/90 border border-slate-800/90 shadow-md">
                  <span className="text-[11px] font-bold text-slate-300 block mb-2 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                    Ideas para continuar:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      'Armame un plan con esta recomendación',
                      'Buscar opciones en Cajicá',
                      'Buscar opciones en Chía',
                      'Ver opciones de postres o café',
                    ].map((chipText) => (
                      <button
                        key={chipText}
                        onClick={() => {
                          setInputMessage(chipText);
                          handleSendMessage(chipText);
                        }}
                        className="px-2.5 py-1.5 rounded-xl bg-slate-800/90 hover:bg-cyan-500/20 border border-slate-700/60 hover:border-cyan-500/40 text-xs text-cyan-200 hover:text-white transition-all cursor-pointer active:scale-95 shadow-xs"
                      >
                        {chipText}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              </div>
            );
          })}

          {/* Loading Animation while Oli is thinking */}
          {isLoading && (
            <div className="flex items-center gap-3 p-4 rounded-2xl bg-slate-900 border border-cyan-500/30 animate-pulse max-w-sm">
              <div className="w-8 h-8 rounded-full bg-cyan-500/20 flex items-center justify-center text-cyan-300">
                <Sparkles className="w-4 h-4 animate-spin" />
              </div>
              <div className="text-xs text-cyan-200">
                <p className="font-bold">Oli está organizando tu plan...</p>
                <p className="text-[11px] text-slate-400">Revisando las mejores ofertas y rutas locales</p>
              </div>
            </div>
          )}

          <div ref={chatBottomRef} />
        </div>

        {/* Audio Floating Bar if Audio is active */}
        {currentPlan && (
          <div className="relative z-10 px-4 py-2 bg-slate-950/80 border-t border-slate-800 flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <button
                onClick={handleToggleAudio}
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                  isPlayingAudio
                    ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/40 animate-pulse'
                    : 'bg-white/10 hover:bg-white/20 text-cyan-300'
                }`}
                title={isPlayingAudio ? 'Pausar audio de Oli' : 'Escuchar voz de Oli'}
              >
                {isAudioLoading ? (
                  <Sparkles className="w-4 h-4 animate-spin text-cyan-300" />
                ) : isPlayingAudio ? (
                  <Pause className="w-4 h-4" />
                ) : (
                  <Play className="w-4 h-4 ml-0.5" />
                )}
              </button>
              <div className="min-w-0">
                <span className="font-bold text-white text-xs block truncate">
                  {isPlayingAudio ? 'Oli te está contando el plan...' : 'Voz de Oli'}
                </span>
                <span className="text-[10px] text-slate-400 block truncate">
                  {isPlayingAudio ? 'Voz oficial de OleVeci' : 'Toca reproducir para escuchar'}
                </span>
              </div>
            </div>

            {isPlayingAudio && (
              <div className="flex items-center gap-1">
                <span className="w-1 h-3 bg-cyan-400 rounded-full animate-bounce" />
                <span className="w-1 h-5 bg-blue-400 rounded-full animate-bounce [animation-delay:0.15s]" />
                <span className="w-1 h-2 bg-emerald-400 rounded-full animate-bounce [animation-delay:0.3s]" />
                <span className="w-1 h-4 bg-cyan-400 rounded-full animate-bounce [animation-delay:0.45s]" />
              </div>
            )}
          </div>
        )}

        {/* Bottom Input & Voice Trigger Bar */}
        <div className="relative z-10 p-3 sm:p-4 bg-slate-900 border-t border-slate-800">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex items-center gap-2"
          >
            {/* Mic trigger */}
            <button
              type="button"
              onClick={toggleListening}
              className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-all cursor-pointer shrink-0 ${
                isListening
                  ? 'bg-rose-500 text-white ring-4 ring-rose-400/40 animate-pulse scale-105'
                  : 'bg-white/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
              }`}
              title={isListening ? 'Detener micrófono' : 'Hablar con Oli por voz'}
              aria-label="Hablar por voz"
            >
              {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </button>

            {/* Input field */}
            <div className="relative flex-1">
              <input
                ref={inputRef}
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder={
                  isListening
                    ? 'Escuchando tu voz...'
                    : currentPlan
                    ? 'Dile a Oli cómo ajustar el plan (ej: cambiar a pizza)...'
                    : 'Pídele un plan a Oli (ej: plan familiar domingo en Chía)...'
                }
                disabled={isLoading}
                className="w-full bg-slate-950 border border-slate-700 focus:border-cyan-400 rounded-2xl px-4 py-3 text-xs sm:text-sm text-white placeholder:text-slate-500 focus:outline-hidden focus:ring-2 focus:ring-cyan-500/20 transition-all pr-10"
              />
            </div>

            {/* Send button */}
            <button
              type="submit"
              disabled={isLoading || !inputMessage.trim()}
              className="w-11 h-11 rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 disabled:opacity-40 disabled:cursor-not-allowed text-white flex items-center justify-center shadow-lg transition-all cursor-pointer shrink-0"
              aria-label="Enviar mensaje a Oli"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>

          {isListening && (
            <p className="text-[11px] text-center text-rose-400 font-bold mt-2 animate-pulse flex items-center justify-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
              Micrófono activo: habla con Oli, te está escuchando...
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

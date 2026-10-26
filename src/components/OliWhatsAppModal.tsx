import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Send,
  Loader2,
  ExternalLink,
  Key,
  Smartphone,
  CheckCircle2,
  AlertCircle,
  QrCode,
  Share2,
  RefreshCw,
  LogOut,
  Bot,
  Copy,
  Check,
} from 'lucide-react';
import { WhatsAppIcon } from './WhatsAppIcon';

interface OliWhatsAppModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface SimulatedChatMessage {
  sender: 'user' | 'oli';
  text: string;
  time: string;
}

type TabType = 'link_device' | 'simulator' | 'customer_qr' | 'meta_setup';

export const OliWhatsAppModal: React.FC<OliWhatsAppModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<TabType>('link_device');
  const [botNumber, setBotNumber] = useState('573245168762');
  const [verifyToken, setVerifyToken] = useState('oleveci_token_2026');
  const [tokenInput, setTokenInput] = useState('');
  const [phoneIdInput, setPhoneIdInput] = useState('');
  const [isConfigured, setIsConfigured] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);

  // Baileys WhatsApp Web State
  const [baileysStatus, setBaileysStatus] = useState<
    'disconnected' | 'connecting' | 'waiting_for_qr' | 'connected'
  >('disconnected');
  const [baileysQr, setBaileysQr] = useState<string | null>(null);
  const [baileysPhone, setBaileysPhone] = useState<string | null>(null);
  const [baileysLoading, setBaileysLoading] = useState(false);
  const [baileysError, setBaileysError] = useState<string | null>(null);

  // Simulator State
  const [simInput, setSimInput] = useState('');
  const [simLoading, setSimLoading] = useState(false);
  const [simMessages, setSimMessages] = useState<SimulatedChatMessage[]>([
    {
      sender: 'oli',
      text: '🤖 *¡Hola veci! Soy Oli de OleVeci en WhatsApp* 👋\n\nEstoy aquí para recomendarte los mejores comercios, planes, promociones y servicios de la Sabana Centro (Cajicá, Chía, Cota, Zipaquirá y más).\n\n¿Qué te gustaría encontrar hoy? (ej: *"dónde lavo mi carro"*, *"un gym"*, o *"un plan para el fin de semana"*)',
      time: '12:00 PM',
    },
  ]);

  const simEndRef = useRef<HTMLDivElement>(null);

  // Poll Baileys status while modal is open
  useEffect(() => {
    if (!isOpen) return;

    const fetchStatus = () => {
      fetch('/api/whatsapp/baileys/status')
        .then((res) => res.json())
        .then((data) => {
          if (data) {
            setBaileysStatus(data.status);
            setBaileysQr(data.qrCodeDataUrl);
            setBaileysPhone(data.connectedPhone);
            setBaileysError(data.lastError);
          }
        })
        .catch(() => {});
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 2000);
    return () => clearInterval(interval);
  }, [isOpen]);

  // Load Meta Cloud API config on mount
  useEffect(() => {
    if (isOpen) {
      fetch('/api/whatsapp/config')
        .then((res) => res.json())
        .then((data) => {
          if (data) {
            setIsConfigured(data.isConfigured);
            if (data.botNumber) setBotNumber(data.botNumber);
            if (data.verifyToken) setVerifyToken(data.verifyToken);
            if (data.webhookUrl) setWebhookUrl(data.webhookUrl);
          }
        })
        .catch(() => {});
    }
  }, [isOpen]);

  useEffect(() => {
    if (activeTab === 'simulator') {
      simEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [simMessages, activeTab]);

  if (!isOpen) return null;

  const handleConnectBaileys = async () => {
    setBaileysLoading(true);
    setBaileysError(null);
    try {
      const res = await fetch('/api/whatsapp/baileys/connect', { method: 'POST' });
      const data = await res.json();
      if (data) {
        setBaileysStatus(data.status);
        setBaileysQr(data.qrCodeDataUrl);
        setBaileysPhone(data.connectedPhone);
      }
    } catch (err: any) {
      setBaileysError(err?.message || 'Error al conectar con WhatsApp');
    } finally {
      setBaileysLoading(false);
    }
  };

  const handleDisconnectBaileys = async () => {
    if (!confirm('¿Deseas desvincular este número de WhatsApp de OleVeci?')) return;
    setBaileysLoading(true);
    try {
      const res = await fetch('/api/whatsapp/baileys/disconnect', { method: 'POST' });
      const data = await res.json();
      if (data) {
        setBaileysStatus(data.status);
        setBaileysQr(null);
        setBaileysPhone(null);
      }
    } catch (err: any) {
      setBaileysError(err?.message || 'Error al desvincular');
    } finally {
      setBaileysLoading(false);
    }
  };

  const handleSendSimMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const prompt = simInput.trim();
    if (!prompt || simLoading) return;

    setSimInput('');
    setSimLoading(true);

    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    setSimMessages((prev) => [...prev, { sender: 'user', text: prompt, time: timeStr }]);

    try {
      const res = await fetch('/api/whatsapp/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userPrompt: prompt }),
      });

      const data = await res.json();
      const reply = data.replyText || '¡Listo veci! No pude procesar tu mensaje en este momento.';

      const replyTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setSimMessages((prev) => [...prev, { sender: 'oli', text: reply, time: replyTime }]);
    } catch {
      setSimMessages((prev) => [
        ...prev,
        {
          sender: 'oli',
          text: '⚠️ Error al conectar con el motor de Oli. Por favor intenta de nuevo.',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setSimLoading(false);
    }
  };

  const handleSaveMetaConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/whatsapp/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: tokenInput,
          phoneNumberId: phoneIdInput,
          botNumber,
          verifyToken,
        }),
      });

      if (res.ok) {
        setIsConfigured(Boolean(tokenInput && phoneIdInput));
        alert('¡Configuración de WhatsApp guardada con éxito!');
      }
    } catch {
      alert('Error al guardar la configuración.');
    }
  };

  const cleanBotNumber = (baileysPhone || botNumber || '573245168762').replace(/\D/g, '');
  const directChatUrl = `https://wa.me/${cleanBotNumber}?text=${encodeURIComponent(
    '¡Hola Oli! Quiero saber qué planes o comercios me recomiendas hoy en la Sabana Centro.'
  )}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="w-full max-w-2xl max-h-[92vh] bg-white rounded-3xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-emerald-700 via-teal-800 to-emerald-900 text-white flex items-center justify-between border-b border-emerald-950">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/20 border border-white/30 flex items-center justify-center shadow-inner">
              <WhatsAppIcon className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white tracking-tight">
                  Chatear con OLI en WhatsApp
                </h3>
                <span
                  className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                    baileysStatus === 'connected'
                      ? 'bg-emerald-500/40 text-emerald-100 border-emerald-400/50'
                      : 'bg-amber-500/30 text-amber-200 border-amber-400/30'
                  }`}
                >
                  {baileysStatus === 'connected' ? '🟢 En Línea' : '🟡 Desconectado'}
                </span>
              </div>
              <p className="text-xs text-emerald-100">
                {baileysStatus === 'connected'
                  ? `Conectado al WhatsApp: +${baileysPhone}`
                  : 'Vincula la SIM 3245168762 para responder en automático'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="px-4 py-2 bg-slate-100 border-b border-slate-200 flex items-center gap-1.5 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('link_device')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
              activeTab === 'link_device'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-200'
            }`}
          >
            <QrCode className="w-3.5 h-3.5" />
            <span>1. Vincular SIM ({baileysStatus === 'connected' ? 'Conectado' : 'Escanear QR'})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('simulator')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
              activeTab === 'simulator'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-200'
            }`}
          >
            <Bot className="w-3.5 h-3.5" />
            <span>2. Probar en Pantalla</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('customer_qr')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
              activeTab === 'customer_qr'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-200'
            }`}
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>3. QR para Clientes</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('meta_setup')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
              activeTab === 'meta_setup'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-200'
            }`}
          >
            <Key className="w-3.5 h-3.5" />
            <span>Meta API</span>
          </button>
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          {/* TAB 1: WhatsApp Web Linking (Dispositivos Vinculados) */}
          {activeTab === 'link_device' && (
            <div className="space-y-4">
              {/* Instructions Banner */}
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-950 space-y-2">
                <div className="flex items-center gap-2">
                  <Smartphone className="w-5 h-5 text-emerald-600" />
                  <h4 className="text-sm font-bold">
                    Conectar la SIM con WhatsApp Web (Dispositivos Vinculados)
                  </h4>
                </div>
                <p className="text-xs text-emerald-900 leading-relaxed">
                  Para que tu SIM responda automáticamente a las personas que le escriban, vincula la
                  sesión de WhatsApp Web escaneando el código QR con el celular de esa SIM.
                </p>
              </div>

              {/* Status & Action Center */}
              {baileysStatus === 'connected' ? (
                <div className="p-6 bg-white rounded-2xl border-2 border-emerald-500 shadow-sm flex flex-col items-center text-center space-y-4">
                  <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                    <CheckCircle2 className="w-10 h-10" />
                  </div>
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-emerald-600">
                      Estado: Conexión Activa
                    </span>
                    <h3 className="text-xl font-black text-slate-800 mt-1">
                      +{baileysPhone || botNumber}
                    </h3>
                    <p className="text-xs text-slate-600 max-w-md mx-auto mt-2 leading-relaxed">
                      ¡Tu WhatsApp está conectado exitosamente! El agente <strong>OLI</strong> está
                      escuchando y responderá de inmediato cualquier mensaje o búsqueda que le
                      envíen a este número.
                    </p>
                  </div>

                  <div className="pt-2 flex flex-wrap gap-3 justify-center">
                    <button
                      type="button"
                      onClick={() => setActiveTab('simulator')}
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-2 shadow-xs cursor-pointer"
                    >
                      <Bot className="w-4 h-4" />
                      <span>Hacer una Prueba en Vivo</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('customer_qr')}
                      className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center gap-2 border border-slate-300 cursor-pointer"
                    >
                      <Share2 className="w-4 h-4 text-emerald-600" />
                      <span>Ver QR para Clientes</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleDisconnectBaileys}
                      disabled={baileysLoading}
                      className="px-4 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs flex items-center gap-2 border border-rose-200 cursor-pointer"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Desvincular WhatsApp</span>
                    </button>
                  </div>
                </div>
              ) : baileysStatus === 'waiting_for_qr' && baileysQr ? (
                <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-center gap-6">
                  {/* Pairing QR Code */}
                  <div className="flex flex-col items-center">
                    <div className="p-3 bg-white rounded-2xl border-4 border-emerald-600 shadow-lg">
                      <img
                        src={baileysQr}
                        alt="Código QR de Vinculación de WhatsApp"
                        className="w-52 h-52 rounded-lg select-none"
                      />
                    </div>
                    <span className="text-[11px] font-bold text-emerald-700 mt-2 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                      Esperando escaneo desde tu celular...
                    </span>
                  </div>

                  {/* Step by Step Instructions */}
                  <div className="flex-1 space-y-3">
                    <h5 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                      Pasos en el celular de la SIM (324 516 8762):
                    </h5>
                    <ol className="text-xs text-slate-700 space-y-2.5 list-decimal pl-4 font-medium">
                      <li>
                        Abre <strong>WhatsApp</strong> en el teléfono que tiene la SIM.
                      </li>
                      <li>
                        Toca el menú de los <strong>tres puntos</strong> (Android) o{' '}
                        <strong>Configuración</strong> (iPhone).
                      </li>
                      <li>
                        Selecciona <strong>Dispositivos vinculados</strong>.
                      </li>
                      <li>
                        Toca en <strong>Vincular un dispositivo</strong> y apunta la cámara a este
                        código QR en la pantalla.
                      </li>
                    </ol>

                    <div className="pt-2 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleConnectBaileys}
                        disabled={baileysLoading}
                        className="px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1.5 border border-slate-200 cursor-pointer"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${baileysLoading ? 'animate-spin' : ''}`} />
                        <span>Regenerar QR</span>
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-6 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col items-center text-center space-y-4">
                  <div className="w-16 h-16 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center">
                    <QrCode className="w-8 h-8 text-emerald-600" />
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-slate-800">
                      Conectar WhatsApp de OleVeci ({botNumber})
                    </h4>
                    <p className="text-xs text-slate-600 max-w-md mx-auto mt-1 leading-relaxed">
                      Haz clic en el botón a continuación para generar el código QR de WhatsApp Web.
                      Luego abre WhatsApp en el celular que tiene esa SIM y escanea el código.
                    </p>
                  </div>

                  {baileysError && (
                    <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                      <span>{baileysError}</span>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={handleConnectBaileys}
                    disabled={baileysLoading}
                    className="px-6 py-3 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white font-bold text-sm flex items-center gap-2 shadow-md transition-all active:scale-98 cursor-pointer disabled:opacity-50"
                  >
                    {baileysLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Generando código QR...</span>
                      </>
                    ) : (
                      <>
                        <QrCode className="w-4 h-4" />
                        <span>Generar Código QR de Vinculación</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: WhatsApp Chat Simulator */}
          {activeTab === 'simulator' && (
            <div className="flex flex-col h-[520px] rounded-2xl border border-slate-300 overflow-hidden bg-[#E5DDD5] shadow-inner">
              {/* WhatsApp App Topbar */}
              <div className="px-4 py-2.5 bg-[#075E54] text-white flex items-center justify-between shadow-xs">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-white/20 p-1 flex items-center justify-center">
                    <img
                      src="/assets/aistudio/Oli_sin_Fondo_d51a9103.png"
                      alt="Oli"
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold leading-tight">Oli · OleVeci Asistente</h4>
                    <span className="text-[10px] text-emerald-200">En línea</span>
                  </div>
                </div>
                <span className="text-[10px] bg-emerald-800 text-emerald-100 px-2 py-0.5 rounded-full font-medium">
                  Simulación en tiempo real
                </span>
              </div>

              {/* Chat Message Stream */}
              <div className="flex-1 overflow-y-auto p-3 space-y-3">
                {simMessages.map((msg, i) => (
                  <div
                    key={i}
                    className={`flex ${
                      msg.sender === 'user' ? 'justify-end' : 'justify-start'
                    } animate-in fade-in duration-200`}
                  >
                    <div
                      className={`max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed shadow-xs whitespace-pre-wrap ${
                        msg.sender === 'user'
                          ? 'bg-[#DCF8C6] text-slate-800 rounded-tr-xs'
                          : 'bg-white text-slate-800 rounded-tl-xs'
                      }`}
                    >
                      <p>{msg.text}</p>
                      <span className="text-[9px] text-slate-400 block text-right mt-1 font-medium">
                        {msg.time}
                      </span>
                    </div>
                  </div>
                ))}
                {simLoading && (
                  <div className="flex justify-start">
                    <div className="bg-white rounded-xl px-3 py-2 text-xs text-slate-500 flex items-center gap-2 shadow-xs">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600" />
                      <span>Oli está escribiendo...</span>
                    </div>
                  </div>
                )}
                <div ref={simEndRef} />
              </div>

              {/* Chat Input Bar */}
              <form
                onSubmit={handleSendSimMessage}
                className="p-2 bg-[#F0F0F0] border-t border-slate-300 flex items-center gap-2"
              >
                <input
                  type="text"
                  value={simInput}
                  onChange={(e) => setSimInput(e.target.value)}
                  placeholder="Escribe un mensaje como en WhatsApp (ej: pizza, gym, carro)..."
                  disabled={simLoading}
                  className="flex-1 bg-white border border-slate-300 rounded-full px-4 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <button
                  type="submit"
                  disabled={simLoading || !simInput.trim()}
                  className="w-9 h-9 rounded-full bg-[#128C7E] hover:bg-[#075E54] disabled:opacity-50 text-white flex items-center justify-center transition-colors cursor-pointer shrink-0 shadow-xs"
                >
                  <Send className="w-4 h-4 -rotate-12 translate-x-0.5" />
                </button>
              </form>
            </div>
          )}

          {/* TAB 3: Customer QR & Direct Chat Link */}
          {activeTab === 'customer_qr' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-950 space-y-2">
                <div className="flex items-center gap-2.5">
                  <WhatsAppIcon className="w-6 h-6 text-emerald-600" />
                  <h4 className="text-sm font-bold">
                    Código QR para Clientes (Imprimir o Compartir)
                  </h4>
                </div>
                <p className="text-xs text-emerald-900 leading-relaxed">
                  Cualquier persona que escanee este código desde la cámara de su celular abrirá
                  inmediatamente un chat en su WhatsApp personal con el número de OleVeci (+57{' '}
                  {botNumber}).
                </p>
              </div>

              {/* QR Code Card */}
              <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-center gap-6">
                <div className="flex flex-col items-center">
                  <div className="p-3 bg-white rounded-2xl border-2 border-emerald-500 shadow-md">
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(
                        directChatUrl
                      )}&color=075E54`}
                      alt="Código QR WhatsApp Oli"
                      className="w-44 h-44 rounded-lg select-none"
                    />
                  </div>
                  <span className="text-[11px] font-bold text-slate-600 mt-2 text-center">
                    📱 Escanear con cualquier celular
                  </span>
                </div>

                <div className="flex-1 space-y-3 text-center sm:text-left">
                  <div>
                    <h5 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                      Número Oficial OleVeci
                    </h5>
                    <p className="text-lg font-black text-emerald-700 tracking-wide font-mono mt-0.5">
                      +{cleanBotNumber}
                    </p>
                  </div>

                  <p className="text-xs text-slate-600 leading-relaxed">
                    Al escanear el QR o hacer clic abajo, tu WhatsApp abrirá la conversación con Oli
                    y prellenará el saludo de bienvenida.
                  </p>

                  <div className="pt-1">
                    <a
                      href={directChatUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-2.5 px-4 rounded-xl bg-[#25D366] hover:bg-[#20ba5a] text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition-transform active:scale-98 cursor-pointer"
                    >
                      <WhatsAppIcon className="w-4 h-4 text-white" />
                      <span>Abrir Chat en WhatsApp Web / Celular</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
              </div>

              {/* Number Configuration */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                <label className="text-xs font-bold text-slate-700 block">
                  Número oficial configurado:
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={botNumber}
                    onChange={(e) => setBotNumber(e.target.value)}
                    placeholder="Ej: 573245168762"
                    className="flex-1 bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono text-slate-800 focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>
                <p className="text-[11px] text-slate-500">
                  Formato internacional sin signos: <strong>573245168762</strong> (57 para
                  Colombia).
                </p>
              </div>
            </div>
          )}

          {/* TAB 4: Meta WhatsApp Cloud API Setup */}
          {activeTab === 'meta_setup' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-blue-50 border border-blue-200 text-blue-950 space-y-2">
                <div className="flex items-center gap-2">
                  <Bot className="w-5 h-5 text-blue-600" />
                  <h4 className="text-sm font-bold">Conexión Oficial con Meta WhatsApp Cloud API</h4>
                </div>
                <p className="text-xs text-blue-900 leading-relaxed">
                  El servidor de OleVeci ya incluye los endpoints oficiales de webhook listos para
                  conectar con la API de WhatsApp de Meta (sin costo para los primeros 1.000 chats
                  al mes).
                </p>
              </div>

              {/* Webhook URLs to copy */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                <h5 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  1. Configuración del Webhook en Meta for Developers:
                </h5>

                <div className="space-y-2">
                  <div>
                    <span className="text-[11px] font-semibold text-slate-600 block mb-1">
                      Callback URL (Webhook):
                    </span>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        readOnly
                        value={webhookUrl || `${window.location.origin}/api/whatsapp/webhook`}
                        className="flex-1 bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-mono text-slate-700 select-all outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(
                            webhookUrl || `${window.location.origin}/api/whatsapp/webhook`
                          );
                          setCopiedUrl(true);
                          setTimeout(() => setCopiedUrl(false), 2000);
                        }}
                        className="px-3 py-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold flex items-center gap-1 cursor-pointer shrink-0"
                      >
                        {copiedUrl ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedUrl ? 'Copiado' : 'Copiar'}</span>
                      </button>
                    </div>
                  </div>

                  <div>
                    <span className="text-[11px] font-semibold text-slate-600 block mb-1">
                      Verify Token:
                    </span>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        readOnly
                        value={verifyToken}
                        className="flex-1 bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-mono text-slate-700 select-all outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(verifyToken);
                          setCopiedToken(true);
                          setTimeout(() => setCopiedToken(false), 2000);
                        }}
                        className="px-3 py-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold flex items-center gap-1 cursor-pointer shrink-0"
                      >
                        {copiedToken ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedToken ? 'Copiado' : 'Copiar'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Form to enter Meta credentials */}
              <form
                onSubmit={handleSaveMetaConfig}
                className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3"
              >
                <h5 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  2. Credenciales de la Aplicación Meta:
                </h5>

                <div className="space-y-2">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                      System User Access Token:
                    </label>
                    <input
                      type="password"
                      value={tokenInput}
                      onChange={(e) => setTokenInput(e.target.value)}
                      placeholder="EAAB..."
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-mono text-slate-800 focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                      Phone Number ID:
                    </label>
                    <input
                      type="text"
                      value={phoneIdInput}
                      onChange={(e) => setPhoneIdInput(e.target.value)}
                      placeholder="Ej: 104598234857291"
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-mono text-slate-800 focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    className="w-full py-2.5 rounded-xl bg-[#0066FF] hover:bg-blue-600 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                  >
                    <Key className="w-3.5 h-3.5" />
                    <span>Guardar y Vincular Credenciales</span>
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <span className="flex items-center gap-1.5">
            <WhatsAppIcon className="w-4 h-4 text-emerald-600" />
            Integración de WhatsApp para OleVeci
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold cursor-pointer transition-colors shadow-xs"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};

import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  QrCode,
  Camera,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Keyboard,
  RefreshCw,
  Store,
  Tag,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import { Post } from '../types';

interface BusinessQRScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  businessId: string;
  businessName: string;
  onRedeem: (codeOrPayload: string) => {
    success: boolean;
    message: string;
    post?: Post;
    code?: string;
  };
}

export const BusinessQRScannerModal: React.FC<BusinessQRScannerModalProps> = ({
  isOpen,
  onClose,
  businessId,
  businessName,
  onRedeem,
}) => {
  const [manualCode, setManualCode] = useState<string>('');
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [scanning, setScanning] = useState<boolean>(false);
  const [validationResult, setValidationResult] = useState<{
    success: boolean;
    message: string;
    post?: Post;
    code?: string;
  } | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // Play audio chime using Web Audio API
  const playSound = (success: boolean) => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (success) {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
        osc.frequency.setValueAtTime(880, ctx.currentTime + 0.1); // A5
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
        osc.start();
        osc.stop(ctx.currentTime + 0.35);
      } else {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(260, ctx.currentTime);
        osc.frequency.setValueAtTime(195, ctx.currentTime + 0.12);
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
        osc.start();
        osc.stop(ctx.currentTime + 0.3);
      }
    } catch {
      // Audio not permitted or unavailable
    }
  };

  const handleProcessCode = (raw: string) => {
    if (!raw || !raw.trim()) return;
    const res = onRedeem(raw.trim());
    setValidationResult(res);
    playSound(res.success);
    if (navigator.vibrate) {
      navigator.vibrate(res.success ? [100, 50, 100] : [200, 100, 200]);
    }
    if (res.success) {
      stopCamera();
    }
  };

  const startCamera = async () => {
    setCameraError(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Navegador no soporta cámara en vivo');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setCameraActive(true);
        startDetectionLoop();
      }
    } catch (err: any) {
      console.warn('Camera access issue:', err);
      setCameraActive(false);
      setCameraError(
        err.name === 'NotAllowedError'
          ? 'Permiso de cámara denegado. Puedes ingresar el código alfanumérico manualmente.'
          : 'No se pudo iniciar la cámara en este dispositivo. Usa el ingreso manual.'
      );
    }
  };

  const stopCamera = () => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  };

  const startDetectionLoop = () => {
    // Check if BarcodeDetector API is natively available
    const BarcodeDetectorClass = (window as any).BarcodeDetector;
    if (BarcodeDetectorClass) {
      const detector = new BarcodeDetectorClass({ formats: ['qr_code'] });
      const detect = async () => {
        if (!videoRef.current || videoRef.current.readyState < 2) {
          animFrameRef.current = requestAnimationFrame(detect);
          return;
        }

        try {
          const barcodes = await detector.detect(videoRef.current);
          if (barcodes && barcodes.length > 0) {
            const rawValue = barcodes[0].rawValue;
            if (rawValue) {
              handleProcessCode(rawValue);
              return;
            }
          }
        } catch {
          // ignore detection frame errors
        }

        animFrameRef.current = requestAnimationFrame(detect);
      };
      animFrameRef.current = requestAnimationFrame(detect);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setValidationResult(null);
      setManualCode('');
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-sm sm:max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200/90 overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Ribbon */}
        <div className="bg-gradient-to-r from-[#031c54] via-[#0056d6] to-[#007af7] p-4 text-white relative">
          <button
            id="btn-close-scanner-modal"
            type="button"
            onClick={onClose}
            className="absolute top-3.5 right-3.5 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 transition-all flex items-center justify-center text-white cursor-pointer"
            aria-label="Cerrar escáner"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/15 backdrop-blur-md flex items-center justify-center text-white shrink-0 shadow-xs border border-white/20">
              <QrCode className="w-5 h-5 text-[#00d8a5]" />
            </div>
            <div>
              <div className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-[#ffbe00]">
                <Sparkles className="w-3 h-3" />
                <span>Panel de Validación</span>
              </div>
              <h3 className="text-base font-black text-white leading-tight">
                Escanear QR de Cliente
              </h3>
            </div>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto scrollbar-thin">
          {/* Validation Result Feedback Screen */}
          {validationResult ? (
            <div
              className={`p-5 rounded-2xl border text-center space-y-3 animate-in fade-in duration-200 ${
                validationResult.success
                  ? 'bg-emerald-50/90 border-emerald-200 text-emerald-950'
                  : 'bg-red-50/90 border-red-200 text-red-950'
              }`}
            >
              <div className="flex justify-center">
                <div
                  className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-xs ${
                    validationResult.success
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-red-100 text-red-700'
                  }`}
                >
                  {validationResult.success ? (
                    <CheckCircle2 className="w-8 h-8 text-emerald-600" />
                  ) : (
                    <AlertTriangle className="w-8 h-8 text-red-600" />
                  )}
                </div>
              </div>

              <div>
                <h4
                  className={`text-base font-black ${
                    validationResult.success ? 'text-emerald-900' : 'text-red-900'
                  }`}
                >
                  {validationResult.success
                    ? '¡Cliente Validado con Éxito!'
                    : 'No se pudo validar el código'}
                </h4>
                <p className="text-xs font-medium mt-1 text-slate-600">
                  {validationResult.message}
                </p>
              </div>

              {validationResult.post && (
                <div className="bg-white p-3 rounded-xl border border-emerald-200/80 shadow-2xs text-left flex items-center gap-3">
                  {validationResult.post.imageUrl ? (
                    <img
                      src={validationResult.post.imageUrl}
                      alt={validationResult.post.title}
                      className="w-12 h-12 rounded-lg object-cover border border-slate-200 shrink-0"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600 shrink-0">
                      <Store className="w-5 h-5" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <span className="text-[9px] font-extrabold uppercase tracking-wider text-emerald-800 block">
                      Publicación Canjeada
                    </span>
                    <h5 className="text-xs font-black text-[#041f5e] truncate">
                      {validationResult.post.title}
                    </h5>
                    <div className="text-[10px] text-slate-500 font-bold mt-0.5">
                      Código: <span className="font-mono">{validationResult.code}</span>
                    </div>
                  </div>
                </div>
              )}

              <div className="pt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setValidationResult(null);
                    setManualCode('');
                    startCamera();
                  }}
                  className="flex-1 py-2 px-3 rounded-xl bg-white border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-100 cursor-pointer shadow-2xs flex items-center justify-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Escanear Otro</span>
                </button>
                <button
                  id="btn-close-scanner-result"
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-2 px-3 rounded-xl bg-[#041f5e] text-white text-xs font-extrabold hover:bg-[#0056d6] cursor-pointer shadow-xs"
                >
                  Cerrar
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Camera Scanner Viewport */}
              <div className="relative w-full aspect-square max-h-64 sm:max-h-72 bg-slate-950 rounded-2xl overflow-hidden border border-slate-200/90 shadow-inner flex items-center justify-center">
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  className={`w-full h-full object-cover transition-opacity duration-300 ${
                    cameraActive ? 'opacity-100' : 'opacity-0'
                  }`}
                />

                {cameraActive ? (
                  // Target scan box animation
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none p-6">
                    <div className="relative w-48 h-48 border-2 border-[#00d8a5] rounded-2xl shadow-[0_0_20px_rgba(0,216,165,0.35)] flex items-center justify-center">
                      <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-white rounded-tl-sm" />
                      <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-white rounded-tr-sm" />
                      <div className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-white rounded-bl-sm" />
                      <div className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-white rounded-br-sm" />
                      <div className="w-full h-0.5 bg-[#ffbe00] shadow-[0_0_8px_#ffbe00] animate-pulse" />
                    </div>
                    <span className="absolute bottom-3 text-[11px] font-bold text-white/90 bg-black/60 px-2.5 py-1 rounded-full backdrop-blur-md">
                      Apunta al código QR del cliente
                    </span>
                  </div>
                ) : (
                  <div className="p-4 text-center text-slate-300 space-y-2">
                    <Camera className="w-8 h-8 mx-auto text-slate-400 animate-pulse" />
                    <p className="text-xs font-medium text-slate-300 max-w-xs mx-auto">
                      {cameraError || 'Iniciando cámara del dispositivo...'}
                    </p>
                    <button
                      type="button"
                      onClick={startCamera}
                      className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-bold text-white transition-colors cursor-pointer"
                    >
                      Reintentar cámara
                    </button>
                  </div>
                )}
              </div>

              {/* Manual Alphanumeric Code Entry */}
              <div className="bg-slate-50 p-3 sm:p-3.5 rounded-2xl border border-slate-200/80 space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-black text-[#041f5e]">
                  <Keyboard className="w-3.5 h-3.5 text-[#007af7]" />
                  <span>¿Sin cámara? Ingresa el código manual:</span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    id="input-manual-qr-code"
                    type="text"
                    value={manualCode}
                    onChange={(e) => setManualCode(e.target.value.toUpperCase())}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleProcessCode(manualCode);
                      }
                    }}
                    placeholder="Ej: OV-BRAS-9K24"
                    className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-bold text-[#041f5e] uppercase tracking-wider outline-none focus:ring-2 focus:ring-[#007af7]/30 focus:border-[#007af7]"
                  />
                  <button
                    id="btn-submit-manual-code"
                    type="button"
                    onClick={() => handleProcessCode(manualCode)}
                    disabled={!manualCode.trim()}
                    className="px-3.5 py-2 rounded-xl bg-[#007af7] hover:bg-[#0062f5] active:scale-95 disabled:opacity-50 disabled:pointer-events-none text-xs font-black text-white transition-all cursor-pointer shadow-2xs flex items-center gap-1 shrink-0"
                  >
                    <span>Validar</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Security Hint */}
              <div className="flex items-start gap-2 text-[11px] text-slate-500 font-medium px-1">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>
                  Cada escaneo se suma automáticamente a tus <strong>Clientes Reales Adquiridos</strong> y actualiza tu Costo de Adquisición Real (CAC) en tiempo real.
                </span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

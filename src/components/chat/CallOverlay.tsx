import { useApp } from '@/contexts/AppContext';
import { useEffect, useRef, useState, useCallback } from 'react';
import { Mic, MicOff, Video, VideoOff, PhoneOff, Monitor, MonitorOff } from 'lucide-react';
import { getUserMedia, getDisplayMedia, createPeerConnection } from '@/services/rtc';

export default function CallOverlay() {
  const { inCall, endCall, activeChat, callType, user } = useApp();

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);

  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [screenSharing, setScreenSharing] = useState(false);
  const [mediaReady, setMediaReady] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);

  /* ── Iniciar medios al entrar en llamada ── */
  useEffect(() => {
    if (!inCall) return;

    let cancelled = false;

    (async () => {
      try {
        const wantsVideo = callType === 'video';
        const stream = await getUserMedia(wantsVideo, true);
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }

        localStreamRef.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
        setMediaReady(true);

        // Crear PeerConnection y añadir tracks
        // TODO: reemplazar chatId / fromUserId con valores reales del contexto
        const pc = createPeerConnection(
          activeChat?.id || '',
          user?.id || '',
        );
        pcRef.current = pc;

        stream.getTracks().forEach((track) => pc.addTrack(track, stream));

        pc.ontrack = (e) => {
          if (remoteVideoRef.current && e.streams[0]) {
            remoteVideoRef.current.srcObject = e.streams[0];
          }
        };
      } catch (err: any) {
        if (!cancelled) setMediaError(err?.message || 'No se pudo acceder a los medios');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [inCall, callType, activeChat?.id, user?.id]);

  /* ── Limpiar al colgar ── */
  const handleEndCall = useCallback(() => {
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    screenStreamRef.current?.getTracks().forEach((t) => t.stop());
    pcRef.current?.close();
    localStreamRef.current = null;
    screenStreamRef.current = null;
    pcRef.current = null;
    setMediaReady(false);
    setMediaError(null);
    setScreenSharing(false);
    setCamOn(true);
    setMicOn(true);
    endCall();
  }, [endCall]);

  /* ── Toggle micrófono ── */
  const toggleMic = useCallback(() => {
    localStreamRef.current?.getAudioTracks().forEach((t) => { t.enabled = !t.enabled; });
    setMicOn((p) => !p);
  }, []);

  /* ── Toggle cámara ── */
  const toggleCam = useCallback(() => {
    localStreamRef.current?.getVideoTracks().forEach((t) => { t.enabled = !t.enabled; });
    setCamOn((p) => !p);
  }, []);

  /* ── Toggle pantalla compartida ── */
  const toggleScreen = useCallback(async () => {
    if (screenSharing) {
      screenStreamRef.current?.getTracks().forEach((t) => t.stop());
      screenStreamRef.current = null;
      setScreenSharing(false);
      // Restaurar cámara local
      if (localStreamRef.current && localVideoRef.current) {
        localVideoRef.current.srcObject = localStreamRef.current;
      }
    } else {
      try {
        const screen = await getDisplayMedia();
        screenStreamRef.current = screen;
        if (localVideoRef.current) localVideoRef.current.srcObject = screen;
        setScreenSharing(true);
        // TODO: reemplazar tracks en PeerConnection para señalizar pantalla
        screen.getVideoTracks()[0].onended = () => {
          setScreenSharing(false);
          if (localStreamRef.current && localVideoRef.current) {
            localVideoRef.current.srcObject = localStreamRef.current;
          }
        };
      } catch { /* Usuario canceló */ }
    }
  }, [screenSharing]);

  if (!inCall || !activeChat) return null;

  const isVideo = callType === 'video';

  return (
    <div className="fixed inset-0 z-50 bg-call-bg flex flex-col animate-fade-in">

      {/* Header */}
      <div className="absolute top-0 left-0 right-0 h-16 px-6 flex items-center justify-between z-10 bg-gradient-to-b from-black/40 to-transparent">
        <div>
          <h2 className="text-sm font-semibold text-call-foreground">{activeChat.title}</h2>
          <p className="text-xs text-call-foreground/60">
            {isVideo ? 'Videollamada' : 'Llamada de voz'} · {activeChat.members.length} participante{activeChat.members.length !== 1 ? 's' : ''}
          </p>
        </div>
        {mediaError && (
          <span className="text-xs bg-destructive/80 text-destructive-foreground px-3 py-1 rounded-full">
            {mediaError}
          </span>
        )}
      </div>

      {/* Área de video */}
      {isVideo ? (
        <div className="flex-1 flex items-center justify-center relative">
          {/* Video remoto (principal) */}
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover"
          />

          {/* Avatares de participantes cuando no hay stream remoto */}
          {!remoteVideoRef.current?.srcObject && (
            <div className="absolute inset-0 flex flex-wrap gap-4 justify-center items-center p-8">
              {activeChat.members.map((m) => (
                <div
                  key={m.id}
                  className="w-56 h-44 rounded-2xl bg-call-muted flex flex-col items-center justify-center gap-3"
                >
                  <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center text-primary text-2xl font-bold">
                    {m.displayName.charAt(0)}
                  </div>
                  <span className="text-call-foreground text-sm font-medium">{m.displayName}</span>
                  {!mediaReady && m.id === user?.id && (
                    <span className="text-xs text-call-foreground/50 animate-pulse">Conectando cámara…</span>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Video local (PiP) */}
          <div className="absolute bottom-24 right-6 w-36 h-28 rounded-xl overflow-hidden border-2 border-white/20 shadow-2xl bg-call-muted">
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
            {!camOn && !screenSharing && (
              <div className="absolute inset-0 flex items-center justify-center bg-call-muted">
                <VideoOff className="w-6 h-6 text-call-foreground/40" />
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Llamada de audio: avatares grandes */
        <div className="flex-1 flex flex-wrap gap-6 justify-center items-center p-12">
          {activeChat.members.map((m) => (
            <div
              key={m.id}
              className="flex flex-col items-center gap-3"
            >
              <div className="w-24 h-24 rounded-full bg-primary/20 flex items-center justify-center text-primary text-3xl font-bold ring-4 ring-primary/20 animate-pulse-dot">
                {m.displayName.charAt(0)}
              </div>
              <span className="text-call-foreground text-sm font-medium">{m.displayName}</span>
              <span className="text-call-foreground/50 text-xs">
                {m.id === user?.id ? (micOn ? '🎙 Hablando' : '🔇 Silenciado') : 'En llamada'}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Barra de controles */}
      <div className="absolute bottom-0 left-0 right-0 h-24 flex items-center justify-center gap-3 bg-gradient-to-t from-black/50 to-transparent">
        <CtrlBtn onClick={toggleMic} active={micOn} danger={!micOn} label={micOn ? 'Silenciar' : 'Activar mic'}>
          {micOn ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
        </CtrlBtn>

        {isVideo && (
          <CtrlBtn onClick={toggleCam} active={camOn} danger={!camOn} label={camOn ? 'Apagar cámara' : 'Encender cámara'}>
            {camOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
          </CtrlBtn>
        )}

        {isVideo && (
          <CtrlBtn onClick={toggleScreen} active={!screenSharing} accent={screenSharing} label={screenSharing ? 'Dejar de compartir' : 'Compartir pantalla'}>
            {screenSharing ? <MonitorOff className="w-5 h-5" /> : <Monitor className="w-5 h-5" />}
          </CtrlBtn>
        )}

        {/* Colgar */}
        <button
          onClick={handleEndCall}
          className="w-14 h-14 rounded-full bg-call-danger text-destructive-foreground flex items-center justify-center hover:opacity-80 transition-opacity shadow-lg"
          aria-label="Colgar"
        >
          <PhoneOff className="w-6 h-6" />
        </button>
      </div>
    </div>
  );
}

/* ── Botón de control reutilizable ── */
function CtrlBtn({
  children, onClick, active, danger, accent, label,
}: {
  children: React.ReactNode;
  onClick: () => void;
  active: boolean;
  danger?: boolean;
  accent?: boolean;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`w-12 h-12 rounded-full flex items-center justify-center transition-all shadow-md
        ${danger ? 'bg-destructive text-destructive-foreground'
          : accent ? 'bg-primary text-primary-foreground'
          : 'bg-call-muted text-call-foreground hover:opacity-80'}`}
    >
      {children}
    </button>
  );
}

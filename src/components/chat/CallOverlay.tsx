import { useApp } from '@/contexts/AppContext';
import { useEffect, useRef, useState, useCallback, type ReactNode } from 'react';
import { Mic, MicOff, Video, VideoOff, PhoneOff, Monitor, MonitorOff } from 'lucide-react';
import { getUserMedia, getDisplayMedia, createPeerConnection, createOffer, createAnswer } from '@/services/rtc';
import { wsService } from '@/services/websocket';

const VOICE_THRESHOLD = 0.045;

export default function CallOverlay() {
  const { inCall, endCall, activeChat, chats, callType, user, callChatId, callPeerId, isCallInitiator } = useApp();

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);

  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [screenSharing, setScreenSharing] = useState(false);
  const [mediaReady, setMediaReady] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [hasRemoteStream, setHasRemoteStream] = useState(false);
  const [localSpeaking, setLocalSpeaking] = useState(false);
  const [remoteSpeaking, setRemoteSpeaking] = useState(false);

  const chatForCall = activeChat?.id === callChatId
    ? activeChat
    : chats.find((chat) => chat.id === callChatId) || null;

  const detectSpeaking = useCallback((stream: MediaStream, onChange: (speaking: boolean) => void) => {
    const audioCtx = new AudioContext();
    const source = audioCtx.createMediaStreamSource(stream);
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 512;
    source.connect(analyser);

    const buffer = new Uint8Array(analyser.frequencyBinCount);
    let rafId = 0;

    const tick = () => {
      analyser.getByteFrequencyData(buffer);
      const average = buffer.reduce((sum, value) => sum + value, 0) / (buffer.length * 255);
      onChange(average > VOICE_THRESHOLD);
      rafId = requestAnimationFrame(tick);
    };

    tick();

    return () => {
      cancelAnimationFrame(rafId);
      source.disconnect();
      analyser.disconnect();
      void audioCtx.close();
      onChange(false);
    };
  }, []);

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
    setHasRemoteStream(false);
    setLocalSpeaking(false);
    setRemoteSpeaking(false);
    endCall();
  }, [endCall]);

  useEffect(() => {
    if (!inCall || !callChatId || !user?.id || !callPeerId) return;

    let cancelled = false;
    let stopLocalDetector: (() => void) | null = null;

    (async () => {
      try {
        const wantsVideo = callType === 'video';
        const stream = await getUserMedia(wantsVideo, true);
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        localStreamRef.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
        setMediaReady(true);

        stopLocalDetector = detectSpeaking(stream, setLocalSpeaking);

        const pc = createPeerConnection(callChatId, user.id, callPeerId);
        pcRef.current = pc;

        stream.getTracks().forEach((track) => pc.addTrack(track, stream));

        pc.ontrack = (e) => {
          const incomingStream = e.streams[0];
          if (!incomingStream) return;

          setHasRemoteStream(true);
          if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = incomingStream;
          }
          if (remoteAudioRef.current) {
            remoteAudioRef.current.srcObject = incomingStream;
            void remoteAudioRef.current.play().catch(() => undefined);
          }

          const stopRemoteDetector = detectSpeaking(incomingStream, setRemoteSpeaking);
          incomingStream.getTracks().forEach((track) => {
            track.onended = () => {
              stopRemoteDetector();
              setRemoteSpeaking(false);
            };
          });
        };

        if (isCallInitiator) {
          const offer = await createOffer(pc);
          wsService.send('rtc:signal', {
            type: 'offer',
            chatId: callChatId,
            fromUserId: user.id,
            toUserId: callPeerId,
            payload: offer,
            callType,
          });
        }
      } catch (err: any) {
        if (!cancelled) setMediaError(err?.message || 'No se pudo acceder a los medios');
      }
    })();

    return () => {
      cancelled = true;
      stopLocalDetector?.();
    };
  }, [inCall, callType, callChatId, callPeerId, user?.id, isCallInitiator, detectSpeaking]);

  useEffect(() => {
    if (!inCall || !callChatId || !user?.id) return;

    const offRtcSignal = wsService.on('rtc:signal', async (signal: any) => {
      if (!pcRef.current) return;
      if (signal?.chatId !== callChatId) return;
      if (signal?.fromUserId === user.id) return;

      try {
        if (signal.type === 'offer' && signal.payload?.type === 'offer') {
          const answer = await createAnswer(pcRef.current, signal.payload);
          wsService.send('rtc:signal', {
            type: 'answer',
            chatId: callChatId,
            fromUserId: user.id,
            toUserId: signal.fromUserId,
            payload: answer,
          });
          return;
        }

        if (signal.type === 'answer' && signal.payload?.type === 'answer') {
          await pcRef.current.setRemoteDescription(new RTCSessionDescription(signal.payload));
          return;
        }

        if (signal.type === 'ice' && signal.payload) {
          await pcRef.current.addIceCandidate(new RTCIceCandidate(signal.payload));
          return;
        }

        if (signal.type === 'end') {
          handleEndCall();
        }
      } catch (error) {
        setMediaError(error instanceof Error ? error.message : 'Error de señalización RTC');
      }
    });

    return () => offRtcSignal();
  }, [inCall, callChatId, user?.id, handleEndCall]);

  const toggleMic = useCallback(() => {
    localStreamRef.current?.getAudioTracks().forEach((t) => { t.enabled = !t.enabled; });
    setMicOn((p) => !p);
  }, []);

  const toggleCam = useCallback(() => {
    localStreamRef.current?.getVideoTracks().forEach((t) => { t.enabled = !t.enabled; });
    setCamOn((p) => !p);
  }, []);

  const toggleScreen = useCallback(async () => {
    if (screenSharing) {
      screenStreamRef.current?.getTracks().forEach((t) => t.stop());
      screenStreamRef.current = null;
      setScreenSharing(false);
      if (localStreamRef.current && localVideoRef.current) {
        localVideoRef.current.srcObject = localStreamRef.current;
      }
      return;
    }

    try {
      const screen = await getDisplayMedia();
      screenStreamRef.current = screen;
      if (localVideoRef.current) localVideoRef.current.srcObject = screen;
      setScreenSharing(true);

      const sender = pcRef.current?.getSenders().find((s) => s.track?.kind === 'video');
      const screenTrack = screen.getVideoTracks()[0];
      if (sender && screenTrack) {
        await sender.replaceTrack(screenTrack);
      }

      screenTrack.onended = async () => {
        setScreenSharing(false);
        if (localStreamRef.current && localVideoRef.current) {
          localVideoRef.current.srcObject = localStreamRef.current;
        }
        const localTrack = localStreamRef.current?.getVideoTracks()[0];
        const videoSender = pcRef.current?.getSenders().find((s) => s.track?.kind === 'video');
        if (videoSender && localTrack) {
          await videoSender.replaceTrack(localTrack);
        }
      };
    } catch {
      // Usuario canceló
    }
  }, [screenSharing]);

  if (!inCall || !chatForCall) return null;

  const isVideo = callType === 'video';

  return (
    <div className="fixed inset-0 z-50 bg-call-bg flex flex-col animate-fade-in">
      <audio ref={remoteAudioRef} autoPlay playsInline />

      <div className="absolute top-0 left-0 right-0 h-16 px-6 flex items-center justify-between z-10 bg-gradient-to-b from-black/40 to-transparent">
        <div>
          <h2 className="text-sm font-semibold text-call-foreground">{chatForCall.title}</h2>
          <p className="text-xs text-call-foreground/60">
            {isVideo ? 'Videollamada' : 'Llamada de voz'} · {chatForCall.members.length} participante{chatForCall.members.length !== 1 ? 's' : ''}
          </p>
        </div>
        {mediaError && (
          <span className="text-xs bg-destructive/80 text-destructive-foreground px-3 py-1 rounded-full">
            {mediaError}
          </span>
        )}
      </div>

      {isVideo ? (
        <div className="flex-1 flex items-center justify-center relative">
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover"
          />

          {!hasRemoteStream && (
            <div className="absolute inset-0 flex flex-wrap gap-4 justify-center items-center p-8">
              {chatForCall.members.map((m) => (
                <div
                  key={m.id}
                  className="w-56 h-44 rounded-2xl bg-call-muted flex flex-col items-center justify-center gap-3"
                >
                  <div className={`w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center text-primary text-2xl font-bold ${remoteSpeaking && m.id !== user?.id ? 'ring-4 ring-green-500/70' : ''}`}>
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

          <div className={`absolute bottom-24 right-6 w-40 h-32 rounded-xl overflow-hidden border-2 shadow-2xl bg-call-muted ${localSpeaking && micOn ? 'border-green-500' : 'border-white/20'}`}>
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
        <div className="flex-1 flex flex-wrap gap-6 justify-center items-center p-12">
          {chatForCall.members.map((m) => {
            const isLocalUser = m.id === user?.id;
            const speaking = isLocalUser ? localSpeaking && micOn : remoteSpeaking;
            return (
              <div
                key={m.id}
                className="flex flex-col items-center gap-3"
              >
                <div className={`w-24 h-24 rounded-full bg-primary/20 flex items-center justify-center text-primary text-3xl font-bold ring-4 ${speaking ? 'ring-green-500' : 'ring-primary/20'} transition-colors`}>
                  {m.displayName.charAt(0)}
                </div>
                <span className="text-call-foreground text-sm font-medium">{m.displayName}</span>
                <span className="text-call-foreground/50 text-xs">
                  {isLocalUser ? (micOn ? (localSpeaking ? '🟢 Hablando' : '🎙 Micrófono activo') : '🔇 Silenciado') : (remoteSpeaking ? '🟢 Hablando' : 'En llamada')}
                </span>
              </div>
            );
          })}
        </div>
      )}

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

function CtrlBtn({
  children, onClick, danger, accent, label,
}: {
  children: ReactNode;
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

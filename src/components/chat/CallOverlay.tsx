import { useApp } from '@/contexts/AppContext';
import { useEffect, useMemo, useRef, useState, useCallback, type ReactNode } from 'react';
import { Mic, MicOff, Video, VideoOff, PhoneOff, Monitor, MonitorOff } from 'lucide-react';
import { getUserMedia, getDisplayMedia, createPeerConnection } from '@/services/rtc';
import { wsService } from '@/services/websocket';

const VOICE_THRESHOLD = 0.045;

type RemoteStreamMap = Record<string, MediaStream>;
type SpeakingMap = Record<string, boolean>;

export default function CallOverlay() {
  const { inCall, endCall, activeChat, chats, callType, user, callChatId, isCallInitiator } = useApp();

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const pcsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const speakingCleanupRef = useRef<Map<string, () => void>>(new Map());

  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [screenSharing, setScreenSharing] = useState(false);
  const [mediaReady, setMediaReady] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<RemoteStreamMap>({});
  const [speakingByUser, setSpeakingByUser] = useState<SpeakingMap>({});

  const chatForCall = activeChat?.id === callChatId
    ? activeChat
    : chats.find((chat) => chat.id === callChatId) || null;

  const peers = useMemo(
    () => (chatForCall?.members.filter((m) => m.id !== user?.id) ?? []),
    [chatForCall?.members, user?.id],
  );

  const detectSpeaking = useCallback((userId: string, stream: MediaStream) => {
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
      setSpeakingByUser((prev) => ({ ...prev, [userId]: average > VOICE_THRESHOLD }));
      rafId = requestAnimationFrame(tick);
    };

    tick();

    const cleanup = () => {
      cancelAnimationFrame(rafId);
      source.disconnect();
      analyser.disconnect();
      void audioCtx.close();
      setSpeakingByUser((prev) => ({ ...prev, [userId]: false }));
    };

    speakingCleanupRef.current.get(userId)?.();
    speakingCleanupRef.current.set(userId, cleanup);

    return cleanup;
  }, []);

  const attachRemoteStream = useCallback((peerId: string, stream: MediaStream) => {
    setRemoteStreams((prev) => ({ ...prev, [peerId]: stream }));
    detectSpeaking(peerId, stream);
  }, [detectSpeaking]);

  const ensurePeerConnection = useCallback((peerId: string) => {
    const existing = pcsRef.current.get(peerId);
    if (existing) return existing;
    if (!callChatId || !user?.id) return null;

    const pc = createPeerConnection(callChatId, user.id, peerId);
    pcsRef.current.set(peerId, pc);

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => pc.addTrack(track, localStreamRef.current!));
    }

    pc.ontrack = (e) => {
      const incomingStream = e.streams[0];
      if (!incomingStream) return;
      attachRemoteStream(peerId, incomingStream);

      incomingStream.getTracks().forEach((track) => {
        track.onended = () => {
          setRemoteStreams((prev) => {
            const next = { ...prev };
            delete next[peerId];
            return next;
          });
          speakingCleanupRef.current.get(peerId)?.();
          speakingCleanupRef.current.delete(peerId);
        };
      });
    };

    return pc;
  }, [attachRemoteStream, callChatId, user?.id]);

  const closeAllPeerConnections = useCallback(() => {
    pcsRef.current.forEach((pc) => pc.close());
    pcsRef.current.clear();
  }, []);

  const handleEndCall = useCallback(() => {
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    screenStreamRef.current?.getTracks().forEach((t) => t.stop());
    closeAllPeerConnections();
    speakingCleanupRef.current.forEach((cleanup) => cleanup());
    speakingCleanupRef.current.clear();

    localStreamRef.current = null;
    screenStreamRef.current = null;

    setMediaReady(false);
    setMediaError(null);
    setScreenSharing(false);
    setCamOn(true);
    setMicOn(true);
    setRemoteStreams({});
    setSpeakingByUser({});

    endCall();
  }, [closeAllPeerConnections, endCall]);

  useEffect(() => {
    if (!inCall || !callChatId || !user?.id) return;

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
        detectSpeaking(user.id, stream);

        peers.forEach((peer) => {
          ensurePeerConnection(peer.id);
        });

        if (isCallInitiator) {
          for (const peer of peers) {
            const pc = ensurePeerConnection(peer.id);
            if (!pc) continue;
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            wsService.send('rtc:signal', {
              type: 'offer',
              chatId: callChatId,
              fromUserId: user.id,
              toUserId: peer.id,
              payload: offer,
              callType,
            });
          }
        }
      } catch (err: any) {
        if (!cancelled) setMediaError(err?.message || 'No se pudo acceder a los medios');
      }
    })();

    return () => {
      cancelled = true;
      stopLocalDetector?.();
    };
  }, [inCall, callType, callChatId, user?.id, isCallInitiator, peers, ensurePeerConnection, detectSpeaking]);

  useEffect(() => {
    if (!inCall || !callChatId || !user?.id) return;

    const offRtcSignal = wsService.on('rtc:signal', async (signal: any) => {
      if (signal?.chatId !== callChatId) return;
      if (signal?.fromUserId === user.id) return;

      const peerId = signal?.fromUserId;
      if (!peerId) return;

      try {
        if (signal.type === 'offer' && signal.payload?.type === 'offer') {
          const pc = ensurePeerConnection(peerId);
          if (!pc) return;
          await pc.setRemoteDescription(new RTCSessionDescription(signal.payload));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);

          wsService.send('rtc:signal', {
            type: 'answer',
            chatId: callChatId,
            fromUserId: user.id,
            toUserId: peerId,
            payload: answer,
          });
          return;
        }

        if (signal.type === 'answer' && signal.payload?.type === 'answer') {
          const pc = ensurePeerConnection(peerId);
          if (!pc) return;
          await pc.setRemoteDescription(new RTCSessionDescription(signal.payload));
          return;
        }

        if (signal.type === 'ice' && signal.payload) {
          const pc = ensurePeerConnection(peerId);
          if (!pc) return;
          await pc.addIceCandidate(new RTCIceCandidate(signal.payload));
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
  }, [inCall, callChatId, user?.id, ensurePeerConnection, handleEndCall]);

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

      const localTrack = localStreamRef.current?.getVideoTracks()[0];
      if (localTrack) {
        for (const pc of pcsRef.current.values()) {
          const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
          if (sender) {
            await sender.replaceTrack(localTrack);
          }
        }
      }
      return;
    }

    try {
      const screen = await getDisplayMedia();
      screenStreamRef.current = screen;
      if (localVideoRef.current) localVideoRef.current.srcObject = screen;
      setScreenSharing(true);

      const screenTrack = screen.getVideoTracks()[0];
      if (screenTrack) {
        for (const pc of pcsRef.current.values()) {
          const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
          if (sender) {
            await sender.replaceTrack(screenTrack);
          }
        }
      }

      screenTrack.onended = async () => {
        setScreenSharing(false);
        if (localStreamRef.current && localVideoRef.current) {
          localVideoRef.current.srcObject = localStreamRef.current;
        }
        const localTrack = localStreamRef.current?.getVideoTracks()[0];
        if (localTrack) {
          for (const pc of pcsRef.current.values()) {
            const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
            if (sender) {
              await sender.replaceTrack(localTrack);
            }
          }
        }
      };
    } catch {
      // Usuario canceló compartir
    }
  }, [screenSharing]);

  if (!inCall || !chatForCall) return null;

  const isVideo = callType === 'video';
  const remoteEntries = Object.entries(remoteStreams);
  const mainRemote = remoteEntries[0];

  return (
    <div className="fixed inset-0 z-50 bg-call-bg flex flex-col animate-fade-in">
      {remoteEntries.map(([peerId, stream]) => (
        <audio
          key={`audio-${peerId}`}
          autoPlay
          playsInline
          ref={(el) => {
            if (!el) return;
            if (el.srcObject !== stream) {
              el.srcObject = stream;
            }
          }}
        />
      ))}

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
          {mainRemote ? (
            <video
              autoPlay
              playsInline
              ref={(el) => {
                if (!el) return;
                if (el.srcObject !== mainRemote[1]) {
                  el.srcObject = mainRemote[1];
                }
              }}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 flex flex-wrap gap-4 justify-center items-center p-8">
              {chatForCall.members.map((m) => (
                <div key={m.id} className="w-56 h-44 rounded-2xl bg-call-muted flex flex-col items-center justify-center gap-3">
                  <div className={`w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center text-primary text-2xl font-bold ${speakingByUser[m.id] ? 'ring-4 ring-green-500/70' : ''}`}>
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

          <div className="absolute top-20 right-6 max-w-[220px] max-h-[55vh] overflow-y-auto space-y-3 scrollbar-thin">
            {remoteEntries.slice(1).map(([peerId, stream]) => {
              const peer = chatForCall.members.find((m) => m.id === peerId);
              return (
                <div key={`remote-mini-${peerId}`} className="rounded-xl overflow-hidden border border-white/20 bg-black/20">
                  <video
                    autoPlay
                    playsInline
                    muted
                    ref={(el) => {
                      if (!el) return;
                      if (el.srcObject !== stream) {
                        el.srcObject = stream;
                      }
                    }}
                    className="w-40 h-28 object-cover"
                  />
                  <p className={`text-xs px-2 py-1 ${speakingByUser[peerId] ? 'text-green-300' : 'text-call-foreground/80'}`}>
                    {peer?.displayName || 'Participante'}
                  </p>
                </div>
              );
            })}
          </div>

          <div className={`absolute bottom-24 right-6 w-40 h-32 rounded-xl overflow-hidden border-2 shadow-2xl bg-call-muted ${speakingByUser[user?.id || ''] && micOn ? 'border-green-500' : 'border-white/20'}`}>
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
            const speaking = isLocalUser ? speakingByUser[m.id] && micOn : speakingByUser[m.id];
            return (
              <div key={m.id} className="flex flex-col items-center gap-3">
                <div className={`w-24 h-24 rounded-full bg-primary/20 flex items-center justify-center text-primary text-3xl font-bold ring-4 ${speaking ? 'ring-green-500' : 'ring-primary/20'} transition-colors`}>
                  {m.displayName.charAt(0)}
                </div>
                <span className="text-call-foreground text-sm font-medium">{m.displayName}</span>
                <span className="text-call-foreground/50 text-xs">
                  {isLocalUser ? (micOn ? (speaking ? '🟢 Hablando' : '🎙 Micrófono activo') : '🔇 Silenciado') : (speaking ? '🟢 Hablando' : 'En llamada')}
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

function CtrlBtn({ children, onClick, danger, accent, label }: {
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

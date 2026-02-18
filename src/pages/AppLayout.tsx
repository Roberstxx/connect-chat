import { useState, useEffect } from 'react';
import { useApp } from '@/contexts/AppContext';
import ChatSidebar from '@/components/chat/ChatSidebar';
import ChatHeader from '@/components/chat/ChatHeader';
import MessageList from '@/components/chat/MessageList';
import MessageInput from '@/components/chat/MessageInput';
import CallOverlay from '@/components/chat/CallOverlay';
import GroupModal from '@/components/chat/GroupModal';
import GroupInfoPanel from '@/components/chat/GroupInfoPanel';
import DirectInfoPanel from '@/components/chat/DirectInfoPanel';
import NewDirectChatModal from '@/components/chat/NewDirectChatModal';
import { MessageSquare, Phone, Video } from 'lucide-react';

export default function AppLayout() {
  const { activeChat, incomingCall, chats, allUsers, acceptIncomingCall, declineIncomingCall } = useApp();
  const [groupModal, setGroupModal] = useState(false);
  const [directModal, setDirectModal] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);

  // Close info panel when switching chats
  useEffect(() => {
    setInfoOpen(false);
  }, [activeChat?.id]);


  const incomingChat = incomingCall ? chats.find((chat) => chat.id === incomingCall.chatId) : null;
  const callerUser = incomingCall ? allUsers.find((u) => u.id === incomingCall.fromUserId) : null;

  return (
    <div className="h-screen flex bg-background relative">
      <ChatSidebar
        onNewGroup={() => setGroupModal(true)}
        onNewDirect={() => setDirectModal(true)}
      />

      <main className="flex-1 flex min-w-0">
        <div className="flex-1 flex flex-col min-w-0">
          {activeChat ? (
            <>
              <ChatHeader
                onToggleInfo={() => setInfoOpen((p) => !p)}
                infoOpen={infoOpen}
              />
              <MessageList />
              <MessageInput />
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
              <div className="w-20 h-20 rounded-3xl bg-primary/10 flex items-center justify-center mb-4">
                <MessageSquare className="w-10 h-10 text-primary" />
              </div>
              <h2 className="text-xl font-semibold text-foreground mb-2">Chat Local</h2>
              <p className="text-sm">Selecciona un chat para comenzar</p>
            </div>
          )}
        </div>

        {activeChat?.type === 'group' && (
          <GroupInfoPanel open={infoOpen} onClose={() => setInfoOpen(false)} />
        )}
        {activeChat?.type === 'direct' && (
          <DirectInfoPanel open={infoOpen} onClose={() => setInfoOpen(false)} />
        )}
      </main>


      {incomingCall && (
        <div className="absolute top-5 left-1/2 -translate-x-1/2 z-[60] rounded-2xl border border-border bg-card shadow-xl px-4 py-3 min-w-[320px]">
          <p className="text-sm font-semibold text-foreground">
            Llamada entrante {incomingCall.callType === 'video' ? 'de video' : 'de voz'}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {callerUser?.displayName || 'Usuario'} · {incomingChat?.title || 'Chat'}
          </p>
          <div className="flex gap-2 mt-3 justify-end">
            <button
              onClick={declineIncomingCall}
              className="px-3 py-2 rounded-lg text-sm bg-muted text-muted-foreground hover:opacity-80"
            >
              Rechazar
            </button>
            <button
              onClick={acceptIncomingCall}
              className="px-3 py-2 rounded-lg text-sm bg-primary text-primary-foreground flex items-center gap-1.5 hover:opacity-90"
            >
              {incomingCall.callType === 'video' ? <Video className="w-4 h-4" /> : <Phone className="w-4 h-4" />}
              Contestar
            </button>
          </div>
        </div>
      )}

      <CallOverlay />
      <GroupModal open={groupModal} onClose={() => setGroupModal(false)} />
      <NewDirectChatModal open={directModal} onClose={() => setDirectModal(false)} />
    </div>
  );
}

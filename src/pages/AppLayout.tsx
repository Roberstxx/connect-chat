import { useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import ChatSidebar from '@/components/chat/ChatSidebar';
import ChatHeader from '@/components/chat/ChatHeader';
import MessageList from '@/components/chat/MessageList';
import MessageInput from '@/components/chat/MessageInput';
import CallOverlay from '@/components/chat/CallOverlay';
import GroupModal from '@/components/chat/GroupModal';
import { MessageSquare } from 'lucide-react';

export default function AppLayout() {
  const { activeChat } = useApp();
  const [groupModal, setGroupModal] = useState(false);

  return (
    <div className="h-screen flex bg-background">
      <ChatSidebar onNewGroup={() => setGroupModal(true)} />

      <main className="flex-1 flex flex-col min-w-0">
        {activeChat ? (
          <>
            <ChatHeader />
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
      </main>

      <CallOverlay />
      <GroupModal open={groupModal} onClose={() => setGroupModal(false)} />
    </div>
  );
}

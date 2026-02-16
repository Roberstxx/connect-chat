import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { User, Chat, Message } from '@/types';
import { currentUser, mockChats, mockMessages, mockUsers } from '@/data/mock';

interface AppState {
  user: User | null;
  chats: Chat[];
  messages: Message[];
  activeChat: Chat | null;
  inCall: boolean;
  callChatId: string | null;
}

interface AppContextType extends AppState {
  login: (user: User) => void;
  logout: () => void;
  setActiveChat: (chat: Chat | null) => void;
  sendMessage: (chatId: string, content: string, kind?: Message['kind']) => void;
  startCall: (chatId: string) => void;
  endCall: () => void;
  createGroup: (title: string, description?: string) => void;
  allUsers: User[];
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>({
    user: null,
    chats: mockChats,
    messages: mockMessages,
    activeChat: null,
    inCall: false,
    callChatId: null,
  });

  const login = useCallback((user: User) => {
    setState((s) => ({ ...s, user }));
  }, []);

  const logout = useCallback(() => {
    setState((s) => ({ ...s, user: null, activeChat: null }));
  }, []);

  const setActiveChat = useCallback((chat: Chat | null) => {
    setState((s) => ({ ...s, activeChat: chat }));
  }, []);

  const sendMessage = useCallback((chatId: string, content: string, kind: Message['kind'] = 'text') => {
    const msg: Message = {
      id: `m${Date.now()}`,
      chatId,
      senderId: state.user?.id || 'u1',
      kind,
      content,
      createdAt: Date.now(),
    };
    setState((s) => ({
      ...s,
      messages: [...s.messages, msg],
      chats: s.chats.map((c) =>
        c.id === chatId ? { ...c, lastMessage: msg } : c
      ),
    }));
    // TODO: wsService.send('message:send', { chatId, kind, content });
  }, [state.user?.id]);

  const startCall = useCallback((chatId: string) => {
    setState((s) => ({ ...s, inCall: true, callChatId: chatId }));
  }, []);

  const endCall = useCallback(() => {
    setState((s) => ({ ...s, inCall: false, callChatId: null }));
  }, []);

  const createGroup = useCallback((title: string, description?: string) => {
    const newChat: Chat = {
      id: `c${Date.now()}`,
      type: 'group',
      title,
      description,
      members: [currentUser],
    };
    setState((s) => ({ ...s, chats: [...s.chats, newChat] }));
    // TODO: wsService.send('group:create', { title, description });
  }, []);

  return (
    <AppContext.Provider
      value={{
        ...state,
        login,
        logout,
        setActiveChat,
        sendMessage,
        startCall,
        endCall,
        createGroup,
        allUsers: mockUsers,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}

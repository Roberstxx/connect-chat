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
  createDirectChat: (targetUserId: string) => void;
  inviteToGroup: (groupId: string, userIds: string[]) => void;
  updateStatus: (status: User['status']) => void;
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
    const me = state.user || currentUser;
    const newChat: Chat = {
      id: `c${Date.now()}`,
      type: 'group',
      title,
      description,
      members: [me],
    };
    setState((s) => ({ ...s, chats: [...s.chats, newChat], activeChat: newChat }));
    // TODO: wsService.send('group:create', { title, description });
  }, [state.user]);

  const createDirectChat = useCallback((targetUserId: string) => {
    setState((s) => {
      const me = s.user || currentUser;
      // Check if direct chat already exists
      const existing = s.chats.find(
        (c) => c.type === 'direct' && c.members.some((m) => m.id === targetUserId)
      );
      if (existing) {
        return { ...s, activeChat: existing };
      }
      const targetUser = mockUsers.find((u) => u.id === targetUserId);
      if (!targetUser) return s;
      const newChat: Chat = {
        id: `c${Date.now()}`,
        type: 'direct',
        title: targetUser.displayName,
        members: [me, targetUser],
      };
      return { ...s, chats: [...s.chats, newChat], activeChat: newChat };
      // TODO: wsService.send('chat:createDirect', { userId: targetUserId });
    });
  }, []);

  const inviteToGroup = useCallback((groupId: string, userIds: string[]) => {
    setState((s) => {
      const usersToAdd = mockUsers.filter((u) => userIds.includes(u.id));
      const updatedChats = s.chats.map((c) => {
        if (c.id !== groupId) return c;
        const existingIds = new Set(c.members.map((m) => m.id));
        const newMembers = usersToAdd.filter((u) => !existingIds.has(u.id));
        return { ...c, members: [...c.members, ...newMembers] };
      });
      const updatedActive = s.activeChat?.id === groupId
        ? updatedChats.find((c) => c.id === groupId) || s.activeChat
        : s.activeChat;
      return { ...s, chats: updatedChats, activeChat: updatedActive };
      // TODO: wsService.send('group:invite', { groupId, userId }) for each
    });
  }, []);

  const updateStatus = useCallback((status: User['status']) => {
    setState((s) => {
      if (!s.user) return s;
      return { ...s, user: { ...s.user, status } };
      // TODO: wsService.send('presence:update', { status });
    });
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
        createDirectChat,
        inviteToGroup,
        updateStatus,
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

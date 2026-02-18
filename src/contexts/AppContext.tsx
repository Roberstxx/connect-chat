import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';
import { User, Chat, Message, CallType } from '@/types';
import { wsService } from '@/services/websocket';
import { connectWithToken, logoutAuth } from '@/services/auth';

interface AppState {
  user: User | null;
  chats: Chat[];
  messages: Message[];
  activeChat: Chat | null;
  inCall: boolean;
  callChatId: string | null;
  callType: CallType | null;
  callPeerId: string | null;
  isCallInitiator: boolean;
  incomingCall: {
    chatId: string;
    fromUserId: string;
    callType: CallType;
  } | null;
}

interface AppContextType extends AppState {
  login: (user: User) => Promise<void>;
  logout: () => void;
  setActiveChat: (chat: Chat | null) => void;
  sendMessage: (chatId: string, content: string, kind?: Message['kind']) => void;
  startCall: (chatId: string, type?: CallType) => void;
  endCall: () => void;
  acceptIncomingCall: () => void;
  declineIncomingCall: () => void;
  createGroup: (title: string, description?: string, memberIds?: string[]) => void;
  createDirectChat: (targetUserId: string) => void;
  inviteToGroup: (groupId: string, userIds: string[]) => void;
  updateStatus: (status: User['status']) => void;
  allUsers: User[];
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>({
    user: null,
    chats: [],
    messages: [],
    activeChat: null,
    inCall: false,
    callChatId: null,
    callType: null,
    callPeerId: null,
    isCallInitiator: false,
    incomingCall: null,
  });
  const [allUsers, setAllUsers] = useState<User[]>([]);

  const loadChats = useCallback(async () => {
    wsService.send('chat:list', {});
    const chats = await wsService.once<Chat[]>('chat:list', 12000);
    setState((s) => ({ ...s, chats, activeChat: s.activeChat ? chats.find((c) => c.id === s.activeChat!.id) || null : null }));
  }, []);

  const loadUsers = useCallback(async () => {
    wsService.send('user:list', {});
    const users = await wsService.once<User[]>('user:list', 12000);
    setAllUsers(users);
  }, []);

  const loadMessagesForChat = useCallback(async (chatId: string) => {
    wsService.send('message:list', { chatId, limit: 200 });
    const msgs = await wsService.once<Message[]>('message:list', 12000);
    setState((s) => ({
      ...s,
      messages: [...s.messages.filter((m) => m.chatId !== chatId), ...msgs],
    }));
  }, []);

  useEffect(() => {
    const offMessage = wsService.on('message:receive', (incoming: Message) => {
      setState((s) => {
        const deduped = s.messages.some((m) => m.id === incoming.id) ? s.messages : [...s.messages, incoming];
        return {
          ...s,
          messages: deduped,
          chats: s.chats.map((c) => (c.id === incoming.chatId ? { ...c, lastMessage: incoming } : c)),
        };
      });
    });

    const offPresence = wsService.on('presence:update', ({ userId, status }: { userId: string; status: User['status'] }) => {
      setAllUsers((users) => users.map((u) => (u.id === userId ? { ...u, status } : u)));
      setState((s) => ({
        ...s,
        chats: s.chats.map((chat) => ({
          ...chat,
          members: chat.members.map((member) => (member.id === userId ? { ...member, status } : member)),
        })),
      }));
    });

    const offChatCreated = wsService.on('chat:created', (chat: Chat) => {
      setState((s) => {
        if (s.chats.some((c) => c.id === chat.id)) {
          return { ...s, activeChat: chat };
        }
        return { ...s, chats: [chat, ...s.chats], activeChat: chat };
      });
    });

    const offChatUpdated = wsService.on('chat:updated', (chat: Chat) => {
      setState((s) => ({
        ...s,
        chats: s.chats.map((c) => (c.id === chat.id ? chat : c)),
        activeChat: s.activeChat?.id === chat.id ? chat : s.activeChat,
      }));
    });

    const offRtcSignal = wsService.on('rtc:signal', (signal: any) => {
      setState((s) => {
        if (signal?.type === 'offer' && signal?.payload?.kind === 'invite') {
          if (s.inCall) return s;
          return {
            ...s,
            incomingCall: {
              chatId: signal.chatId,
              fromUserId: signal.fromUserId,
              callType: signal.callType || 'audio',
            },
          };
        }

        if (signal?.type === 'end') {
          if (s.callChatId === signal.chatId || s.incomingCall?.chatId === signal.chatId) {
            return {
              ...s,
              inCall: false,
              callChatId: null,
              callType: null,
              callPeerId: null,
              isCallInitiator: false,
              incomingCall: null,
            };
          }
        }

        if (signal?.type === 'answer' && signal?.payload?.kind === 'accept' && s.callChatId === signal.chatId) {
          return {
            ...s,
            callPeerId: signal.fromUserId,
          };
        }

        return s;
      });
    });

    return () => {
      offMessage();
      offPresence();
      offChatCreated();
      offChatUpdated();
      offRtcSignal();
    };
  }, []);

  const login = useCallback(async (user: User) => {
    await connectWithToken();
    setState((s) => ({ ...s, user }));
    await Promise.all([loadUsers(), loadChats()]);
  }, [loadChats, loadUsers]);

  const logout = useCallback(() => {
    logoutAuth();
    setState({
      user: null,
      chats: [],
      messages: [],
      activeChat: null,
      inCall: false,
      callChatId: null,
      callType: null,
      callPeerId: null,
      isCallInitiator: false,
      incomingCall: null,
    });
    setAllUsers([]);
  }, []);

  const setActiveChat = useCallback((chat: Chat | null) => {
    setState((s) => ({ ...s, activeChat: chat }));
    if (chat) {
      void loadMessagesForChat(chat.id);
    }
  }, [loadMessagesForChat]);

  const sendMessage = useCallback((chatId: string, content: string, kind: Message['kind'] = 'text') => {
    wsService.send('message:send', { chatId, kind, content });
  }, []);

  const startCall = useCallback((chatId: string, type: CallType = 'video') => {
    const chat = state.chats.find((c) => c.id === chatId);
    const peers = chat?.members.filter((member) => member.id !== state.user?.id) || [];
    const primaryPeerId = peers[0]?.id || null;

    setState((s) => ({
      ...s,
      inCall: true,
      callChatId: chatId,
      callType: type,
      callPeerId: primaryPeerId,
      isCallInitiator: true,
      incomingCall: null,
    }));

    peers.forEach((peer) => {
      wsService.send('rtc:signal', {
        type: 'offer',
        chatId,
        fromUserId: state.user?.id,
        toUserId: peer.id,
        payload: { kind: 'invite' },
        callType: type,
      });
    });
  }, [state.chats, state.user?.id]);

  const endCall = useCallback(() => {
    if (state.callChatId && state.user?.id) {
      const chat = state.chats.find((c) => c.id === state.callChatId);
      const peers = chat?.members.filter((member) => member.id !== state.user?.id) || [];
      peers.forEach((peer) => {
        wsService.send('rtc:signal', {
          type: 'end',
          chatId: state.callChatId,
          fromUserId: state.user?.id,
          toUserId: peer.id,
          payload: null,
        });
      });
    }
    setState((s) => ({
      ...s,
      inCall: false,
      callChatId: null,
      callType: null,
      callPeerId: null,
      isCallInitiator: false,
      incomingCall: null,
    }));
  }, [state.callChatId, state.chats, state.user?.id]);

  const acceptIncomingCall = useCallback(() => {
    if (!state.incomingCall || !state.user) return;

    wsService.send('rtc:signal', {
      type: 'answer',
      chatId: state.incomingCall.chatId,
      fromUserId: state.user.id,
      toUserId: state.incomingCall.fromUserId,
      payload: { kind: 'accept' },
    });

    setState((s) => ({
      ...s,
      inCall: true,
      callChatId: s.incomingCall?.chatId || null,
      callType: s.incomingCall?.callType || null,
      callPeerId: s.incomingCall?.fromUserId || null,
      isCallInitiator: false,
      incomingCall: null,
    }));
  }, [state.incomingCall, state.user]);

  const declineIncomingCall = useCallback(() => {
    if (state.incomingCall && state.user) {
      wsService.send('rtc:signal', {
        type: 'end',
        chatId: state.incomingCall.chatId,
        fromUserId: state.user.id,
        toUserId: state.incomingCall.fromUserId,
        payload: { kind: 'decline' },
      });
    }
    setState((s) => ({ ...s, incomingCall: null }));
  }, [state.incomingCall, state.user]);

  const createGroup = useCallback((title: string, description?: string, memberIds: string[] = []) => {
    wsService.send('group:create', { title, description, memberIds });
  }, []);

  const createDirectChat = useCallback((targetUserId: string) => {
    wsService.send('chat:createDirect', { userId: targetUserId });
  }, []);

  const inviteToGroup = useCallback((groupId: string, userIds: string[]) => {
    wsService.send('group:invite', { groupId, userIds });
  }, []);

  const updateStatus = useCallback((status: User['status']) => {
    wsService.send('presence:update', { status });
    setState((s) => (s.user ? { ...s, user: { ...s.user, status } } : s));
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
        acceptIncomingCall,
        declineIncomingCall,
        createGroup,
        createDirectChat,
        inviteToGroup,
        updateStatus,
        allUsers,
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

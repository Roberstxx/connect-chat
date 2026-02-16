import { useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { X, Search } from 'lucide-react';
import StatusDot from './StatusDot';

interface NewDirectChatModalProps {
  open: boolean;
  onClose: () => void;
}

export default function NewDirectChatModal({ open, onClose }: NewDirectChatModalProps) {
  const { allUsers, user, createDirectChat, chats } = useApp();
  const [search, setSearch] = useState('');

  if (!open) return null;

  const available = allUsers
    .filter((u) => u.id !== user?.id)
    .filter((u) => u.displayName.toLowerCase().includes(search.toLowerCase()) || u.username.toLowerCase().includes(search.toLowerCase()));

  const handleSelect = (userId: string) => {
    createDirectChat(userId);
    setSearch('');
    onClose();
  };

  // Check if direct chat already exists with user
  const hasExisting = (userId: string) =>
    chats.some((c) => c.type === 'direct' && c.members.some((m) => m.id === userId));

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-background/80 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md bg-card border border-border rounded-2xl p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-foreground">Nuevo chat</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors" aria-label="Cerrar">
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar usuario..."
            className="w-full pl-9 pr-4 py-2.5 rounded-lg bg-muted border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-all"
            aria-label="Buscar usuario"
            autoFocus
          />
        </div>

        <div className="max-h-72 overflow-y-auto scrollbar-thin space-y-1">
          {available.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No se encontraron usuarios</p>
          ) : (
            available.map((u) => (
              <button
                key={u.id}
                onClick={() => handleSelect(u.id)}
                className="w-full flex items-center gap-3 p-3 rounded-xl text-left hover:bg-muted transition-colors"
              >
                <div className="relative">
                  <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-sm font-semibold text-primary">
                    {u.displayName.charAt(0)}
                  </div>
                  <StatusDot status={u.status} className="absolute -bottom-0.5 -right-0.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{u.displayName}</p>
                  <p className="text-xs text-muted-foreground">@{u.username}</p>
                </div>
                {hasExisting(u.id) && (
                  <span className="text-xs text-muted-foreground px-2 py-1 rounded-md bg-muted">Existente</span>
                )}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

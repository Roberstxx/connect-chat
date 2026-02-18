import React, { useState, useRef } from 'react';
import { useApp } from '@/contexts/AppContext';
import { Send, Smile, Sparkles } from 'lucide-react';

const EMOJI_LIBRARY = {
  favoritos: ['😀', '😂', '❤️', '👍', '🔥', '🎉', '😎', '🙌', '💯', '🤔', '😢', '👋'],
  personas: ['😊', '😁', '😅', '😉', '😍', '😘', '😴', '🤗', '🤩', '🤝', '🙏', '🫶', '😇', '🤯', '🥳', '😭'],
  reaccion: ['✅', '❌', '⚠️', '👏', '👌', '💪', '🫡', '👀', '🤨', '😡', '😱', '😬', '🤭', '😮‍💨', '😴', '🤒'],
  trabajo: ['💻', '📌', '📅', '📎', '🧠', '✍️', '📢', '🔔', '📊', '📈', '🧩', '📦', '⚙️', '🛠️', '🔒', '🧾'],
  fiesta: ['🥳', '🎊', '🎈', '🍕', '🍔', '🍩', '☕', '🍺', '🎮', '🎵', '🎬', '🏆', '⚽', '🏀', '🚀', '🌟'],
};

const EMOJI_SECTIONS = Object.entries(EMOJI_LIBRARY);

export default function MessageInput() {
  const { activeChat, sendMessage } = useApp();
  const [text, setText] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const [activeSection, setActiveSection] = useState<(typeof EMOJI_SECTIONS)[number][0]>('favoritos');
  const inputRef = useRef<HTMLInputElement>(null);

  if (!activeChat) return null;

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    sendMessage(activeChat.id, trimmed);
    setText('');
    setShowEmoji(false);
    inputRef.current?.focus();
  };

  const handleEmoji = (emoji: string) => {
    sendMessage(activeChat.id, emoji, 'emoji');
    setShowEmoji(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="relative px-4 py-3 border-t border-border bg-card shrink-0">
      {showEmoji && (
        <div className="absolute bottom-full left-4 mb-2 w-[min(92vw,430px)] p-3 bg-popover border border-border rounded-xl shadow-lg animate-fade-in">
          <div className="flex items-center gap-2 mb-2 overflow-x-auto scrollbar-thin pb-1">
            {EMOJI_SECTIONS.map(([section, emojis]) => (
              <button
                key={section}
                onClick={() => setActiveSection(section)}
                className={`px-2.5 py-1 rounded-lg text-xs whitespace-nowrap transition-colors ${activeSection === section ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'}`}
              >
                {section} {emojis[0]}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-8 gap-1.5 max-h-44 overflow-y-auto scrollbar-thin pr-1">
            {EMOJI_LIBRARY[activeSection].map((emoji) => (
              <button
                key={`${activeSection}-${emoji}`}
                onClick={() => handleEmoji(emoji)}
                className="text-xl hover:scale-125 transition-transform p-1"
                aria-label={`Emoji ${emoji}`}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setShowEmoji(!showEmoji)}
          className={`p-2.5 rounded-lg transition-colors ${showEmoji ? 'bg-primary/10 text-primary' : 'hover:bg-muted text-muted-foreground'}`}
          aria-label="Emojis"
        >
          {showEmoji ? <Sparkles className="w-5 h-5" /> : <Smile className="w-5 h-5" />}
        </button>
        <input
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Escribe un mensaje..."
          className="flex-1 px-4 py-2.5 rounded-xl bg-muted border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-all"
          aria-label="Mensaje"
        />
        <button
          onClick={handleSend}
          disabled={!text.trim()}
          className="p-2.5 rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-40"
          aria-label="Enviar mensaje"
        >
          <Send className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}

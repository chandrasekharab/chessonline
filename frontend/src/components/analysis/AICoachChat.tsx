/**
 * AICoachChat
 * Full-featured chat with the AI chess coach, contextualised to the current move.
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { explanationApi, getErrorMessage } from '../../services/api';
import type { ChatMessage, CoachChatContext, AnalysisMove } from '../../types';
import { Send, Sparkles, User, RefreshCw, Trash2 } from 'lucide-react';

// ── helpers ──────────────────────────────────────────────────────────────────
let _idCounter = 0;
const uid = () => `msg-${++_idCounter}-${Date.now()}`;

const LABEL_COLOR: Record<string, string> = {
  blunder: '#ef4444', mistake: '#f97316', missed_win: '#a855f7',
  inaccuracy: '#eab308', good: '#22c55e', best: '#3b82f6',
  excellent: '#10b981', book: '#64748b',
};

const SUGGESTED: string[] = [
  'Why was this a bad move?',
  'What should I have played instead?',
  'Explain the best move',
  'How can I improve my tactics?',
  'What is the main idea here?',
];

// ── component ────────────────────────────────────────────────────────────────
interface Props {
  gameId: string;
  gamePlayers?: string;
  gameEvent?: string;
  currentMove: AnalysisMove | null;
}

export default function AICoachChat({ gameId, gamePlayers, gameEvent, currentMove }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: uid(),
      role: 'assistant',
      content: 'Hi! I\'m your AI chess coach. Select a move on the board and ask me anything about it — why it was good or bad, what the better option was, or any chess concept you want to understand.',
      timestamp: Date.now(),
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);

  // Inject a system note when the selected move changes
  const prevMoveRef = useRef<string | null>(null);
  useEffect(() => {
    if (!currentMove) return;
    const key = `${currentMove.move_number}-${currentMove.move}`;
    if (key === prevMoveRef.current) return;
    prevMoveRef.current = key;
    setMessages((prev) => [
      ...prev,
      {
        id: uid(),
        role: 'system',
        content: `Move ${currentMove.move_number}: **${currentMove.move}** (${currentMove.label.replace(/_/g, ' ')})`,
        timestamp: Date.now(),
      },
    ]);
  }, [currentMove]);

  const buildContext = useCallback((): CoachChatContext => ({
    players: gamePlayers,
    event: gameEvent,
    currentMove: currentMove?.move,
    moveNumber: currentMove?.move_number,
    label: currentMove?.label,
    eval_before: currentMove?.eval_before ?? undefined,
    eval_after: currentMove?.eval_after ?? undefined,
    best_move: currentMove?.best_move ?? undefined,
  }), [gamePlayers, gameEvent, currentMove]);

  const send = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const userMsg: ChatMessage = { id: uid(), role: 'user', content: trimmed, timestamp: Date.now() };
    const pendingMsg: ChatMessage = { id: uid(), role: 'assistant', content: '', timestamp: Date.now(), pending: true };

    setMessages((prev) => [...prev, userMsg, pendingMsg]);
    setInput('');
    setLoading(true);

    // build history (only real user/assistant turns, max last 10 turns = 20 msgs)
    const history = messages
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .slice(-20)
      .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));

    try {
      const { data } = await explanationApi.chat(gameId, trimmed, history, buildContext());
      setMessages((prev) =>
        prev.map((m) => m.id === pendingMsg.id
          ? { ...m, content: data.reply, pending: false }
          : m,
        ),
      );
    } catch (err) {
      const errText = getErrorMessage(err);
      setMessages((prev) =>
        prev.map((m) => m.id === pendingMsg.id
          ? { ...m, content: `Sorry, I couldn't respond: ${errText}`, pending: false }
          : m,
        ),
      );
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }, [loading, messages, gameId, buildContext]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  };

  const clearChat = () => {
    prevMoveRef.current = null;
    setMessages([{
      id: uid(), role: 'assistant',
      content: 'Chat cleared. Select a move and ask me anything!',
      timestamp: Date.now(),
    }]);
  };

  return (
    <div style={S.root}>
      {/* Context bar */}
      {currentMove && (
        <div style={S.contextBar}>
          <span style={{ color: 'var(--text-5)', fontSize: 10 }}>Context:</span>
          <span style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--text-2)' }}>
            {currentMove.move_number}. {currentMove.move}
          </span>
          <span style={{
            ...S.labelPill,
            background: (LABEL_COLOR[currentMove.label] ?? 'var(--text-5)') + '20',
            color: LABEL_COLOR[currentMove.label] ?? 'var(--text-3)',
          }}>
            {currentMove.label.replace(/_/g, ' ')}
          </span>
          <button onClick={clearChat} style={S.clearBtn} title="Clear chat">
            <Trash2 size={11} />
          </button>
        </div>
      )}

      {/* Message thread */}
      <div style={S.thread}>
        {messages.map((msg) => {
          if (msg.role === 'system') return (
            <div key={msg.id} style={S.systemNote}>
              <span>📍 {parseBold(msg.content)}</span>
            </div>
          );
          const isUser = msg.role === 'user';
          return (
            <div key={msg.id} style={{ ...S.msgRow, justifyContent: isUser ? 'flex-end' : 'flex-start' }}>
              {!isUser && (
                <div style={S.avatarAI}>
                  <Sparkles size={11} style={{ color: '#818cf8' }} />
                </div>
              )}
              <div style={{
                ...S.bubble,
                ...(isUser ? S.bubbleUser : S.bubbleAI),
              }}>
                {msg.pending ? (
                  <TypingIndicator />
                ) : (
                  <span style={{ whiteSpace: 'pre-wrap', lineHeight: 1.55 }}>{msg.content}</span>
                )}
              </div>
              {isUser && (
                <div style={S.avatarUser}>
                  <User size={11} style={{ color: '#60a5fa' }} />
                </div>
              )}
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Suggestions (only if idle and no conversation yet) */}
      {messages.length <= 2 && !loading && (
        <div style={S.suggestions}>
          {SUGGESTED.map((s) => (
            <button key={s} style={S.suggestion} onClick={() => send(s)}>
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Input bar */}
      <div style={S.inputBar}>
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={currentMove ? `Ask about ${currentMove.move}…` : 'Ask the AI coach anything…'}
          style={S.textarea}
          rows={1}
          disabled={loading}
        />
        <button
          onClick={() => send(input)}
          disabled={loading || !input.trim()}
          style={{ ...S.sendBtn, ...(loading || !input.trim() ? S.sendBtnOff : {}) }}
          title="Send (Enter)"
        >
          {loading ? <RefreshCw size={15} style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={15} />}
        </button>
      </div>
      <p style={S.hint}>Enter to send · Shift+Enter for new line</p>
    </div>
  );
}

// ── Typing indicator ──────────────────────────────────────────────────────────
function TypingIndicator() {
  return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'center', padding: '2px 0' }}>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          style={{
            width: 6, height: 6, borderRadius: '50%',
            background: '#4f46e5',
            animation: 'bounce 1.2s infinite',
            animationDelay: `${i * 0.2}s`,
          }}
        />
      ))}
    </div>
  );
}

// Bold text parser (converts **text** to <strong>)
function parseBold(text: string) {
  const parts = text.split(/\*\*(.*?)\*\*/g);
  return parts.map((part, i) =>
    i % 2 === 1 ? <strong key={i}>{part}</strong> : part,
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const S: Record<string, React.CSSProperties> = {
  root:    { display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' },

  contextBar: {
    display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap',
    padding: '6px 12px', background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)',
    flexShrink: 0,
  },
  labelPill: {
    fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 8,
    textTransform: 'uppercase', letterSpacing: '0.04em',
  },
  clearBtn: {
    marginLeft: 'auto', display: 'flex', alignItems: 'center',
    background: 'transparent', border: 'none', color: 'var(--text-5)',
    cursor: 'pointer', padding: 2,
  },

  thread: {
    flex: 1, overflowY: 'auto', padding: '12px 10px',
    display: 'flex', flexDirection: 'column', gap: 8,
  },
  systemNote: {
    alignSelf: 'center', padding: '3px 12px',
    background: 'var(--bg-surface)', border: '1px solid var(--border-mid)',
    borderRadius: 20, fontSize: 11, color: 'var(--text-5)',
  },
  msgRow:  { display: 'flex', alignItems: 'flex-end', gap: 6 },
  avatarAI: {
    width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
    background: 'linear-gradient(135deg,#312e81,#1e1b4b)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  avatarUser: {
    width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
    background: '#0c2340', border: '1px solid #1e3a5f',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  bubble:     { maxWidth: '80%', borderRadius: 12, padding: '8px 12px', fontSize: 13 },
  bubbleAI:   { background: 'var(--bg-surface)', border: '1px solid var(--border-mid)', color: 'var(--text-2)', borderBottomLeftRadius: 3 },
  bubbleUser: { background: '#1e3a5f', border: '1px solid #2563eb33', color: '#e2e8f0', borderBottomRightRadius: 3 },

  suggestions: {
    padding: '0 10px 8px', display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0,
  },
  suggestion: {
    background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-5)',
    borderRadius: 7, padding: '6px 10px', fontSize: 11, cursor: 'pointer', textAlign: 'left',
    transition: 'border-color 0.15s, color 0.15s',
  },

  inputBar: {
    display: 'flex', alignItems: 'flex-end', gap: 8,
    padding: '8px 10px', borderTop: '1px solid var(--border)',
    background: 'var(--bg-drawer)', flexShrink: 0,
  },
  textarea: {
    flex: 1, background: 'var(--bg-surface)', border: '1px solid var(--border-mid)',
    borderRadius: 9, color: 'var(--text-2)', fontSize: 13, padding: '8px 10px',
    resize: 'none', outline: 'none', fontFamily: 'inherit',
    lineHeight: 1.5, maxHeight: 100, overflowY: 'auto',
  },
  sendBtn: {
    width: 36, height: 36, borderRadius: 9, border: 'none',
    background: '#2563eb', color: '#fff',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', flexShrink: 0, transition: 'background 0.15s',
  },
  sendBtnOff: { background: 'var(--bg-elevated)', color: 'var(--text-5)', cursor: 'not-allowed' },

  hint: { margin: 0, padding: '0 10px 6px', fontSize: 10, color: 'var(--border-mid)', flexShrink: 0 },
};

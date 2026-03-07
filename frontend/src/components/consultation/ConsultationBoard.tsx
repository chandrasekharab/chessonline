import { useEffect, useRef, useState } from 'react';
import { Chessboard } from 'react-chessboard';
import { Chess, Square } from 'chess.js';
import { useBoardThemeStore } from '../../store/boardThemeStore';
import { useConsultationStore } from '../../store/consultationStore';
import { useAuthStore } from '../../store/authStore';
import { getSocket } from '../../services/socket';
import { getErrorMessage } from '../../services/api';
import PlayerClock from '../live/PlayerClock';
import type {
  ConsultationMoveMadeEvent,
  ConsultationSuggestionsEvent,
  ConsultationChatMsgEvent,
  ConsultationGameOverEvent,
  ConsultationGame,
} from '../../types';
import toast from 'react-hot-toast';
import { Send, ThumbsUp, Play as PlayIcon, Copy, Users2, MessageSquare, Clock as ClockIcon } from 'lucide-react';

// ── Helpers ───────────────────────────────────────────────────────────────────

function isMyPiece(fen: string, square: Square, myColor: 'white' | 'black'): boolean {
  try {
    const chess = new Chess(fen);
    const piece = chess.get(square);
    if (!piece) return false;
    return (myColor === 'white' && piece.color === 'w') || (myColor === 'black' && piece.color === 'b');
  } catch { return false; }
}

function isPlayerTurn(fen: string, myColor: 'white' | 'black'): boolean {
  const turn = fen.split(' ')[1];
  return (myColor === 'white' && turn === 'w') || (myColor === 'black' && turn === 'b');
}

function isPromotion(fen: string, from: Square, to: Square): boolean {
  try {
    const chess = new Chess(fen);
    const piece = chess.get(from);
    if (!piece || piece.type !== 'p') return false;
    return (piece.color === 'w' && to[1] === '8') || (piece.color === 'b' && to[1] === '1');
  } catch { return false; }
}

function getLegalMoves(fen: string, square: Square): Square[] {
  try {
    const chess = new Chess(fen);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (chess.moves({ square, verbose: true }) as any[]).map((m) => m.to as Square);
  } catch { return []; }
}

// ── Lobby ─────────────────────────────────────────────────────────────────────

function ConsultationLobby({ userId }: { userId: string }) {
  const { setGame, setWaiting, onGameStarted } = useConsultationStore();
  const [timeControl, setTimeControl] = useState('rapid');
  const [joinCode, setJoinCode] = useState('');
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    const socket = getSocket();
    const onCreated = (data: { game: ConsultationGame }) => {
      setGame(data.game, 'white', userId);
      setWaiting(data.game.invite_code ?? '');
      setCreating(false);
    };
    const onStarted = (data: { game: ConsultationGame }) => {
      // Determine this user's side based on player IDs
      const side = (
        data.game.white_player1_id === userId || data.game.white_player2_id === userId
      ) ? 'white' as const : 'black' as const;
      setGame(data.game, side, userId);
      onGameStarted(data.game);
      setJoining(false);
    };
    socket.on('consultation:created', onCreated);
    socket.on('consultation:started', onStarted);
    return () => {
      socket.off('consultation:created', onCreated);
      socket.off('consultation:started', onStarted);
    };
  }, [userId, setGame, setWaiting, onGameStarted]);

  const create = () => {
    setCreating(true);
    try {
      getSocket().emit('consultation:create', { timeControl });
    } catch (err) { toast.error(getErrorMessage(err)); setCreating(false); }
  };

  const join = () => {
    if (!joinCode.trim()) { toast.error('Enter an invite code'); return; }
    setJoining(true);
    try {
      getSocket().emit('consultation:join', { inviteCode: joinCode.trim().toUpperCase() });
    } catch (err) { toast.error(getErrorMessage(err)); setJoining(false); }
  };

  return (
    <div style={S.lobby}>
      <h2 style={{ ...S.title, marginBottom: 24, fontSize: 20 }}>Consultation Chess</h2>
      <p style={{ ...S.muted, marginBottom: 24, textAlign: 'center' }}>
        Play 2v2 chess where teammates suggest and vote on moves together.
      </p>

      {/* Create game */}
      <div style={S.lobbyCard}>
        <h3 style={S.sectionTitle}>Create Game</h3>
        <label style={S.label}>Time Control
          <select style={S.input} value={timeControl} onChange={(e) => setTimeControl(e.target.value)}>
            <option value="bullet">Bullet (2+1)</option>
            <option value="blitz">Blitz (5+3)</option>
            <option value="rapid">Rapid (10+0)</option>
          </select>
        </label>
        <button onClick={create} disabled={creating} style={{ ...S.btnPrimary, marginTop: 12, width: '100%', justifyContent: 'center' }}>
          <Users2 size={15} style={{ marginRight: 6 }} />{creating ? 'Creating…' : 'Create Consultation Game'}
        </button>
      </div>

      {/* Join game */}
      <div style={S.lobbyCard}>
        <h3 style={S.sectionTitle}>Join Game</h3>
        <label style={S.label}>Invite Code
          <input style={S.input} value={joinCode} onChange={(e) => setJoinCode(e.target.value.toUpperCase())} placeholder="XXXXXXXX" maxLength={20} />
        </label>
        <button onClick={join} disabled={joining} style={{ ...S.btnPrimary, marginTop: 12, width: '100%', justifyContent: 'center' }}>
          {joining ? 'Joining…' : 'Join as Second Player'}
        </button>
      </div>
    </div>
  );
}

// ── Waiting Room ──────────────────────────────────────────────────────────────

function WaitingRoom({ inviteCode }: { inviteCode: string }) {
  const copy = () => { navigator.clipboard.writeText(inviteCode); toast.success('Invite code copied!'); };
  return (
    <div style={S.lobby}>
      <h2 style={{ ...S.title, marginBottom: 16 }}>Waiting for opponent…</h2>
      <p style={S.muted}>Share this invite code with your opponent team:</p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '20px 0' }}>
        <code style={S.code}>{inviteCode}</code>
        <button onClick={copy} style={S.btnGhost}><Copy size={14} style={{ marginRight: 4 }} />Copy</button>
      </div>
      <p style={S.muted}>Each team member should open this page and join using the code above.</p>
    </div>
  );
}

// ── Game Over Overlay ─────────────────────────────────────────────────────────

function GameOverBanner({ reason, winner, onLeave }: { reason: string; winner: string | null; onLeave: () => void }) {
  return (
    <div style={S.gameOverBanner}>
      <p style={{ fontWeight: 700, fontSize: 18, margin: '0 0 6px' }}>
        {winner === null ? 'Draw!' : winner === 'white' ? 'White Wins!' : 'Black Wins!'}
      </p>
      <p style={S.muted}>{reason}</p>
      <button onClick={onLeave} style={{ ...S.btnPrimary, marginTop: 12 }}>Leave</button>
    </div>
  );
}

// ── Suggestion Panel ──────────────────────────────────────────────────────────

function SuggestionPanel({ gameId, isMyTurn, isExecutor }: {
  gameId: string; mySide?: 'white' | 'black'; fen?: string;
  isMyTurn: boolean; isExecutor: boolean;
}) {
  const suggestions = useConsultationStore((s) => s.suggestions);
  const [uci, setUci] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const suggestMove = () => {
    const trimmed = uci.trim().toLowerCase();
    if (!trimmed) return;
    setSubmitting(true);
    getSocket().emit('consultation:suggest', { gameId, uci: trimmed }, (res: { error?: string }) => {
      if (res?.error) toast.error(res.error);
      else { setUci(''); toast.success('Move suggested!'); }
      setSubmitting(false);
    });
  };

  const vote = (suggestionId: string) => {
    getSocket().emit('consultation:vote', { gameId, suggestionId });
  };

  const execute = (suggestionId: string) => {
    getSocket().emit('consultation:execute', { gameId, suggestionId }, (res: { error?: string }) => {
      if (res?.error) toast.error(res.error);
    });
  };

  return (
    <div style={S.panel}>
      <div style={S.panelTitle}><ThumbsUp size={14} style={{ marginRight: 6 }} />Move Suggestions</div>

      {isMyTurn && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
          <input value={uci} onChange={(e) => setUci(e.target.value)} style={{ ...S.input, flex: 1, marginTop: 0, fontSize: 12 }}
            placeholder="UCI (e.g. e2e4)" maxLength={6} />
          <button onClick={suggestMove} disabled={submitting || !uci.trim()} style={{ ...S.btnPrimary, padding: '6px 10px', fontSize: 12 }}>
            <Send size={12} />
          </button>
        </div>
      )}

      {suggestions.length === 0 && <p style={S.muted}>No suggestions yet.</p>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {suggestions.map((s) => (
          <div key={s.id} style={S.suggestionRow}>
            <span style={{ flex: 1, fontSize: 13, fontFamily: 'monospace', color: 'var(--text-1)' }}>{s.san ?? s.uci}</span>
            <span style={{ fontSize: 11, color: 'var(--text-3)', marginRight: 8 }}>{s.votes} vote{s.votes !== 1 ? 's' : ''}</span>
            {isMyTurn && !isExecutor && (
              <button onClick={() => vote(s.id)} style={{ ...S.btnGhost, padding: '3px 8px', fontSize: 11 }}>
                <ThumbsUp size={11} style={{ marginRight: 3 }} />Vote
              </button>
            )}
            {isExecutor && (
              <button onClick={() => execute(s.id)} style={{ ...S.btnPrimary, padding: '3px 8px', fontSize: 11 }}>
                <PlayIcon size={11} style={{ marginRight: 3 }} />Play
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Chat Panel ────────────────────────────────────────────────────────────────

function ChatPanel({ gameId, mySide }: { gameId: string; mySide: 'white' | 'black'; userId?: string }) {
  const chatMessages = useConsultationStore((s) => s.chatMessages);
  const myMessages = chatMessages.filter((m) => m.side === mySide);
  const [msg, setMsg] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [myMessages.length]);

  const send = () => {
    const text = msg.trim();
    if (!text) return;
    getSocket().emit('consultation:chat', { gameId, message: text, side: mySide });
    setMsg('');
  };

  return (
    <div style={S.panel}>
      <div style={S.panelTitle}><MessageSquare size={14} style={{ marginRight: 6 }} />Team Chat</div>
      <div style={S.chatList}>
        {myMessages.length === 0 && <p style={S.muted}>No messages yet.</p>}
        {myMessages.map((m, i) => (
          <div key={i} style={{ marginBottom: 6 }}>
            <span style={{ fontSize: 11, color: 'var(--text-3)', marginRight: 6 }}>{m.senderId}:</span>
            <span style={{ fontSize: 13, color: 'var(--text-1)' }}>{m.message}</span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
        <input value={msg} onChange={(e) => setMsg(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()}
          style={{ ...S.input, flex: 1, marginTop: 0, fontSize: 12 }} placeholder="Message teammates…" maxLength={500} />
        <button onClick={send} disabled={!msg.trim()} style={{ ...S.btnPrimary, padding: '6px 10px' }}><Send size={12} /></button>
      </div>
    </div>
  );
}

// ── Clock Panel ───────────────────────────────────────────────────────────────

function ClockPanel({ whiteTimeMs, blackTimeMs, turn }: { whiteTimeMs: number; blackTimeMs: number; turn: 'w' | 'b' }) {
  return (
    <div style={S.panel}>
      <div style={S.panelTitle}><ClockIcon size={14} style={{ marginRight: 6 }} />Clocks</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 12, color: 'var(--text-3)' }}>⬜ White</span>
          <PlayerClock timeMs={whiteTimeMs} isActive={turn === 'w'} label="White" />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 12, color: 'var(--text-3)' }}>⬛ Black</span>
          <PlayerClock timeMs={blackTimeMs} isActive={turn === 'b'} label="Black" />
        </div>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function ConsultationBoard() {
  const user = useAuthStore((s) => s.user)!;
  const boardTheme = useBoardThemeStore((s) => s.getTheme());
  const {
    game, mySide, fen, inviteCode, waitingForOpponent, gameOver,
    whiteTimeMs, blackTimeMs,
    setGame, onGameStarted, updateMove, updateClock, setSuggestions, addChatMessage, setGameOver, reset,
  } = useConsultationStore();

  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [optionSquares, setOptionSquares] = useState<Square[]>([]);
  const [lastMove, setLastMove] = useState<{ from: Square; to: Square } | null>(null);

  // Determine if user is executor (player1 = white executor, player2 = black executor)
  const isExecutor = game
    ? (mySide === 'white' ? game.white_executor_id === user.id : game.black_executor_id === user.id)
    : false;
  const isMyTurn = mySide !== null && isPlayerTurn(fen, mySide);
  const parsedTurn = fen.split(' ')[1] as 'w' | 'b';

  // ── Socket listeners ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!game) return;
    const socket = getSocket();
    void game.id; // used in room joins

    const onStarted = (data: { game: ConsultationGame }) => onGameStarted(data.game);
    const onState = (data: { game: ConsultationGame }) => {
      const side = (
        data.game.white_player1_id === user.id || data.game.white_player2_id === user.id
      ) ? 'white' as const : 'black' as const;
      setGame(data.game, side, user.id);
    };
    const onMoveMade = (data: ConsultationMoveMadeEvent) => {
      updateMove(data.fen, data.move, data.white_time_ms, data.black_time_ms, data.turn);
      // Extract squares from the UCI string (e.g. "e2e4" → from="e2", to="e4")
      const uci = data.move.uci;
      if (uci && uci.length >= 4) {
        setLastMove({ from: uci.slice(0, 2) as Square, to: uci.slice(2, 4) as Square });
      }
    };
    const onClock = (data: { white_time_ms: number; black_time_ms: number }) => updateClock(data.white_time_ms, data.black_time_ms);
    const onSuggestions = (data: ConsultationSuggestionsEvent) => setSuggestions(data.suggestions);
    const onChat = (data: ConsultationChatMsgEvent) => addChatMessage(data);
    const onGameOver = (data: ConsultationGameOverEvent) => setGameOver({ winner: data.winner, termination: data.termination });

    socket.on('consultation:started', onStarted);
    socket.on('consultation:state', onState);
    socket.on('consultation:move_made', onMoveMade);
    socket.on('consultation:clock', onClock);
    socket.on('consultation:suggestions', onSuggestions);
    socket.on('consultation:chat_msg', onChat);
    socket.on('consultation:gameover', onGameOver);

    return () => {
      socket.off('consultation:started', onStarted);
      socket.off('consultation:state', onState);
      socket.off('consultation:move_made', onMoveMade);
      socket.off('consultation:clock', onClock);
      socket.off('consultation:suggestions', onSuggestions);
      socket.off('consultation:chat_msg', onChat);
      socket.off('consultation:gameover', onGameOver);
    };
  }, [game?.id]);

  // ── Board interaction ─────────────────────────────────────────────────────
  const onSquareClick = (square: Square) => {
    if (!mySide || !isMyTurn || !isExecutor) return;

    if (selectedSquare && optionSquares.includes(square)) {
      emitSuggestFromSquares(selectedSquare, square);
      setSelectedSquare(null);
      setOptionSquares([]);
      return;
    }
    if (!isMyPiece(fen, square, mySide)) { setSelectedSquare(null); setOptionSquares([]); return; }
    setSelectedSquare(square);
    setOptionSquares(getLegalMoves(fen, square));
  };

  const onPieceDrop = (sourceSquare: Square, targetSquare: Square): boolean => {
    if (!mySide || !isMyTurn || !isExecutor) return false;
    if (!isMyPiece(fen, sourceSquare, mySide)) return false;
    emitSuggestFromSquares(sourceSquare, targetSquare);
    return true;
  };

  const emitSuggestFromSquares = (from: Square, to: Square) => {
    const uci = isPromotion(fen, from, to) ? `${from}${to}q` : `${from}${to}`;
    getSocket().emit('consultation:suggest', { gameId: game!.id, uci }, (res: { error?: string }) => {
      if (res?.error) toast.error(res.error);
    });
  };

  const customSquareStyles: Record<string, React.CSSProperties> = {};
  if (selectedSquare) customSquareStyles[selectedSquare] = { background: 'rgba(255,255,0,0.4)' };
  if (lastMove) {
    customSquareStyles[lastMove.from] = { ...customSquareStyles[lastMove.from], background: 'rgba(20,85,30,0.4)' };
    customSquareStyles[lastMove.to] = { ...customSquareStyles[lastMove.to], background: 'rgba(20,85,30,0.4)' };
  }
  optionSquares.forEach((sq) => { customSquareStyles[sq] = { ...customSquareStyles[sq], background: 'radial-gradient(circle, rgba(0,0,0,0.3) 30%, transparent 30%)' }; });

  const resign = () => {
    if (!game) return;
    getSocket().emit('consultation:resign', { gameId: game.id });
  };

  // ── Render ────────────────────────────────────────────────────────────────

  if (!game) return <ConsultationLobby userId={user.id} />;
  if (waitingForOpponent && inviteCode) return <WaitingRoom inviteCode={inviteCode} />;

  return (
    <div style={S.gameLayout}>
      {/* Board column */}
      <div style={S.boardCol}>
        {/* Opponent info */}
        <div style={S.playerBar}>
          <span style={S.playerName}>
            {mySide === 'white' ? 'Black Team' : 'White Team'}
          </span>
          <PlayerClock timeMs={mySide === 'white' ? blackTimeMs : whiteTimeMs} isActive={parsedTurn !== (mySide === 'white' ? 'w' : 'b')} label={mySide === 'white' ? 'Black' : 'White'} />
        </div>

        <Chessboard
          id="consultation-board"
          position={fen}
          onSquareClick={onSquareClick}
          onPieceDrop={onPieceDrop}
          boardOrientation={mySide ?? 'white'}
          arePiecesDraggable={!!mySide && isMyTurn && isExecutor}
          customSquareStyles={customSquareStyles}
          customBoardStyle={{ borderRadius: 6, boxShadow: '0 4px 24px #0004' }}
          customDarkSquareStyle={{ backgroundColor: boardTheme.dark }}
          customLightSquareStyle={{ backgroundColor: boardTheme.light }}
        />

        {/* My info */}
        <div style={S.playerBar}>
          <span style={S.playerName}>
            {mySide ? `You (${mySide})${isExecutor ? ' — Executor' : ' — Suggester'}` : 'Spectating'}
          </span>
          <PlayerClock timeMs={mySide === 'white' ? whiteTimeMs : blackTimeMs} isActive={parsedTurn === (mySide === 'white' ? 'w' : 'b')} label={mySide === 'white' ? 'White' : 'Black'} />
        </div>

        {mySide && (
          <button onClick={resign} style={{ ...S.btnGhost, marginTop: 8, fontSize: 12, alignSelf: 'flex-end' }}>Resign</button>
        )}
      </div>

      {/* Side panels */}
      <div style={S.sideCol}>
        <ClockPanel whiteTimeMs={whiteTimeMs} blackTimeMs={blackTimeMs} turn={parsedTurn} />
        {mySide && (
          <>
            <SuggestionPanel
              gameId={game.id}
              mySide={mySide}
              fen={fen}
              isMyTurn={isMyTurn}
              isExecutor={isExecutor}
            />
            <ChatPanel gameId={game.id} mySide={mySide} userId={user.id} />
          </>
        )}
        {!mySide && <p style={{ ...S.muted, marginTop: 12 }}>You are spectating.</p>}
      </div>

      {gameOver && (
        <div style={S.gameOverOverlay}>
          <GameOverBanner
            reason={gameOver.termination}
            winner={gameOver.winner === null ? null : gameOver.winner === 'white' ? 'white' : 'black'}
            onLeave={reset}
          />
        </div>
      )}
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const S: Record<string, React.CSSProperties> = {
  lobby:           { maxWidth: 420, margin: '60px auto', padding: '0 16px', display: 'flex', flexDirection: 'column', alignItems: 'center' },
  lobbyCard:       { width: '100%', background: 'var(--bg-2)', border: '1px solid var(--border-1)', borderRadius: 10, padding: 20, marginBottom: 16 },
  gameLayout:      { display: 'grid', gridTemplateColumns: '1fr 280px', gap: 20, maxWidth: 900, margin: '24px auto', padding: '0 16px', alignItems: 'start', position: 'relative' },
  boardCol:        { display: 'flex', flexDirection: 'column', gap: 6 },
  sideCol:         { display: 'flex', flexDirection: 'column', gap: 10 },
  panel:           { background: 'var(--bg-2)', border: '1px solid var(--border-1)', borderRadius: 8, padding: 12 },
  panelTitle:      { fontSize: 12, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8, display: 'flex', alignItems: 'center' },
  playerBar:       { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 4px' },
  playerName:      { fontSize: 13, fontWeight: 600, color: 'var(--text-1)' },
  title:           { margin: 0, fontWeight: 700, color: 'var(--text-1)' },
  sectionTitle:    { fontSize: 12, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 },
  muted:           { margin: 0, fontSize: 12, color: 'var(--text-4)' },
  input:           { width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border-1)', background: 'var(--bg-3)', color: 'var(--text-1)', fontSize: 14, outline: 'none', boxSizing: 'border-box', display: 'block', marginTop: 4 },
  label:           { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-3)' },
  btnPrimary:      { display: 'flex', alignItems: 'center', padding: '8px 16px', borderRadius: 6, border: 'none', background: '#3b82f6', color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer' },
  btnGhost:        { display: 'flex', alignItems: 'center', padding: '7px 14px', borderRadius: 6, border: '1px solid var(--border-1)', background: 'transparent', color: 'var(--text-2)', fontWeight: 500, fontSize: 13, cursor: 'pointer' },
  code:            { fontFamily: 'monospace', fontSize: 22, fontWeight: 700, color: '#f59e0b', letterSpacing: '0.12em', padding: '8px 16px', background: 'var(--bg-3)', borderRadius: 8, border: '1px solid var(--border-1)' },
  suggestionRow:   { display: 'flex', alignItems: 'center', padding: '5px 8px', borderRadius: 6, border: '1px solid var(--border-1)', background: 'var(--bg-3)' },
  chatList:        { maxHeight: 140, overflowY: 'auto', marginBottom: 4 },
  gameOverOverlay: { position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0007', borderRadius: 10, zIndex: 50 },
  gameOverBanner:  { background: 'var(--bg-2)', border: '1px solid var(--border-1)', borderRadius: 12, padding: '24px 32px', textAlign: 'center', color: 'var(--text-1)' },
};

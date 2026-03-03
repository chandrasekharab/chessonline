import { useEffect, useCallback, useState, useRef, CSSProperties, ReactElement } from 'react';
import { Chessboard } from 'react-chessboard';
import { Chess, Square } from 'chess.js';
import { useLiveGameStore } from '../../store/liveGameStore';
import { getSocket } from '../../services/socket';
import PlayerClock from './PlayerClock';
import GameOverModal from './GameOverModal';
import {
  MoveMadeEvent,
  ClockUpdateEvent,
  GameOverEvent,
  DrawOfferedEvent,
} from '../../types';
import toast from 'react-hot-toast';

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Get all legal destination squares for a piece on `square` given the current fen */
function getLegalMoves(fen: string, square: Square): Square[] {
  try {
    const chess = new Chess(fen);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (chess.moves({ square, verbose: true }) as any[])
      .map((m) => m.to as Square);
  } catch {
    return [];
  }
}

/** Check if the piece on square belongs to the current player */
function isMyPiece(fen: string, square: Square, myColor: 'white' | 'black'): boolean {
  try {
    const chess = new Chess(fen);
    const piece = chess.get(square);
    if (!piece) return false;
    return (myColor === 'white' && piece.color === 'w') ||
           (myColor === 'black' && piece.color === 'b');
  } catch {
    return false;
  }
}

/** Is it this player's turn? */
function isPlayerTurn(fen: string, myColor: 'white' | 'black'): boolean {
  const turn = fen.split(' ')[1];
  return (myColor === 'white' && turn === 'w') || (myColor === 'black' && turn === 'b');
}

/** Is this move a pawn promotion? */
function isPromotion(fen: string, from: Square, to: Square): boolean {
  try {
    const chess = new Chess(fen);
    const piece = chess.get(from);
    if (!piece || piece.type !== 'p') return false;
    return (piece.color === 'w' && to[1] === '8') || (piece.color === 'b' && to[1] === '1');
  } catch {
    return false;
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function LiveBoard() {
  const {
    gameId, game, myColor, fen, moves,
    whiteTimeMs, blackTimeMs,
    drawOfferedBy, gameOver,
    updateMove, updateClock, setDrawOffer, setGameOver, reset,
  } = useLiveGameStore();

  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [optionSquares, setOptionSquares] = useState<Square[]>([]);
  const [lastMove, setLastMove] = useState<{ from: Square; to: Square } | null>(null);
  const [boardWidth, setBoardWidth] = useState(480);
  const dragState = useRef<{ startX: number; startWidth: number } | null>(null);

  const onResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragState.current = { startX: e.clientX, startWidth: boardWidth };
    const onMouseMove = (ev: MouseEvent) => {
      if (!dragState.current) return;
      const delta = ev.clientX - dragState.current.startX;
      const next = Math.min(800, Math.max(280, dragState.current.startWidth + delta));
      setBoardWidth(next);
    };
    const onMouseUp = () => {
      dragState.current = null;
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, [boardWidth]);

  // Clear selection whenever FEN changes (after a move is confirmed)
  useEffect(() => {
    setSelectedSquare(null);
    setOptionSquares([]);
  }, [fen]);

  // ── Socket listeners ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!gameId) return;
    const socket = getSocket();

    const onMoveMade = (e: MoveMadeEvent) => {
      updateMove(e.fen, e.move, e.white_time_ms, e.black_time_ms, e.turn);
      const uci = e.move.uci;
      setLastMove({ from: uci.slice(0, 2) as Square, to: uci.slice(2, 4) as Square });
    };

    const onClockUpdate = (e: ClockUpdateEvent) => {
      if (e.gameId === gameId) updateClock(e.white_time_ms, e.black_time_ms);
    };

    const onGameOver = (e: GameOverEvent) => {
      if (e.gameId === gameId) setGameOver(e);
    };

    const onDrawOffered = (e: DrawOfferedEvent) => {
      if (e.gameId === gameId) {
        setDrawOffer(e.by);
        if (e.by !== myColor) toast('Your opponent offers a draw', { icon: '🤝' });
      }
    };

    const onDrawDeclined = () => {
      setDrawOffer(null);
      toast('Draw offer declined');
    };

    const onIllegalMove = (e: { error: string }) => {
      toast.error(`Illegal move: ${e.error}`);
      setSelectedSquare(null);
      setOptionSquares([]);
    };

    socket.on('move_made', onMoveMade);
    socket.on('clock_update', onClockUpdate);
    socket.on('game_over', onGameOver);
    socket.on('draw_offered', onDrawOffered);
    socket.on('draw_declined', onDrawDeclined);
    socket.on('illegal_move', onIllegalMove);

    return () => {
      socket.off('move_made', onMoveMade);
      socket.off('clock_update', onClockUpdate);
      socket.off('game_over', onGameOver);
      socket.off('draw_offered', onDrawOffered);
      socket.off('draw_declined', onDrawDeclined);
      socket.off('illegal_move', onIllegalMove);
    };
  }, [gameId, myColor, updateMove, updateClock, setDrawOffer, setGameOver]);

  // ── Emit a move to the server ─────────────────────────────────────────────
  const emitMove = useCallback(
    (from: Square, to: Square) => {
      if (!gameId || !myColor) return;
      const promotion = isPromotion(fen, from, to) ? 'q' : undefined;
      const uci = `${from}${to}${promotion ?? ''}`;
      getSocket().emit('make_move', { gameId, uci });
      setSelectedSquare(null);
      setOptionSquares([]);
    },
    [gameId, myColor, fen]
  );

  // ── Click-to-move handler ─────────────────────────────────────────────────
  const onSquareClick = useCallback(
    (square: Square) => {
      if (!gameId || !myColor || game?.status !== 'active') return;
      if (!isPlayerTurn(fen, myColor)) return;

      // Case 1: A piece is already selected
      if (selectedSquare) {
        // Clicking a valid destination → move
        if (optionSquares.includes(square)) {
          emitMove(selectedSquare, square);
          return;
        }
        // Clicking own piece → reselect
        if (isMyPiece(fen, square, myColor)) {
          const moves = getLegalMoves(fen, square);
          setSelectedSquare(square);
          setOptionSquares(moves);
          return;
        }
        // Clicking empty or opponent square that isn't a valid move → deselect
        setSelectedSquare(null);
        setOptionSquares([]);
        return;
      }

      // Case 2: No piece selected — select if own piece with legal moves
      if (isMyPiece(fen, square, myColor)) {
        const legalMoves = getLegalMoves(fen, square);
        if (legalMoves.length > 0) {
          setSelectedSquare(square);
          setOptionSquares(legalMoves);
        }
      }
    },
    [gameId, myColor, game?.status, fen, selectedSquare, optionSquares, emitMove]
  );

  // ── Drag-and-drop handler (keeps existing drag support) ───────────────────
  const onDrop = useCallback(
    (sourceSquare: Square, targetSquare: Square, piece: string) => {
      if (!gameId || !myColor) return false;
      if (!isPlayerTurn(fen, myColor)) return false;

      const promotion =
        (piece === 'wP' || piece === 'bP') &&
        (targetSquare[1] === '8' || targetSquare[1] === '1')
          ? 'q'
          : undefined;

      const uci = `${sourceSquare}${targetSquare}${promotion ?? ''}`;
      getSocket().emit('make_move', { gameId, uci });
      setSelectedSquare(null);
      setOptionSquares([]);
      return true;
    },
    [gameId, myColor, fen]
  );

  // ── Custom square styles ──────────────────────────────────────────────────
  const customSquareStyles: Record<string, CSSProperties> = {};

  // Last move highlight (subtle yellow tint)
  if (lastMove) {
    customSquareStyles[lastMove.from] = { backgroundColor: 'rgba(255, 214, 10, 0.25)' };
    customSquareStyles[lastMove.to]   = { backgroundColor: 'rgba(255, 214, 10, 0.35)' };
  }

  // Selected piece highlight (blue)
  if (selectedSquare) {
    customSquareStyles[selectedSquare] = { backgroundColor: 'rgba(59, 130, 246, 0.55)' };
  }

  // Legal move dots / capture rings
  for (const sq of optionSquares) {
    const chess = new Chess(fen);
    const hasEnemy = chess.get(sq) !== null;
    if (hasEnemy) {
      // Capture: hollow ring around the square
      customSquareStyles[sq] = {
        background: 'radial-gradient(circle, transparent 55%, rgba(59,130,246,0.6) 55%)',
        borderRadius: '50%',
      };
    } else {
      // Empty square: filled dot in the centre
      customSquareStyles[sq] = {
        background: 'radial-gradient(circle, rgba(59,130,246,0.6) 28%, transparent 28%)',
        borderRadius: '50%',
      };
    }
  }

  // ── Controls ──────────────────────────────────────────────────────────────
  const resign = () => {
    if (!gameId) return;
    if (!window.confirm('Are you sure you want to resign?')) return;
    getSocket().emit('resign', { gameId });
  };

  const offerDraw = () => {
    if (!gameId) return;
    getSocket().emit('offer_draw', { gameId });
    toast('Draw offered');
  };

  const acceptDraw = () => {
    if (!gameId) return;
    getSocket().emit('accept_draw', { gameId });
    setDrawOffer(null);
  };

  const declineDraw = () => {
    if (!gameId) return;
    getSocket().emit('decline_draw', { gameId });
    setDrawOffer(null);
  };

  if (!game || !gameId) return null;

  const flipped = myColor === 'black';
  const opponentColor = myColor === 'white' ? 'black' : 'white';
  const opponentEmail = myColor === 'white' ? game.black_email : game.white_email;
  const myEmail = myColor === 'white' ? game.white_email : game.black_email;
  const myRating = myColor === 'white' ? game.white_rating : game.black_rating;
  const opponentRating = myColor === 'white' ? game.black_rating : game.white_rating;
  const myTimeMs = myColor === 'white' ? whiteTimeMs : blackTimeMs;
  const oppTimeMs = myColor === 'white' ? blackTimeMs : whiteTimeMs;
  const isMyTurn = isPlayerTurn(fen, myColor!);

  return (
    <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start', justifyContent: 'center', padding: '24px', flexWrap: 'wrap' }}>
      {/* Board column */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {/* Opponent clock (top) */}
        <PlayerClock
          timeMs={oppTimeMs}
          isActive={!isMyTurn && game.status === 'active'}
          label={opponentEmail ?? opponentColor}
          rating={opponentRating}
        />

        {/* Chessboard — resizable via bottom-right drag handle */}
        <div style={{ position: 'relative', display: 'inline-block', borderRadius: '8px', overflow: 'visible', boxShadow: '0 4px 32px rgba(0,0,0,0.5)' }}>
          <div style={{ borderRadius: '8px', overflow: 'hidden' }}>
            <Chessboard
              position={fen}
              onPieceDrop={onDrop}
              onSquareClick={onSquareClick}
              boardOrientation={flipped ? 'black' : 'white'}
              boardWidth={boardWidth}
              areArrowsAllowed
              customBoardStyle={{ borderRadius: '0' }}
              customSquareStyles={customSquareStyles}
              animationDuration={150}
            />
          </div>
          {/* Resize grip */}
          <div
            onMouseDown={onResizeStart}
            title="Drag to resize board"
            style={{
              position: 'absolute',
              bottom: 0,
              right: 0,
              width: 18,
              height: 18,
              cursor: 'nwse-resize',
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'flex-end',
              padding: '3px',
              zIndex: 10,
            }}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M11 1L1 11" stroke="#64748b" strokeWidth="1.5" strokeLinecap="round"/>
              <path d="M11 5L5 11" stroke="#64748b" strokeWidth="1.5" strokeLinecap="round"/>
              <path d="M11 9L9 11" stroke="#64748b" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </div>
        </div>

        {/* My clock (bottom) */}
        <PlayerClock
          timeMs={myTimeMs}
          isActive={isMyTurn && game.status === 'active'}
          label={`You (${myEmail ?? myColor})`}
          rating={myRating}
        />

        {/* Controls */}
        {game.status === 'active' && (
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={offerDraw}
              style={{ flex: 1, padding: '8px', borderRadius: '6px', background: '#334155', color: '#e2e8f0', border: 'none', cursor: 'pointer' }}
            >
              ½ Draw
            </button>
            <button
              onClick={resign}
              style={{ flex: 1, padding: '8px', borderRadius: '6px', background: '#7f1d1d', color: '#fca5a5', border: 'none', cursor: 'pointer' }}
            >
              Resign
            </button>
          </div>
        )}

        {/* Draw offer banner */}
        {drawOfferedBy && drawOfferedBy !== myColor && (
          <div style={{ background: '#1e293b', border: '1px solid #fbbf24', borderRadius: '8px', padding: '12px', textAlign: 'center' }}>
            <p style={{ color: '#fbbf24', marginBottom: '8px' }}>Your opponent offers a draw</p>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
              <button onClick={acceptDraw} style={{ padding: '6px 16px', borderRadius: '6px', background: '#22c55e', color: '#fff', border: 'none', cursor: 'pointer' }}>Accept</button>
              <button onClick={declineDraw} style={{ padding: '6px 16px', borderRadius: '6px', background: '#ef4444', color: '#fff', border: 'none', cursor: 'pointer' }}>Decline</button>
            </div>
          </div>
        )}
      </div>

      {/* Move list */}
      <div style={{ minWidth: '180px', maxHeight: '520px', overflow: 'auto', background: '#1e293b', borderRadius: '8px', padding: '12px' }}>
        <h3 style={{ color: '#94a3b8', fontSize: '14px', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Moves</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '30px 1fr 1fr', gap: '2px 8px' }}>
          {moves.reduce<ReactElement[]>((acc: ReactElement[], m: { san: string; uci: string }, i: number) => {
            if (i % 2 === 0) {
              acc.push(
                <span key={`n${i}`} style={{ color: '#475569', fontSize: '13px', lineHeight: '24px' }}>
                  {Math.floor(i / 2) + 1}.
                </span>
              );
              acc.push(
                <span key={`w${i}`} style={{ color: '#e2e8f0', fontSize: '13px', lineHeight: '24px' }}>
                  {m.san}
                </span>
              );
              if (i + 1 < moves.length) {
                acc.push(
                  <span key={`b${i}`} style={{ color: '#e2e8f0', fontSize: '13px', lineHeight: '24px' }}>
                    {moves[i + 1].san}
                  </span>
                );
              } else {
                acc.push(<span key={`empty${i}`} />);
              }
            }
            return acc;
          }, [])}
        </div>
        {moves.length === 0 && (
          <p style={{ color: '#475569', fontSize: '13px' }}>No moves yet</p>
        )}
      </div>

      {/* Game over modal */}
      {gameOver && (
        <GameOverModal
          info={gameOver}
          myColor={myColor}
          onClose={reset}
        />
      )}
    </div>
  );
}

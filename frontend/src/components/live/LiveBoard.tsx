import { useEffect, useCallback } from 'react';
import { Chessboard } from 'react-chessboard';
import { Square } from 'chess.js';
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

export default function LiveBoard() {
  const {
    gameId, game, myColor, fen, moves, turn,
    whiteTimeMs, blackTimeMs,
    drawOfferedBy, gameOver,
    updateMove, updateClock, setDrawOffer, setGameOver, reset,
  } = useLiveGameStore();

  // Register socket listeners when game is active
  useEffect(() => {
    if (!gameId) return;
    const socket = getSocket();

    const onMoveMade = (e: MoveMadeEvent) => {
      updateMove(e.fen, e.move, e.white_time_ms, e.black_time_ms, e.turn);
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
        if (e.by !== myColor) {
          toast('Your opponent offers a draw', { icon: '🤝' });
        }
      }
    };

    const onDrawDeclined = () => {
      setDrawOffer(null);
      toast('Draw offer declined');
    };

    const onIllegalMove = (e: { error: string }) => {
      toast.error(`Illegal move: ${e.error}`);
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

  const onDrop = useCallback(
    (sourceSquare: Square, targetSquare: Square, piece: string) => {
      if (!gameId || !myColor) return false;
      if (myColor === 'white' && turn !== 'w') return false;
      if (myColor === 'black' && turn !== 'b') return false;

      const promotion =
        (piece === 'wP' || piece === 'bP') &&
        (targetSquare[1] === '8' || targetSquare[1] === '1')
          ? 'q'
          : undefined;

      const uci = `${sourceSquare}${targetSquare}${promotion ?? ''}`;
      getSocket().emit('make_move', { gameId, uci });
      return true;
    },
    [gameId, myColor, turn]
  );

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
  const isMyTurn = (myColor === 'white' && turn === 'w') || (myColor === 'black' && turn === 'b');

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

        {/* Chessboard */}
        <div style={{ borderRadius: '8px', overflow: 'hidden', boxShadow: '0 4px 32px rgba(0,0,0,0.5)' }}>
          <Chessboard
            position={fen}
            onPieceDrop={onDrop}
            boardOrientation={flipped ? 'black' : 'white'}
            boardWidth={480}
            areArrowsAllowed
            customBoardStyle={{ borderRadius: '0' }}
            animationDuration={150}
          />
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
          {moves.reduce<JSX.Element[]>((acc, m, i) => {
            if (i % 2 === 0) {
              acc.push(
                <span key={`n${i}`} style={{ color: '#475569', fontSize: '13px', lineHeight: '24px' }}>
                  {Math.floor(i / 2) + 1}.
                </span>
              );
              acc.push(
                <span key={`w${i}`} style={{ color: '#e2e8f0', fontSize: '13px', lineHeight: '24px', cursor: 'default' }}>
                  {m.san}
                </span>
              );
              if (i + 1 < moves.length) {
                acc.push(
                  <span key={`b${i}`} style={{ color: '#e2e8f0', fontSize: '13px', lineHeight: '24px', cursor: 'default' }}>
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

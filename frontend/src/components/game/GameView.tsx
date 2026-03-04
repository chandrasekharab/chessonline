import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Chess } from 'chess.js';
import toast from 'react-hot-toast';
import { gamesApi, getErrorMessage } from '../../services/api';
import ChessBoardView from '../analysis/ChessBoard';
import EvaluationBar from '../analysis/EvaluationBar';
import MoveList from '../analysis/MoveList';
import AnalysisSummary from '../analysis/AnalysisSummary';
import AnalysisProgressBar from '../analysis/AnalysisProgressBar';
import AISummaryCard from '../analysis/AISummaryCard';
import ExplanationPanel from '../analysis/ExplanationPanel';
import AICoachChat from '../analysis/AICoachChat';
import type { AnalysisMove } from '../../types';

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

function getMoveSquares(moves: AnalysisMove[], idx: number): { from: string; to: string } | undefined {
  if (idx < 0 || idx >= moves.length) return undefined;
  const prevFen = idx === 0 ? START_FEN : moves[idx - 1].fen;
  try {
    const ch = new Chess(prevFen);
    const result = ch.move(moves[idx].move);
    if (result) return { from: result.from, to: result.to };
  } catch {}
  return undefined;
}

/** Parse a UCI string (e.g. "d7d5" or "e7e8q") into from/to squares. */
function uciSquares(uci: string): { from: string; to: string } | undefined {
  if (!uci || uci.length < 4) return undefined;
  return { from: uci.slice(0, 2), to: uci.slice(2, 4) };
}
import {
  ArrowLeft, PlayCircle, RefreshCw,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
  Sparkles, AlertTriangle, Crosshair, TrendingDown, Zap, BarChart2,
  PanelRightOpen, PanelRightClose, Maximize2, Minimize2,
  MessageSquare, BarChart,
} from 'lucide-react';

const LABEL_COLOR: Record<string, string> = {
  blunder: '#ef4444', mistake: '#f97316', missed_win: '#a855f7',
  inaccuracy: '#eab308', good: '#22c55e', best: '#3b82f6',
  excellent: '#10b981', book: '#64748b',
};
const labelBg = (l: string) => LABEL_COLOR[l] ?? '#475569';
const LABEL_ICON: Record<string, string> = {
  blunder: '❌', mistake: '⚠️', missed_win: '💜', inaccuracy: '🟡',
  good: '✅', best: '🔵', excellent: '🟢', book: '📖',
};
const NAVBAR_H = 57;
const PANEL_WIDTHS = [340, 500, 700] as const;
type PanelWidth = (typeof PANEL_WIDTHS)[number];

export default function GameView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [currentMoveIndex, setCurrentMoveIndex] = useState<number>(-1);
  const [hoveredMoveIdx, setHoveredMoveIdx] = useState<number | null>(null);
  const [boardWidth, setBoardWidth] = useState(420);
  const [aiOpen, setAiOpen] = useState(true);
  const [coachWidth, setCoachWidth] = useState<PanelWidth>(340);
  const [coachTab, setCoachTab] = useState<'analysis' | 'chat'>('analysis');
  const coachBodyRef = useRef<HTMLDivElement>(null);

  const { data, refetch, isLoading, isError } = useQuery({
    queryKey: ['analysis', id],
    queryFn: () => gamesApi.getAnalysis(id!).then((r) => r.data),
    enabled: !!id,
    refetchInterval: (query) => {
      const s = query.state.data?.game?.status;
      return s === 'analyzing' ? 1000 : false;
    },
  });

  const analyseMutation = useMutation({
    mutationFn: () => gamesApi.analyze(id!),
    onSuccess: () => { toast.success('Analysis started'); refetch(); },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const game  = data?.game;
  const moves: AnalysisMove[] = data?.moves ?? [];
  const summary = data?.summary ?? {};

  const goTo    = useCallback((i: number) => setCurrentMoveIndex(i), []);
  const goPrev  = useCallback(() => setCurrentMoveIndex((i) => Math.max(-1, i - 1)), []);
  const goNext  = useCallback(() => setCurrentMoveIndex((i) => Math.min(moves.length - 1, i + 1)), [moves.length]);
  const goStart = useCallback(() => setCurrentMoveIndex(-1), []);
  const goEnd   = useCallback(() => setCurrentMoveIndex(moves.length - 1), [moves.length]);

  const jumpNext = useCallback((labels: string[]) => {
    const from = currentMoveIndex + 1;
    const idx  = moves.findIndex((m, i) => i >= from && labels.includes(m.label));
    if (idx !== -1) { setCurrentMoveIndex(idx); return; }
    const wrap = moves.findIndex((m) => labels.includes(m.label));
    if (wrap !== -1) setCurrentMoveIndex(wrap);
    else toast('No such move found', { icon: '🔍' });
  }, [currentMoveIndex, moves]);

  const jumpWorst = useCallback(() => {
    if (!moves.length) return;
    let wi = 0, wd = -Infinity;
    moves.forEach((m, i) => { const d = Math.abs(m.eval_diff ?? 0); if (d > wd) { wd = d; wi = i; } });
    setCurrentMoveIndex(wi);
  }, [moves]);

  const cycleWidth = () => {
    const idx = PANEL_WIDTHS.indexOf(coachWidth);
    setCoachWidth(PANEL_WIDTHS[(idx + 1) % PANEL_WIDTHS.length] as PanelWidth);
  };

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft')  { e.preventDefault(); goPrev();  }
      if (e.key === 'ArrowRight') { e.preventDefault(); goNext();  }
      if (e.key === 'Home')       { e.preventDefault(); goStart(); }
      if (e.key === 'End')        { e.preventDefault(); goEnd();   }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [goPrev, goNext, goStart, goEnd]);

  useEffect(() => {
    if (coachBodyRef.current) coachBodyRef.current.scrollTop = 0;
  }, [currentMoveIndex]);

  const currentMove = currentMoveIndex >= 0 ? moves[currentMoveIndex] : null;
  // Hover preview: temporarily show a different move without navigating
  const displayIdx  = hoveredMoveIdx ?? currentMoveIndex;
  const displayMove = displayIdx >= 0 ? moves[displayIdx] : null;
  let boardFen = START_FEN;
  if (displayMove) boardFen = displayMove.fen;
  const lastMove       = getMoveSquares(moves, displayIdx);
  const highlightColor = displayMove ? (LABEL_COLOR[displayMove.label] ?? undefined) : undefined;
  // Show the opponent's best engine response as a cyan arrow on bad moves
  const BAD_LABELS = ['blunder', 'mistake', 'inaccuracy', 'missed_win'];
  const nextRow = displayIdx + 1 < moves.length ? moves[displayIdx + 1] : undefined;
  const opponentMove = displayMove && BAD_LABELS.includes(displayMove.label)
    ? (nextRow?.best_move ? uciSquares(nextRow.best_move) : getMoveSquares(moves, displayIdx + 1))
    : undefined;
  const currentEval = currentMove?.eval_after ?? (moves[0]?.eval_before ?? 0);

  const blunderCount    = moves.filter((m) => m.label === 'blunder').length;
  const mistakeCount    = moves.filter((m) => m.label === 'mistake').length;
  const inaccuracyCount = moves.filter((m) => m.label === 'inaccuracy').length;

  const meta = game?.metadata_json;
  const gamePlayers = meta
    ? `${meta.white ?? 'White'} vs ${meta.black ?? 'Black'}`
    : undefined;

  if (isLoading) return (
    <div style={S.center}><div style={S.spinner} /><p style={{ color: 'var(--text-4)', marginTop: 12 }}>Loading game…</p></div>
  );
  if (isError || !game) return (
    <div style={S.center}>
      <p style={{ color: '#ef4444' }}>Failed to load game.</p>
      <button onClick={() => navigate('/')} style={S.outlineBtn}><ArrowLeft size={15} /> Back</button>
    </div>
  );

  return (
    <div style={{ ...S.portal, height: `calc(100vh - ${NAVBAR_H}px)` }}>

      {/* ── MAIN COLUMN ──────────────────────────────────────────────── */}
      <div style={S.mainCol}>

        {/* Top bar */}
        <div style={S.topBar}>
          <button onClick={() => navigate('/')} style={S.outlineBtn}>
            <ArrowLeft size={15} /> Back
          </button>
          <div style={S.gameTitle}>
            <span style={S.players}>
              {meta!.white ?? 'White'} <span style={S.vs}>vs</span> {meta!.black ?? 'Black'}
            </span>
            <span style={S.metaLine}>
              {[meta!.event, meta!.date, meta!.result].filter(Boolean).join(' · ')}
            </span>
          </div>
          <button
            onClick={() => analyseMutation.mutate()}
            style={{ ...S.primaryBtn, ...(game.status === 'analyzing' || analyseMutation.isPending ? S.primaryBtnDisabled : {}) }}
            disabled={game.status === 'analyzing' || analyseMutation.isPending}
          >
            {game.status === 'analyzing'
              ? <><RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> Analysing…</>
              : moves.length > 0
                ? <><RefreshCw size={14} /> Re-Analyse</>
                : <><PlayCircle size={14} /> Analyse</>}
          </button>
          <button
            onClick={() => { setAiOpen((v) => !v); }}
            style={{ ...S.outlineBtn, ...(aiOpen ? S.outlineBtnActive : {}) }}
            title={aiOpen ? 'Hide AI Coach' : 'Show AI Coach'}
          >
            {aiOpen ? <PanelRightClose size={14} /> : <PanelRightOpen size={14} />}
            <span style={{ fontSize: 12 }}>{aiOpen ? 'Hide Coach' : 'AI Coach'}</span>
          </button>
        </div>

        {game.status === 'analyzing' && (
          <div style={{ flexShrink: 0, padding: '0 20px' }}>
            <AnalysisProgressBar current={game.progress_current ?? 0} total={game.progress_total ?? 0} />
          </div>
        )}

        {/* Content area */}
        {moves.length === 0 ? (
          <div style={S.emptyFill}>
            {game.status === 'uploaded' && (
              <><span style={{ fontSize: 52, lineHeight: 1 }}>♟</span>
                <p style={S.emptyTitle}>No analysis yet</p>
                <p style={S.emptyHint}>Click "Analyse" to run Stockfish on this game</p></>
            )}
            {game.status === 'analyzing' && (
              <><div style={S.spinnerLg} />
                <p style={S.emptyTitle}>Stockfish is analysing…</p>
                <p style={S.emptyHint}>This usually takes 30–90 seconds</p></>
            )}
            {game.status === 'failed' && (
              <><span style={{ fontSize: 40 }}>⚠️</span>
                <p style={{ ...S.emptyTitle, color: '#ef4444' }}>Analysis failed</p>
                <p style={S.emptyHint}>Try Re-Analyse</p></>
            )}
          </div>
        ) : (
          <div style={S.contentRow}>
            <div style={S.boardPane}>
              <AnalysisSummary summary={summary} />
              <div style={S.boardRow}>
                <EvaluationBar evalCp={currentEval} height={boardWidth} />
                <ChessBoardView
                  fen={boardFen}
                  lastMove={lastMove}
                  highlightColor={highlightColor}
                  opponentMove={opponentMove}
                  orientation="white"
                  boardWidth={boardWidth}
                  onBoardWidthChange={setBoardWidth}
                />
              </div>
              <div style={S.navBar}>
                <button onClick={goStart} disabled={currentMoveIndex < 0} style={S.navBtn} title="Start (Home)"><ChevronsLeft size={16} /></button>
                <button onClick={goPrev}  disabled={currentMoveIndex < 0} style={S.navBtn} title="Prev (←)"><ChevronLeft size={16} /></button>
                <div style={S.navInfo}>
                  {currentMoveIndex < 0
                    ? <span style={S.navStart}>Start position</span>
                    : <><span style={S.navMoveNum}>Move {currentMove?.move_number}</span>
                        <span style={S.navSep}>/</span>
                        <span style={S.navTotal}>{Math.ceil(moves.length / 2)} total</span></>}
                </div>
                <button onClick={goNext} disabled={currentMoveIndex >= moves.length - 1} style={S.navBtn} title="Next (→)"><ChevronRight size={16} /></button>
                <button onClick={goEnd}  disabled={currentMoveIndex >= moves.length - 1} style={S.navBtn} title="End (End)"><ChevronsRight size={16} /></button>
              </div>
              <p style={S.keyHint}>← → to navigate · Home / End to jump</p>
            </div>
            <div style={S.movePane}>
              <MoveList moves={moves} currentIndex={currentMoveIndex} onSelect={goTo} onHoverMove={setHoveredMoveIdx} />
            </div>
          </div>
        )}
      </div>

      {/* ── AI COACH PANEL ──────────────────────────────────────────── */}
      <div style={{ ...S.coachOuter, width: aiOpen ? coachWidth : 0 }}>
        <div style={{ ...S.coachInner, width: coachWidth }}>

          {/* Panel header */}
          <div style={S.coachHeader}>
            <Sparkles size={13} style={{ color: '#818cf8', flexShrink: 0 }} />
            <span style={{ flex: 1, fontSize: 11, fontWeight: 700, color: '#c7d2fe', letterSpacing: '0.06em', textTransform: 'uppercase' }}>AI Coach</span>
            {/* Width cycle */}
            <button onClick={cycleWidth} style={S.coachIconBtn} title="Expand / compress panel">
              {coachWidth === 700 ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
            </button>
            <button onClick={() => setAiOpen(false)} style={S.coachIconBtn} title="Close">
              <PanelRightClose size={13} />
            </button>
          </div>

          {/* Tabs */}
          <div style={S.tabs}>
            <button
              style={{ ...S.tab, ...(coachTab === 'analysis' ? S.tabActive : {}) }}
              onClick={() => setCoachTab('analysis')}
            >
              <BarChart size={12} /> Analysis
            </button>
            <button
              style={{ ...S.tab, ...(coachTab === 'chat' ? S.tabActive : {}) }}
              onClick={() => setCoachTab('chat')}
            >
              <MessageSquare size={12} /> Chat
            </button>
          </div>

          {/* ── ANALYSIS TAB ── */}
          {coachTab === 'analysis' && (
            <div style={S.coachBody} ref={coachBodyRef}>
              {moves.length > 0 ? (
                <>
                  {currentMove ? (
                    <div style={{ ...S.moveCard, borderLeftColor: labelBg(currentMove.label) }}>
                      <div style={S.moveCardHeader}>
                        <span style={S.moveNum}>Move {currentMove.move_number}</span>
                        <span style={{
                          ...S.labelPill,
                          background: labelBg(currentMove.label) + '20',
                          color: labelBg(currentMove.label),
                          borderColor: labelBg(currentMove.label) + '50',
                        }}>
                          {LABEL_ICON[currentMove.label]} {currentMove.label.replace(/_/g, ' ')}
                        </span>
                      </div>
                      <div style={S.sanLine}>
                        <span style={S.sanText}>{currentMove.move}</span>
                        {currentMove.best_move && currentMove.best_move !== currentMove.move && (
                          <span style={S.bestMove}>best: <strong>{currentMove.best_move}</strong></span>
                        )}
                      </div>
                      {currentMove.eval_before !== null && currentMove.eval_after !== null && (
                        <div style={S.evalLine}>
                          <span style={S.evalChip}>
                            {currentMove.eval_before >= 0 ? '+' : ''}{(currentMove.eval_before / 100).toFixed(2)}
                          </span>
                          <span style={{ color: 'var(--text-5)', fontSize: 12 }}>→</span>
                          <span style={{ ...S.evalChip, color: (currentMove.eval_diff ?? 0) < -50 ? '#f87171' : 'var(--text-3)' }}>
                            {currentMove.eval_after >= 0 ? '+' : ''}{(currentMove.eval_after / 100).toFixed(2)}
                          </span>
                          {currentMove.eval_diff !== null && Math.abs(currentMove.eval_diff) > 5 && (
                            <span style={{ marginLeft: 2, fontSize: 12, fontWeight: 700, color: currentMove.eval_diff < 0 ? '#ef4444' : '#22c55e' }}>
                              ({currentMove.eval_diff > 0 ? '+' : ''}{(currentMove.eval_diff / 100).toFixed(2)})
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div style={S.coachHint}>
                      <Sparkles size={20} style={{ color: '#312e81', marginBottom: 8 }} />
                      <p style={{ margin: 0, color: 'var(--text-5)', fontSize: 12, lineHeight: 1.5, textAlign: 'center' }}>
                        Select any move to see AI coaching and engine evaluation.
                      </p>
                    </div>
                  )}

                  {currentMove && id && (
                    <div style={S.coachSection}>
                      <ExplanationPanel gameId={id} move={currentMove} />
                    </div>
                  )}

                  <div style={S.coachSection}>
                    <div style={S.coachSectionLabel}><Zap size={11} style={{ color: '#fbbf24' }} /> Quick Navigation</div>
                    {[
                      { labels: ['blunder'],    Icon: AlertTriangle, color: '#ef4444', bg: '#ef444415', label: 'Next Blunder',    count: blunderCount },
                      { labels: ['mistake'],    Icon: TrendingDown,  color: '#f97316', bg: '#f9731615', label: 'Next Mistake',    count: mistakeCount },
                      { labels: ['inaccuracy'], Icon: Crosshair,     color: '#eab308', bg: '#eab30815', label: 'Next Inaccuracy', count: inaccuracyCount },
                    ].map(({ labels, Icon, color, bg, label, count }) => (
                      <button key={label} style={{ ...S.navChip, ...(count === 0 ? S.navChipOff : {}) }} disabled={count === 0} onClick={() => jumpNext(labels)}>
                        <span style={{ ...S.navChipDot, background: bg, border: `1px solid ${color}30` }}><Icon size={11} style={{ color }} /></span>
                        <span style={{ flex: 1 }}>{label}</span>
                        {count > 0 && <span style={{ ...S.countBadge, background: bg, color }}>{count}</span>}
                      </button>
                    ))}
                    <button style={S.navChip} onClick={jumpWorst}>
                      <span style={{ ...S.navChipDot, background: '#a855f715', border: '1px solid #a855f730' }}><BarChart2 size={11} style={{ color: '#a855f7' }} /></span>
                      <span style={{ flex: 1 }}>Jump to Worst Move</span>
                    </button>
                  </div>

                  {id && (
                    <div style={S.coachSection}>
                      <AISummaryCard gameId={id} analysisComplete={game.status === 'completed'} />
                    </div>
                  )}
                </>
              ) : (
                <div style={S.coachHint}>
                  <Sparkles size={20} style={{ color: '#312e81', marginBottom: 8 }} />
                  <p style={{ margin: 0, color: 'var(--text-5)', fontSize: 12, lineHeight: 1.5, textAlign: 'center' }}>
                    Analyse the game first to unlock AI coaching.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ── CHAT TAB ── */}
          {coachTab === 'chat' && id && (
            <AICoachChat
              gameId={id}
              gamePlayers={gamePlayers}
              gameEvent={meta?.event}
              currentMove={currentMove}
            />
          )}
          {coachTab === 'chat' && !id && (
            <div style={S.coachHint}>
              <MessageSquare size={20} style={{ color: '#312e81', marginBottom: 8 }} />
                  <p style={{ margin: 0, color: 'var(--text-5)', fontSize: 12 }}>Chat unavailable.</p>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const S: Record<string, React.CSSProperties> = {
  portal:  { display: 'flex', overflow: 'hidden', background: 'var(--bg-drawer)' },
  mainCol: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 },

  topBar: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '0 20px', height: 56, flexShrink: 0,
    background: 'var(--bg-nav)', borderBottom: '1px solid var(--border)',
  },
  gameTitle: { flex: 1, display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0, overflow: 'hidden' },
  players:   { fontSize: 16, fontWeight: 700, color: 'var(--text-2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  vs:        { color: 'var(--text-5)', fontWeight: 400 },
  metaLine:  { fontSize: 11, color: 'var(--text-5)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },

  outlineBtn: {
    display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0,
    background: 'transparent', border: '1px solid var(--border-mid)', color: 'var(--text-4)',
    padding: '6px 12px', borderRadius: 7, cursor: 'pointer', fontSize: 13, fontWeight: 500,
  },
  outlineBtnActive: { borderColor: '#4338ca', color: '#a5b4fc', background: '#1e1b4b22' },
  primaryBtn: {
    display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0,
    background: '#2563eb', color: '#fff', border: 'none',
    padding: '7px 14px', borderRadius: 7, cursor: 'pointer', fontSize: 13, fontWeight: 600,
  },
  primaryBtnDisabled: { background: '#1e3a5f', color: 'var(--text-5)', cursor: 'not-allowed' },

  emptyFill:  { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 40 },
  emptyTitle: { margin: 0, fontSize: 17, fontWeight: 600, color: 'var(--text-2)' },
  emptyHint:  { margin: 0, fontSize: 13, color: 'var(--text-5)' },
  spinnerLg:  { width: 44, height: 44, border: '3px solid var(--border-mid)', borderTop: '3px solid #3b82f6', borderRadius: '50%', animation: 'spin 1s linear infinite' },

  contentRow: { flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 },
  boardPane:  { flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 12, padding: '16px 16px 16px 20px', overflowY: 'auto' },
  boardRow:   { display: 'flex', gap: 10, alignItems: 'flex-start' },
  movePane:   { flex: 1, overflowY: 'auto', borderLeft: '1px solid var(--border)', padding: '16px 16px 16px 14px', minWidth: 200 },

  navBar:    { display: 'flex', alignItems: 'center', gap: 6, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 9, padding: '6px 10px' },
  navBtn:    { display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, background: 'var(--bg-card)', border: '1px solid var(--border-mid)', color: 'var(--text-4)', borderRadius: 7, cursor: 'pointer' },
  navInfo:   { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 },
  navStart:  { color: 'var(--text-5)', fontSize: 12 },
  navMoveNum:{ color: 'var(--text-2)', fontSize: 13, fontWeight: 600 },
  navSep:    { color: 'var(--border-strong)', fontSize: 12 },
  navTotal:  { color: 'var(--text-5)', fontSize: 12 },
  keyHint:   { margin: 0, color: 'var(--border-mid)', fontSize: 11, textAlign: 'center' },

  // Coach panel outer (animated width)
  coachOuter: {
    flexShrink: 0, overflow: 'hidden',
    transition: 'width 0.22s cubic-bezier(0.4,0,0.2,1)',
    borderLeft: '1px solid var(--border)',
  },
  coachInner: { height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg-drawer)' },

  coachHeader: {
    display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0,
    background: 'linear-gradient(90deg,#1e1b4b,#0f172a)',
    borderBottom: '1px solid #312e81',
    padding: '9px 12px',
  },
  coachIconBtn: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'transparent', border: 'none', color: '#4338ca',
    cursor: 'pointer', padding: 3, borderRadius: 4,
  },

  // Tabs
  tabs: {
    display: 'flex', flexShrink: 0,
    borderBottom: '1px solid var(--border)',
    background: 'var(--bg-nav)',
  },
  tab: {
    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
    padding: '9px 0', fontSize: 12, fontWeight: 600, cursor: 'pointer',
    background: 'transparent', border: 'none', color: 'var(--border-strong)',
    borderBottom: '2px solid transparent',
    transition: 'color 0.15s, border-color 0.15s',
  },
  tabActive: { color: '#818cf8', borderBottomColor: '#6366f1' },

  coachBody: { flex: 1, overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: 10 },
  coachHint: { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '32px 12px' },
  coachSection: { borderTop: '1px solid var(--bg-surface)', paddingTop: 10 },
  coachSectionLabel: { display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, fontWeight: 700, color: 'var(--border-strong)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 7 },

  moveCard:       { background: 'var(--bg-surface)', border: '1px solid var(--border-mid)', borderLeft: '3px solid #475569', borderRadius: 8, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 7 },
  moveCardHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 },
  moveNum:        { color: 'var(--text-5)', fontSize: 11 },
  labelPill:      { fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10, border: '1px solid', textTransform: 'uppercase', letterSpacing: '0.04em' },
  sanLine:        { display: 'flex', alignItems: 'baseline', gap: 8 },
  sanText:        { fontFamily: 'monospace', fontSize: 22, fontWeight: 700, color: 'var(--text-2)', lineHeight: 1 },
  bestMove:       { fontSize: 12, color: 'var(--text-5)' },
  evalLine:       { display: 'flex', alignItems: 'center', gap: 6 },
  evalChip:       { fontSize: 12, fontFamily: 'monospace', color: 'var(--text-3)' },

  navChip:    { display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg-surface)', border: '1px solid var(--border-mid)', color: 'var(--text-3)', borderRadius: 7, padding: '7px 10px', fontSize: 12, fontWeight: 500, cursor: 'pointer', width: '100%', textAlign: 'left', marginBottom: 4 },
  navChipOff: { opacity: 0.3, cursor: 'not-allowed' },
  navChipDot: { width: 24, height: 24, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  countBadge: { fontSize: 11, fontWeight: 700, padding: '1px 6px', borderRadius: 9, flexShrink: 0 },

  center:  { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, padding: '80px 20px', background: 'var(--bg-drawer)', minHeight: '100%' },
  spinner: { width: 34, height: 34, border: '3px solid var(--border-mid)', borderTop: '3px solid #3b82f6', borderRadius: '50%', animation: 'spin 1s linear infinite' },
};

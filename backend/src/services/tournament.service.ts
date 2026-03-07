import { tournamentRepository } from '../repositories/tournament.repository';
import { teamRepository } from '../repositories/team.repository';
import {
  Tournament, TournamentTeamEntry, TournamentRound,
  TournamentMatch, TournamentBoard,
  TournamentFormat, TimeControl,
} from '../types';
import { logger } from '../utils/logger';

/**
 * Generates Swiss-system pairings for a given standings array.
 * Groups teams by score, then pairs within groups (top half vs bottom half).
 */
function swissPairings(standings: TournamentTeamEntry[], pastOpponents: Map<string, Set<string>>): [string, string][] {
  const sorted = [...standings].sort((a, b) =>
    (b.match_points - a.match_points) || (b.board_points - a.board_points)
  );
  const paired = new Set<string>();
  const result: [string, string][] = [];

  for (let i = 0; i < sorted.length; i++) {
    const a = sorted[i];
    if (paired.has(a.team_id)) continue;
    // Find nearest unpaired opponent not already played
    for (let j = i + 1; j < sorted.length; j++) {
      const b = sorted[j];
      if (paired.has(b.team_id)) continue;
      if (pastOpponents.get(a.team_id)?.has(b.team_id)) continue;
      paired.add(a.team_id);
      paired.add(b.team_id);
      result.push([a.team_id, b.team_id]);
      break;
    }
  }
  return result;
}

/**
 * Generates round-robin pairings for round `r` (1-based).
 * Uses the standard rotation algorithm.
 */
function roundRobinPairings(teamIds: string[], round: number): [string, string][] {
  const ids = [...teamIds];
  if (ids.length % 2 !== 0) ids.push('BYE');
  const n = ids.length;
  const fixed = ids[0];
  const rotating = ids.slice(1);
  const shift = (round - 1) % (n - 1);
  const rotated = [...rotating.slice(shift), ...rotating.slice(0, shift)];
  const pairs: [string, string][] = [];
  for (let i = 0; i < n / 2; i++) {
    const a = i === 0 ? fixed : rotated[i - 1];
    const b = rotated[n - 1 - i - 1];
    if (a !== 'BYE' && b !== 'BYE') pairs.push([a, b]);
  }
  return pairs;
}

class TournamentService {
  async createTournament(organizerId: string, params: {
    name: string;
    description?: string;
    leagueId?: string;
    format: TournamentFormat;
    teamSize?: number;
    timeControl?: TimeControl;
    maxTeams?: number;
    roundsTotal?: number;
    startDate?: Date;
  }): Promise<Tournament> {
    if (!params.name?.trim()) throw Object.assign(new Error('Tournament name required'), { status: 400 });

    const roundsTotal = params.roundsTotal ?? (params.format === 'swiss' ? 5 : 1);

    return tournamentRepository.create({
      name: params.name.trim(),
      description: params.description,
      organizerId,
      leagueId: params.leagueId,
      format: params.format,
      teamSize: params.teamSize ?? 4,
      timeControl: params.timeControl ?? 'rapid',
      maxTeams: params.maxTeams,
      roundsTotal,
      startDate: params.startDate,
    });
  }

  async getTournament(id: string): Promise<Tournament> {
    const t = await tournamentRepository.findById(id);
    if (!t) throw Object.assign(new Error('Tournament not found'), { status: 404 });
    return t;
  }

  async listTournaments(params: {
    status?: string;
    leagueId?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ tournaments: Tournament[]; total: number }> {
    return tournamentRepository.list(params as Parameters<typeof tournamentRepository.list>[0]);
  }

  async registerTeam(tournamentId: string, teamId: string, userId: string): Promise<TournamentTeamEntry> {
    const tournament = await this.getTournament(tournamentId);
    if (tournament.status !== 'registration') {
      throw Object.assign(new Error('Registration is closed'), { status: 400 });
    }

    const member = await teamRepository.getMember(teamId, userId);
    if (!member || !['captain', 'coach'].includes(member.role)) {
      throw Object.assign(new Error('Only team captain or coach can register'), { status: 403 });
    }

    if (tournament.max_teams) {
      const standings = await tournamentRepository.getStandings(tournamentId);
      if (standings.length >= tournament.max_teams) {
        throw Object.assign(new Error('Tournament is full'), { status: 400 });
      }
    }

    return tournamentRepository.registerTeam(tournamentId, teamId);
  }

  async startTournament(tournamentId: string, organizerId: string): Promise<TournamentRound> {
    const tournament = await this.getTournament(tournamentId);
    if (tournament.organizer_id !== organizerId) {
      throw Object.assign(new Error('Only the organizer can start the tournament'), { status: 403 });
    }
    if (tournament.status !== 'registration') {
      throw Object.assign(new Error('Tournament already started'), { status: 400 });
    }

    const entries = await tournamentRepository.getStandings(tournamentId);
    if (entries.length < 2) throw Object.assign(new Error('Need at least 2 teams to start'), { status: 400 });

    await tournamentRepository.updateStatus(tournamentId, 'active');
    return this.generateNextRound(tournament, entries, []);
  }

  async getStandings(tournamentId: string): Promise<TournamentTeamEntry[]> {
    return tournamentRepository.getStandings(tournamentId);
  }

  async getRounds(tournamentId: string): Promise<TournamentRound[]> {
    return tournamentRepository.getRounds(tournamentId);
  }

  async getMatchesForRound(roundId: string): Promise<TournamentMatch[]> {
    return tournamentRepository.getMatchesForRound(roundId);
  }

  async getMatch(matchId: string): Promise<TournamentMatch | null> {
    return tournamentRepository.getMatch(matchId);
  }

  async getBoardsForMatch(matchId: string): Promise<TournamentBoard[]> {
    return tournamentRepository.getBoardsForMatch(matchId);
  }

  async submitBoardResult(
    matchId: string,
    boardId: string,
    result: 'white' | 'black' | 'draw',
    organizerId: string,
    liveGameId?: string,
  ): Promise<void> {
    const match = await tournamentRepository.getMatch(matchId);
    if (!match) throw Object.assign(new Error('Match not found'), { status: 404 });

    const tournament = await this.getTournament(match.tournament_id);
    if (tournament.organizer_id !== organizerId) {
      throw Object.assign(new Error('Only the organizer can submit results'), { status: 403 });
    }

    await tournamentRepository.setBoardResult(boardId, result, liveGameId);

    // Recalculate match score from all board results
    const boards = await tournamentRepository.getBoardsForMatch(matchId);
    let aPoints = 0;
    let bPoints = 0;
    for (const b of boards) {
      if (b.result === 'white') aPoints += 1;
      else if (b.result === 'black') bPoints += 1;
      else if (b.result === 'draw') { aPoints += 0.5; bPoints += 0.5; }
    }
    await tournamentRepository.updateMatchPoints(matchId, aPoints, bPoints);

    // Check if match is complete (all boards have results)
    const pending = boards.filter((b) => !b.result || b.result === 'pending');
    if (pending.length === 0) {
      await tournamentRepository.updateMatchStatus(matchId, 'completed');
      await this.onMatchCompleted(match, aPoints, bPoints);
    }
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private async generateNextRound(
    tournament: Tournament,
    standings: TournamentTeamEntry[],
    existingRounds: TournamentRound[],
  ): Promise<TournamentRound> {
    const nextNum = existingRounds.length + 1;
    const round = await tournamentRepository.createRound(tournament.id, nextNum);

    let pairings: [string, string][] = [];

    if (tournament.format === 'swiss') {
      const pastOpponents = await this.buildPastOpponentsMap(tournament.id);
      pairings = swissPairings(standings, pastOpponents);
    } else if (tournament.format === 'round_robin') {
      const teamIds = standings.map((s) => s.team_id);
      pairings = roundRobinPairings(teamIds, nextNum);
    } else {
      // knockout: pair top vs bottom seed
      const ids = standings.map((s) => s.team_id);
      for (let i = 0; i < ids.length / 2; i++) {
        pairings.push([ids[i], ids[ids.length - 1 - i]]);
      }
    }

    await tournamentRepository.updateRoundStatus(round.id, 'active');

    for (const [aId, bId] of pairings) {
      const match = await tournamentRepository.createMatch({
        roundId: round.id,
        tournamentId: tournament.id,
        teamAId: aId,
        teamBId: bId,
      });
      await tournamentRepository.updateMatchStatus(match.id, 'active');
      // Create board slots
      for (let b = 1; b <= tournament.team_size; b++) {
        await tournamentRepository.createBoard({ matchId: match.id, boardNumber: b });
      }
    }

    logger.info('Round generated', { tournamentId: tournament.id, round: nextNum, matchCount: pairings.length });
    return round;
  }

  private async onMatchCompleted(match: TournamentMatch, aPoints: number, bPoints: number): Promise<void> {
    // Award match points: 2 for win, 1 for tie, 0 for loss
    const aMatchPts = aPoints > bPoints ? 2 : aPoints === bPoints ? 1 : 0;
    const bMatchPts = bPoints > aPoints ? 2 : aPoints === bPoints ? 1 : 0;

    await tournamentRepository.addMatchPoints(match.tournament_id, match.team_a_id, aMatchPts, aPoints);
    await tournamentRepository.addMatchPoints(match.tournament_id, match.team_b_id, bMatchPts, bPoints);

    // Check if all matches in round are done
    const allMatches = await tournamentRepository.getMatchesForRound(match.round_id);
    const allDone = allMatches.every((m) => m.status === 'completed');
    if (allDone) {
      await tournamentRepository.updateRoundStatus(match.round_id, 'completed');
      await tournamentRepository.incrementRoundsDone(match.tournament_id);

      const tournament = await tournamentRepository.findById(match.tournament_id);
      if (!tournament) return;

      if (tournament.rounds_done >= tournament.rounds_total) {
        await tournamentRepository.updateStatus(tournament.id, 'completed');
        logger.info('Tournament completed', { tournamentId: tournament.id });
      } else {
        const standings = await tournamentRepository.getStandings(tournament.id);
        const rounds = await tournamentRepository.getRounds(tournament.id);
        await this.generateNextRound(tournament, standings, rounds);
      }
    }
  }

  private async buildPastOpponentsMap(tournamentId: string): Promise<Map<string, Set<string>>> {
    const map = new Map<string, Set<string>>();
    const rounds = await tournamentRepository.getRounds(tournamentId);
    for (const round of rounds) {
      const matches = await tournamentRepository.getMatchesForRound(round.id);
      for (const m of matches) {
        if (!map.has(m.team_a_id)) map.set(m.team_a_id, new Set());
        if (!map.has(m.team_b_id)) map.set(m.team_b_id, new Set());
        map.get(m.team_a_id)!.add(m.team_b_id);
        map.get(m.team_b_id)!.add(m.team_a_id);
      }
    }
    return map;
  }
}

export const tournamentService = new TournamentService();

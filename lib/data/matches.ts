import { MatchData } from '../agents/orchestrator';

export const MOCK_MATCHES: MatchData[] = [
  {
    id: 'm1',
    code: 'EPL-2425-MC-ARS',
    teams: { home: 'MAN CITY', away: 'ARSENAL' },
    league: 'Premier League',
    odds: { win: 1.85, draw: 3.50, loss: 4.20 },
    startTime: '2026-04-12T19:30:00Z'
  },
  {
    id: 'm2',
    code: 'LALIGA-2425-RM-BAR',
    teams: { home: 'REAL MADRID', away: 'BARCELONA' },
    league: 'La Liga',
    odds: { win: 2.10, draw: 3.40, loss: 3.10 },
    startTime: '2026-04-12T21:00:00Z'
  },
  {
    id: 'm3',
    code: 'KLEAGUE-24-SEO-ULW',
    teams: { home: 'FC SEOUL', away: 'ULSAN HD' },
    league: 'K League 1',
    odds: { win: 2.75, draw: 3.20, loss: 2.45 },
    startTime: '2026-04-12T17:00:00Z'
  },
  {
    id: 'm4',
    code: 'BUND-2425-BY-LEV',
    teams: { home: 'BAYERN MUNICH', away: 'LEVERKUSEN' },
    league: 'Bundesliga',
    odds: { win: 1.65, draw: 4.10, loss: 5.50 },
    startTime: '2026-04-13T02:00:00Z'
  },
  {
    id: 'm5',
    code: 'KLEAGUE-24-JEJ-DAE',
    teams: { home: 'JEJU UTD', away: 'DAEGU FC' },
    league: 'K League 1',
    odds: { win: 2.30, draw: 3.10, loss: 3.20 },
    startTime: '2026-04-12T14:30:00Z'
  }
];

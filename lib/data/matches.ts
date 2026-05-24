import { MatchData } from '../agents/orchestrator';

export interface EnrichedMockMatch extends MatchData {
  sport?: 'soccer' | 'baseball' | 'basketball' | 'football' | 'tennis';
}

export const MOCK_MATCHES: EnrichedMockMatch[] = [
  {
    id: 'm1',
    code: 'EPL-2425-MC-ARS',
    teams: { home: 'MAN CITY', away: 'ARSENAL' },
    league: 'Premier League',
    odds: { win: 1.85, draw: 3.50, loss: 4.20 },
    startTime: '2026-04-12T19:30:00Z',
    isFeatured: true,
    previewScore: '2:1',
    sport: 'soccer',
    stats: {
      home: { form: 'W-W-D-W-L', xG: 2.1, goalsScored: 12, goalsConceded: 5, winRate: 70 },
      away: { form: 'W-W-W-D-W', xG: 1.95, goalsScored: 10, goalsConceded: 3, winRate: 80 },
      headToHead: '최근 5경기 2승 2무 1패 MAN CITY 우세'
    }
  },
  {
    id: 'm2',
    code: 'LALIGA-2425-RM-BAR',
    teams: { home: 'REAL MADRID', away: 'BARCELONA' },
    league: 'La Liga',
    odds: { win: 2.10, draw: 3.40, loss: 3.10 },
    startTime: '2026-04-12T21:00:00Z',
    isFeatured: true,
    previewScore: '2:2',
    sport: 'soccer',
    stats: {
      home: { form: 'W-L-W-W-W', xG: 2.05, goalsScored: 11, goalsConceded: 4, winRate: 80 },
      away: { form: 'W-W-L-W-W', xG: 1.88, goalsScored: 9, goalsConceded: 6, winRate: 60 },
      headToHead: '최근 5경기 3승 0무 2패 REAL MADRID 우세'
    }
  },
  {
    id: 'm3',
    code: 'KLEAGUE-24-SEO-ULW',
    teams: { home: 'FC SEOUL', away: 'ULSAN HD' },
    league: 'K League 1',
    odds: { win: 2.75, draw: 3.20, loss: 2.45 },
    startTime: '2026-04-12T17:00:00Z',
    previewScore: '1:0',
    sport: 'soccer',
    stats: {
      home: { form: 'D-W-L-D-W', xG: 1.35, goalsScored: 6, goalsConceded: 5, winRate: 40 },
      away: { form: 'W-W-D-W-L', xG: 1.68, goalsScored: 9, goalsConceded: 4, winRate: 60 },
      headToHead: '최근 5경기 3승 2무 0패 ULSAN HD 우세'
    }
  },
  {
    id: 'm4',
    code: 'BUND-2425-BY-LEV',
    teams: { home: 'BAYERN MUNICH', away: 'LEVERKUSEN' },
    league: 'Bundesliga',
    odds: { win: 1.65, draw: 4.10, loss: 5.50 },
    startTime: '2026-04-13T02:00:00Z',
    previewScore: '3:1',
    sport: 'soccer',
    stats: {
      home: { form: 'W-W-W-W-W', xG: 2.45, goalsScored: 15, goalsConceded: 2, winRate: 100 },
      away: { form: 'D-W-W-D-W', xG: 1.75, goalsScored: 8, goalsConceded: 4, winRate: 60 },
      headToHead: '최근 5경기 2승 1무 2패 동률'
    }
  },
  {
    id: 'm5',
    code: 'KLEAGUE-24-JEJ-DAE',
    teams: { home: 'JEJU UTD', away: 'DAEGU FC' },
    league: 'K League 1',
    odds: { win: 2.30, draw: 3.10, loss: 3.20 },
    startTime: '2026-04-12T14:30:00Z',
    previewScore: '1:1',
    sport: 'soccer',
    stats: {
      home: { form: 'L-D-L-W-L', xG: 1.05, goalsScored: 4, goalsConceded: 7, winRate: 20 },
      away: { form: 'L-L-D-W-D', xG: 1.15, goalsScored: 5, goalsConceded: 6, winRate: 20 },
      headToHead: '최근 5경기 1승 3무 1패 동률'
    }
  },
  {
    id: 'm6',
    code: 'KBO-2026-OB-LG',
    teams: { home: 'DOOSAN BEARS', away: 'LG TWINS' },
    league: 'KBO League',
    odds: { win: 1.75, draw: 9.00, loss: 2.10 },
    startTime: '2026-04-12T18:30:00Z',
    previewScore: '6:4',
    sport: 'baseball',
    stats: {
      home: { form: 'W-W-L-W-W', xG: 1.2, goalsScored: 28, goalsConceded: 18, winRate: 65 },
      away: { form: 'L-W-W-L-W', xG: 1.1, goalsScored: 22, goalsConceded: 20, winRate: 50 },
      headToHead: '올 시즌 3승 2패 DOOSAN BEARS 우세'
    }
  },
  {
    id: 'm7',
    code: 'MLB-2026-LAD-SF',
    teams: { home: 'LA DODGERS', away: 'SF GIANTS' },
    league: 'MLB',
    odds: { win: 1.55, draw: 11.00, loss: 2.45 },
    startTime: '2026-04-12T22:15:00Z',
    previewScore: '8:3',
    sport: 'baseball',
    stats: {
      home: { form: 'W-W-W-W-L', xG: 1.4, goalsScored: 35, goalsConceded: 12, winRate: 80 },
      away: { form: 'L-L-W-W-L', xG: 0.9, goalsScored: 15, goalsConceded: 24, winRate: 40 },
      headToHead: '최근 10경기 7승 3패 LA DODGERS 절대 우세'
    }
  },
  {
    id: 'm8',
    code: 'NBA-2026-LAL-GSW',
    teams: { home: 'LA LAKERS', away: 'GS WARRIORS' },
    league: 'NBA',
    odds: { win: 1.82, draw: 15.00, loss: 1.95 },
    startTime: '2026-04-13T10:30:00Z',
    previewScore: '112:108',
    sport: 'basketball',
    stats: {
      home: { form: 'W-L-W-L-W', xG: 1.15, goalsScored: 560, goalsConceded: 540, winRate: 60 },
      away: { form: 'L-W-L-W-L', xG: 1.12, goalsScored: 550, goalsConceded: 560, winRate: 40 },
      headToHead: '최근 5경기 3승 2패 LA LAKERS 우세'
    }
  }
];

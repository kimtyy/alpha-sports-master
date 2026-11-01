import type { MatchData } from './agents/orchestrator';

export type LeagueScope = 'kleague' | 'international' | 'all';
export const LEAGUE_SCOPES: {id: LeagueScope; label: string}[] = [
  {id: 'kleague', label: 'K리그'}, {id: 'international', label: '해외·국제'}, {id: 'all', label: '전체'},
];
const LABELS: Record<number,string> = {
  292:'K리그1',293:'K리그2',39:'EPL',140:'라리가',78:'분데스리가',135:'세리에 A',
  61:'리그 1',98:'J리그1',88:'에레디비시',253:'MLS',235:'러시아 프리미어리그',
};
export function leagueLabel(league:string,leagueId?:number) {
  return (leagueId && LABELS[leagueId]) || league;
}
export function isKLeague(match:MatchData) {
  return match.rawIds?.leagueId===292 || match.rawIds?.leagueId===293;
}
export function inLeagueScope(match:MatchData,scope:LeagueScope) {
  return scope==='all' || (scope==='kleague'?isKLeague(match):!isKLeague(match));
}
export function leagueKey(match:MatchData) {
  return match.rawIds?.leagueId?`id:${match.rawIds.leagueId}`:`name:${match.league}`;
}
export function leagueOptions(matches:MatchData[],scope:LeagueScope) {
  const options=new Map<string,{value:string;label:string;count:number}>();
  for(const match of matches.filter(m=>inLeagueScope(m,scope))){
    const value=leagueKey(match),existing=options.get(value);
    if(existing)existing.count++;
    else options.set(value,{value,label:leagueLabel(match.league,match.rawIds?.leagueId),count:1});
  }
  return [...options.values()].sort((a,b)=>{
    const priority=(v:string)=>v==='id:292'?0:v==='id:293'?1:2;
    return priority(a.value)-priority(b.value)||a.label.localeCompare(b.label,'ko');
  });
}
export function filterMatches<T extends MatchData>(matches:T[],scope:LeagueScope,league='all',query=''):T[] {
  const q=query.trim().toLocaleLowerCase();
  return matches.filter(m=>inLeagueScope(m,scope)&&(league==='all'||leagueKey(m)===league)&&
    (!q||[m.teams.home,m.teams.away,m.league,leagueLabel(m.league,m.rawIds?.leagueId)]
      .some(s=>s.toLocaleLowerCase().includes(q))));
}
export function compareMatchSchedule(a:MatchData,b:MatchData) {
  const aDate=new Date(Date.parse(a.startTime)+9*3600000).toISOString().slice(0,10);
  const bDate=new Date(Date.parse(b.startTime)+9*3600000).toISOString().slice(0,10);
  // Preserve date chronology. Within each Korean date, show domestic fixtures first.
  return aDate.localeCompare(bDate)||Number(isKLeague(b))-Number(isKLeague(a))||
    Date.parse(a.startTime)-Date.parse(b.startTime)||a.id.localeCompare(b.id);
}
export function fixtureStatusLabel(status?:string) {
  if(status==='NS')return '경기 예정';
  if(['FT','AET','PEN'].includes(status||''))return '경기 종료';
  if(['1H','HT','2H','ET','BT','P','LIVE'].includes(status||''))return '경기 진행 중';
  if(status==='PST')return '경기 연기';
  if(status==='CANC')return '경기 취소';
  return '일정 확인 필요';
}
export function oddsAvailabilityMessage(match:MatchData) {
  if(match.oddsUnavailableReason==='FETCH_FAILED')return '배당을 불러오지 못했습니다. 다시 조회해 주세요.';
  if(match.oddsStatus!=='AVAILABLE')return '제공된 배당이 없습니다. 이후 제공될 수 있습니다.';
  return null;
}

import type {FeatureKey} from '@narra/shared';

/** UI routing only; server feature/ownership checks remain authoritative. Match path segments, not prefixes. */
export function routeFeature(path:string):FeatureKey|undefined{
 const parts=path.replace(/\/+$/,'').split('/');
 if(parts[1]!=='app')return undefined;
 if(!parts[2])return 'research.overview';
 switch(parts[2]){
  case 'personal-radar':return 'research.personal_radar';
  case 'theses':return 'research.thesis_tracker';
  case 'briefing':return 'research.personal_briefing';
  case 'radar':case 'narratives':return 'research.narratives';
  case 'tokens':return 'research.tokens';
  case 'smart-money':return 'research.smart_money';
  case 'opportunities':return 'research.opportunities';
  case 'analytics':return 'research.decision_analytics';
  case 'agent':return 'research.chat';
  default:return undefined; // Own-account Alerts/Settings and separately authorized Admin.
 }
}

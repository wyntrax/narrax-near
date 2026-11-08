import {act,render,screen,waitFor,cleanup} from '@testing-library/react';
import {afterEach,it,expect,vi} from 'vitest';
import {NextIntlClientProvider} from 'next-intl';
import {z} from 'zod';
import type {ReactNode} from 'react';
import {AuthContext,type AuthAdapter} from '@/components/auth/context';
import {empty} from '@/test/fixtures';
import messages from '../../../messages/research/en.json';
import site from '../../../messages/en.json';
import {hasFeature,ResearchWorkspace,useResearchQuery} from './session';
vi.mock('./shell',()=>({ResearchShell:({children}:{children:ReactNode})=>children}));
vi.mock('@/i18n/navigation',()=>({Link:({children,href}:{children:ReactNode;href:string})=><a href={href}>{children}</a>,useRouter:()=>({replace:vi.fn()}),usePathname:()=>'/app'}));
const auth=(userId:string|null):AuthAdapter=>({ready:true,authenticated:!!userId,userId,getAccessToken:async()=>userId,login:vi.fn(),logout:async()=>{}});
function Probe(){const query=useResearchQuery('private',z.object({label:z.string()}));return <p>{query.data?.label??'waiting for research'}</p>;}
function Tree({user}:{user:string|null}){return <NextIntlClientProvider locale="en" messages={{workspace:messages,common:site.common}}><AuthContext.Provider value={auth(user)}><ResearchWorkspace theme="dark"><Probe/></ResearchWorkspace></AuthContext.Provider></NextIntlClientProvider>;}
afterEach(()=>{cleanup();vi.unstubAllGlobals();vi.unstubAllEnvs();});
it('requires explicit feature permission even with legacy rollout disabled; unknown features fail closed',()=>{
 const access={...empty,rollout:{enforced:false,shadow_log:false}};
 expect(hasFeature(access,'research.chat')).toBe(false);expect(hasFeature(access,'unknown')).toBe(false);
 expect(hasFeature({...access,features:{...access.features,'research.chat':{requiredTier:'MEMBER',allowed:true,min_entitlement_age_hours:0}}},'research.chat')).toBe(true);
 // An admin holds every known research feature without a tier, but an unknown key still fails closed.
 expect(hasFeature({...access,admin:true},'research.chat')).toBe(true);expect(hasFeature({...access,admin:true},'unknown')).toBe(false);
});
it('removes private content immediately on sign-out',async()=>{
 vi.stubEnv('NEXT_PUBLIC_API_URL','http://localhost:4000');vi.stubGlobal('fetch',vi.fn(async(input:URL)=>new Response(JSON.stringify(input.pathname.endsWith('entitlements')?empty:{label:'private A'}),{status:200})));
 const view=render(<Tree user="A"/>);await screen.findByText('private A');view.rerender(<Tree user={null}/>);
 expect(screen.queryByText('private A')).not.toBeInTheDocument();expect(await screen.findByText('Sign in to your workspace')).toBeVisible();
});
it('ignores late data from the previous identity even when the network ignores abort',async()=>{
 vi.stubEnv('NEXT_PUBLIC_API_URL','http://localhost:4000');let finishA:(value:Response)=>void=()=>{};
 const fetcher=vi.fn(async(input:URL,init:RequestInit)=>{if(input.pathname.endsWith('entitlements'))return new Response(JSON.stringify(empty));if((init.headers as Record<string,string>).Authorization==='Bearer A')return new Promise<Response>(resolve=>{finishA=resolve;});return new Response(JSON.stringify({label:'private B'}));});vi.stubGlobal('fetch',fetcher);
 const view=render(<Tree user="A"/>);await waitFor(()=>expect(fetcher).toHaveBeenCalledTimes(2));view.rerender(<Tree user="B"/>);await screen.findByText('private B');
 await act(async()=>{finishA(new Response(JSON.stringify({label:'private A'})));});expect(screen.queryByText('private A')).not.toBeInTheDocument();expect(screen.getByText('private B')).toBeVisible();
});

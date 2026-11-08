import {getTranslations} from 'next-intl/server';
import {AuthBoundary} from '@/components/auth/boundary';
import {AccessFlow} from '@/features/access/controller';
import {BrandMark} from '@/components/brand-mark';
import {ShieldCheck,ArrowLeft} from 'lucide-react';
import {Link} from '@/i18n/navigation';
import {PoweredBy} from '@/components/powered-by';
import './access-design.css';

export default async function EarlyAccess(){
 const t=await getTranslations('access'),c=await getTranslations('common'),l=await getTranslations('landing'),v=await getTranslations('visual');
 return <main id="main" className="access-page container">
  <div className="access-atmosphere" aria-hidden="true"/>
  <div className="access-layout">
   <div className="access-heading"><Link href="/" className="access-back"><ArrowLeft size={14}/>{v('back')}</Link><span className="badge access-eyebrow">{c('earlyAccess')}</span><h1>{l('headlineStart')}<br/><span>{l('headlineAccent')}</span></h1><p>{t('subcopy')}</p><div className="access-emblem" aria-hidden="true"><span/><span/><div className="core-emblem"><BrandMark/></div><i className="emblem-satellite satellite-one"/><i className="emblem-satellite satellite-two"/></div><p className="access-assurance"><ShieldCheck size={16}/>{l('messageOnly')}</p></div>
   <div className="access-stage"><div className="access-panel-label"><span className="tiny-dot"/>{v('accountAccess')}<span>01 — 03</span></div><AuthBoundary><AccessFlow/></AuthBoundary></div>
  </div>
  <PoweredBy className="powered-by-access"/>
 </main>;
}

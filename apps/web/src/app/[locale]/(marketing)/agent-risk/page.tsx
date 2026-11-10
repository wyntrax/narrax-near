import type {Metadata} from 'next';
import {Link} from '@/i18n/navigation';
import {pageMetadata, seoLocale} from '@/lib/seo';
import {agentRiskCopy} from '@/content/agent-risk';
import {AgentRiskPanel} from '@/components/marketing/agent-risk-panel';
import {StructuredData} from '@/components/marketing/structured-data';
import {breadcrumbSchema} from '@/lib/structured-data';
import './agent-risk.css';

export async function generateMetadata({params}: {params: Promise<{locale: string}>}): Promise<Metadata> {
  const locale = seoLocale((await params).locale), copy = agentRiskCopy[locale];
  return pageMetadata(locale, '/agent-risk', copy.title, copy.description);
}

export default async function AgentRisk({params}: {params: Promise<{locale: string}>}) {
  const locale = seoLocale((await params).locale), copy = agentRiskCopy[locale];
  return <main id="main" className="container research-public agent-risk-page">
    <StructuredData data={[breadcrumbSchema(locale, [{name: copy.home, path: ''}, {name: copy.title, path: '/agent-risk'}])]}/>
    <nav aria-label={locale === 'id' ? 'Jejak navigasi' : 'Breadcrumb'} className="research-breadcrumb">
      <Link href="/">{copy.home}</Link><span aria-hidden="true">/</span><span>{copy.title}</span>
    </nav>
    <header>
      <p className="eyebrow">{copy.eyebrow}</p>
      <h1>{copy.title}</h1>
      <p className="research-public-intro">{copy.intro}</p>
    </header>
    <AgentRiskPanel copy={copy}/>
    <section className="agent-risk-how">
      <h2>{copy.how}</h2>
      <p>{copy.howBody}</p>
    </section>
  </main>;
}

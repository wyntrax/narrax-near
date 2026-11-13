import type {Metadata} from 'next';
import {Link} from '@/i18n/navigation';
import {pageMetadata, seoLocale} from '@/lib/seo';
import {thesisDeskCopy} from '@/content/thesis-desk';
import {ThesisDeskPanel} from '@/components/marketing/thesis-desk';
import {StructuredData} from '@/components/marketing/structured-data';
import {breadcrumbSchema} from '@/lib/structured-data';
import './thesis-desk.css';

export async function generateMetadata({params}: {params: Promise<{locale: string}>}): Promise<Metadata> {
  const locale = seoLocale((await params).locale), copy = thesisDeskCopy[locale];
  return pageMetadata(locale, '/thesis', copy.title, copy.description);
}

export default async function ThesisPage({params}: {params: Promise<{locale: string}>}) {
  const locale = seoLocale((await params).locale), copy = thesisDeskCopy[locale];
  return <main id="main" className="container research-public thesis-page">
    <StructuredData data={[breadcrumbSchema(locale, [{name: copy.home, path: ''}, {name: copy.title, path: '/thesis'}])]}/>
    <nav aria-label={locale === 'id' ? 'Jejak navigasi' : 'Breadcrumb'} className="research-breadcrumb">
      <Link href="/">{copy.home}</Link><span aria-hidden="true">/</span><span>{copy.title}</span>
    </nav>
    <header>
      <p className="eyebrow">{copy.eyebrow}</p>
      <h1>{copy.title}</h1>
      <p className="research-public-intro">{copy.intro}</p>
    </header>
    <ThesisDeskPanel copy={copy}/>
    <section className="thesis-clocks">
      <h2>{copy.clocksTitle}</h2>
      <p>{copy.clocksBody}</p>
      <div className="thesis-clocks-links">
        <Link className="button button-primary" href="/agent-risk">{copy.toAgentRisk}</Link>
        <Link className="button button-ghost" href="/methodology">{copy.toMethodology}</Link>
      </div>
    </section>
  </main>;
}

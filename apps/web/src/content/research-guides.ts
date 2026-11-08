import type {SeoLocale} from '@/lib/seo';

type Section = {title: string; paragraphs: string[]};
export type ResearchGuide = {slug: string; title: string; description: string; intro: string; sections: Section[]; checklist: string[]};
export const researchCopy = {
  en: {
    homeTitle: 'NEAR Narrative & Token Research',
    homeDescription: 'Research NEAR crypto narratives, early token activity and recorded market evidence with Narrax. Inspect evidence freshness, risk gaps and measured token outcomes.',
    title: 'NEAR research guides',
    description: 'Learn how to evaluate crypto narratives and early token activity on NEAR using source-backed evidence and explicit risk limits.',
    intro: 'Understand the evidence before interpreting a signal. These guides explain the research concepts behind Narrax, including what the data cannot establish.',
    methodology: 'Research methodology', methodologyDescription: 'How Narrax separates discovery, evidence checks and measured outcomes in NEAR narrative and token research. Read the limits before interpreting a signal.',
    home: 'Home', guides: 'Research guides', read: 'Read guide', all: 'All guides', methodologyCta: 'Read methodology', related: 'Continue researching', checklist: 'A practical research checklist',
    notice: 'Educational research, not financial advice. A signal or fresh risk row is not a guarantee of safety or future returns.',
    byline: 'By the Narrax research team', access: 'Explore early access',
    sources: 'Primary technical references', sourceNote: 'These references explain the underlying data and protocol concepts; they do not endorse Narrax or any token.',
  },
  id: {
    homeTitle: 'Riset Narasi & Token NEAR',
    homeDescription: 'Riset narasi kripto NEAR, aktivitas token awal, dan bukti pasar tercatat bersama Narrax. Periksa kesegaran bukti, celah risiko, dan hasil token terukur.',
    title: 'Panduan riset NEAR',
    description: 'Pelajari cara mengevaluasi narasi kripto dan aktivitas token awal di NEAR dengan bukti bersumber serta batas risiko yang jelas.',
    intro: 'Pahami bukti sebelum menafsirkan sinyal. Panduan ini menjelaskan konsep riset Narrax, termasuk hal-hal yang tidak dapat dibuktikan oleh data.',
    methodology: 'Metodologi riset', methodologyDescription: 'Cara Narrax memisahkan penemuan, pemeriksaan bukti, dan hasil terukur dalam riset narasi serta token NEAR. Pahami batasannya sebelum membaca sinyal.',
    home: 'Beranda', guides: 'Panduan riset', read: 'Baca panduan', all: 'Semua panduan', methodologyCta: 'Baca metodologi', related: 'Lanjutkan riset', checklist: 'Daftar periksa riset praktis',
    notice: 'Riset edukatif, bukan nasihat keuangan. Sinyal atau baris risiko terkini bukan jaminan keamanan maupun keuntungan mendatang.',
    byline: 'Oleh tim riset Narrax', access: 'Jelajahi akses awal',
    sources: 'Referensi teknis utama', sourceNote: 'Referensi ini menjelaskan konsep data dan protokol; bukan dukungan terhadap Narrax atau token apa pun.',
  },
} satisfies Record<SeoLocale, Record<string, string>>;

export const researchGuides: Record<SeoLocale, ResearchGuide[]> = {
  en: [
    {
      slug: 'near-narrative-research', title: 'How to research crypto narratives on NEAR',
      description: 'Separate a crypto narrative from token promotion: verify original sources, resolve exact NEAR token addresses and test whether attention has market evidence.',
      intro: 'A crypto narrative is a shared explanation for why a topic may matter. Attention can spread before a token has meaningful adoption, liquidity or even a clear connection to that topic. Narrative research starts by testing the connection, not buying the label.',
      sections: [
        {title: 'Start with the original source', paragraphs: ['Identify the announcement, release, proposal or event that caused the discussion. Record who published it and when. Several accounts quoting one announcement are not several independent confirmations.', 'Distinguish a verifiable product event from speculation, paid promotion and recycled screenshots. A social post can establish that someone made a claim; it cannot, on its own, establish that the claim is true.']},
        {title: 'Connect the topic to an exact token', paragraphs: ['A ticker is not an identity. Different tokens can share a symbol, and a pool address is not necessarily a token contract address. Resolve the exact NEAR token contract and check whether the cited source actually identifies it.', 'A token name that resembles a trending phrase is only a candidate match. Treat uncertain associations as unresolved rather than assigning the narrative to whichever token has the most attention.']},
        {title: 'Compare attention with market evidence', paragraphs: ['Inspect the timestamps and provenance of price, liquidity and holder observations. Missing holder data is unknown, not zero. A fresh price does not make an hours-old holder snapshot current.', 'Attention without adequate liquidity may not be tradable. Holder counts do not prove independent ownership, and a volume spike can reflect concentration or artificial activity. No single metric validates a narrative.']},
        {title: 'Evaluate prospectively, not from a winners list', paragraphs: ['Freeze the evidence available when a research observation is published, then measure later prices against that entry. Keep failed candidates and unavailable outcomes visible so the sample is not limited to surviving winners.', 'A token-price return is not an executable trade return. Fees, spread, slippage, liquidity changes and failed execution can materially change what a participant could realize. Small samples cannot establish a repeatable edge.']},
      ],
      checklist: ['Save the original source and publication time.', 'Resolve the exact token contract; do not rely on ticker similarity.', 'Check price, liquidity and holder timestamps separately.', 'Mark uncertain connections and missing outcomes as unknown.', 'Compare later outcomes without rewriting the original evidence.'],
    },
    {
      slug: 'early-token-risk-checklist', title: 'An early NEAR token research and risk checklist',
      description: 'Inspect token contract identity, liquidity, holder concentration, authorities and evidence freshness when researching early NEAR tokens. Missing data is not a safety pass.',
      intro: 'Early token activity can be noisy, illiquid and adversarial. A trending chart is not a security audit, and a low reported risk score cannot eliminate the possibility of loss. Research begins by identifying what is actually known at the observation time.',
      sections: [
        {title: 'Verify identity and market provenance', paragraphs: ['Match the exact token contract to the market pair and the source you are reading. Check whether market capitalization is measured from circulating supply or is a fully diluted valuation proxy.', 'Record when the quote was observed and whether the market source knows the token. A missing quote, an ambiguous symbol or a future-dated timestamp should stop an inference, not be filled with a guessed value.']},
        {title: 'Read liquidity alongside price and volume', paragraphs: ['A quoted price can move sharply in a thin pool. Inspect liquidity before interpreting a percentage increase or assuming a position could be exited at the displayed price.', 'Reported volume and liquidity are observations, not execution guarantees. Route availability, slippage, fees and pool changes can prevent a trade from matching a chart-based return.']},
        {title: 'Understand holder and authority limitations', paragraphs: ['Holder count and top-holder concentration describe a snapshot, not beneficial ownership. Related accounts may split one economic position across many addresses.', 'Token contract ownership, pause controls and deployer balances need their own evidence. Missing deployer attribution must remain unknown rather than appearing as a zero-percent holding. A fresh risk row is not a declaration that a token is safe.']},
        {title: 'Demand fresh evidence and honest outcomes', paragraphs: ['Narrax Early Radar uses a 15-minute price freshness gate and a 60-minute holder freshness gate alongside its other publication rules. Passing a freshness gate only establishes recency, not investment quality.', 'Later horizons that cannot be measured remain unknown. Research should not backfill a convenient entry, replace an unavailable observation with a hindsight price or present gross token returns as actual account profit.']},
      ],
      checklist: ['Verify the token contract and market pair.', 'Identify market-cap versus fully diluted valuation assumptions.', 'Check liquidity and concentration, not price alone.', 'Keep missing authority and deployer evidence unknown.', 'Read timestamps and execution limitations before interpreting returns.'],
    },
  ],
  id: [
    {
      slug: 'near-narrative-research', title: 'Cara meriset narasi kripto di NEAR',
      description: 'Bedakan narasi kripto dari promosi token: periksa sumber asli, pastikan alamat token NEAR, dan uji apakah perhatian didukung bukti pasar.',
      intro: 'Narasi kripto adalah penjelasan bersama tentang mengapa suatu topik dianggap penting. Perhatian bisa menyebar sebelum token memiliki adopsi, likuiditas, atau hubungan yang jelas dengan topik tersebut. Riset dimulai dengan menguji hubungan itu, bukan membeli labelnya.',
      sections: [
        {title: 'Mulai dari sumber asli', paragraphs: ['Temukan pengumuman, rilis, proposal, atau peristiwa yang memicu pembicaraan. Catat penerbit dan waktunya. Banyak akun yang mengutip satu pengumuman bukan berarti ada banyak konfirmasi independen.', 'Bedakan peristiwa produk yang dapat diverifikasi dari spekulasi, promosi berbayar, dan tangkapan layar daur ulang. Unggahan sosial membuktikan adanya klaim, tetapi tidak otomatis membuktikan kebenaran klaim tersebut.']},
        {title: 'Hubungkan topik dengan token yang tepat', paragraphs: ['Ticker bukan identitas. Token berbeda dapat memakai simbol yang sama, dan alamat pool belum tentu alamat kontrak token. Pastikan token contract NEAR yang tepat dan periksa apakah sumber benar-benar menyebut token itu.', 'Nama token yang mirip frasa populer hanya menghasilkan kandidat hubungan. Biarkan hubungan yang meragukan belum terselesaikan; jangan memilih token hanya karena paling ramai.']},
        {title: 'Bandingkan perhatian dengan bukti pasar', paragraphs: ['Periksa waktu serta asal data harga, likuiditas, dan holder. Data holder yang tidak tersedia berarti tidak diketahui, bukan nol. Harga terkini tidak membuat snapshot holder lama menjadi terkini.', 'Perhatian tanpa likuiditas memadai belum tentu dapat diperdagangkan. Jumlah holder tidak membuktikan kepemilikan independen. Lonjakan volume dapat mencerminkan konsentrasi atau aktivitas buatan; satu metrik tidak cukup untuk mengesahkan narasi.']},
        {title: 'Ukur ke depan, bukan dari daftar pemenang', paragraphs: ['Bekukan bukti yang tersedia saat observasi riset diterbitkan, lalu ukur harga berikutnya terhadap entri tersebut. Pertahankan kandidat gagal dan hasil yang tidak tersedia agar sampel tidak hanya berisi pemenang yang bertahan.', 'Imbal hasil harga token bukan hasil transaksi yang pasti bisa dieksekusi. Biaya, spread, slippage, perubahan likuiditas, dan kegagalan eksekusi dapat mengubah hasil nyata. Sampel kecil belum membuktikan keunggulan berulang.']},
      ],
      checklist: ['Simpan sumber asli dan waktu penerbitannya.', 'Pastikan token contract; jangan mengandalkan kemiripan ticker.', 'Periksa waktu harga, likuiditas, dan holder secara terpisah.', 'Tandai hubungan meragukan dan hasil yang hilang sebagai tidak diketahui.', 'Bandingkan hasil berikutnya tanpa menulis ulang bukti awal.'],
    },
    {
      slug: 'early-token-risk-checklist', title: 'Daftar periksa riset dan risiko token awal NEAR',
      description: 'Periksa identitas token contract, likuiditas, konsentrasi holder, otoritas, dan kesegaran bukti token awal NEAR. Data hilang bukan tanda aman.',
      intro: 'Aktivitas token awal bisa bising, tidak likuid, dan penuh manipulasi. Grafik populer bukan audit keamanan, dan skor risiko rendah tidak menghilangkan kemungkinan rugi. Riset dimulai dari apa yang benar-benar diketahui saat observasi.',
      sections: [
        {title: 'Verifikasi identitas dan asal data pasar', paragraphs: ['Cocokkan token contract yang tepat dengan pasangan pasar dan sumber yang dibaca. Periksa apakah kapitalisasi pasar memakai suplai beredar atau hanya proksi valuasi terdilusi penuh.', 'Catat waktu pengamatan harga dan apakah sumber pasar mengenali token. Harga hilang, simbol ambigu, atau waktu di masa depan harus menghentikan kesimpulan, bukan diisi dengan perkiraan.']},
        {title: 'Baca likuiditas bersama harga dan volume', paragraphs: ['Harga dapat bergerak tajam di pool tipis. Periksa likuiditas sebelum menafsirkan persentase kenaikan atau menganggap posisi dapat dijual pada harga layar.', 'Volume dan likuiditas adalah observasi, bukan jaminan eksekusi. Ketersediaan rute, slippage, biaya, dan perubahan pool dapat membuat hasil transaksi berbeda dari grafik.']},
        {title: 'Pahami batas data holder dan otoritas', paragraphs: ['Jumlah holder dan konsentrasi holder besar menggambarkan snapshot, bukan pemilik manfaat akhir. Alamat terkait dapat memecah satu posisi ekonomi menjadi banyak akun.', 'Kepemilikan kontrak token, kontrol pause, dan saldo deployer membutuhkan bukti masing-masing. Atribusi deployer yang hilang harus tetap tidak diketahui, bukan kepemilikan nol persen. Baris risiko terkini bukan pernyataan bahwa token aman.']},
        {title: 'Tuntut bukti terkini dan hasil yang jujur', paragraphs: ['Early Radar Narrax memakai batas kesegaran harga 15 menit dan holder 60 menit bersama aturan penerbitan lainnya. Lolos pemeriksaan kesegaran hanya membuktikan kebaruan, bukan mutu investasi.', 'Horizon berikutnya yang tidak dapat diukur tetap tidak diketahui. Riset tidak boleh mengisi entri yang menguntungkan secara retrospektif, mengganti observasi hilang dengan harga setelah kejadian, atau menyajikan imbal hasil token bruto sebagai laba akun nyata.']},
      ],
      checklist: ['Verifikasi token contract dan pasangan pasar.', 'Bedakan kapitalisasi pasar dari asumsi valuasi terdilusi penuh.', 'Periksa likuiditas dan konsentrasi, bukan harga saja.', 'Biarkan bukti otoritas dan deployer yang hilang tetap tidak diketahui.', 'Baca waktu observasi dan batas eksekusi sebelum menafsirkan hasil.'],
    },
  ],
};

export function findResearchGuide(locale: SeoLocale, slug: string) {
  return researchGuides[locale].find(guide => guide.slug === slug);
}
export const researchReferences = [
  {name: 'NEAR documentation: accounts', url: 'https://docs.near.org/protocol/account-model'},
  {name: 'NEAR documentation: transactions', url: 'https://docs.near.org/protocol/transactions'},
  {name: 'NEAR documentation: token authorities', url: 'https://docs.near.org/tokens/token-standard'},
  {name: 'DEX Screener API reference', url: 'https://docs.dexscreener.com/api/reference'},
] as const;

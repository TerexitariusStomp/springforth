// Minimal i18n — a flat strings table keyed by (lang, key). English is
// the fallback: any missing key renders English, so adding a locale is
// incremental. Swahili (sw) ships first — Kenya field deployment.
export type Lang = 'en' | 'sw';

const STRINGS: Record<Lang, Record<string, string>> = {
  en: {
    tagline: 'Coordinate first.',
    hero: 'People declare what they want to make happen; the commons offers what it already has — tools, hours, skills, space. When enough commit, coordination activates. And before anyone duplicates work, the overlap layer shows who is already pursuing the same outcome.',
    'step.declare': 'Declare',
    'step.declare.body': '"I want to…" with what you bring, what you need, a quorum and a deadline.',
    'step.commit': 'Commit',
    'step.commit.body': 'Others opt in and pledge resources. The coordination layer matches needs to existing offers first.',
    'step.activate': 'Activate',
    'step.activate.body': 'At quorum the commitment binds — while outcomes reveal who else is already working on the same thing.',
    'step.verify': 'Verify',
    'step.verify.body': 'Open-evidence readings and post-event appreciation close the loop — trust compounds into the next declaration.',
    'attention.title': 'What needs attention',
    'attention.none': 'Nothing waiting — declare a possibility to start the loop.',
    'cards.title': 'Possibility cards',
    'explore.title': 'Explore the graph',
    'nav.portfolio': 'Portfolio', 'nav.outcomes': 'Outcomes',
    'nav.coordination': 'Coordination', 'nav.commitments': 'Commitments',
    'nav.verify': 'Verify', 'nav.rounds': 'Funding rounds',
    'nav.governance': 'Governance', 'nav.datasets': 'Datasets',
    'nav.possibilities': 'Deck', 'nav.ledger': 'audit ledger',
  },
  sw: {
    tagline: 'Ratibu kwanza.',
    hero: 'Watu hutangaza kile wanataka kufanya; jamii hutoa kile inayoshikilia tayari — zana, saa, ujuzi, nafasi. Watu wengi wa kutosha wakiidhinisha, uratibu huanza. Na kabla mtu yeyote hajarudia kazi, safu ya miguso inaonyesha nani tayari anafuatilia lengo lilelile.',
    'step.declare': 'Tangaza',
    'step.declare.body': '"Nataka…" pamoja na unachochangia, unachohitaji, idadi ya kutosha na tarehe ya mwisho.',
    'step.commit': 'Jitolee',
    'step.commit.body': 'Wengine wanaingia na kuahidi rasilimali. Safu ya uratibu hulinganisha mahitaji na hifadhi zilizopo kwanza.',
    'step.activate': 'Anzisha',
    'step.activate.body': 'Idadi inapofika, ahadi hufungwa — huku matokeo yakionyesha nani mwingine tayari anafanya jambo lilelile.',
    'step.verify': 'Thibitisha',
    'step.verify.body': 'Usomaji wa ushahidi wa wazi na shukrani baada ya tukio hufunga mzunguko — uaminifu huongezeka kwenye tangazo linalofuata.',
    'attention.title': 'Kinachohitaji uangalizi',
    'attention.none': 'Hakuna kinachosubiri — tangaza uwezekano kuanzisha mzunguko.',
    'cards.title': 'Kadi za uwezekano',
    'explore.title': 'Chunguza grafu',
    'nav.portfolio': 'Kwingineko', 'nav.outcomes': 'Matokeo',
    'nav.coordination': 'Uratibu', 'nav.commitments': 'Ahadi',
    'nav.verify': 'Thibitisha', 'nav.rounds': 'Mzunguko wa ufadhili',
    'nav.governance': 'Utawala', 'nav.datasets': 'Takwimu',
    'nav.possibilities': 'Kadi', 'nav.ledger': 'daftar ya ukaguzi',
  },
};

export const LANGS: Lang[] = ['en', 'sw'];

export const langFrom = (url: URL, cookie?: string | null): Lang => {
  const q = url.searchParams.get('lang');
  if (q === 'sw' || q === 'en') return q;
  const c = cookie?.match(/(?:^|;\s*)lang=(sw|en)/)?.[1];
  return (c as Lang) ?? 'en';
};

export function t(lang: Lang, key: string): string {
  return STRINGS[lang][key] ?? STRINGS.en[key] ?? key;
}

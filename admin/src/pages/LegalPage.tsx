import { useEffect } from 'react'
import { ArrowLeft, CircleAlert } from 'lucide-react'
import { Link } from 'react-router-dom'
import { LocaleSwitcher } from '../components/LocaleSwitcher'
import { usePublicLocale, type PublicLocale } from '../i18n/PublicLocale'

export type LegalDocumentKind = 'privacy' | 'terms'

type LegalSection = {
  title: string
  body: string
}

type LegalDocument = {
  title: string
  updated: string
  intro: string
  sections: LegalSection[]
  resourceLabel: string
  resourceUrl: string
}

const operator = {
  name: import.meta.env.VITE_LEGAL_ENTITY_NAME?.trim() ?? '',
  companyId: import.meta.env.VITE_LEGAL_COMPANY_ID?.trim() ?? '',
  address: import.meta.env.VITE_LEGAL_REGISTERED_ADDRESS?.trim() ?? '',
  email: import.meta.env.VITE_LEGAL_CONTACT_EMAIL?.trim() ?? '',
}

const operatorConfigReady = Object.values(operator).every(Boolean)
const legalPublishReady = operatorConfigReady && import.meta.env.VITE_LEGAL_PUBLISH_READY === 'true'

function operatorDescription(locale: PublicLocale) {
  if (!operatorConfigReady) {
    return locale === 'cs'
      ? 'Provozovatel služby Coach Foska — právní název, IČO, sídlo a kontaktní e-mail musí být doplněny před veřejným spuštěním.'
      : 'The operator of Coach Foska — legal name, company ID, registered address and contact email must be completed before public launch.'
  }

  return locale === 'cs'
    ? `${operator.name}, IČO ${operator.companyId}, se sídlem ${operator.address}. Kontakt: ${operator.email}.`
    : `${operator.name}, company ID ${operator.companyId}, registered at ${operator.address}. Contact: ${operator.email}.`
}

function privacyDocument(locale: PublicLocale): LegalDocument {
  const controller = operatorDescription(locale)

  if (locale === 'cs') {
    return {
      title: 'Informace o zpracování osobních údajů',
      updated: 'Aktualizováno 13. července 2026',
      intro: 'Tento dokument vysvětluje, jaké osobní údaje Coach Foska používá, proč je potřebuje a jaká máte práva. Služba je v současnosti dostupná pouze pozvaným klientům.',
      resourceLabel: 'Úřad pro ochranu osobních údajů',
      resourceUrl: 'https://uoou.gov.cz/informace-o-zpracovani-osobnich-udaju',
      sections: [
        {
          title: '1. Správce a kontakt',
          body: controller,
        },
        {
          title: '2. Jaké údaje zpracováváme',
          body: 'Podle využívaných funkcí může jít o údaje účtu a profilu, přihlašovací a bezpečnostní údaje, odpovědi z onboardingu, tréninkové a pohybové záznamy, jídelníčky a záznamy stravy, údaje o hydrataci, hmotnosti a tělesných mírách, check-iny, fotografie, komunikaci s trenérem, token zařízení pro oznámení a technické diagnostické údaje. Některé z těchto údajů mohou vypovídat o zdravotním stavu a patří mezi zvláštní kategorie osobních údajů.',
        },
        {
          title: '3. Účely a právní základy',
          body: 'Údaje účtu a záznamy potřebné k poskytování služby zpracováváme pro splnění smlouvy nebo kroků před jejím uzavřením. Bezpečnostní a omezené provozní záznamy můžeme zpracovávat na základě oprávněného zájmu na ochraně služby. Údaje potřebné pro účetnictví či řešení právních nároků zpracováváme z důvodu právních povinností. Údaje o zdravotním stavu lze pro personalizovaný coaching zpracovávat pouze na základě výslovného souhlasu nebo jiného platného důvodu podle čl. 9 GDPR. Volitelná analytika, marketing a oznámení vyžadují samostatné posouzení a volbu uživatele, pokud to právní předpisy vyžadují.',
        },
        {
          title: '4. Jak údaje používáme',
          body: 'Údaje používáme k vytvoření a úpravám tréninkového a výživového plánu, zobrazení historie a pokroku, komunikaci s trenérem, zpracování check-inů, provozu připomínek, podpoře uživatelů, zabezpečení účtu a zlepšování spolehlivosti služby. Nepoužíváme je pro nesouvisející účely bez dalšího právního základu a odpovídajícího informování.',
        },
        {
          title: '5. Komu mohou být údaje zpřístupněny',
          body: 'K údajům mohou v nezbytném rozsahu přistupovat váš trenér a oprávnění správci služby. Technické zpracování mohou zajišťovat dodavatelé databáze, autentizace, hostingu, úložiště, e-mailu, oznámení a zákaznické podpory. Coach Foska používá Supabase pro backendové služby. Pokud vědomě použijete volitelnou AI funkci, například analýzu fotografie jídla, může být příslušný vstup odeslán poskytovateli AI; konkrétní poskytovatel a podmínky musí být uvedeny u dané funkce před jejím veřejným spuštěním.',
        },
        {
          title: '6. Předávání mimo EHP',
          body: 'Někteří techničtí dodavatelé mohou zpracovávat údaje mimo Evropský hospodářský prostor. V takovém případě musí být použito platné rozhodnutí o odpovídající ochraně, standardní smluvní doložky nebo jiná zákonná záruka. Informace o konkrétních předáních musí odpovídat finálnímu seznamu dodavatelů.',
        },
        {
          title: '7. Doba uchování',
          body: 'Údaje účtu a coachingové záznamy uchováváme pouze po dobu potřebnou k poskytování účtu a následně po omezenou dobu nutnou k vyřízení žádostí, bezpečnostních událostí nebo právních nároků. Účetní údaje se uchovávají po zákonem stanovenou dobu. Zálohy se odstraňují v rámci běžného cyklu obnovy. Konkrétní produkční retenční plán musí být dokončen a technicky prosazen před veřejným spuštěním.',
        },
        {
          title: '8. Vaše práva',
          body: 'Za podmínek GDPR můžete požádat o přístup, opravu, výmaz, omezení zpracování a přenositelnost údajů nebo vznést námitku. Souhlas můžete kdykoli odvolat; tím není dotčena zákonnost dřívějšího zpracování. Máte také právo podat stížnost u Úřadu pro ochranu osobních údajů nebo jiného příslušného dozorového úřadu. Žádosti se zasílají na kontaktní e-mail správce.',
        },
        {
          title: '9. Úložiště prohlížeče a zabezpečení',
          body: 'Webová aplikace používá nezbytné úložiště prohlížeče k udržení přihlášení, zabezpečení relace a zapamatování jazyka. Nepoužívá reklamní cookies. Používáme přiměřená technická a organizační opatření, ale žádný internetový systém nelze označit za absolutně bezpečný.',
        },
        {
          title: '10. Děti a změny dokumentu',
          body: 'Služba není určena dětem bez odpovídajícího souhlasu a zapojení zákonného zástupce. Minimální věk a případný režim účtů pro nezletilé musí odpovídat finálnímu obchodnímu modelu a místním právním předpisům. O podstatných změnách této informace budeme uživatele informovat vhodným způsobem a uvedeme nové datum účinnosti.',
        },
      ],
    }
  }

  return {
    title: 'Privacy notice',
    updated: 'Updated 13 July 2026',
    intro: 'This notice explains which personal data Coach Foska uses, why it is needed and which rights you have. The service is currently available only to invited clients.',
    resourceLabel: 'European Commission: information for individuals',
    resourceUrl: 'https://commission.europa.eu/law/law-topic/data-protection/information-individuals_en',
    sections: [
      {
        title: '1. Controller and contact',
        body: controller,
      },
      {
        title: '2. Data we process',
        body: 'Depending on the features you use, this may include account and profile details, authentication and security data, onboarding answers, workout and activity logs, meal plans and meal logs, hydration data, weight and body measurements, check-ins, photos, coach conversations, device tokens for notifications and technical diagnostics. Some of this information may reveal health status and qualify as special-category personal data.',
      },
      {
        title: '3. Purposes and legal bases',
        body: 'We process account details and records needed to provide the service to perform a contract or take steps before entering one. We may process security and limited operational logs for our legitimate interest in protecting the service. We process records required for accounting or legal claims to meet legal obligations. Health-related data may be processed for personalised coaching only with explicit consent or another valid condition under Article 9 GDPR. Optional analytics, marketing and notifications require separate assessment and user choice where the law requires it.',
      },
      {
        title: '4. How we use data',
        body: 'We use data to create and adjust training and nutrition plans, show history and progress, support coach communication, process check-ins, operate reminders, provide user support, secure accounts and improve service reliability. We do not use it for unrelated purposes without a further legal basis and appropriate notice.',
      },
      {
        title: '5. Who may receive data',
        body: 'Your coach and authorised service administrators may access data where necessary. Technical processing may be provided by database, authentication, hosting, storage, email, notification and support suppliers. Coach Foska uses Supabase for backend services. If you knowingly use an optional AI feature, such as meal-photo analysis, the relevant input may be sent to an AI provider; the specific provider and terms must be disclosed next to that feature before public launch.',
      },
      {
        title: '6. Transfers outside the EEA',
        body: 'Some technical suppliers may process data outside the European Economic Area. In that case, an adequacy decision, standard contractual clauses or another lawful safeguard must be used. Details of specific transfers must match the final production supplier list.',
      },
      {
        title: '7. Retention',
        body: 'Account and coaching records are retained only while needed to provide the account and for a limited period afterwards to handle requests, security incidents or legal claims. Accounting records are retained for statutory periods. Backups are removed through the normal recovery cycle. A specific production retention schedule must be completed and technically enforced before public launch.',
      },
      {
        title: '8. Your rights',
        body: 'Subject to the GDPR, you may request access, correction, deletion, restriction and portability or object to processing. You may withdraw consent at any time without affecting earlier lawful processing. You may also complain to the Czech Office for Personal Data Protection or another competent supervisory authority. Send requests to the controller contact email.',
      },
      {
        title: '9. Browser storage and security',
        body: 'The web app uses essential browser storage to keep you signed in, secure the session and remember your language. It does not use advertising cookies. We use appropriate technical and organisational safeguards, but no internet service can honestly be described as completely secure.',
      },
      {
        title: '10. Children and changes',
        body: 'The service is not intended for children without appropriate consent and involvement from a parent or legal guardian. The minimum age and any minor-account model must match the final service design and local law. We will notify users appropriately about material changes to this notice and show the new effective date.',
      },
    ],
  }
}

function termsDocument(locale: PublicLocale): LegalDocument {
  const provider = operatorDescription(locale)

  if (locale === 'cs') {
    return {
      title: 'Podmínky používání',
      updated: 'Aktualizováno 13. července 2026',
      intro: 'Tyto podmínky upravují používání Coach Foska pozvanými klienty. Veřejný web v současnosti nenabízí nákup ani otevřenou registraci.',
      resourceLabel: 'Česká obchodní inspekce: digitální obsah a služby',
      resourceUrl: 'https://coi.gov.cz/faq/smlouvy-o-poskytovani-digitalniho-obsahu-ci-sluzby/',
      sections: [
        {
          title: '1. Poskytovatel',
          body: provider,
        },
        {
          title: '2. Co služba poskytuje',
          body: 'Coach Foska je nástroj pro spolupráci klienta s trenérem. Může obsahovat tréninkové a výživové plány, záznamy aktivit a stravy, recepty, přehled pokroku, check-iny, komunikaci s trenérem, připomínky a volitelné funkce využívající AI. Dostupné funkce se mohou lišit podle plánu a fáze vývoje.',
        },
        {
          title: '3. Pozvánka a účet',
          body: 'Účet vytváří nebo schvaluje trenér či správce služby. Musíte uvádět pravdivé údaje, chránit přístup ke svému e-mailu a zařízení a bez odkladu oznámit podezření na zneužití. Účet nesmíte sdílet ani používat pro nezákonnou činnost.',
        },
        {
          title: '4. Zdraví a bezpečnost',
          body: 'Coach Foska poskytuje obecnou podporu pro fitness a výživu, nikoli lékařskou diagnózu, léčbu, fyzioterapii ani krizovou pomoc. Pokud máte zranění, zdravotní omezení, jste těhotná, užíváte léky nebo máte v minulosti poruchu příjmu potravy, konzultujte plán s kvalifikovaným odborníkem. Při bolesti, závrati, bolesti na hrudi, mdlobě nebo neobvyklé dušnosti aktivitu přerušte a vyhledejte odpovídající pomoc.',
        },
        {
          title: '5. Obsah uživatele',
          body: 'Za fotografie, zprávy, poznámky a další obsah, který nahrajete, odpovídáte vy. Nesmíte nahrávat nezákonný obsah, obsah porušující práva jiných osob ani osobní údaje třetích osob bez oprávnění. Udělujete poskytovateli omezené oprávnění tento obsah technicky uložit a zpracovat pouze pro provoz vámi používaných funkcí.',
        },
        {
          title: '6. AI a odhady',
          body: 'Výstupy AI, odhady kalorií, makroživin a tréninkových metrik mohou být nepřesné. Před použitím důležitého doporučení jej ověřte s trenérem nebo kvalifikovaným odborníkem. AI funkce nejsou určeny pro naléhavé nebo zdravotnické rozhodování.',
        },
        {
          title: '7. Cena a případné předplatné',
          body: 'Tento veřejný web nyní neumožňuje nákup. Pokud bude nabídnuta placená služba, před objednávkou obdržíte jasné informace o ceně včetně daní, době trvání, obnovování, ukončení, způsobu plnění, reklamacích a případném právu na odstoupení. Pravidla Apple nebo Google se mohou použít na nákup provedený v jejich obchodě.',
        },
        {
          title: '8. Dostupnost, změny a aktualizace',
          body: 'Službu můžeme udržovat, opravovat a rozvíjet. Nezaručujeme nepřetržitou dostupnost, ale poskytneme aktualizace a nápravu vad v rozsahu vyžadovaném právními předpisy. Pokud změna digitální služby významně negativně ovlivní její používání, budou zachována práva spotřebitele na informování a případné ukončení.',
        },
        {
          title: '9. Ukončení účtu',
          body: 'O ukončení účtu můžete požádat prostřednictvím kontaktního e-mailu. Přístup můžeme omezit při závažném porušení podmínek, bezpečnostním riziku nebo ukončení spolupráce, vždy s ohledem na závazná práva spotřebitele. Nakládání s údaji po ukončení popisují informace o zpracování osobních údajů.',
        },
        {
          title: '10. Odpovědnost a práva spotřebitele',
          body: 'Nic v těchto podmínkách nevylučuje odpovědnost ani práva, která nelze podle zákona omezit, včetně práv z vadného digitálního obsahu nebo služby. Odpovídáte za bezpečné provádění cvičení, vhodné vybavení a rozhodnutí, zda je aktivita přiměřená vašemu stavu. Konkrétní omezení odpovědnosti musí před veřejným spuštěním zkontrolovat právník podle finálního obchodního modelu.',
        },
        {
          title: '11. Rozhodné právo a kontakt',
          body: 'Použije se právo podle sídla poskytovatele, aniž by tím byla omezena závazná ochrana spotřebitele v zemi jeho obvyklého bydliště. Dotazy, stížnosti a žádosti se zasílají na kontaktní e-mail poskytovatele. Příslušné informace o mimosoudním řešení sporů musí být doplněny podle identity a sídla finálního poskytovatele.',
        },
      ],
    }
  }

  return {
    title: 'Terms of use',
    updated: 'Updated 13 July 2026',
    intro: 'These terms govern use of Coach Foska by invited clients. The public website currently offers neither purchases nor open registration.',
    resourceLabel: 'Your Europe: contract information',
    resourceUrl: 'https://europa.eu/youreurope/citizens/consumers/shopping/contract-information/index_en.htm',
    sections: [
      {
        title: '1. Provider',
        body: provider,
      },
      {
        title: '2. What the service provides',
        body: 'Coach Foska is a tool for collaboration between a client and coach. It may include training and nutrition plans, activity and meal logs, recipes, progress views, check-ins, coach messaging, reminders and optional AI-supported features. Available features may vary by plan and development stage.',
      },
      {
        title: '3. Invitation and account',
        body: 'An account is created or approved by a coach or service administrator. You must provide accurate information, protect access to your email and device and report suspected misuse promptly. You may not share the account or use it for unlawful activity.',
      },
      {
        title: '4. Health and safety',
        body: 'Coach Foska provides general fitness and nutrition support, not medical diagnosis, treatment, physiotherapy or emergency help. Consult a qualified professional if you have an injury or medical limitation, are pregnant, take medication or have a history of an eating disorder. Stop activity and seek appropriate help if you experience pain, dizziness, chest pain, fainting or unusual shortness of breath.',
      },
      {
        title: '5. User content',
        body: 'You are responsible for photos, messages, notes and other content you upload. You may not upload unlawful content, content that infringes another person’s rights or third-party personal data without authority. You grant the provider limited permission to store and process that content only to operate the features you use.',
      },
      {
        title: '6. AI and estimates',
        body: 'AI outputs and calorie, macro or training estimates may be inaccurate. Verify important guidance with your coach or a qualified professional before relying on it. AI features are not intended for emergency or clinical decisions.',
      },
      {
        title: '7. Pricing and possible subscriptions',
        body: 'This public site does not currently offer a purchase. If a paid service is offered, you will receive clear pre-contract information about the total price, taxes, duration, renewal, cancellation, performance, complaints and any withdrawal right. Apple or Google terms may apply to a purchase made through their store.',
      },
      {
        title: '8. Availability, changes and updates',
        body: 'We may maintain, repair and develop the service. We do not promise uninterrupted availability, but will provide updates and remedies for defects to the extent required by law. If a change to a digital service materially harms its use, mandatory consumer rights to notice and possible termination remain available.',
      },
      {
        title: '9. Ending an account',
        body: 'You may request account closure through the contact email. We may restrict access for a serious breach, security risk or the end of the coaching relationship, subject to mandatory consumer rights. The privacy notice describes what happens to personal data after closure.',
      },
      {
        title: '10. Liability and consumer rights',
        body: 'Nothing in these terms excludes liability or rights that cannot lawfully be limited, including statutory rights for defective digital content or services. You remain responsible for safe exercise technique, suitable equipment and deciding whether an activity is appropriate for your condition. Any specific limitation of liability must be reviewed against the final business model before public launch.',
      },
      {
        title: '11. Governing law and contact',
        body: 'The law of the provider’s establishment applies without removing mandatory consumer protection in the country where a consumer usually lives. Send questions, complaints and requests to the provider contact email. Applicable alternative-dispute-resolution information must be completed once the final provider identity and establishment are confirmed.',
      },
    ],
  }
}

const pageCopy = {
  en: {
    back: 'Back to Coach Foska',
    draftTitle: 'Pre-release legal draft',
    draftBody: 'The mobile templates were not publishable: they were explicitly marked as samples and contained unresolved placeholders. Complete the operator identity, retention schedule, supplier list and consent flow, then obtain Czech legal review before public launch.',
    officialGuidance: 'Official guidance used for this draft:',
    privacy: 'Privacy',
    terms: 'Terms',
  },
  cs: {
    back: 'Zpět na Coach Foska',
    draftTitle: 'Právní návrh před spuštěním',
    draftBody: 'Šablony v mobilní aplikaci nebyly připravené ke zveřejnění: byly výslovně označené jako vzor a obsahovaly nedoplněné údaje. Před veřejným spuštěním doplňte identitu provozovatele, retenční plán, seznam dodavatelů a souhlas se zpracováním zdravotních údajů a zajistěte kontrolu českým právníkem.',
    officialGuidance: 'Oficiální zdroj použitý pro návrh:',
    privacy: 'Ochrana soukromí',
    terms: 'Podmínky',
  },
} as const

export default function LegalPage({ kind }: { kind: LegalDocumentKind }) {
  const { locale } = usePublicLocale()
  const page = pageCopy[locale]
  const document = kind === 'privacy' ? privacyDocument(locale) : termsDocument(locale)

  useEffect(() => {
    window.scrollTo({ top: 0 })
    window.document.title = `${document.title} · Coach Foska`
    return () => {
      window.document.title = 'Coach Foska'
    }
  }, [document.title])

  return (
    <div className="min-h-dvh bg-background text-text-primary">
      <header className="border-b border-outline-subtle bg-surface">
        <div className="mx-auto flex h-18 max-w-5xl items-center justify-between gap-4 px-5 sm:px-8">
          <Link to="/" className="inline-flex items-center gap-2 text-sm font-semibold text-text-secondary transition-colors hover:text-text-primary">
            <ArrowLeft size={16} aria-hidden="true" /> {page.back}
          </Link>
          <LocaleSwitcher />
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-12 sm:px-8 sm:py-16">
        <p className="flex items-center gap-2 ledger-label text-text-secondary">
          <span className="h-3.5 w-[3px] shrink-0 rounded-full bg-accent-strong" aria-hidden="true" />
          Coach Foska
        </p>
        <h1 className="mt-4 text-4xl font-display font-bold tracking-tight sm:text-5xl">{document.title}</h1>
        <p className="mt-4 text-sm font-medium text-text-secondary">{document.updated}</p>
        <p className="mt-7 text-base leading-8 text-text-secondary">{document.intro}</p>

        {!legalPublishReady && (
          <div className="mt-9 rounded-2xl border border-warning/35 bg-warning/10 p-5" role="note">
            <div className="flex gap-3">
              <CircleAlert size={20} className="mt-0.5 shrink-0 text-warning" aria-hidden="true" />
              <div>
                <h2 className="text-sm font-extrabold text-text-primary">{page.draftTitle}</h2>
                <p className="mt-2 text-sm leading-6 text-text-secondary">{page.draftBody}</p>
              </div>
            </div>
          </div>
        )}

        <div className="mt-12 space-y-10">
          {document.sections.map(section => (
            <section key={section.title}>
              <h2 className="text-xl font-display font-bold tracking-tight">{section.title}</h2>
              <p className="mt-3 text-sm leading-7 text-text-secondary sm:text-base sm:leading-8">{section.body}</p>
            </section>
          ))}
        </div>

        <div className="mt-14 border-t border-outline-subtle pt-7 text-sm leading-6 text-text-secondary">
          {page.officialGuidance}{' '}
          <a href={document.resourceUrl} target="_blank" rel="noreferrer" className="font-semibold text-text-primary underline decoration-outline underline-offset-4 hover:text-accent">
            {document.resourceLabel}
          </a>
        </div>

        <nav className="mt-10 flex gap-6 border-t border-outline-subtle pt-7 text-sm font-semibold" aria-label="Legal documents">
          <Link to="/privacy" className={kind === 'privacy' ? 'text-accent' : 'text-text-secondary hover:text-text-primary'}>{page.privacy}</Link>
          <Link to="/terms" className={kind === 'terms' ? 'text-accent' : 'text-text-secondary hover:text-text-primary'}>{page.terms}</Link>
        </nav>
      </main>
    </div>
  )
}

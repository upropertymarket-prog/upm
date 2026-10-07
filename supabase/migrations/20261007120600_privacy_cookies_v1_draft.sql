-- UProperty Market — P11-07, antecipada
--
-- Primeira versão da **Política de Privacidade** e da **Política de Cookies**,
-- MINUTA PARA REVISÃO JURÍDICA, em PT e EN (07 §5.13: EN cobre os textos
-- legais desde a v1).
--
-- Antecipado a 6 out 2026 a pedido do cliente. P11-07 continua aberta: o que
-- fecha essa tarefa é a revisão por advogado e os dados da empresa, não a
-- existência das páginas. Ambos os documentos entram com
-- `review_state = 'draft_pending_legal_review'`, o que faz a app mostrar o
-- aviso por cima do texto — igual aos Termos (P9-02).
--
-- **O texto descreve o que a plataforma faz hoje, não um modelo genérico.** Foi
-- escrito a partir do código, não de um template:
--   * `upm-locale` (`packages/config/i18n.ts`) — cookie de idioma, 365 dias,
--     `sameSite=lax`, `httpOnly=false`, `secure` em produção.
--   * cookies de sessão do Supabase (`@supabase/ssr`, `packages/db/src/server.ts`).
--   * o tema vive no `localStorage`, escrito pelo `ThemeProvider` de `@upm/ui`
--     — não é cookie, e por isso aparece como armazenamento local, não na
--     tabela de cookies.
--   * analítica **sem cookies** (07 §4.4) — é por isso que não há banner de
--     consentimento na v1, como já está escrito em `actions/preferences.ts`.
-- Se algum destes pontos mudar, muda primeiro o produto e só depois o texto.
--
-- Os dados da empresa e os prazos de conservação ficam como marcadores em
-- maiúsculas, pela mesma razão dos Termos: `app_settings` (P8-05) tem
-- `company_name`, `company_tax_id`, `company_address`, `company_email` e
-- `company_phone` vazios, e os prazos de conservação são uma das lacunas
-- assinaladas em §19 da minuta dos Termos. Nenhum foi inventado.

set search_path = public, extensions;

-- ---------------------------------------------------------------------------
-- Política de Privacidade — PT
-- ---------------------------------------------------------------------------

insert into public.legal_documents (kind, version, locale, title, body_md, status, review_state, effective_from, published_at)
values (
  'privacy',
  '2026.10-draft1',
  'pt',
  'Política de Privacidade — UProperty Market',
  $privacy_pt$
> **MINUTA PARA REVISÃO JURÍDICA — NÃO É UM DOCUMENTO DEFINITIVO.**
> Este texto foi redigido como estrutura de trabalho e **tem de ser revisto e
> aprovado por advogado** antes de a plataforma entrar em produção. Contém
> lacunas assinaladas em §10, que dependem de decisões ainda por tomar.
> Nenhuma cláusula aqui escrita deve ser tratada como validada juridicamente.

## 1. Quem trata os seus dados

O responsável pelo tratamento é **[NOME LEGAL DA EMPRESA]**, com sede em **[MORADA]**,
NIPC **[NIPC]**, contactável em **[EMAIL DE CONTACTO]** e **[TELEFONE]**.

Esta política explica que dados pessoais a plataforma **UProperty Market** recolhe, porquê, durante
quanto tempo os conserva e que direitos lhe assistem.

## 2. Que dados recolhemos

| Categoria | Exemplos | Quando |
| --------- | -------- | ------ |
| Identificação e contacto | nome, e-mail, telefone | no registo |
| Conta | palavra-passe (guardada cifrada, nunca em claro), idioma, tema | no registo e nas definições |
| Aceitação de documentos legais | versão aceite, hash do texto, data, endereço IP | ao aceitar os Termos |
| Subscrição e pagamento | plano, periodicidade, histórico de faturação | ao contratar |
| Conteúdo que publica | imóveis, fotografias, descrições, documentos | ao usar a plataforma |
| Mensagens e visitas | mensagens trocadas, pedidos e marcações de visita | ao usar a plataforma |
| Dados técnicos | endereço IP, tipo de dispositivo e navegador | em cada utilização |

**Não recolhemos categorias especiais de dados** (saúde, convicções, filiação sindical e
equivalentes) e não lhe pedimos esses dados em nenhum formulário.

## 3. Para que usamos os dados, e com que fundamento

| Finalidade | Fundamento (RGPD art. 6.º) |
| ---------- | -------------------------- |
| Criar e manter a sua conta | execução do contrato |
| Publicar e gerir os seus imóveis | execução do contrato |
| Cobrar a subscrição e emitir faturas | execução do contrato e obrigação legal |
| Provar que aceitou uma versão concreta dos Termos | obrigação legal e interesse legítimo |
| Segurança, prevenção de abuso e registo de acessos | interesse legítimo |
| Responder a pedidos de suporte | execução do contrato |

> **Nota para a revisão jurídica.** A conservação do endereço IP associado à aceitação dos Termos
> está aqui fundada em obrigação legal e interesse legítimo. A base legal concreta e o prazo de
> conservação são uma lacuna assinalada — ver §10.

## 4. Quem tem acesso

Os seus dados são acedidos por nós e pelos subcontratantes que a plataforma usa para funcionar.
À data desta minuta: o fornecedor de alojamento e base de dados, o fornecedor de pagamentos e o
fornecedor de envio de e-mail. **[LISTA DE SUBCONTRATANTES A FIXAR NA REVISÃO]**

O conteúdo que publica como anúncio é, por natureza, público: quem visita a plataforma vê-o.
As mensagens que troca são visíveis para si e para o destinatário.

Não vendemos dados pessoais a terceiros e não os cedemos para publicidade.

## 5. Transferências para fora do Espaço Económico Europeu

**[A FIXAR NA REVISÃO]** — depende dos subcontratantes efetivamente contratados e das garantias
aplicáveis (cláusulas contratuais-tipo ou decisão de adequação).

## 6. Durante quanto tempo guardamos

| Dados | Prazo |
| ----- | ----- |
| Conta e conteúdo | enquanto a conta existir |
| Faturação | o prazo legal de conservação fiscal |
| Aceitação de documentos legais | **[PRAZO A FIXAR]** |
| Registos técnicos e de segurança | **[PRAZO A FIXAR]** |

Quando elimina a conta, o perfil é **anonimizado e não apagado**: o histórico de aceitações e a
faturação têm de sobreviver sem ficarem órfãos. Deixa de ser possível ligar esses registos a si
através da plataforma.

## 7. Os seus direitos

Pode pedir **acesso**, **retificação**, **apagamento**, **limitação**, **portabilidade** e
**oposição** ao tratamento, e retirar o consentimento quando for esse o fundamento. Para exercer
qualquer destes direitos, escreva para **[EMAIL DE CONTACTO]**.

Tem também o direito de reclamar junto da **Comissão Nacional de Proteção de Dados (CNPD)**.

## 8. Segurança

As palavras-passe são guardadas cifradas. O acesso aos dados na base de dados é restringido por
políticas por linha, de modo que cada conta só alcança o que lhe pertence. As ligações são cifradas
em trânsito.

## 9. Cookies

O uso de cookies está descrito na **Política de Cookies**, em `/cookies`.

## 10. Lacunas assinaladas nesta minuta

| # | Assunto | Onde |
| - | ------- | ---- |
| 1 | Dados da empresa responsável pelo tratamento | §1 |
| 2 | Lista de subcontratantes | §4 |
| 3 | Transferências para fora do EEE e respetivas garantias | §5 |
| 4 | Prazos de conservação de aceitações e registos técnicos | §6 |
| 5 | Base legal da conservação do IP na aceitação | §3 |

---

**Versão 2026.10-draft1 · MINUTA PARA REVISÃO JURÍDICA.** Esta versão não substitui aconselhamento
jurídico e não deve entrar em produção sem revisão por advogado.
$privacy_pt$,
  'published',
  'draft_pending_legal_review',
  now(),
  now()
)
on conflict (kind, version, locale) do nothing;

-- ---------------------------------------------------------------------------
-- Privacy Policy — EN
-- ---------------------------------------------------------------------------

insert into public.legal_documents (kind, version, locale, title, body_md, status, review_state, effective_from, published_at)
values (
  'privacy',
  '2026.10-draft1',
  'en',
  'Privacy Policy — UProperty Market',
  $privacy_en$
> **DRAFT PENDING LEGAL REVIEW — THIS IS NOT A FINAL DOCUMENT.**
> This text was written as a working structure and **must be reviewed and approved by a lawyer**
> before the platform goes to production. It contains gaps flagged in §10 that depend on decisions
> still to be made. No clause written here should be treated as legally validated.
> In case of divergence, the Portuguese version prevails.

## 1. Who processes your data

The controller is **[LEGAL COMPANY NAME]**, with registered office at **[ADDRESS]**, tax number
**[NIPC]**, reachable at **[CONTACT EMAIL]** and **[PHONE]**.

This policy explains what personal data the **UProperty Market** platform collects, why, how long it
is kept, and what rights you have.

## 2. What we collect

| Category | Examples | When |
| -------- | -------- | ---- |
| Identification and contact | name, email, phone | at registration |
| Account | password (stored hashed, never in clear), language, theme | at registration and in settings |
| Legal document acceptance | accepted version, text hash, date, IP address | when accepting the Terms |
| Subscription and payment | plan, billing period, invoice history | when subscribing |
| Content you publish | properties, photographs, descriptions, documents | while using the platform |
| Messages and viewings | messages exchanged, viewing requests and bookings | while using the platform |
| Technical data | IP address, device and browser type | on each use |

**We do not collect special categories of data** (health, beliefs, trade union membership and
equivalent) and no form asks you for them.

## 3. Why we use the data, and on what basis

| Purpose | Basis (GDPR art. 6) |
| ------- | ------------------- |
| Creating and maintaining your account | performance of the contract |
| Publishing and managing your properties | performance of the contract |
| Charging the subscription and issuing invoices | performance of the contract and legal obligation |
| Proving you accepted a specific version of the Terms | legal obligation and legitimate interest |
| Security, abuse prevention and access logging | legitimate interest |
| Answering support requests | performance of the contract |

> **Note for legal review.** Retention of the IP address tied to Terms acceptance is grounded here on
> legal obligation and legitimate interest. The specific legal basis and retention period are a
> flagged gap — see §10.

## 4. Who has access

Your data is accessed by us and by the processors the platform relies on to operate. As of this
draft: the hosting and database provider, the payment provider and the email delivery provider.
**[LIST OF PROCESSORS TO BE FIXED AT REVIEW]**

Content you publish as a listing is public by nature: platform visitors can see it. Messages you
exchange are visible to you and to the recipient.

We do not sell personal data to third parties and do not share it for advertising.

## 5. Transfers outside the European Economic Area

**[TO BE FIXED AT REVIEW]** — depends on the processors actually engaged and the applicable
safeguards (standard contractual clauses or an adequacy decision).

## 6. How long we keep it

| Data | Period |
| ---- | ------ |
| Account and content | while the account exists |
| Billing | the statutory tax retention period |
| Legal document acceptance | **[PERIOD TO BE FIXED]** |
| Technical and security logs | **[PERIOD TO BE FIXED]** |

When you delete your account the profile is **anonymised, not deleted**: the acceptance history and
billing records must survive without becoming orphaned. Those records can no longer be linked to you
through the platform.

## 7. Your rights

You may request **access**, **rectification**, **erasure**, **restriction**, **portability** and
**objection** to processing, and withdraw consent where consent is the basis. To exercise any of
these rights, write to **[CONTACT EMAIL]**.

You also have the right to lodge a complaint with the Portuguese data protection authority
(**CNPD**).

## 8. Security

Passwords are stored hashed. Access to data in the database is restricted by row-level policies, so
each account only reaches what belongs to it. Connections are encrypted in transit.

## 9. Cookies

Cookie use is described in the **Cookie Policy**, at `/cookies`.

## 10. Gaps flagged in this draft

| # | Subject | Where |
| - | ------- | ----- |
| 1 | Controller company details | §1 |
| 2 | List of processors | §4 |
| 3 | Transfers outside the EEA and their safeguards | §5 |
| 4 | Retention periods for acceptances and technical logs | §6 |
| 5 | Legal basis for retaining the IP on acceptance | §3 |

---

**Version 2026.10-draft1 · DRAFT PENDING LEGAL REVIEW.** This version does not replace legal advice
and must not go to production without review by a lawyer.
$privacy_en$,
  'published',
  'draft_pending_legal_review',
  now(),
  now()
)
on conflict (kind, version, locale) do nothing;

-- ---------------------------------------------------------------------------
-- Política de Cookies — PT
-- ---------------------------------------------------------------------------

insert into public.legal_documents (kind, version, locale, title, body_md, status, review_state, effective_from, published_at)
values (
  'cookies',
  '2026.10-draft1',
  'pt',
  'Política de Cookies — UProperty Market',
  $cookies_pt$
> **MINUTA PARA REVISÃO JURÍDICA — NÃO É UM DOCUMENTO DEFINITIVO.**
> Este texto foi redigido como estrutura de trabalho e **tem de ser revisto e
> aprovado por advogado** antes de a plataforma entrar em produção.
> Nenhuma cláusula aqui escrita deve ser tratada como validada juridicamente.

## 1. O que esta política cobre

Explica que cookies e que armazenamento local a plataforma **UProperty Market** usa, para quê, e o
que pode fazer quanto a isso.

## 2. Porque não há banner de consentimento

**A plataforma só usa cookies estritamente necessários ao seu funcionamento.** A analítica do site
público funciona **sem cookies**, por decisão tomada na conceção do produto.

Cookies estritamente necessários estão dispensados de consentimento prévio. É por isso que não lhe
aparece um banner a pedir autorização: não há nada a autorizar. Se vier a existir um cookie que o
exija, o banner aparece **antes** de esse cookie ser escrito, e esta política muda com ele.

## 3. Cookies que usamos

| Cookie | Para que serve | Duração |
| ------ | -------------- | ------- |
| `upm-locale` | Guardar o idioma que escolheu, para as páginas abrirem nesse idioma | 365 dias |
| Cookies de sessão (`sb-…`) | Manter a sessão iniciada e proteger os pedidos autenticados | duração da sessão e da sua renovação |

Os cookies de sessão são escritos pelo serviço de autenticação que a plataforma usa. Sem eles não é
possível manter-se autenticado entre páginas.

## 4. Armazenamento local (não são cookies)

| Chave | Para que serve |
| ----- | -------------- |
| Preferência de tema | Guardar se escolheu o modo claro ou escuro |

Fica guardado no seu próprio navegador, **não é enviado para os nossos servidores** e não é usado
para o identificar.

## 5. Como controlar

Pode apagar ou bloquear cookies nas definições do seu navegador. Note que bloquear os cookies de
sessão impede-o de iniciar sessão — não é uma limitação que possamos contornar, é o que esses
cookies fazem.

## 6. Dados pessoais

O tratamento de dados pessoais está descrito na **Política de Privacidade**, em `/privacidade`.

---

**Versão 2026.10-draft1 · MINUTA PARA REVISÃO JURÍDICA.** Esta versão não substitui aconselhamento
jurídico e não deve entrar em produção sem revisão por advogado.
$cookies_pt$,
  'published',
  'draft_pending_legal_review',
  now(),
  now()
)
on conflict (kind, version, locale) do nothing;

-- ---------------------------------------------------------------------------
-- Cookie Policy — EN
-- ---------------------------------------------------------------------------

insert into public.legal_documents (kind, version, locale, title, body_md, status, review_state, effective_from, published_at)
values (
  'cookies',
  '2026.10-draft1',
  'en',
  'Cookie Policy — UProperty Market',
  $cookies_en$
> **DRAFT PENDING LEGAL REVIEW — THIS IS NOT A FINAL DOCUMENT.**
> This text was written as a working structure and **must be reviewed and approved by a lawyer**
> before the platform goes to production. No clause written here should be treated as legally
> validated. In case of divergence, the Portuguese version prevails.

## 1. What this policy covers

It explains which cookies and which local storage the **UProperty Market** platform uses, what for,
and what you can do about it.

## 2. Why there is no consent banner

**The platform only uses cookies strictly necessary for it to work.** Public-site analytics runs
**without cookies**, by a decision taken when the product was designed.

Strictly necessary cookies are exempt from prior consent. That is why no banner asks for your
permission: there is nothing to permit. Should a cookie requiring consent ever be introduced, the
banner appears **before** that cookie is written, and this policy changes with it.

## 3. Cookies we use

| Cookie | Purpose | Duration |
| ------ | ------- | -------- |
| `upm-locale` | Remember the language you chose, so pages open in it | 365 days |
| Session cookies (`sb-…`) | Keep you signed in and protect authenticated requests | the session and its renewal |

Session cookies are written by the authentication service the platform uses. Without them you cannot
stay signed in across pages.

## 4. Local storage (not cookies)

| Key | Purpose |
| --- | ------- |
| Theme preference | Remember whether you chose light or dark mode |

It stays in your own browser, **is not sent to our servers** and is not used to identify you.

## 5. How to control it

You can delete or block cookies in your browser settings. Note that blocking session cookies
prevents you from signing in — that is not a limitation we can work around, it is what those cookies
do.

## 6. Personal data

The processing of personal data is described in the **Privacy Policy**, at `/privacidade`.

---

**Version 2026.10-draft1 · DRAFT PENDING LEGAL REVIEW.** This version does not replace legal advice
and must not go to production without review by a lawyer.
$cookies_en$,
  'published',
  'draft_pending_legal_review',
  now(),
  now()
)
on conflict (kind, version, locale) do nothing;

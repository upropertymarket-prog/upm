-- UProperty Market — P11-07, Política de Cookies `2026.10-draft2`
--
-- MINUTA PARA REVISÃO JURÍDICA. Substitui `2026.10-draft1`, que fica
-- `archived` — nunca editada.
--
-- O que a v2 acrescenta, e porquê cada peça sai do código:
--   * a distinção entre cookie e armazenamento local, porque o tema vive no
--     `localStorage` (escrito pelo `ThemeProvider` de `@upm/ui`) e não num
--     cookie — tratá-los como a mesma coisa seria descrever mal o produto;
--   * a tabela de cookies com os atributos reais de `upm-locale`
--     (`packages/config/i18n.ts`: 365 dias, `path=/`, `sameSite=lax`,
--     `httpOnly=false`, `secure` só em produção);
--   * **cookies de terceiro no pagamento** — `stripe.checkout.sessions.create`
--     e `stripe.billingPortal.sessions.create` levam a pessoa para um domínio
--     do Stripe, que lá define os seus próprios cookies. A v1 não dizia isto, e
--     era uma omissão: a política tem de cobrir o percurso todo, não só as
--     páginas que servimos;
--   * a explicação de como a analítica mede sem cookies (07 §4.4), para que o
--     "não há banner" seja verificável e não uma afirmação solta.
--
-- Continua a não haver secção de consentimento porque continua a não haver
-- cookie que o exija. Se algum dia houver, o banner entra ANTES do cookie, e
-- este texto muda com ele.

set search_path = public, extensions;

update public.legal_documents
   set status = 'archived'
 where kind = 'cookies'
   and version = '2026.10-draft1'
   and status = 'published';

insert into public.legal_documents (kind, version, locale, title, body_md, status, review_state, effective_from, published_at)
values (
  'cookies',
  '2026.10-draft2',
  'pt',
  'Política de Cookies — UProperty Market',
  $cookies_pt_v2$
> **MINUTA PARA REVISÃO JURÍDICA — NÃO É UM DOCUMENTO DEFINITIVO.**
> Este texto foi redigido como estrutura de trabalho e **tem de ser revisto e
> aprovado por advogado** antes de a plataforma entrar em produção.
> Nenhuma cláusula aqui escrita deve ser tratada como validada juridicamente.

## 1. O que esta política cobre

Explica que cookies e que armazenamento local a plataforma **UProperty Market** utiliza, para quê,
durante quanto tempo, e o que pode fazer quanto a isso. Cobre o site público e a aplicação.

## 2. Cookie e armazenamento local não são a mesma coisa

Um **cookie** é um pequeno ficheiro que o navegador guarda e que **é enviado para o servidor** em cada
pedido.

O **armazenamento local** é guardado pelo navegador e **nunca sai do seu equipamento**: não é enviado
para nós, não é usado para o identificar e não é acessível a outros sítios.

A distinção interessa porque o que usamos para guardar o tema que escolheu é armazenamento local, e
não um cookie.

## 3. Porque não lhe aparece um pedido de consentimento

**A plataforma só usa cookies estritamente necessários ao seu funcionamento.** A analítica do site
público funciona **sem cookies**, por decisão tomada na conceção do produto.

Cookies estritamente necessários — os que são indispensáveis para prestar um serviço que o utilizador
pediu — estão dispensados de consentimento prévio. Não lhe aparece um banner porque não há nada a
consentir: não usamos cookies de publicidade, de perfilagem, de redes sociais nem de medição de
audiência.

Se vier a existir um cookie que exija consentimento, o pedido aparece **antes** de esse cookie ser
escrito, e esta política é atualizada em versão nova.

## 4. Cookies que utilizamos

| Cookie | Finalidade | Tipo | Duração |
| ------ | ---------- | ---- | ------- |
| `upm-locale` | Guardar o idioma que escolheu, para as páginas abrirem nesse idioma | necessário | 365 dias |
| Cookies de sessão de autenticação | Manter a sessão iniciada e proteger os pedidos autenticados contra uso indevido | necessário | duração da sessão e da sua renovação |

O cookie de idioma é acessível ao próprio navegador, está limitado a este sítio e não é partilhado
entre domínios. Os cookies de sessão são definidos pelo serviço de autenticação que a plataforma
utiliza; sem eles não é possível manter-se autenticado entre páginas.

**Nenhum destes cookies é usado para publicidade, para construir um perfil seu ou para o seguir noutros
sítios.**

## 5. Armazenamento local

| O que guardamos | Finalidade |
| --------------- | ---------- |
| Preferência de tema | Guardar se escolheu o modo claro ou escuro |

Fica no seu navegador, não é enviado para os nossos servidores e não é usado para o identificar. Pode
apagá-lo limpando os dados do sítio nas definições do navegador.

## 6. Como medimos o tráfego sem cookies

Usamos um serviço de analítica que **não escreve cookies e não cria identificadores de visitante**.
Recebemos apenas linhas diárias já agregadas — quantas páginas foram vistas, de que origem veio o
tráfego, que tipo de dispositivo e que cidade —, sem endereço IP e sem identificação do navegador em
bruto.

O número de visitantes únicos chega-nos já calculado pelo fornecedor. Não o calculamos nós: fazê-lo
exigiria combinar o endereço IP com a identificação do navegador, e isso é tratar um dado pessoal para
obter um número que não justifica o tratamento.

## 7. Cookies de terceiros durante o pagamento

Quando subscreve um plano ou gere a sua subscrição, é encaminhado para páginas do nosso prestador de
pagamentos, **Stripe**, alojadas em domínio próprio dele.

Nessas páginas é o Stripe que define os seus próprios cookies, necessários ao processamento do
pagamento e à prevenção de fraude, **sob a sua própria política**. Não controlamos esses cookies e não
lhes temos acesso. Terminado o pagamento, regressa à plataforma.

## 8. Como controlar os cookies

Pode consultar, apagar e bloquear cookies nas definições do seu navegador, e configurar o bloqueio por
sítio.

Tenha presente que **bloquear os cookies de sessão impede-o de iniciar sessão**. Não é uma limitação
que possamos contornar: é exatamente a função desses cookies. Bloquear o cookie de idioma faz apenas
com que a sua escolha não seja recordada entre visitas.

## 9. Alterações a esta política

Esta política é versionada. Qualquer alteração ao que aqui está descrito — nomeadamente a introdução
de um cookie novo — dá origem a uma versão nova, com data própria, disponível nesta página.

## 10. Dados pessoais e contactos

O tratamento de dados pessoais está descrito na **Política de Privacidade**, em `/privacidade`.

Para qualquer questão sobre esta política, escreva para **[E-MAIL DE CONTACTO]**.

---

**Versão 2026.10-draft2 · MINUTA PARA REVISÃO JURÍDICA.** Esta versão não substitui aconselhamento
jurídico e não deve entrar em produção sem revisão por advogado.
$cookies_pt_v2$,
  'published',
  'draft_pending_legal_review',
  now(),
  now()
)
on conflict (kind, version, locale) do nothing;

-- ---------------------------------------------------------------------------
-- EN — 07 §5.13. A portuguesa é a fonte e prevalece.
-- ---------------------------------------------------------------------------

update public.legal_documents
   set status = 'archived'
 where kind = 'cookies'
   and version = '2026.10-draft1'
   and locale = 'en'
   and status = 'published';

insert into public.legal_documents (kind, version, locale, title, body_md, status, review_state, effective_from, published_at)
values (
  'cookies',
  '2026.10-draft2',
  'en',
  'Cookie Policy — UProperty Market',
  $cookies_en_v2$
> **DRAFT PENDING LEGAL REVIEW — THIS IS NOT A FINAL DOCUMENT.**
> This text was written as a working structure and **must be reviewed and approved by a lawyer**
> before the platform goes to production. No clause written here should be treated as legally
> validated. In case of divergence, the Portuguese version prevails.

## 1. What this policy covers

It explains which cookies and which local storage the **UProperty Market** platform uses, what for,
for how long, and what you can do about it. It covers the public site and the application.

## 2. A cookie and local storage are not the same thing

A **cookie** is a small file the browser stores and which **is sent to the server** with every request.

**Local storage** is kept by the browser and **never leaves your device**: it is not sent to us, is not
used to identify you and is not accessible to other sites.

The distinction matters because what we use to remember the theme you chose is local storage, not a
cookie.

## 3. Why you are not asked for consent

**The platform only uses cookies strictly necessary for it to work.** Public-site analytics run
**without cookies**, by a decision taken when the product was designed.

Strictly necessary cookies — those indispensable to providing a service the user asked for — are
exempt from prior consent. No banner appears because there is nothing to consent to: we use no
advertising, profiling, social-media or audience-measurement cookies.

Should a cookie requiring consent ever be introduced, the request appears **before** that cookie is
written, and this policy is updated in a new version.

## 4. Cookies we use

| Cookie | Purpose | Type | Duration |
| ------ | ------- | ---- | -------- |
| `upm-locale` | Remember the language you chose, so pages open in it | necessary | 365 days |
| Authentication session cookies | Keep you signed in and protect authenticated requests against misuse | necessary | the session and its renewal |

The language cookie is readable by your own browser, is limited to this site and is not shared across
domains. Session cookies are set by the authentication service the platform uses; without them you
cannot stay signed in across pages.

**None of these cookies is used for advertising, to build a profile of you or to track you on other
sites.**

## 5. Local storage

| What we store | Purpose |
| ------------- | ------- |
| Theme preference | Remember whether you chose light or dark mode |

It stays in your browser, is not sent to our servers and is not used to identify you. You can remove
it by clearing site data in your browser settings.

## 6. How we measure traffic without cookies

We use an analytics service that **writes no cookies and creates no visitor identifiers**. We receive
only pre-aggregated daily rows — how many pages were viewed, where the traffic came from, which device
type and which city — with no IP address and no raw browser identification.

The number of unique visitors reaches us already calculated by the provider. We do not compute it
ourselves: doing so would mean combining the IP address with the browser identification, and that is
processing personal data to obtain a figure that does not justify it.

## 7. Third-party cookies during payment

When you subscribe to a plan or manage your subscription, you are taken to pages of our payment
provider, **Stripe**, hosted on its own domain.

On those pages it is Stripe that sets its own cookies, necessary for processing the payment and
preventing fraud, **under Stripe's own policy**. We do not control those cookies and have no access to
them. Once payment is complete, you return to the platform.

## 8. How to control cookies

You can review, delete and block cookies in your browser settings, and configure blocking per site.

Bear in mind that **blocking session cookies prevents you from signing in**. That is not a limitation
we can work around: it is exactly what those cookies do. Blocking the language cookie merely means
your choice is not remembered between visits.

## 9. Changes to this policy

This policy is versioned. Any change to what is described here — in particular the introduction of a
new cookie — results in a new version, with its own date, available on this page.

## 10. Personal data and contact

The processing of personal data is described in the **Privacy Policy**, at `/privacidade`.

For any question about this policy, write to **[CONTACT EMAIL]**.

---

**Version 2026.10-draft2 · DRAFT PENDING LEGAL REVIEW.** This version does not replace legal advice
and must not go to production without review by a lawyer.
$cookies_en_v2$,
  'published',
  'draft_pending_legal_review',
  now(),
  now()
)
on conflict (kind, version, locale) do nothing;

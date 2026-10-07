-- UProperty Market — P11-07, Política de Privacidade `2026.10-draft2`
--
-- MINUTA PARA REVISÃO JURÍDICA. Substitui `2026.10-draft1`, que fica
-- `archived` — nunca editada, pela mesma razão dos Termos.
--
-- A v1 era um esqueleto genérico de RGPD. Esta descreve o tratamento **por
-- funcionalidade**, porque é isso que torna uma política verificável: cada
-- linha da tabela de §4 corresponde a colunas que existem.
--
-- Âncoras no código, para quem vier rever:
--   * §4 registo — `profiles` (nome, NIF, telefone, e-mail, locale, tema);
--     o NIF nunca entra em `properties_public` nem em props de cliente (08 §6.3).
--   * §4 aceitação — `terms_acceptances` guarda versão, `content_hash`, data e
--     IP. É o único sítio onde o IP de um utilizador autenticado é conservado
--     por razão contratual, e a base legal disso é a lacuna #5 de §16.
--   * §4 Cloud — `document_access_log` guarda IP e user agent de cada acesso a
--     documento partilhado; `file_shares` guarda `expires_at`,
--     `access_code_hash` e `revoked_at`.
--   * §4 site público — `site_leads` com `consent_marketing` e `consent_at`.
--   * §5 analítica — `site_analytics_daily` é agregada por dia e **não guarda
--     IP, user agent cru nem identificador de visitante** (07 §4.4); os únicos
--     são do fornecedor, não calculados por nós, precisamente para não hashear
--     IP + user agent.
--   * §7 staff — `admin_user_detail` exclui deliberadamente telefone, morada,
--     conversas e documentos, e cada consulta de perfil escreve em
--     `personal_data_access_log`.
--   * §12 segurança — RLS por linha, palavra-passe cifrada pelo Supabase Auth,
--     HMAC-SHA256 em `person_identities`, PIN de step-up antes de ações
--     sensíveis do `interno`, `auth_attempts` para limitar tentativas.
--   * §10 eliminação — anonimização em vez de apagamento, `retention_until` a
--     nascer `null`.
--
-- O que NÃO se afirma, de propósito: a lista de subcontratantes (só se nomeiam
-- os que o código mostra — Supabase, Stripe, Resend, Umami), as transferências
-- fora do EEE e os prazos de conservação. Continuam lacunas.

set search_path = public, extensions;

update public.legal_documents
   set status = 'archived'
 where kind = 'privacy'
   and version = '2026.10-draft1'
   and status = 'published';

insert into public.legal_documents (kind, version, locale, title, body_md, status, review_state, effective_from, published_at)
values (
  'privacy',
  '2026.10-draft2',
  'pt',
  'Política de Privacidade — UProperty Market',
  $privacy_pt_v2$
> **MINUTA PARA REVISÃO JURÍDICA — NÃO É UM DOCUMENTO DEFINITIVO.**
> Este texto foi redigido como estrutura de trabalho e **tem de ser revisto e
> aprovado por advogado** antes de a plataforma entrar em produção. Contém
> lacunas assinaladas em §16, que dependem de decisões ainda por tomar.
> Nenhuma cláusula aqui escrita deve ser tratada como validada juridicamente.

## 1. Quem trata os seus dados

O responsável pelo tratamento é **[NOME LEGAL DA EMPRESA]**, com sede em **[MORADA]**, NIPC
**[NIPC]**, contactável em **[E-MAIL DE CONTACTO]** e **[TELEFONE]**.

Esta política explica que dados pessoais a plataforma **UProperty Market** recolhe, para que fins, com
que fundamento, a quem são comunicados, durante quanto tempo são conservados e que direitos lhe
assistem.

**[LACUNA — A DECIDIR] Encarregado de Proteção de Dados.** Não está designado. A revisão deve
confirmar se a designação é obrigatória neste caso e, se for, indicar aqui o contacto.

## 2. A quem se aplica

Aplica-se a quem visita o site público, a quem se pré-inscreve, a quem tem conta na plataforma e a
quem acede a um documento partilhado através de uma ligação, ainda que não tenha conta.

## 3. O princípio que orienta esta política

A plataforma foi desenhada para **pedir o menos possível e expor ainda menos**. Em concreto:

1. **Os seus contactos não são dados a outros utilizadores.** O telefone, o endereço de correio
   eletrónico e a morada nunca aparecem num anúncio, numa listagem, no mapa ou em qualquer vista
   pública, e não são fornecidos à outra parte a pedido. É por isso que toda a comunicação acontece
   dentro da plataforma — a razão está explicada em §12 dos Termos e Condições.
2. **A morada exata de um imóvel é informação restrita**, revelada apenas a quem o proprietário
   decidir e de forma revogável.
3. **A analítica do site não usa cookies nem identifica visitantes.**
4. **O acesso de colaboradores a dados pessoais é limitado e registado.**

## 4. Que dados recolhemos, e em que momento

| Momento | Dados |
| ------- | ----- |
| Criação de conta | nome, NIF de pessoa singular, telefone, endereço de correio eletrónico, palavra-passe (guardada cifrada, nunca em claro) |
| Verificação | confirmação do endereço de correio eletrónico |
| Preferências | idioma, tema, preferências de notificação |
| Aceitação de documentos legais | versão aceite, impressão digital do texto, data e endereço IP |
| Subscrição e pagamento | plano, periodicidade, extras, histórico de faturação; os dados de pagamento são tratados pelo prestador de pagamentos, e não guardamos dados completos de cartão |
| Publicação de imóveis | características do imóvel, fotografias, vídeos, documentos, localização aproximada e morada exata |
| Conversas | o conteúdo das mensagens trocadas e a que imóvel dizem respeito |
| Pedidos de visita | datas propostas, estados, reagendamentos, cancelamentos e quem os fez |
| Contactos recebidos | o estado de cada contacto ao longo do processo e o desfecho registado pelo proprietário |
| Cloud | ficheiros carregados e respetivas versões, pastas, partilhas |
| Acessos a documentos partilhados | quem acedeu, quando, por que partilha, endereço IP, identificação do navegador e volume transferido |
| Contratos | os valores que preenche no contrato gerado |
| Segurança | tentativas de autenticação e registos de acesso |
| Site público | nos formulários de pré-inscrição e contacto: nome, endereço de correio eletrónico, telefone, perfil, motivo e mensagem, e o consentimento de marketing quando o dê |

**Não recolhemos categorias especiais de dados** (saúde, convicções, filiação sindical, dados
biométricos e equivalentes) e nenhum formulário os pede. Se os incluir espontaneamente numa mensagem
ou num documento, fá-lo por sua iniciativa e sob a sua responsabilidade.

## 5. O que não recolhemos

**A analítica do site público não usa cookies e não identifica visitantes.** São conservadas apenas
linhas diárias já agregadas — páginas vistas, origem do tráfego, tipo de dispositivo e cidade —, sem
endereço IP, sem identificação do navegador em bruto e sem qualquer identificador de visitante. O
número de visitantes únicos é fornecido já calculado pelo prestador de analítica; não o calculamos nós,
precisamente porque fazê-lo exigiria tratar o endereço IP.

## 6. Para que usamos os dados, e com que fundamento

| Finalidade | Fundamento (RGPD art. 6.º) |
| ---------- | -------------------------- |
| Criar e manter a conta, e prestar o serviço contratado | execução do contrato |
| Publicar e gerir anúncios, conversas, visitas e documentos | execução do contrato |
| Cobrar a subscrição e emitir faturas | execução do contrato e obrigação legal |
| Conservar prova da versão dos Termos aceite | obrigação legal e interesse legítimo |
| Moderar anúncios e apreciar denúncias | interesse legítimo e execução do contrato |
| Segurança, prevenção de fraude e de abuso, registo de acessos | interesse legítimo |
| Impedir a criação sucessiva de contas para repetir ofertas limitadas | interesse legítimo, a validar |
| Responder a pedidos de suporte | execução do contrato |
| Enviar comunicações de marketing | consentimento, revogável a todo o tempo |
| Medir o tráfego do site de forma agregada | interesse legítimo |

> **[NOTA PARA A REVISÃO JURÍDICA.]** Três fundamentos acima precisam de confirmação expressa: a
> conservação do endereço IP associado à aceitação dos Termos (§4), a conservação de identificadores
> após um pedido de apagamento (§10) e o equilíbrio de interesses que sustenta o registo de acessos a
> documentos. Os três estão listados em §16.

## 7. Quem tem acesso aos seus dados

**Outros utilizadores.** Veem o que a plataforma mostra e nada além disso: o anúncio e a localização
aproximada; o seu nome e as mensagens, dentro de uma conversa que consigo iniciaram; e a morada exata
apenas quando o proprietário a conceder. **Não veem o seu telefone, o seu endereço de correio
eletrónico, o seu NIF nem a sua morada.**

**Os nossos colaboradores.** Apenas na medida do necessário para operar o serviço, prestar suporte,
moderar anúncios e cumprir obrigações legais. Esse acesso é limitado por desenho — a ficha de
utilizador disponível à administração **não inclui telefone, morada, conversas nem documentos** — e
cada consulta a dados pessoais de um utilizador fica registada. As ações sensíveis exigem uma segunda
confirmação de identidade do colaborador.

**Subcontratantes.** Prestadores que tratam dados por nossa conta e segundo as nossas instruções. À
data desta minuta: o fornecedor de alojamento e base de dados (**Supabase**), o prestador de
pagamentos (**Stripe**), o fornecedor de envio de correio eletrónico (**Resend**) e o fornecedor de
analítica agregada (**Umami**).

**[LACUNA — A FIXAR NA REVISÃO]** A lista definitiva de subcontratantes, os respetivos contratos de
subcontratação e as garantias aplicáveis.

**Autoridades.** Quando exigido por lei ou por decisão de autoridade competente.

**Não vendemos dados pessoais** a terceiros e não os cedemos para publicidade.

## 8. Transferências para fora do Espaço Económico Europeu

**[A FIXAR NA REVISÃO]** — depende dos subcontratantes efetivamente contratados e das garantias
aplicáveis, designadamente cláusulas contratuais-tipo ou decisão de adequação.

## 9. Durante quanto tempo guardamos

| Dados | Prazo |
| ----- | ----- |
| Conta, anúncios, conversas, visitas e ficheiros | enquanto a conta existir |
| Faturação e dados fiscais | o prazo legal de conservação fiscal |
| Aceitação de documentos legais | **[PRAZO A FIXAR]** |
| Registos de acesso a documentos | **[PRAZO A FIXAR]** |
| Registos de segurança e tentativas de autenticação | **[PRAZO A FIXAR]** |
| Identificadores conservados após eliminação da conta | **[PRAZO A FIXAR]** — ver §10 |
| Linhas diárias agregadas de tráfego | não contêm dados pessoais |

## 10. Eliminação da conta

Quando elimina a conta, o perfil é **anonimizado e não apagado**: o nome, o telefone, o NIF, a imagem
e as preferências são esvaziados e a conta fica inacessível.

Não é apagado porque disso dependeria o histórico de subscrições, de faturação e de aceitação dos
Termos, que temos de conservar por obrigação legal e como prova do contrato celebrado. Esses registos
deixam de poder ser ligados a si através da plataforma.

Conservamos ainda, **sob a forma de impressão digital irreversível e nunca do valor em si**, os
identificadores estritamente necessários para impedir que a mesma pessoa crie contas sucessivas para
repetir ofertas limitadas.

**[LACUNA — A VALIDAR JURIDICAMENTE] Base legal e prazo desta conservação.** Trata-se de tratamento
após um pedido de apagamento e tem de ter base legal expressa, documentada e com prazo determinado.
Enquanto não for fixado, não existe prazo configurado.

## 11. Decisões automatizadas

**Não tomamos decisões exclusivamente automatizadas que produzam efeitos jurídicos sobre si ou que o
afetem de modo significativo.** Os alertas de pesquisa limitam-se a comparar os critérios que definiu
com os anúncios publicados; a moderação de anúncios é decidida por pessoas.

## 12. Segurança

As medidas em vigor incluem:

1. a palavra-passe é guardada cifrada e nunca em claro, e não é conhecida por nós;
2. o acesso aos dados é restringido **por linha** na própria base de dados, de modo que cada conta só
   alcança o que lhe pertence, e não apenas por verificações na aplicação;
3. os identificadores conservados após a eliminação da conta são guardados como impressão digital
   irreversível;
4. as ações sensíveis dos colaboradores exigem uma segunda confirmação de identidade;
5. os acessos a dados pessoais por colaboradores e os acessos a documentos partilhados são registados;
6. as tentativas de autenticação são limitadas em frequência;
7. as ligações são cifradas em trânsito;
8. as partilhas por ligação podem ter código de acesso e prazo de validade, e são revogáveis.

Nenhuma medida elimina por completo o risco. Se detetarmos uma violação de dados pessoais suscetível
de implicar risco para os seus direitos, cumpriremos os deveres de notificação previstos na lei.

## 13. Os seus direitos

Pode exercer os direitos de **acesso**, **retificação**, **apagamento**, **limitação**,
**portabilidade** e **oposição**, e retirar o consentimento quando for esse o fundamento — o que não
afeta a licitude do tratamento feito antes da retirada.

Alguns destes direitos exercem-se diretamente na área de cliente: corrigir os seus dados, alterar
preferências de notificação, exportar os seus dados e eliminar a conta. Para os restantes, escreva
para **[E-MAIL DE CONTACTO]**.

Responderemos nos prazos legais. Pode também reclamar junto da **Comissão Nacional de Proteção de
Dados (CNPD)**.

## 14. Proprietários e dados de quem os contacta

Quando um proprietário recebe contactos através da plataforma, acede a dados pessoais de quem o
contactou. Esses dados só podem ser usados para responder, marcar a visita e conduzir aquela
negociação.

Se o proprietário os tratar para finalidades próprias — por exemplo, conservá-los ou usá-los para
comunicações comerciais — passa a ser responsável por esse tratamento e assume os deveres que a lei
lhe impõe nessa qualidade. A UProperty proíbe essa utilização nos Termos e Condições.

## 15. Alterações a esta política

Esta política é versionada. Alterações materiais são comunicadas com antecedência razoável e a versão
em vigor está sempre disponível na plataforma, com a respetiva data.

## 16. Lacunas assinaladas nesta minuta

| # | Assunto | Onde |
| - | ------- | ---- |
| 1 | Dados de identificação do responsável pelo tratamento | §1 |
| 2 | Designação de Encarregado de Proteção de Dados | §1 |
| 3 | Lista definitiva de subcontratantes e contratos de subcontratação | §7 |
| 4 | Transferências para fora do EEE e respetivas garantias | §8 |
| 5 | Base legal e prazo da conservação do IP na aceitação dos Termos | §4 e §6 |
| 6 | Prazos de conservação de todas as categorias | §9 |
| 7 | Base legal e prazo da retenção de identificadores após apagamento | §10 |
| 8 | Equilíbrio de interesses do registo de acessos a documentos | §6 |

---

**Versão 2026.10-draft2 · MINUTA PARA REVISÃO JURÍDICA.** Esta versão não substitui aconselhamento
jurídico e não deve entrar em produção sem revisão por advogado.
$privacy_pt_v2$,
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
 where kind = 'privacy'
   and version = '2026.10-draft1'
   and locale = 'en'
   and status = 'published';

insert into public.legal_documents (kind, version, locale, title, body_md, status, review_state, effective_from, published_at)
values (
  'privacy',
  '2026.10-draft2',
  'en',
  'Privacy Policy — UProperty Market',
  $privacy_en_v2$
> **DRAFT PENDING LEGAL REVIEW — THIS IS NOT A FINAL DOCUMENT.**
> This text was written as a working structure and **must be reviewed and approved by a lawyer**
> before the platform goes to production. It contains gaps flagged in §16 that depend on decisions
> still to be made. No clause written here should be treated as legally validated.
> In case of divergence, the Portuguese version prevails.

## 1. Who processes your data

The controller is **[LEGAL COMPANY NAME]**, with registered office at **[ADDRESS]**, tax number
**[NIPC]**, reachable at **[CONTACT EMAIL]** and **[PHONE]**.

This policy explains what personal data the **UProperty Market** platform collects, for what purposes,
on what basis, to whom it is disclosed, how long it is kept and what rights you have.

**[GAP — TO BE DECIDED] Data Protection Officer.** None has been appointed. The review should confirm
whether appointment is mandatory here and, if so, state the contact details.

## 2. Who this applies to

It applies to visitors to the public site, to those who pre-register, to account holders, and to
anyone who opens a shared document through a link, even without an account.

## 3. The principle behind this policy

The platform was designed to **ask for as little as possible and expose even less**. Specifically:

1. **Your contact details are not given to other users.** Your phone number, email address and home
   address never appear in a listing, a search result, the map or any public view, and are not provided
   to the other party on request. This is why all communication happens within the platform — the
   reasons are set out in §12 of the Terms and Conditions.
2. **A property's exact address is restricted information**, disclosed only to whoever the owner
   decides, and revocably.
3. **Site analytics use no cookies and do not identify visitors.**
4. **Staff access to personal data is limited and logged.**

## 4. What we collect, and when

| Moment | Data |
| ------ | ---- |
| Account creation | name, personal tax number (NIF), phone, email address, password (stored hashed, never in clear) |
| Verification | confirmation of the email address |
| Preferences | language, theme, notification preferences |
| Legal document acceptance | accepted version, fingerprint of the text, date and IP address |
| Subscription and payment | plan, billing period, add-ons, invoice history; payment details are handled by the payment provider, and we do not store full card details |
| Publishing properties | property features, photographs, videos, documents, approximate location and exact address |
| Conversations | the content of messages exchanged and which property they concern |
| Viewing requests | proposed dates, states, reschedules, cancellations and who made them |
| Contacts received | the state of each contact through the process and the outcome recorded by the owner |
| Cloud | uploaded files and their versions, folders, shares |
| Access to shared documents | who accessed, when, under which share, IP address, browser identification and bytes transferred |
| Contracts | the values you fill into the generated contract |
| Security | authentication attempts and access logs |
| Public site | in the pre-registration and contact forms: name, email address, phone, profile, reason and message, and the marketing consent where given |

**We do not collect special categories of data** (health, beliefs, trade union membership, biometric
data and the like) and no form asks for them. If you volunteer them in a message or a document, you do
so on your own initiative and responsibility.

## 5. What we do not collect

**Public-site analytics use no cookies and do not identify visitors.** Only pre-aggregated daily rows
are kept — page views, traffic source, device type and city — with no IP address, no raw browser
identification and no visitor identifier of any kind. The number of unique visitors is supplied
already calculated by the analytics provider; we do not compute it ourselves, precisely because doing
so would require processing the IP address.

## 6. Why we use the data, and on what basis

| Purpose | Basis (GDPR art. 6) |
| ------- | ------------------- |
| Creating and maintaining the account, and providing the contracted service | performance of the contract |
| Publishing and managing listings, conversations, viewings and documents | performance of the contract |
| Charging the subscription and issuing invoices | performance of the contract and legal obligation |
| Keeping proof of which version of the Terms was accepted | legal obligation and legitimate interest |
| Moderating listings and examining reports | legitimate interest and performance of the contract |
| Security, fraud and abuse prevention, access logging | legitimate interest |
| Preventing successive account creation to repeat limited offers | legitimate interest, to be validated |
| Answering support requests | performance of the contract |
| Sending marketing communications | consent, withdrawable at any time |
| Measuring site traffic in aggregate | legitimate interest |

> **[NOTE FOR LEGAL REVIEW.]** Three of the bases above need express confirmation: retention of the IP
> address tied to Terms acceptance (§4), retention of identifiers after an erasure request (§10), and
> the balancing of interests supporting document access logging. All three are listed in §16.

## 7. Who has access to your data

**Other users.** They see what the platform shows and nothing more: the listing and the approximate
location; your name and the messages, inside a conversation they started with you; and the exact
address only when the owner grants it. **They do not see your phone number, email address, tax number
or home address.**

**Our staff.** Only as far as necessary to operate the service, provide support, moderate listings and
comply with legal obligations. That access is limited by design — the user record available to
administration **does not include phone, address, conversations or documents** — and every consultation
of a user's personal data is logged. Sensitive actions require a second identity confirmation from the
staff member.

**Processors.** Providers who process data on our behalf and on our instructions. As of this draft: the
hosting and database provider (**Supabase**), the payment provider (**Stripe**), the email delivery
provider (**Resend**) and the aggregate analytics provider (**Umami**).

**[GAP — TO BE FIXED AT REVIEW]** The definitive list of processors, the corresponding processing
agreements and the applicable safeguards.

**Authorities.** Where required by law or by a decision of a competent authority.

**We do not sell personal data** to third parties and do not share it for advertising.

## 8. Transfers outside the European Economic Area

**[TO BE FIXED AT REVIEW]** — depends on the processors actually engaged and the applicable
safeguards, in particular standard contractual clauses or an adequacy decision.

## 9. How long we keep it

| Data | Period |
| ---- | ------ |
| Account, listings, conversations, viewings and files | while the account exists |
| Billing and tax data | the statutory tax retention period |
| Legal document acceptance | **[PERIOD TO BE FIXED]** |
| Document access logs | **[PERIOD TO BE FIXED]** |
| Security logs and authentication attempts | **[PERIOD TO BE FIXED]** |
| Identifiers kept after account deletion | **[PERIOD TO BE FIXED]** — see §10 |
| Aggregated daily traffic rows | contain no personal data |

## 10. Account deletion

When you delete your account, the profile is **anonymised, not deleted**: name, phone, tax number,
image and preferences are emptied and the account becomes inaccessible.

It is not deleted because the subscription, billing and Terms-acceptance history depend on it, and we
must keep those by legal obligation and as proof of the contract entered into. Those records can no
longer be linked to you through the platform.

We also keep, **as an irreversible fingerprint and never the value itself**, the identifiers strictly
necessary to prevent the same person creating successive accounts to repeat limited offers.

**[GAP — TO BE VALIDATED LEGALLY] Legal basis and period for this retention.** This is processing
after an erasure request and must have an express, documented legal basis with a defined period. Until
one is set, no period is configured.

## 11. Automated decisions

**We do not take decisions based solely on automated processing that produce legal effects concerning
you or significantly affect you.** Search alerts merely compare the criteria you set against published
listings; listing moderation is decided by people.

## 12. Security

The measures in place include:

1. the password is stored hashed and never in clear, and is not known to us;
2. access to data is restricted **row by row** in the database itself, so each account only reaches
   what belongs to it, and not merely by checks in the application;
3. identifiers kept after account deletion are stored as an irreversible fingerprint;
4. sensitive staff actions require a second identity confirmation;
5. staff access to personal data and access to shared documents are logged;
6. authentication attempts are rate-limited;
7. connections are encrypted in transit;
8. link shares may carry an access code and an expiry date, and are revocable.

No measure removes risk entirely. If we detect a personal data breach likely to pose a risk to your
rights, we will comply with the notification duties laid down by law.

## 13. Your rights

You may exercise the rights of **access**, **rectification**, **erasure**, **restriction**,
**portability** and **objection**, and withdraw consent where that is the basis — which does not
affect the lawfulness of processing carried out before withdrawal.

Some of these rights are exercised directly in the customer area: correcting your data, changing
notification preferences, exporting your data and deleting your account. For the rest, write to
**[CONTACT EMAIL]**.

We will reply within the statutory deadlines. You may also complain to the Portuguese data protection
authority (**CNPD**).

## 14. Owners and the data of those who contact them

When an owner receives contacts through the platform, they access personal data of whoever contacted
them. That data may only be used to reply, arrange the viewing and conduct that negotiation.

If the owner processes it for their own purposes — for example by keeping it or using it for
commercial communications — they become the controller for that processing and assume the duties the
law imposes in that capacity. UProperty prohibits such use in the Terms and Conditions.

## 15. Changes to this policy

This policy is versioned. Material changes are communicated with reasonable advance notice, and the
version in force is always available on the platform, with its date.

## 16. Gaps flagged in this draft

| # | Subject | Where |
| - | ------- | ----- |
| 1 | Controller identification details | §1 |
| 2 | Appointment of a Data Protection Officer | §1 |
| 3 | Definitive list of processors and processing agreements | §7 |
| 4 | Transfers outside the EEA and their safeguards | §8 |
| 5 | Legal basis and period for retaining the IP on Terms acceptance | §4 and §6 |
| 6 | Retention periods for every category | §9 |
| 7 | Legal basis and period for retaining identifiers after erasure | §10 |
| 8 | Balancing of interests for document access logging | §6 |

---

**Version 2026.10-draft2 · DRAFT PENDING LEGAL REVIEW.** This version does not replace legal advice
and must not go to production without review by a lawyer.
$privacy_en_v2$,
  'published',
  'draft_pending_legal_review',
  now(),
  now()
)
on conflict (kind, version, locale) do nothing;

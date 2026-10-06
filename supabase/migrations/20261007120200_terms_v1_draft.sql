-- UProperty Market — Fase 9, 3/6
--
-- P9-02 — primeira versão dos Termos e Condições, **MINUTA PARA REVISÃO
-- JURÍDICA**, em PT e EN (07 §5.13: EN entra na v1 e cobre os textos legais).
--
-- Este texto NÃO é parecer jurídico e NÃO está pronto para produção. Entra na
-- base de dados com `review_state = 'draft_pending_legal_review'`, o que faz
-- a app mostrar o aviso em cima do documento e em cima da caixa de aceitação.
-- A publicação como páginas próprias, já revistas, é P11-07.
--
-- As lacunas estão assinaladas DENTRO do texto, em §19, e são três:
-- período mínimo de subscrição, penalizações por cessação antecipada e
-- prazos de conservação de dados. Nenhuma foi inventada: o cliente decidiu a
-- 7 out 2026 que o prazo mínimo se decide depois.
--
-- Os dados da empresa aparecem como marcadores em maiúsculas. Não são
-- esquecimento: `app_settings` (P8-05) tem `company_name`, `company_tax_id`,
-- `company_address`, `company_email` e `company_phone` todos vazios, e
-- inventar uma morada num contrato era pior do que deixar o espaço à vista.

set search_path = public, extensions;

insert into public.legal_documents (kind, version, locale, title, body_md, status, review_state, effective_from, published_at)
values (
  'terms',
  '2026.10-draft1',
  'pt',
  'Termos e Condições de Utilização — UProperty Market',
  $terms_pt$
> **MINUTA PARA REVISÃO JURÍDICA — NÃO É UM DOCUMENTO DEFINITIVO.**
> Este texto foi redigido como estrutura de trabalho e **tem de ser revisto e
> aprovado por advogado** antes de a plataforma entrar em produção. Contém
> lacunas assinaladas em §19, que dependem de decisões ainda por tomar.
> Nenhuma cláusula aqui escrita deve ser tratada como validada juridicamente.

## 1. Quem somos e o que este documento é

A plataforma **UProperty Market** é explorada por **[NOME LEGAL DA EMPRESA]**, com sede em
**[MORADA]**, NIPC **[NIPC]**, contactável em **[E-MAIL DE CONTACTO]** e **[TELEFONE]**
(adiante, "nós" ou "a UProperty").

Estes Termos e Condições regulam o acesso e a utilização da plataforma por si (adiante, "o
Utilizador"). Ao criar conta e ao subscrever um plano, o Utilizador declara que leu, compreendeu
e aceita estes Termos na versão identificada no final deste documento.

Fazem parte integrante destes Termos a **Política de Privacidade**, a **Política de Cookies** e a
**Informação sobre Proteção de Dados**, disponíveis na plataforma.

## 2. O que a plataforma faz — e o que não faz

A UProperty Market é um serviço digital de subscrição que permite a proprietários publicar imóveis
para venda ou arrendamento e a interessados procurá-los, contactar o proprietário, pedir visitas,
trocar documentos e preparar contratos, **diretamente entre as partes e sem comissões sobre a
transação**.

A UProperty **não é mediadora imobiliária**, não representa nenhuma das partes, não intervém na
negociação, não recebe pagamentos relativos ao imóvel e não garante a concretização de qualquer
negócio. O serviço prestado é o acesso à plataforma e às funcionalidades do plano subscrito.

A UProperty não verifica a titularidade dos imóveis anunciados nem a autenticidade dos documentos
carregados pelos Utilizadores, sem prejuízo da moderação prevista em §10.

## 3. Quem pode ter conta

Pode criar conta quem:

1. seja pessoa singular com idade igual ou superior a 18 anos e capacidade para contratar;
2. indique dados verdadeiros, completos e atuais, incluindo nome, **Número de Identificação Fiscal
   (NIF) de pessoa singular**, telefone e endereço de correio eletrónico;
3. aceite estes Termos.

**Uma pessoa, uma conta.** O NIF é único por conta e não pode ser utilizado em mais do que uma
conta ativa. O NIF indicado tem de ser o do titular da conta; não são aceites números de pessoa
coletiva. A alteração do NIF depois da criação da conta não se faz livremente e exige um pedido
próprio, por razões de prevenção de fraude.

A UProperty pode recusar a criação de conta sem indicar o motivo concreto, quando a recusa resulte
da verificação de elegibilidade descrita em §16.

## 4. Conta, credenciais e verificação

O Utilizador é responsável por manter a confidencialidade das suas credenciais e por toda a
atividade realizada com a sua conta, devendo comunicar-nos de imediato qualquer utilização não
autorizada.

O endereço de correio eletrónico indicado é verificado. Até à verificação, a conta tem acesso
limitado, nos termos indicados na plataforma. Contas não verificadas podem ser eliminadas após o
período indicado na plataforma, com aviso prévio.

## 5. Subscrição, preços e pagamento

O acesso à plataforma **depende de subscrição paga**. Não existe plano gratuito.

Os planos disponíveis, o que cada um inclui, os limites aplicáveis e os preços são apresentados na
plataforma antes da contratação e constam do ecrã de contratação que o Utilizador confirma. Os
preços são apresentados em euros e **incluem IVA à taxa legal em vigor**, salvo indicação expressa
em contrário.

O pagamento é processado pelo prestador de serviços de pagamento **Stripe**. A UProperty não
armazena dados completos de cartão. A fatura é disponibilizada na área de cliente.

A UProperty pode alterar os preços para períodos futuros, comunicando a alteração com antecedência
razoável; a alteração não afeta períodos já pagos e o Utilizador pode cessar a subscrição antes de
a alteração produzir efeitos.

## 6. Duração, renovação e período mínimo

A subscrição tem a periodicidade escolhida na contratação (mensal ou anual) e **renova-se
automaticamente** por períodos iguais, salvo cessação nos termos de §8.

**[LACUNA — A DECIDIR] Período mínimo de permanência.** À data desta minuta **não está fixado
qualquer período mínimo de subscrição**. A plataforma está preparada para o aplicar quando for
decidido e comunicado, caso em que o período mínimo aplicável a cada subscrição será apresentado
no ecrã de contratação, antes do pagamento, e ficará registado na subscrição. Enquanto nada for
decidido, **não existe período mínimo** e a cessação segue §8.

## 7. Direito de livre resolução

Sendo o Utilizador consumidor, dispõe do direito de resolver o contrato **no prazo de 14 dias
seguidos** a contar da data de celebração, sem necessidade de indicar motivo e sem incorrer em
custos, nos termos do Decreto-Lei n.º 24/2014, de 14 de fevereiro.

Se o Utilizador solicitar expressamente que a prestação do serviço se inicie durante esse prazo —
o que sucede quando o acesso à plataforma é disponibilizado imediatamente após o pagamento — e
vier a exercer o direito de livre resolução, **pagará o montante proporcional ao serviço
efetivamente prestado** até à comunicação da resolução.

A resolução pode ser comunicada por qualquer meio inequívoco, nomeadamente para
**[E-MAIL DE CONTACTO]**.

## 8. Cessação da subscrição

O Utilizador pode cessar a subscrição a qualquer momento, a partir da área de cliente.

Salvo o disposto em §6 quanto a um eventual período mínimo, a cessação produz efeitos **no fim do
período já pago**, mantendo-se o acesso até lá. Não há reembolso de períodos já decorridos, sem
prejuízo do disposto em §7.

Cessada a subscrição e terminado o período pago:

1. os anúncios que excedam o que a conta passa a permitir ficam em **rascunho** e **nunca são
   apagados**;
2. os ficheiros guardados na área de armazenamento ficam acessíveis apenas para leitura e
   transferência, deixando de ser possível carregar novos;
3. o Utilizador continua a poder aceder à conta para subscrever de novo, exportar os seus dados ou
   eliminar a conta.

**[LACUNA — A DECIDIR] Penalizações.** Não está fixada qualquer penalização por cessação
antecipada. Se vier a existir período mínimo, as consequências da cessação antes do seu termo terão
de ser definidas e comunicadas antes da contratação.

## 9. Obrigações do Utilizador

O Utilizador obriga-se a:

1. publicar apenas imóveis sobre os quais tenha legitimidade para o fazer, com informação verdadeira
   e atualizada, incluindo preço, área, estado e certificação energética quando aplicável;
2. não publicar conteúdo ilícito, enganoso, discriminatório, ofensivo ou que viole direitos de
   terceiros, incluindo direitos de autor sobre fotografias;
3. não utilizar a plataforma para contactos comerciais não solicitados, recolha de dados de outros
   Utilizadores, ou qualquer forma de abuso automatizado;
4. não tentar contornar limites do plano, nem criar contas adicionais para esse efeito;
5. tratar os dados pessoais a que aceda no âmbito de um contacto exclusivamente para a finalidade
   desse contacto.

## 10. Moderação, suspensão e cessação por nossa iniciativa

Os anúncios são sujeitos a moderação antes da publicação. A UProperty pode recusar, suspender ou
remover um anúncio que não cumpra estes Termos, informando o Utilizador do motivo.

A UProperty pode suspender ou cessar a conta, com aviso sempre que possível, em caso de
incumprimento grave ou reiterado destes Termos, utilização fraudulenta, ou falta de pagamento.

## 11. Disponibilidade, conformidade e atualizações

A UProperty envida os melhores esforços para manter a plataforma disponível, podendo haver
interrupções para manutenção, por motivos técnicos ou por causas não imputáveis à UProperty.

Ao serviço digital prestado aplica-se o regime de conformidade do **Decreto-Lei n.º 84/2021, de 18
de outubro**, nos termos legais, incluindo quanto aos direitos do consumidor em caso de falta de
conformidade.

A UProperty pode atualizar as funcionalidades da plataforma. Alterações que reduzam
significativamente o que foi contratado serão comunicadas com antecedência razoável.

## 12. Dados pessoais

O responsável pelo tratamento é **[NOME LEGAL DA EMPRESA]**. Os dados pessoais recolhidos — incluindo
nome, NIF, telefone, endereço de correio eletrónico, dados de faturação e registos de utilização —
são tratados para a execução do contrato, cumprimento de obrigações legais, prevenção de fraude e,
mediante consentimento, comunicações de marketing.

Os dados são alojados na União Europeia. Os direitos de acesso, retificação, apagamento, limitação,
portabilidade e oposição são exercidos a partir da área de cliente ou através de
**[E-MAIL DE CONTACTO]**, e podem ser apresentadas reclamações à Comissão Nacional de Proteção de
Dados.

**[LACUNA — A DECIDIR] Prazos de conservação.** Os prazos concretos de conservação de cada
categoria de dados não estão fixados nesta minuta e têm de ser definidos na revisão jurídica, em
articulação com §16.

O detalhe consta da Política de Privacidade.

## 13. Propriedade intelectual

A plataforma, o seu software, marca, identidade visual e conteúdos próprios pertencem à UProperty.

O conteúdo carregado pelo Utilizador continua a ser dele. Ao publicá-lo, concede à UProperty uma
licença não exclusiva, limitada à exibição e processamento necessários para prestar o serviço,
válida enquanto o conteúdo estiver publicado.

## 14. Responsabilidade

A UProperty responde nos termos gerais de direito pelos danos causados por incumprimento das suas
obrigações, não sendo responsável:

1. pela veracidade, legalidade ou qualidade dos imóveis, documentos e informações publicados pelos
   Utilizadores;
2. pelos acordos celebrados entre Utilizadores, nem pelo seu cumprimento;
3. pelo conteúdo das comunicações trocadas entre Utilizadores.

Nada nestes Termos exclui ou limita responsabilidade que não possa ser excluída ou limitada por
lei, nomeadamente perante consumidores.

## 15. Alterações a estes Termos

Estes Termos são **versionados**. Cada versão tem um número, uma data e uma impressão digital do
seu conteúdo, e fica registado que versão concreta cada Utilizador aceitou.

Alterações materiais são comunicadas com antecedência razoável e, quando exigível, carecem de nova
aceitação. Se o Utilizador não aceitar a nova versão, pode cessar a subscrição nos termos de §8,
sem penalização.

## 16. Eliminação da conta, histórico e prevenção de abuso

O Utilizador pode eliminar a conta a partir da área de cliente. A eliminação:

1. **anonimiza** os dados de perfil e torna a conta inacessível;
2. **conserva** o histórico de subscrições e faturação, por ser necessário ao cumprimento de
   obrigações legais, contabilísticas e fiscais;
3. **conserva** o registo de que versão destes Termos foi aceite e quando, por ser a prova do
   contrato celebrado;
4. **conserva**, sob a forma de impressão digital irreversível (não do valor em si), os
   identificadores estritamente necessários para impedir que a mesma pessoa beneficie repetidamente
   de ofertas limitadas através da criação sucessiva de contas.

**[LACUNA — A VALIDAR JURIDICAMENTE] Base legal e prazo do ponto 4.** A conservação referida no
ponto 4 constitui tratamento de dados pessoais após um pedido de apagamento e **tem de ter base
legal expressa, documentada e com prazo determinado**, a definir na revisão jurídica. A plataforma
está preparada para aplicar o prazo que vier a ser fixado; enquanto não for fixado, não existe
prazo configurado.

## 17. Reclamações e resolução de litígios

As reclamações podem ser apresentadas para **[E-MAIL DE CONTACTO]** ou através do **Livro de
Reclamações Eletrónico**, em www.livroreclamacoes.pt.

Em caso de litígio de consumo, o Utilizador pode recorrer a entidade de resolução alternativa de
litígios, nos termos da Lei n.º 144/2015, de 8 de setembro. A entidade competente em razão do valor
e do território será identificada na plataforma. **[LACUNA — A DECIDIR] Entidade RAL a indicar.**

A plataforma europeia de resolução de litígios em linha está disponível em
ec.europa.eu/consumers/odr.

## 18. Lei aplicável e foro

Estes Termos regem-se pela lei portuguesa. Sendo o Utilizador consumidor, mantém-se a competência
do foro que a lei lhe reserva.

## 19. Lacunas assinaladas nesta minuta

| # | Assunto | Onde |
| - | ------- | ---- |
| 1 | Período mínimo de subscrição — não fixado | §6 |
| 2 | Penalizações por cessação antecipada — não fixadas | §8 |
| 3 | Prazos de conservação de dados — não fixados | §12 e §16 |
| 4 | Base legal da retenção de identificadores após apagamento | §16 |
| 5 | Entidade de resolução alternativa de litígios | §17 |
| 6 | Dados de identificação da empresa | §1 |

---

**Versão 2026.10-draft1 · MINUTA PARA REVISÃO JURÍDICA.** Esta versão não substitui aconselhamento
jurídico e não deve entrar em produção sem revisão por advogado.
$terms_pt$,
  'published',
  'draft_pending_legal_review',
  now(),
  now()
)
on conflict (kind, version, locale) do nothing;

insert into public.legal_documents (kind, version, locale, title, body_md, status, review_state, effective_from, published_at)
values (
  'terms',
  '2026.10-draft1',
  'en',
  'Terms and Conditions of Use — UProperty Market',
  $terms_en$
> **DRAFT PENDING LEGAL REVIEW — THIS IS NOT A FINAL DOCUMENT.**
> This text was written as a working structure and **must be reviewed and approved by a lawyer**
> before the platform goes to production. It contains gaps flagged in §19 that depend on decisions
> still to be made. No clause written here should be treated as legally validated.
> In case of divergence, the Portuguese version prevails.

## 1. Who we are and what this document is

The **UProperty Market** platform is operated by **[LEGAL COMPANY NAME]**, with registered office at
**[ADDRESS]**, tax number **[NIPC]**, reachable at **[CONTACT EMAIL]** and **[PHONE]**
(hereinafter "we" or "UProperty").

These Terms and Conditions govern your access to and use of the platform (hereinafter, "the User").
By creating an account and subscribing to a plan, the User declares having read, understood and
accepted these Terms in the version identified at the end of this document.

The **Privacy Policy**, the **Cookie Policy** and the **Data Protection Information**, available on
the platform, form an integral part of these Terms.

## 2. What the platform does — and does not do

UProperty Market is a subscription digital service that lets owners list properties for sale or
rent and lets interested parties search, contact the owner, request viewings, exchange documents
and prepare contracts, **directly between the parties and with no commission on the transaction**.

UProperty **is not a real estate agency**, does not represent either party, does not take part in
the negotiation, does not receive payments relating to the property and does not guarantee that any
deal is concluded. The service provided is access to the platform and to the features of the
subscribed plan.

UProperty does not verify ownership of listed properties nor the authenticity of documents uploaded
by Users, without prejudice to the moderation described in §10.

## 3. Who may hold an account

An account may be created by anyone who:

1. is a natural person aged 18 or over with capacity to contract;
2. provides true, complete and current data, including full name, **personal Portuguese tax number
   (NIF)**, phone number and email address;
3. accepts these Terms.

**One person, one account.** The tax number is unique per account and may not be used on more than
one active account. It must belong to the account holder; corporate tax numbers are not accepted.
Changing the tax number after account creation is not done freely and requires a dedicated request,
for fraud prevention reasons.

UProperty may refuse account creation without stating the specific reason, where the refusal results
from the eligibility check described in §16.

## 4. Account, credentials and verification

The User is responsible for keeping credentials confidential and for all activity carried out with
the account, and must notify us immediately of any unauthorised use.

The email address provided is verified. Until verification, the account has limited access as
indicated on the platform. Unverified accounts may be deleted after the period indicated on the
platform, with prior notice.

## 5. Subscription, prices and payment

Access to the platform **requires a paid subscription**. There is no free plan.

The available plans, what each includes, the applicable limits and the prices are shown on the
platform before contracting and appear on the contracting screen the User confirms. Prices are
shown in euros and **include VAT at the legal rate in force**, unless expressly stated otherwise.

Payment is processed by the payment service provider **Stripe**. UProperty does not store full card
details. The invoice is made available in the customer area.

UProperty may change prices for future periods, giving reasonable prior notice; the change does not
affect periods already paid and the User may terminate the subscription before it takes effect.

## 6. Term, renewal and minimum period

The subscription runs for the billing period chosen at contracting (monthly or yearly) and
**renews automatically** for equal periods, unless terminated under §8.

**[GAP — TO BE DECIDED] Minimum commitment period.** As at the date of this draft **no minimum
subscription period is set**. The platform is prepared to apply one once it is decided and
communicated, in which case the minimum period applicable to each subscription will be shown on the
contracting screen, before payment, and recorded on the subscription. While nothing is decided,
**there is no minimum period** and termination follows §8.

## 7. Right of withdrawal

Where the User is a consumer, they have the right to withdraw from the contract **within 14
consecutive days** from the date it was concluded, without giving any reason and without incurring
any cost, under Decree-Law no. 24/2014 of 14 February.

If the User expressly requests that performance begin during that period — which is the case where
access to the platform is granted immediately after payment — and then exercises the right of
withdrawal, they **shall pay an amount proportionate to the service actually provided** up to the
communication of withdrawal.

Withdrawal may be communicated by any unequivocal means, namely to **[CONTACT EMAIL]**.

## 8. Termination of the subscription

The User may terminate the subscription at any time from the customer area.

Save as provided in §6 regarding any minimum period, termination takes effect **at the end of the
period already paid**, access being maintained until then. There is no refund of periods already
elapsed, without prejudice to §7.

Once the subscription ends and the paid period has elapsed:

1. listings exceeding what the account is then allowed become **drafts** and are **never deleted**;
2. files stored in the storage area remain accessible for reading and download only, with no new
   uploads;
3. the User may still access the account to subscribe again, export their data or delete the
   account.

**[GAP — TO BE DECIDED] Penalties.** No penalty for early termination is set. Should a minimum
period come to exist, the consequences of terminating before its end must be defined and
communicated before contracting.

## 9. User obligations

The User undertakes to:

1. list only properties they are entitled to list, with true and up-to-date information, including
   price, area, condition and energy certification where applicable;
2. not publish unlawful, misleading, discriminatory or offensive content, or content infringing
   third-party rights, including copyright in photographs;
3. not use the platform for unsolicited commercial contact, harvesting other Users' data, or any
   form of automated abuse;
4. not attempt to circumvent plan limits, nor create additional accounts for that purpose;
5. process personal data accessed in the course of a contact solely for the purpose of that contact.

## 10. Moderation, suspension and termination by us

Listings are moderated before publication. UProperty may refuse, suspend or remove a listing that
does not comply with these Terms, informing the User of the reason.

UProperty may suspend or terminate the account, with notice whenever possible, in the event of
serious or repeated breach of these Terms, fraudulent use, or non-payment.

## 11. Availability, conformity and updates

UProperty uses its best efforts to keep the platform available; interruptions may occur for
maintenance, for technical reasons, or for reasons not attributable to UProperty.

The digital service provided is subject to the conformity regime of **Decree-Law no. 84/2021 of 18
October**, under the terms of the law, including as regards consumer rights in the event of lack of
conformity.

UProperty may update platform features. Changes that significantly reduce what was contracted will
be communicated with reasonable prior notice.

## 12. Personal data

The data controller is **[LEGAL COMPANY NAME]**. Personal data collected — including name, tax
number, phone, email address, billing data and usage records — is processed for the performance of
the contract, compliance with legal obligations, fraud prevention and, subject to consent, marketing
communications.

Data is hosted in the European Union. The rights of access, rectification, erasure, restriction,
portability and objection are exercised from the customer area or through **[CONTACT EMAIL]**, and
complaints may be lodged with the Portuguese Data Protection Authority (CNPD).

**[GAP — TO BE DECIDED] Retention periods.** The specific retention periods for each category of
data are not set in this draft and must be defined in the legal review, in conjunction with §16.

Details are set out in the Privacy Policy.

## 13. Intellectual property

The platform, its software, brand, visual identity and own content belong to UProperty.

Content uploaded by the User remains theirs. By publishing it, the User grants UProperty a
non-exclusive licence limited to the display and processing necessary to provide the service, valid
for as long as the content is published.

## 14. Liability

UProperty is liable under general law for damage caused by breach of its obligations, and is not
liable:

1. for the truthfulness, legality or quality of properties, documents and information published by
   Users;
2. for agreements entered into between Users, or their performance;
3. for the content of communications exchanged between Users.

Nothing in these Terms excludes or limits liability that cannot be excluded or limited by law,
namely towards consumers.

## 15. Changes to these Terms

These Terms are **versioned**. Each version has a number, a date and a fingerprint of its content,
and it is recorded which specific version each User accepted.

Material changes are communicated with reasonable prior notice and, where required, call for fresh
acceptance. If the User does not accept the new version, they may terminate the subscription under
§8 without penalty.

## 16. Account deletion, history and abuse prevention

The User may delete the account from the customer area. Deletion:

1. **anonymises** profile data and makes the account inaccessible;
2. **retains** the subscription and billing history, as necessary to comply with legal, accounting
   and tax obligations;
3. **retains** the record of which version of these Terms was accepted and when, as proof of the
   contract entered into;
4. **retains**, in the form of an irreversible fingerprint (not the value itself), the identifiers
   strictly necessary to prevent the same person from repeatedly benefiting from limited offers by
   successively creating accounts.

**[GAP — TO BE LEGALLY VALIDATED] Legal basis and period for point 4.** The retention referred to in
point 4 constitutes processing of personal data after an erasure request and **must have an express,
documented legal basis and a defined period**, to be settled in the legal review. The platform is
prepared to apply whatever period is set; while none is set, no period is configured.

## 17. Complaints and dispute resolution

Complaints may be submitted to **[CONTACT EMAIL]** or through the **Electronic Complaints Book** at
www.livroreclamacoes.pt.

In the event of a consumer dispute, the User may turn to an alternative dispute resolution body
under Law no. 144/2015 of 8 September. The body competent by value and territory will be identified
on the platform. **[GAP — TO BE DECIDED] ADR body to be named.**

The European online dispute resolution platform is available at ec.europa.eu/consumers/odr.

## 18. Governing law and jurisdiction

These Terms are governed by Portuguese law. Where the User is a consumer, the jurisdiction reserved
to them by law continues to apply.

## 19. Gaps flagged in this draft

| # | Subject | Where |
| - | ------- | ----- |
| 1 | Minimum subscription period — not set | §6 |
| 2 | Early termination penalties — not set | §8 |
| 3 | Data retention periods — not set | §12 and §16 |
| 4 | Legal basis for retaining identifiers after erasure | §16 |
| 5 | Alternative dispute resolution body | §17 |
| 6 | Company identification details | §1 |

---

**Version 2026.10-draft1 · DRAFT PENDING LEGAL REVIEW.** This version does not replace legal advice
and must not go to production without review by a lawyer.
$terms_en$,
  'published',
  'draft_pending_legal_review',
  now(),
  now()
)
on conflict (kind, version, locale) do nothing;

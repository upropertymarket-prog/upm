-- UProperty Market — P11-07, Termos e Condições `2026.10-draft2`
--
-- MINUTA PARA REVISÃO JURÍDICA. Substitui `2026.10-draft1` (P9-02), que fica
-- `archived` — **nunca editada**. O hash de `draft1` é a prova de que texto
-- viram as pessoas que já aceitaram, e `terms_acceptances` aponta para a linha
-- dele com `on delete restrict`. Versão nova é linha nova; é a regra de §15 do
-- próprio documento.
--
-- Porquê uma v2, a 7 out 2026: o cliente leu a v1 e disse que estava curta —
-- faltavam as **normas e procedimentos** da plataforma. Em concreto: porque é
-- que toda a comunicação acontece dentro da app, porque é que os utilizadores
-- não trocam telefone, como funciona a moderação, as visitas, a morada exata,
-- as partilhas de documentos e o que fazer quando algo corre mal. A v1 descrevia
-- o contrato de subscrição; não descrevia o serviço.
--
-- **Tudo o que é novo descreve mecanismos que existem no código.** Não há
-- promessas de funcionalidades:
--   * §11 morada aproximada/exata — `get_property_location()` e
--     `property_address_grants` (origem, autor, revogação, um grant ativo por
--     imóvel e comprador).
--   * §12 comunicação na plataforma — `conversations` (uma por imóvel e
--     comprador) e `messages`; `properties_public` nunca expõe `location`,
--     `address_line` nem o telefone do dono.
--   * §13 visitas — `visit_requests`, enum `visit_status`, o limite de 3
--     reagendamentos (`reschedule_count check between 0 and 3`) e o grant de
--     morada que nasce com o `accepted`.
--   * §14 leads — `owner_leads`, enum `lead_stage` e `lead_outcome`.
--   * §15 Cloud — `files`/`file_versions` (substituir nunca sobrescreve),
--     `file_shares` com `expires_at`, `access_code_hash` e `revoked_at`, e
--     `document_access_log`.
--   * §16 contratos — modelo da administração vs contrato do proprietário, e a
--     ausência de assinatura eletrónica (01 §1.2 põe-na fora de âmbito).
--   * §19 moderação — `property_moderation_events`, append-only, com motivo, e
--     legível pelo proprietário do imóvel.
--   * §27 eliminação — `profiles.status = 'deleted'` com anonimização e
--     `person_identities` a guardar só HMAC-SHA256.
--
-- **§20 é a exceção, e está assinalada como tal.** Não existe botão de denúncia
-- na app: a procura por `denunc|reportar|abuse|report_` não devolve nada em
-- `apps/` nem em `supabase/`. O canal é o e-mail de contacto, e o texto diz
-- isso em vez de prometer um botão.
--
-- As lacunas de `draft1` mantêm-se todas por fechar e estão em §30. Nenhuma foi
-- inventada: os dados da empresa continuam vazios em `app_settings`, o prazo de
-- conservação continua `null`, e a entidade RAL continua por escolher.

set search_path = public, extensions;

-- `draft1` sai de circulação. `current_legal_document()` escolhe por
-- `effective_from desc`, por isso bastaria inserir a v2; arquivar torna a
-- intenção explícita e evita que uma correção futura de datas ressuscite a v1.
update public.legal_documents
   set status = 'archived'
 where kind = 'terms'
   and version = '2026.10-draft1'
   and status = 'published';

insert into public.legal_documents (kind, version, locale, title, body_md, status, review_state, effective_from, published_at)
values (
  'terms',
  '2026.10-draft2',
  'pt',
  'Termos e Condições de Utilização — UProperty Market',
  $terms_pt_v2$
> **MINUTA PARA REVISÃO JURÍDICA — NÃO É UM DOCUMENTO DEFINITIVO.**
> Este texto foi redigido como estrutura de trabalho e **tem de ser revisto e
> aprovado por advogado** antes de a plataforma entrar em produção. Contém
> lacunas assinaladas em §30, que dependem de decisões ainda por tomar.
> Nenhuma cláusula aqui escrita deve ser tratada como validada juridicamente.

## 1. Identificação e objeto

A plataforma **UProperty Market** é explorada por **[NOME LEGAL DA EMPRESA]**, com sede em
**[MORADA]**, NIPC **[NIPC]**, contactável em **[E-MAIL DE CONTACTO]** e **[TELEFONE]** (adiante,
"nós" ou "a UProperty").

Estes Termos e Condições regulam o acesso e a utilização da plataforma por si (adiante, "o
Utilizador"). Ao criar conta e ao subscrever um plano, o Utilizador declara que leu, compreendeu e
aceita estes Termos na versão identificada no final deste documento.

Fazem parte integrante destes Termos a **Política de Privacidade** e a **Política de Cookies**,
disponíveis na plataforma.

## 2. Definições

| Termo | Significado |
| ----- | ----------- |
| Plataforma | O conjunto do site público, da aplicação de utilizador e dos serviços associados |
| Proprietário | Utilizador que publica um ou mais imóveis |
| Interessado | Utilizador que procura imóvel, contacta proprietários e pede visitas |
| Anúncio | A publicação de um imóvel, com texto, fotografias, características e localização |
| Conversa | O canal de mensagens entre um Interessado e um Proprietário sobre um imóvel concreto |
| Pedido de visita | A proposta de data e hora para visitar um imóvel, e os estados por que passa |
| Cloud | A área de armazenamento de ficheiros do Utilizador, incluída no plano |
| Contrato | O documento gerado pelo Proprietário a partir de um modelo da UProperty |

## 3. O que a plataforma faz — e o que não faz

A UProperty Market é um serviço digital de subscrição que permite a proprietários publicar imóveis
para venda ou arrendamento e a interessados procurá-los, contactar o proprietário, pedir visitas,
trocar documentos e preparar contratos, **diretamente entre as partes e sem comissões sobre a
transação**.

A UProperty **não é mediadora imobiliária**, não representa nenhuma das partes, não intervém na
negociação, não recebe nem processa pagamentos relativos ao imóvel, não detém quantias por conta das
partes e não garante a concretização de qualquer negócio. O serviço prestado é o acesso à plataforma
e às funcionalidades do plano subscrito.

A UProperty **não verifica a titularidade dos imóveis anunciados** nem a autenticidade dos documentos
carregados pelos Utilizadores, sem prejuízo da moderação prevista em §19. A verificação da situação
jurídica, registal, fiscal e urbanística de um imóvel é da responsabilidade das partes.

A UProperty não presta aconselhamento jurídico, fiscal, financeiro, de avaliação imobiliária ou de
crédito. Os modelos de contrato disponibilizados são instrumentos de trabalho e não substituem a
análise de um profissional.

## 4. Quem pode ter conta, e o princípio de uma pessoa uma conta

Pode criar conta quem:

1. seja pessoa singular com idade igual ou superior a 18 anos e capacidade para contratar;
2. indique dados verdadeiros, completos e atuais, incluindo nome, **Número de Identificação Fiscal
   (NIF) de pessoa singular**, telefone e endereço de correio eletrónico;
3. aceite estes Termos.

**Uma pessoa, uma conta.** O NIF é único por conta e não pode ser utilizado em mais do que uma conta
ativa. O NIF indicado tem de ser o do titular da conta; não são aceites números de pessoa coletiva.
Quando a faturação deva ser emitida a uma entidade, os dados fiscais dessa entidade são recolhidos no
processo de pagamento e não substituem o NIF do titular.

A alteração do NIF depois da criação da conta não se faz livremente e exige um pedido próprio, por
razões de prevenção de fraude.

A UProperty pode recusar a criação de conta sem indicar o motivo concreto, quando a recusa resulte da
verificação de elegibilidade descrita em §27. As mensagens de erro no registo são deliberadamente
genéricas: dizer "este NIF já tem conta" revelaria a terceiros que uma pessoa concreta está inscrita
nesta plataforma.

## 5. Conta, credenciais e verificação

O Utilizador é responsável por manter a confidencialidade das suas credenciais e por toda a atividade
realizada com a sua conta, devendo comunicar-nos de imediato qualquer utilização não autorizada.

O endereço de correio eletrónico indicado é verificado por ligação enviada para esse endereço. Até à
verificação, a conta tem acesso limitado, nos termos indicados na plataforma.

As tentativas de autenticação são registadas para efeitos de segurança e podem ser limitadas em
frequência quando se detete um padrão de abuso.

## 6. Subscrição, preços e pagamento

O acesso à plataforma **depende de subscrição paga**. **Não existe plano gratuito nem período
experimental gratuito.** A subscrição é contratada no momento da inscrição, depois de o Utilizador
preencher os seus dados, ver as condições e com elas concordar.

Os planos disponíveis, o que cada um inclui, os limites aplicáveis e os preços são apresentados na
plataforma antes da contratação e constam do ecrã de contratação que o Utilizador confirma. Os preços
são apresentados em euros e **incluem IVA à taxa legal em vigor**, salvo indicação expressa em
contrário.

O pagamento é processado pelo prestador de serviços de pagamento **Stripe**. A UProperty não armazena
dados completos de cartão. A fatura é disponibilizada na área de cliente.

Podem ser contratados **extras** que acrescem ao plano, nos termos apresentados no momento da
contratação.

**Sem subscrição ativa não há limites atribuídos.** Terminada a subscrição, a conta mantém acesso à
contratação e às definições, nos termos de §9.

A UProperty pode alterar os preços para períodos futuros, comunicando a alteração com antecedência
razoável; a alteração não afeta períodos já pagos e o Utilizador pode cessar a subscrição antes de a
alteração produzir efeitos.

## 7. Duração, renovação e período mínimo

A subscrição tem a periodicidade escolhida na contratação (mensal ou anual) e **renova-se
automaticamente** por períodos iguais, salvo cessação nos termos de §9.

**Período mínimo: 12 meses.** A subscrição tem um período mínimo de permanência de **um ano**,
contado desde a data em que é celebrada. O período mínimo aplicável é apresentado no ecrã de
contratação, antes do pagamento, e fica registado na subscrição; uma alteração futura do período
mínimo **não se aplica** a subscrições já celebradas.

**O período mínimo não afeta o direito de livre resolução de 14 dias** previsto em §8.

> **[NOTA PARA A REVISÃO JURÍDICA — não é cláusula.]** O limite de 24 meses e a obrigação de oferecer
> períodos de 6, 12 e 24 meses pertencem ao regime das **comunicações eletrónicas** (Lei n.º 16/2022)
> e **não se aplicam** a este serviço. Os 12 meses são, por isso, uma escolha comercial e não um valor
> imposto por lei. Fica para a revisão confirmar: (a) se se justifica oferecer também uma modalidade
> sem período mínimo, e (b) qual a **contrapartida** identificável que justifica o compromisso.

## 8. Direito de livre resolução

Sendo o Utilizador consumidor, dispõe do direito de resolver o contrato **no prazo de 14 dias
seguidos** a contar da data de celebração, sem necessidade de indicar motivo e sem incorrer em custos,
nos termos do Decreto-Lei n.º 24/2014, de 14 de fevereiro.

Se o Utilizador solicitar expressamente que a prestação do serviço se inicie durante esse prazo — o
que sucede quando o acesso à plataforma é disponibilizado imediatamente após o pagamento — e vier a
exercer o direito de livre resolução, **pagará o montante proporcional ao serviço efetivamente
prestado** até à comunicação da resolução.

A resolução pode ser comunicada por qualquer meio inequívoco, nomeadamente para
**[E-MAIL DE CONTACTO]**.

## 9. Cessação da subscrição e seus efeitos

O Utilizador pode **pedir a cessação a qualquer momento**, a partir da área de cliente. O que varia é
a data em que a cessação produz efeitos:

1. **Depois do período mínimo** — produz efeitos no fim do período já pago, mantendo-se o acesso até lá.
2. **Durante o período mínimo de §7** — produz efeitos no fim desse período, mantendo-se o acesso e a
   obrigação de pagamento até lá. A subscrição deixa de renovar.

Não há reembolso de períodos já decorridos, sem prejuízo do disposto em §8.

Cessada a subscrição e terminado o período pago:

1. os anúncios que excedam o que a conta passa a permitir ficam em **rascunho** e **nunca são
   apagados**;
2. os ficheiros guardados na Cloud ficam acessíveis apenas para leitura e transferência, deixando de
   ser possível carregar novos;
3. as conversas e os pedidos de visita existentes deixam de poder ser iniciados de novo, mantendo-se
   o histórico acessível;
4. o Utilizador continua a poder aceder à conta para subscrever de novo, exportar os seus dados ou
   eliminar a conta.

**[LACUNA — A DECIDIR] Contrapartida por cessação antecipada.** Não está fixado qualquer encargo por
cessação antes do fim do período mínimo. **Enquanto não estiver definido e comunicado no ecrã de
contratação, a UProperty não cobra qualquer encargo por cessação antecipada** — o que acontece é o
descrito no ponto 2 acima.

> **[NOTA PARA A REVISÃO JURÍDICA — não é cláusula.]** Dois limites a respeitar quando esse valor for
> definido: **informação prévia** (DL 24/2014, art. 4.º — a falta alarga o prazo de livre resolução) e
> **proporcionalidade** (DL 446/85, art. 19.º c) — uma cláusula penal desproporcionada é nula, e não
> apenas reduzida).

## 10. Regras de publicação de imóveis

O Proprietário só pode publicar imóveis sobre os quais tenha **legitimidade** para o fazer, enquanto
titular, comproprietário com acordo dos demais, representante com poderes bastantes ou titular de
outro direito que o permita.

Cada anúncio deve conter informação **verdadeira, completa e atualizada**, nomeadamente:

1. a natureza do negócio (venda ou arrendamento) e o preço pedido, sem valores manifestamente
   desfasados destinados apenas a atrair contactos;
2. a tipologia, a área e o estado de conservação;
3. a localização, nos termos de §11;
4. o **certificado energético**, quando legalmente exigível, bem como a respetiva classe;
5. os encargos e ónus relevantes de que o Proprietário tenha conhecimento.

Quanto às **fotografias e vídeos**, o Proprietário declara ser titular dos direitos ou ter
autorização para os utilizar, e obriga-se a que representem o imóvel anunciado no seu estado atual.
Não são admitidas imagens manipuladas de forma a induzir em erro sobre o estado, a dimensão ou a
envolvente do imóvel, nem imagens de imóvel diferente do anunciado.

Não é permitido:

1. publicar o **mesmo imóvel em anúncios duplicados**, na mesma ou em várias contas;
2. publicar imóveis inexistentes, indisponíveis ou já transacionados, ou manter publicado um anúncio
   cujo imóvel deixou de estar disponível;
3. usar o anúncio para promover serviços, angariar clientes, divulgar outras plataformas ou publicar
   qualquer conteúdo alheio ao imóvel;
4. incluir no anúncio, em qualquer campo, dados de contacto diretos, nos termos de §12;
5. publicar conteúdo que discrimine potenciais interessados em razão de origem, nacionalidade, sexo,
   orientação sexual, religião, deficiência, idade ou qualquer outra categoria protegida.

O Proprietário obriga-se a **manter o anúncio atualizado** e a retirá-lo ou marcá-lo como indisponível
quando o imóvel deixe de estar no mercado.

## 11. Localização do imóvel e revelação da morada exata

A plataforma distingue **localização aproximada** de **morada exata**.

Por regra, o público e os Interessados veem apenas a **localização aproximada** do imóvel. A morada
exata e as coordenadas precisas não são exibidas nas listagens, nos resultados de pesquisa, no mapa
nem em qualquer vista pública.

A morada exata é revelada a um Interessado concreto quando:

1. o Proprietário **a conceda expressamente** a esse Interessado; ou
2. o Proprietário **aceite um pedido de visita** desse Interessado, caso em que a concessão é feita
   com a aceitação; ou
3. o Proprietário tenha optado por tornar a morada exata **pública** para aquele imóvel.

A concessão é **individual, registada e revogável**: o Proprietário pode retirá-la a qualquer momento,
deixando o Interessado de ver a morada exata. Cada Interessado tem, no máximo, uma concessão ativa por
imóvel.

Esta regra existe para proteger o Proprietário e quem habita o imóvel. O Interessado que obtenha a
morada exata obriga-se a **não a divulgar** a terceiros nem a utilizá-la para fim diferente da
avaliação do imóvel e da visita.

## 12. Comunicação dentro da plataforma

**Toda a comunicação entre Utilizadores a propósito de um imóvel acontece dentro da plataforma**, no
canal de conversa associado a esse imóvel. É esta a regra central do serviço e a razão de ser de
várias das restantes.

A plataforma **não exibe a terceiros o telefone, o endereço de correio eletrónico nem a morada do
Utilizador**. Esses dados nunca integram os anúncios, as vistas públicas ou as listagens, e não são
fornecidos à outra parte a pedido.

Não é permitido, em anúncios, mensagens, descrições, nomes, fotografias, documentos ou qualquer outro
campo:

1. **pedir ou facultar** número de telefone, endereço de correio eletrónico, perfis de redes sociais,
   identificadores de aplicações de mensagens, ligações externas de contacto ou qualquer outro meio
   de comunicação fora da plataforma;
2. inserir esses dados sob forma dissimulada, nomeadamente por extenso, com símbolos, em imagem ou
   em documento anexo, com o propósito de contornar esta regra;
3. convidar a outra parte a prosseguir a conversa fora da plataforma antes do momento previsto no
   parágrafo final desta cláusula.

**Porquê esta regra.** Não é uma restrição comercial — a UProperty não cobra comissão sobre o negócio
e não tem interesse em prolongar a conversa. As razões são:

1. **Proteção de dados pessoais.** O telefone e o e-mail são dados pessoais. Entregá-los a um
   desconhecido para iniciar uma conversa é desproporcionado quando a conversa pode acontecer sem
   eles, e expõe o Utilizador a contactos que não controla.
2. **Prevenção de contactos indesejados.** Quem publica um imóvel não fica, por isso, obrigado a
   receber chamadas e mensagens de quem quiser. Dentro da plataforma, a conversa pode ser terminada,
   e quem a iniciou não guarda meio de insistir por outra via.
3. **Prevenção de fraude.** A generalidade dos esquemas descritos em §18 começa por arrastar a
   conversa para fora da plataforma, onde não há registo, não há moderação e não há forma de verificar
   com quem se está a falar.
4. **Rastreabilidade.** Se houver desacordo, abuso ou denúncia, a conversa existe e pode ser apreciada.
   Uma conversa mantida fora da plataforma não pode ser verificada por ninguém, e a UProperty não tem
   como ajudar.
5. **Igualdade de tratamento.** Todos os Interessados chegam ao Proprietário pela mesma via e nas
   mesmas condições.

Nada nesta cláusula impede as partes de, **depois de estabelecida a relação na plataforma e quando a
negociação o justifique**, nomeadamente após uma visita realizada, trocarem entre si os contactos que
entenderem. O que não é permitido é usar a plataforma como mero diretório de contactos, contornando o
canal antes de qualquer relação estabelecida.

O incumprimento desta cláusula é fundamento de remoção do conteúdo e, quando reiterado, de suspensão
da conta, nos termos de §21.

## 13. Pedidos de visita

O Interessado pode propor ao Proprietário uma data e hora para visitar o imóvel. O pedido passa por
estados sucessivos — **pendente**, **aceite**, **reagendado**, **cancelado**, **realizado** —
visíveis para ambas as partes.

A aceitação do pedido revela ao Interessado a morada exata do imóvel, nos termos de §11.

Qualquer das partes pode **propor nova data**. O número de reagendamentos do mesmo pedido é limitado,
e o limite é indicado na plataforma; esgotado, o pedido tem de ser cancelado e feito de novo.

Qualquer das partes pode **cancelar** o pedido, ficando registado quem o fez.

A visita decorre entre as partes, fora da plataforma e sob a sua exclusiva responsabilidade. **A
UProperty não está presente, não acompanha, não representa nenhuma das partes e não responde pelo que
ocorra durante a visita.** Recomenda-se a leitura de §18.

O Utilizador obriga-se a comparecer às visitas que marque ou aceite, ou a cancelá-las com
antecedência razoável. O incumprimento reiterado é fundamento de suspensão nos termos de §21.

## 14. Contactos recebidos pelo Proprietário

O Proprietário dispõe de uma vista dos contactos recebidos, com o estado de cada um ao longo do
processo e o respetivo desfecho, que ele próprio regista.

Os dados pessoais a que o Proprietário aceda por esta via **só podem ser tratados para a finalidade do
contacto** — responder, marcar a visita e conduzir a negociação daquele imóvel. É expressamente
proibido utilizá-los para comunicações comerciais, incluí-los em listas, cedê-los a terceiros ou
conservá-los depois de terminada a relação.

Quando o Proprietário trate estes dados para finalidades próprias, assume as responsabilidades que a
lei de proteção de dados lhe imponha nessa qualidade.

## 15. Documentos, Cloud e partilhas

O plano inclui uma área de armazenamento de ficheiros, com o limite indicado na plataforma. Os
limites de espaço são os do plano subscrito e dos extras contratados.

**O histórico de versões é preservado:** substituir um ficheiro cria uma versão nova e não apaga a
anterior.

O Utilizador pode partilhar um ficheiro com outro Utilizador ou através de uma **ligação**. A
partilha por ligação pode ser protegida por **código de acesso** e ter **prazo de validade**, e pode
ser **revogada** a qualquer momento.

Os acessos a documentos partilhados são **registados** — quem acedeu, quando e em que termos — e esse
registo fica disponível para quem partilhou. Ao aceder a um documento partilhado, o Utilizador aceita
esse registo.

O Utilizador obriga-se a não carregar na Cloud conteúdo ilícito, nem conteúdo sobre o qual não tenha
direitos, e a não a utilizar como serviço de distribuição de ficheiros alheios ao fim da plataforma.

A UProperty não acede ao conteúdo dos ficheiros do Utilizador fora do estritamente necessário à
prestação do serviço, ao cumprimento de obrigações legais ou à apreciação de uma denúncia nos termos
de §20.

## 16. Contratos

A plataforma disponibiliza **modelos de contrato**, mantidos pela UProperty e versionados. A partir de
um modelo, o Proprietário gera um **contrato** com valores concretos, que lhe pertence e que pode
editar, exportar e partilhar.

A publicação de uma versão nova de um modelo **não altera** contratos já gerados: cada contrato
conserva a versão do modelo que lhe deu origem.

**A plataforma não dispõe de assinatura eletrónica.** O estado de um contrato como assinado é
assinalado manualmente pelas partes e **não constitui, por si, prova de assinatura** nem confere ao
documento qualquer valor acrescido.

Os modelos são instrumentos de trabalho de uso geral. **Não são aconselhamento jurídico** e podem não
ser adequados ao caso concreto; a sua utilização é da responsabilidade das partes, que devem procurar
apoio profissional quando a situação o justifique.

## 17. Conduta proibida

Para além do já previsto nas cláusulas anteriores, não é permitido:

1. publicar conteúdo ilícito, enganoso, difamatório, discriminatório, ofensivo, violento ou que viole
   direitos de terceiros, incluindo direitos de autor;
2. fazer-se passar por outra pessoa, por profissional habilitado ou pela própria UProperty;
3. utilizar a plataforma para comunicações comerciais não solicitadas, incluindo a oferta de serviços
   de mediação, crédito, obras, mudanças, fotografia ou certificação energética;
4. recolher, extrair ou copiar sistematicamente dados ou conteúdos da plataforma, por qualquer meio,
   automatizado ou não;
5. aceder ou tentar aceder a áreas, contas ou dados que não lhe pertençam, testar vulnerabilidades sem
   autorização escrita, ou interferir com o funcionamento do serviço;
6. contornar ou tentar contornar os limites do plano, a moderação, as regras de §12 ou as restrições
   de acesso, nomeadamente através da criação de contas adicionais;
7. revender, sublicenciar ou disponibilizar a terceiros o acesso à conta.

## 18. Segurança e prevenção de fraude

A segurança de quem usa a plataforma depende também de comportamentos simples. As indicações
seguintes são **recomendações** e não limitam a responsabilidade de quem defrauda outrem.

**O que a UProperty nunca faz:**

1. nunca pede a palavra-passe, por qualquer meio;
2. nunca pede dados completos de cartão por mensagem, telefone ou correio eletrónico;
3. nunca pede transferências para contas de colaboradores ou para contas indicadas por mensagem;
4. nunca intervém como depositária de sinais, cauções ou rendas.

**Sinais de alerta num contacto:**

1. insistência em sair da plataforma logo nas primeiras mensagens;
2. pedido de pagamento de sinal, reserva, caução ou renda **antes de visitar o imóvel** e de verificar
   a identidade e a legitimidade da outra parte;
3. preço muito abaixo do mercado, acompanhado de urgência;
4. proprietário que alega estar no estrangeiro e não poder mostrar o imóvel, propondo o envio de
   chaves após pagamento;
5. pedido de cópia de documentos de identificação sem motivo claro e antes de qualquer relação
   estabelecida;
6. ligações para páginas de pagamento ou de autenticação enviadas por mensagem.

**Recomendações:**

1. mantenha a conversa na plataforma até ter razões para confiar na outra parte;
2. visite o imóvel antes de entregar qualquer quantia;
3. confirme a legitimidade de quem anuncia, pedindo os documentos pertinentes e, quando possível,
   consultando o registo predial;
4. não pague por meios não rastreáveis;
5. use uma palavra-passe exclusiva desta plataforma;
6. comunique-nos qualquer situação suspeita, nos termos de §20.

## 19. Moderação de anúncios

Os anúncios são sujeitos a **moderação** antes da publicação. A UProperty pode aprovar, recusar,
suspender ou remover um anúncio que não cumpra estes Termos.

As decisões de moderação são **registadas com o respetivo motivo**, o Proprietário é **notificado** e
pode consultar o **histórico das decisões** relativas aos seus imóveis.

As decisões são **reversíveis**: um anúncio recusado pode ser corrigido e reaberto. O Proprietário que
discorde de uma decisão pode pedir a sua reapreciação pelo canal de §20, indicando o anúncio e as
razões.

A moderação incide sobre o cumprimento destas regras e **não constitui verificação da titularidade do
imóvel, da veracidade da informação nem da autenticidade dos documentos**.

## 20. Comunicar um problema

Qualquer situação de incumprimento destes Termos — anúncio enganoso, conteúdo ilícito, tentativa de
fraude, pedido de contactos fora da plataforma, assédio ou utilização indevida de dados — deve
ser-nos comunicada para **[E-MAIL DE CONTACTO]**.

> **[NOTA PARA A REVISÃO JURÍDICA — não é cláusula.]** Não existe atualmente mecanismo de denúncia
> dentro da aplicação; o canal é o endereço de correio eletrónico. Esta cláusula descreve o que existe.
> Se vier a ser criado um mecanismo próprio, esta cláusula tem de ser atualizada em versão nova.

A comunicação deve identificar o anúncio, a conversa ou o Utilizador em causa e descrever os factos.

Recebida a comunicação, a UProperty aprecia-a e pode remover conteúdo, suspender a conta ou não dar
seguimento, informando quem comunicou do desfecho sempre que isso não prejudique a apreciação ou os
direitos de terceiros.

Comunicações manifestamente infundadas ou feitas de má-fé, nomeadamente para prejudicar anúncios
concorrentes, são elas próprias fundamento de suspensão.

## 21. Suspensão e cessação por nossa iniciativa

A UProperty pode suspender ou cessar a conta, com aviso sempre que possível, em caso de:

1. incumprimento grave ou reiterado destes Termos;
2. utilização fraudulenta ou indícios sérios de fraude;
3. falta de pagamento;
4. conduta que ponha em risco outros Utilizadores, a plataforma ou terceiros.

A suspensão por motivo de segurança pode ser imediata e sem aviso prévio, sendo o Utilizador informado
logo que possível.

Cessada a conta por incumprimento, não há reembolso dos períodos já decorridos, sem prejuízo dos
direitos que a lei reconheça ao consumidor.

## 22. Disponibilidade, conformidade e atualizações

A UProperty envida os melhores esforços para manter a plataforma disponível, podendo haver
interrupções para manutenção, por motivos técnicos ou por causas não imputáveis à UProperty.

Ao serviço digital prestado aplica-se o regime de conformidade do **Decreto-Lei n.º 84/2021, de 18 de
outubro**, nos termos legais, incluindo quanto aos direitos do consumidor em caso de falta de
conformidade.

A UProperty pode atualizar as funcionalidades da plataforma. Alterações que reduzam significativamente
o que foi contratado serão comunicadas com antecedência razoável.

## 23. Dados pessoais

O responsável pelo tratamento é **[NOME LEGAL DA EMPRESA]**. Os dados pessoais recolhidos são tratados
para a execução do contrato, cumprimento de obrigações legais, prevenção de fraude e, mediante
consentimento, comunicações de marketing.

O acesso de colaboradores da UProperty a dados pessoais de Utilizadores é **limitado ao necessário** e
fica **registado**.

Os direitos de acesso, retificação, apagamento, limitação, portabilidade e oposição são exercidos a
partir da área de cliente ou através de **[E-MAIL DE CONTACTO]**, e podem ser apresentadas reclamações
à Comissão Nacional de Proteção de Dados.

**[LACUNA — A DECIDIR] Prazos de conservação.** Os prazos concretos de conservação de cada categoria
de dados não estão fixados nesta minuta e têm de ser definidos na revisão jurídica, em articulação com
§27.

O detalhe consta da **Política de Privacidade**.

## 24. Propriedade intelectual

A plataforma, o seu software, marca, identidade visual e conteúdos próprios pertencem à UProperty.

O conteúdo carregado pelo Utilizador continua a ser dele. Ao publicá-lo, concede à UProperty uma
licença não exclusiva, gratuita, limitada à exibição, armazenamento e processamento necessários para
prestar o serviço, válida enquanto o conteúdo estiver publicado, e extensível à exibição do anúncio no
site público.

O Utilizador garante que detém os direitos necessários sobre o conteúdo que publica e responde perante
terceiros por qualquer violação.

## 25. Responsabilidade

A UProperty responde nos termos gerais de direito pelos danos causados por incumprimento das suas
obrigações, não sendo responsável:

1. pela veracidade, legalidade, estado ou qualidade dos imóveis, documentos e informações publicados
   pelos Utilizadores;
2. pelos acordos celebrados entre Utilizadores, nem pelo seu cumprimento, nem pelos pagamentos entre
   eles realizados;
3. pelo conteúdo das comunicações trocadas entre Utilizadores;
4. pelo que ocorra durante as visitas aos imóveis;
5. por danos resultantes do incumprimento, pelo Utilizador, das regras de §12 e §18, nomeadamente da
   condução da negociação fora da plataforma.

Nada nestes Termos exclui ou limita responsabilidade que não possa ser excluída ou limitada por lei,
nomeadamente perante consumidores.

## 26. Alterações a estes Termos

Estes Termos são **versionados**. Cada versão tem um número, uma data e uma impressão digital do seu
conteúdo, e fica registado que versão concreta cada Utilizador aceitou.

Alterações materiais são comunicadas com antecedência razoável e, quando exigível, carecem de **nova
aceitação**. Se o Utilizador não aceitar a nova versão, pode cessar a subscrição nos termos de §9, sem
penalização.

## 27. Eliminação da conta, histórico e prevenção de abuso

O Utilizador pode eliminar a conta a partir da área de cliente. A eliminação:

1. **anonimiza** os dados de perfil — nome, telefone, NIF, imagem e preferências — e torna a conta
   inacessível;
2. **conserva** o histórico de subscrições e faturação, por ser necessário ao cumprimento de
   obrigações legais, contabilísticas e fiscais;
3. **conserva** o registo de que versão destes Termos foi aceite e quando, por ser a prova do contrato
   celebrado;
4. **conserva**, sob a forma de impressão digital irreversível (não do valor em si), os identificadores
   estritamente necessários para impedir que a mesma pessoa beneficie repetidamente de ofertas
   limitadas através da criação sucessiva de contas.

**[LACUNA — A VALIDAR JURIDICAMENTE] Base legal e prazo do ponto 4.** A conservação referida no ponto
4 constitui tratamento de dados pessoais após um pedido de apagamento e **tem de ter base legal
expressa, documentada e com prazo determinado**, a definir na revisão jurídica. Enquanto não for
fixado, não existe prazo configurado.

## 28. Reclamações e resolução de litígios

As reclamações podem ser apresentadas para **[E-MAIL DE CONTACTO]** ou através do **Livro de
Reclamações Eletrónico**, em [www.livroreclamacoes.pt](http://www.livroreclamacoes.pt).

Em caso de litígio de consumo, o Utilizador pode recorrer a entidade de resolução alternativa de
litígios, nos termos da Lei n.º 144/2015, de 8 de setembro. A entidade competente em razão do valor e
do território será identificada na plataforma. **[LACUNA — A DECIDIR] Entidade RAL a indicar.**

A plataforma europeia de resolução de litígios em linha está disponível em ec.europa.eu/consumers/odr.

## 29. Lei aplicável e foro

Estes Termos regem-se pela lei portuguesa. Sendo o Utilizador consumidor, mantém-se a competência do
foro que a lei lhe reserva.

## 30. Lacunas assinaladas nesta minuta

| # | Assunto | Onde |
| - | ------- | ---- |
| 1 | Período mínimo fixado em 12 meses; falta a contrapartida que o justifica | §7 |
| 2 | Contrapartida por cessação antecipada — não fixada; enquanto o for, nada é cobrado | §9 |
| 3 | Prazos de conservação de dados — não fixados | §23 e §27 |
| 4 | Base legal da retenção de identificadores após apagamento | §27 |
| 5 | Entidade de resolução alternativa de litígios | §28 |
| 6 | Dados de identificação da empresa | §1 |
| 7 | Momento a partir do qual a troca de contactos diretos passa a ser admitida | §12 |
| 8 | Inexistência de mecanismo de denúncia na aplicação; canal é o e-mail | §20 |

---

**Versão 2026.10-draft2 · MINUTA PARA REVISÃO JURÍDICA.** Esta versão não substitui aconselhamento
jurídico e não deve entrar em produção sem revisão por advogado.
$terms_pt_v2$,
  'published',
  'draft_pending_legal_review',
  now(),
  now()
)
on conflict (kind, version, locale) do nothing;

-- ---------------------------------------------------------------------------
-- EN — 07 §5.13 manda o inglês cobrir também os textos legais. A versão
-- portuguesa é a fonte e prevalece; está dito no próprio texto inglês. São
-- documentos separados, com hashes próprios: quem aceitar em inglês fica com o
-- hash do texto inglês, que é o que viu.
-- ---------------------------------------------------------------------------

update public.legal_documents
   set status = 'archived'
 where kind = 'terms'
   and version = '2026.10-draft1'
   and locale = 'en'
   and status = 'published';

insert into public.legal_documents (kind, version, locale, title, body_md, status, review_state, effective_from, published_at)
values (
  'terms',
  '2026.10-draft2',
  'en',
  'Terms and Conditions of Use — UProperty Market',
  $terms_en_v2$
> **DRAFT PENDING LEGAL REVIEW — THIS IS NOT A FINAL DOCUMENT.**
> This text was written as a working structure and **must be reviewed and approved by a lawyer**
> before the platform goes to production. It contains gaps flagged in §30 that depend on decisions
> still to be made. No clause written here should be treated as legally validated.
> In case of divergence, the Portuguese version prevails.

## 1. Identification and purpose

The **UProperty Market** platform is operated by **[LEGAL COMPANY NAME]**, with registered office at
**[ADDRESS]**, tax number **[NIPC]**, reachable at **[CONTACT EMAIL]** and **[PHONE]** (hereinafter
"we" or "UProperty").

These Terms and Conditions govern your access to and use of the platform (hereinafter "the User"). By
creating an account and subscribing to a plan, the User declares having read, understood and accepted
these Terms in the version identified at the end of this document.

The **Privacy Policy** and the **Cookie Policy**, available on the platform, form an integral part of
these Terms.

## 2. Definitions

| Term | Meaning |
| ---- | ------- |
| Platform | The public site, the user application and the associated services, taken together |
| Owner | A User who publishes one or more properties |
| Interested party | A User who searches for property, contacts Owners and requests viewings |
| Listing | The publication of a property, with text, photographs, features and location |
| Conversation | The messaging channel between an Interested party and an Owner about one property |
| Viewing request | The proposal of a date and time to visit a property, and the states it passes through |
| Cloud | The User's file storage area, included in the plan |
| Contract | The document generated by the Owner from a UProperty template |

## 3. What the platform does — and does not do

UProperty Market is a subscription digital service that lets owners publish properties for sale or
rent and lets interested parties search for them, contact the owner, request viewings, exchange
documents and prepare contracts, **directly between the parties and with no commission on the
transaction**.

UProperty **is not a real estate agency**, does not represent either party, does not take part in the
negotiation, does not receive or process payments relating to the property, does not hold funds on
behalf of the parties and does not guarantee that any deal will be concluded. The service provided is
access to the platform and to the features of the subscribed plan.

UProperty **does not verify title to the properties advertised** nor the authenticity of documents
uploaded by Users, without prejudice to the moderation set out in §19. Verifying a property's legal,
registry, tax and planning situation is the parties' responsibility.

UProperty does not provide legal, tax, financial, valuation or credit advice. The contract templates
made available are working instruments and do not replace a professional's analysis.

## 4. Who may hold an account, and the one person one account principle

An account may be created by anyone who:

1. is a natural person aged 18 or over with capacity to contract;
2. provides true, complete and current data, including name, **personal tax number (NIF)**, phone and
   email address;
3. accepts these Terms.

**One person, one account.** The NIF is unique per account and may not be used on more than one
active account. The NIF provided must be the account holder's; company numbers are not accepted.
Where invoicing must be issued to an entity, that entity's tax details are collected during payment
and do not replace the holder's NIF.

Changing the NIF after the account is created is not done freely and requires a specific request, for
fraud prevention reasons.

UProperty may refuse to create an account without stating the specific reason, where the refusal
results from the eligibility check described in §27. Error messages during registration are
deliberately generic: saying "this NIF already has an account" would reveal to third parties that a
specific person is registered on this platform.

## 5. Account, credentials and verification

The User is responsible for keeping their credentials confidential and for all activity carried out
with their account, and must notify us immediately of any unauthorised use.

The email address provided is verified by a link sent to that address. Until verification, the account
has limited access, as indicated on the platform.

Authentication attempts are logged for security purposes and may be rate-limited where a pattern of
abuse is detected.

## 6. Subscription, prices and payment

Access to the platform **requires a paid subscription**. **There is no free plan and no free trial.**
The subscription is taken out at sign-up, after the User fills in their details, sees the conditions
and agrees to them.

The available plans, what each includes, the applicable limits and the prices are presented on the
platform before contracting and appear on the checkout screen the User confirms. Prices are shown in
euros and **include VAT at the legal rate in force**, unless expressly stated otherwise.

Payment is processed by the payment service provider **Stripe**. UProperty does not store full card
details. The invoice is made available in the customer area.

**Add-ons** may be purchased in addition to the plan, on the terms presented at the time of purchase.

**Without an active subscription no limits are allocated.** Once the subscription ends, the account
retains access to checkout and settings, as set out in §9.

UProperty may change prices for future periods, giving reasonable advance notice; the change does not
affect periods already paid for, and the User may terminate the subscription before it takes effect.

## 7. Duration, renewal and minimum term

The subscription runs for the billing period chosen at checkout (monthly or annual) and **renews
automatically** for equal periods, unless terminated under §9.

**Minimum term: 12 months.** The subscription has a minimum commitment period of **one year**, counted
from the date it is entered into. The applicable minimum term is shown on the checkout screen, before
payment, and is recorded on the subscription; a future change to the minimum term **does not apply** to
subscriptions already entered into.

**The minimum term does not affect the 14-day right of withdrawal** set out in §8.

> **[NOTE FOR LEGAL REVIEW — not a clause.]** The 24-month cap and the duty to offer 6, 12 and 24-month
> terms belong to the **electronic communications** regime (Law 16/2022) and **do not apply** to this
> service. The 12 months are therefore a commercial choice, not a figure imposed by law. For review:
> (a) whether a no-minimum-term option should also be offered, and (b) what identifiable benefit
> justifies the commitment.

## 8. Right of withdrawal

Where the User is a consumer, they have the right to withdraw from the contract **within 14
consecutive days** from the date it is entered into, without giving reasons and without incurring
costs, under Decree-Law 24/2014 of 14 February.

If the User expressly requests that performance begin during that period — which is what happens when
access to the platform is made available immediately after payment — and then exercises the right of
withdrawal, they **will pay an amount proportionate to the service actually provided** up to the
communication of withdrawal.

Withdrawal may be communicated by any unequivocal means, in particular to **[CONTACT EMAIL]**.

## 9. Termination of the subscription and its effects

The User may **request termination at any time** from the customer area. What varies is the date on
which termination takes effect:

1. **After the minimum term** — it takes effect at the end of the period already paid for, access
   being retained until then.
2. **During the minimum term under §7** — it takes effect at the end of that term, access and the
   payment obligation being retained until then. The subscription stops renewing.

There is no refund of periods already elapsed, without prejudice to §8.

Once the subscription has ended and the paid period has expired:

1. listings exceeding what the account is then allowed become **drafts** and are **never deleted**;
2. files kept in the Cloud remain accessible for reading and download only, and no new files may be
   uploaded;
3. existing conversations and viewing requests can no longer be started afresh, while the history
   remains accessible;
4. the User may still access the account to subscribe again, export their data or delete the account.

**[GAP — TO BE DECIDED] Early termination charge.** No charge for termination before the end of the
minimum term has been set. **Until one is defined and communicated on the checkout screen, UProperty
charges nothing for early termination** — what happens is point 2 above.

> **[NOTE FOR LEGAL REVIEW — not a clause.]** Two limits to respect when that amount is set: **prior
> information** (DL 24/2014, art. 4 — failure extends the withdrawal period) and **proportionality**
> (DL 446/85, art. 19 c) — a disproportionate penalty clause is void, not merely reduced).

## 10. Rules for publishing properties

The Owner may only publish properties they are **entitled** to publish, as holder, as co-owner with
the agreement of the others, as a representative with sufficient powers, or as holder of another right
allowing it.

Each listing must contain **true, complete and current** information, in particular:

1. the nature of the transaction (sale or rent) and the asking price, without figures clearly out of
   line with the market intended merely to attract contacts;
2. the layout, floor area and state of repair;
3. the location, as set out in §11;
4. the **energy certificate**, where legally required, and its rating;
5. any relevant charges and encumbrances known to the Owner.

As to **photographs and videos**, the Owner declares that they hold the rights or have authorisation
to use them, and undertakes that they depict the advertised property in its current state. Images
manipulated so as to mislead about the property's condition, size or surroundings are not allowed, nor
are images of a property other than the one advertised.

It is not permitted to:

1. publish the **same property in duplicate listings**, on the same or on several accounts;
2. publish properties that do not exist, are unavailable or have already been transacted, or keep a
   listing live once the property is off the market;
3. use the listing to promote services, solicit clients, advertise other platforms or publish any
   content unrelated to the property;
4. include direct contact details in any field of the listing, as set out in §12;
5. publish content discriminating against potential interested parties on grounds of origin,
   nationality, sex, sexual orientation, religion, disability, age or any other protected ground.

The Owner undertakes to **keep the listing up to date** and to withdraw it or mark it unavailable when
the property leaves the market.

## 11. Property location and disclosure of the exact address

The platform distinguishes **approximate location** from **exact address**.

As a rule, the public and Interested parties see only the property's **approximate location**. The
exact address and precise coordinates are not shown in listings, search results, the map or any public
view.

The exact address is disclosed to a specific Interested party when:

1. the Owner **expressly grants** it to that Interested party; or
2. the Owner **accepts a viewing request** from that Interested party, in which case the grant is made
   with the acceptance; or
3. the Owner has chosen to make the exact address **public** for that property.

The grant is **individual, recorded and revocable**: the Owner may withdraw it at any time, after
which the Interested party no longer sees the exact address. Each Interested party has at most one
active grant per property.

This rule exists to protect the Owner and whoever lives in the property. An Interested party who
obtains the exact address undertakes **not to disclose it** to third parties and not to use it for any
purpose other than assessing the property and the viewing.

## 12. Communication within the platform

**All communication between Users about a property takes place within the platform**, in the
conversation channel associated with that property. This is the central rule of the service and the
reason for several of the others.

The platform **does not show third parties the User's phone number, email address or home address**.
Those details never form part of listings, public views or search results, and are not provided to the
other party on request.

It is not permitted, in listings, messages, descriptions, names, photographs, documents or any other
field, to:

1. **request or provide** a phone number, email address, social media profiles, messaging app
   identifiers, external contact links or any other means of communication outside the platform;
2. insert such details in disguised form, in particular spelled out, with symbols, in an image or in
   an attached document, for the purpose of circumventing this rule;
3. invite the other party to continue the conversation outside the platform before the moment set out
   in the final paragraph of this clause.

**Why this rule exists.** It is not a commercial restriction — UProperty charges no commission on the
transaction and has no interest in prolonging the conversation. The reasons are:

1. **Protection of personal data.** Phone numbers and email addresses are personal data. Handing them
   to a stranger in order to start a conversation is disproportionate when the conversation can happen
   without them, and exposes the User to contacts they do not control.
2. **Prevention of unwanted contact.** Publishing a property does not oblige anyone to receive calls
   and messages from all comers. Within the platform a conversation can be ended, and whoever started
   it keeps no means of persisting by another route.
3. **Fraud prevention.** Most of the schemes described in §18 begin by dragging the conversation
   outside the platform, where there is no record, no moderation and no way to verify who one is
   talking to.
4. **Traceability.** If there is a disagreement, abuse or a report, the conversation exists and can be
   examined. A conversation held outside the platform cannot be verified by anyone, and UProperty has
   no way to help.
5. **Equal treatment.** Every Interested party reaches the Owner by the same route and on the same
   terms.

Nothing in this clause prevents the parties, **once the relationship has been established on the
platform and where the negotiation justifies it**, in particular after a viewing has taken place, from
exchanging whatever contact details they see fit. What is not allowed is using the platform as a mere
contact directory, bypassing the channel before any relationship exists.

Breach of this clause is grounds for removing the content and, where repeated, for suspending the
account under §21.

## 13. Viewing requests

The Interested party may propose a date and time to the Owner to visit the property. The request
passes through successive states — **pending**, **accepted**, **rescheduled**, **cancelled**,
**completed** — visible to both parties.

Acceptance of the request discloses the property's exact address to the Interested party, under §11.

Either party may **propose a new date**. The number of times the same request may be rescheduled is
limited, and the limit is shown on the platform; once exhausted, the request must be cancelled and made
anew.

Either party may **cancel** the request, and who did so is recorded.

The viewing takes place between the parties, outside the platform and under their sole responsibility.
**UProperty is not present, does not accompany the viewing, represents neither party and is not liable
for what occurs during it.** Reading §18 is recommended.

The User undertakes to attend viewings they arrange or accept, or to cancel them with reasonable
notice. Repeated failure to do so is grounds for suspension under §21.

## 14. Contacts received by the Owner

The Owner has a view of the contacts received, with the state of each one through the process and its
outcome, which the Owner records.

Personal data the Owner accesses by this route **may only be processed for the purpose of that
contact** — replying, arranging the viewing and conducting the negotiation for that property. Using it
for commercial communications, including it in lists, transferring it to third parties or keeping it
after the relationship has ended is expressly prohibited.

Where the Owner processes this data for their own purposes, they assume the responsibilities data
protection law imposes on them in that capacity.

## 15. Documents, Cloud and sharing

The plan includes a file storage area, with the limit shown on the platform. Storage limits are those
of the subscribed plan and of any add-ons purchased.

**Version history is preserved:** replacing a file creates a new version and does not delete the
previous one.

The User may share a file with another User or by **link**. Link sharing may be protected by an
**access code** and have an **expiry date**, and may be **revoked** at any time.

Access to shared documents is **logged** — who accessed, when and on what terms — and that log is
available to whoever shared the file. By accessing a shared document, the User accepts that logging.

The User undertakes not to upload unlawful content to the Cloud, nor content they hold no rights to,
and not to use it as a distribution service for files unrelated to the platform's purpose.

UProperty does not access the content of the User's files beyond what is strictly necessary to provide
the service, comply with legal obligations or examine a report under §20.

## 16. Contracts

The platform provides **contract templates**, maintained by UProperty and versioned. From a template
the Owner generates a **contract** with specific values, which belongs to them and which they may
edit, export and share.

Publishing a new version of a template **does not alter** contracts already generated: each contract
retains the template version it was created from.

**The platform has no electronic signature.** Marking a contract as signed is done manually by the
parties and **does not in itself constitute proof of signature** nor give the document any added
status.

Templates are general-purpose working instruments. They are **not legal advice** and may not suit the
specific case; their use is the parties' responsibility, and professional support should be sought
where the situation warrants it.

## 17. Prohibited conduct

In addition to what is set out in the preceding clauses, it is not permitted to:

1. publish unlawful, misleading, defamatory, discriminatory, offensive or violent content, or content
   infringing third-party rights, including copyright;
2. impersonate another person, a qualified professional or UProperty itself;
3. use the platform for unsolicited commercial communications, including offering brokerage, credit,
   building works, removals, photography or energy certification services;
4. systematically collect, extract or copy data or content from the platform, by any means, automated
   or otherwise;
5. access or attempt to access areas, accounts or data not belonging to them, test vulnerabilities
   without written authorisation, or interfere with the operation of the service;
6. circumvent or attempt to circumvent plan limits, moderation, the rules in §12 or access
   restrictions, in particular by creating additional accounts;
7. resell, sublicense or make account access available to third parties.

## 18. Safety and fraud prevention

The safety of those using the platform also depends on simple behaviours. The following are
**recommendations** and do not limit the liability of anyone who defrauds another.

**What UProperty never does:**

1. never asks for your password, by any means;
2. never asks for full card details by message, phone or email;
3. never asks for transfers to staff accounts or to accounts given by message;
4. never acts as a holder of deposits, bonds or rent.

**Warning signs in a contact:**

1. insistence on leaving the platform in the first few messages;
2. a request to pay a deposit, reservation, bond or rent **before visiting the property** and before
   verifying the other party's identity and entitlement;
3. a price far below market, coupled with urgency;
4. an owner claiming to be abroad and unable to show the property, offering to send keys after payment;
5. a request for copies of identity documents without a clear reason and before any relationship
   exists;
6. links to payment or sign-in pages sent by message.

**Recommendations:**

1. keep the conversation on the platform until you have reason to trust the other party;
2. visit the property before handing over any money;
3. confirm the entitlement of whoever is advertising, asking for the relevant documents and, where
   possible, consulting the land registry;
4. do not pay by untraceable means;
5. use a password unique to this platform;
6. report anything suspicious to us, under §20.

## 19. Listing moderation

Listings are subject to **moderation** before publication. UProperty may approve, refuse, suspend or
remove a listing that does not comply with these Terms.

Moderation decisions are **recorded with their reason**, the Owner is **notified** and may consult the
**history of decisions** relating to their properties.

Decisions are **reversible**: a refused listing may be corrected and reopened. An Owner who disagrees
with a decision may request a review through the channel in §20, identifying the listing and the
reasons.

Moderation addresses compliance with these rules and **does not constitute verification of title to
the property, of the truth of the information or of the authenticity of documents**.

## 20. Reporting a problem

Any breach of these Terms — a misleading listing, unlawful content, attempted fraud, a request for
contact details outside the platform, harassment or misuse of data — should be reported to us at
**[CONTACT EMAIL]**.

> **[NOTE FOR LEGAL REVIEW — not a clause.]** There is currently no in-app reporting mechanism; the
> channel is the email address. This clause describes what exists. If a dedicated mechanism is built,
> this clause must be updated in a new version.

The report should identify the listing, conversation or User concerned and describe the facts.

On receiving a report, UProperty examines it and may remove content, suspend the account or take no
further action, informing the reporter of the outcome whenever doing so does not prejudice the
examination or third-party rights.

Reports that are manifestly unfounded or made in bad faith, in particular to harm competing listings,
are themselves grounds for suspension.

## 21. Suspension and termination on our initiative

UProperty may suspend or terminate the account, with notice wherever possible, in the event of:

1. serious or repeated breach of these Terms;
2. fraudulent use or serious indications of fraud;
3. non-payment;
4. conduct endangering other Users, the platform or third parties.

Suspension on security grounds may be immediate and without prior notice, the User being informed as
soon as possible.

Where the account is terminated for breach, there is no refund of periods already elapsed, without
prejudice to the rights the law affords consumers.

## 22. Availability, conformity and updates

UProperty uses its best efforts to keep the platform available; there may be interruptions for
maintenance, for technical reasons or for causes not attributable to UProperty.

The digital service provided is subject to the conformity regime of **Decree-Law 84/2021 of 18
October**, under the terms of the law, including as regards consumer rights in the event of lack of
conformity.

UProperty may update the platform's features. Changes that significantly reduce what was contracted
for will be communicated with reasonable advance notice.

## 23. Personal data

The controller is **[LEGAL COMPANY NAME]**. Personal data collected is processed to perform the
contract, comply with legal obligations, prevent fraud and, with consent, send marketing
communications.

Access by UProperty staff to Users' personal data is **limited to what is necessary** and is **logged**.

The rights of access, rectification, erasure, restriction, portability and objection are exercised
from the customer area or through **[CONTACT EMAIL]**, and complaints may be lodged with the
Portuguese data protection authority (CNPD).

**[GAP — TO BE DECIDED] Retention periods.** The specific retention periods for each category of data
are not set in this draft and must be defined at legal review, together with §27.

Details are in the **Privacy Policy**.

## 24. Intellectual property

The platform, its software, brand, visual identity and own content belong to UProperty.

Content uploaded by the User remains theirs. By publishing it, they grant UProperty a non-exclusive,
royalty-free licence limited to the display, storage and processing necessary to provide the service,
valid while the content is published, and extending to display of the listing on the public site.

The User warrants that they hold the necessary rights over the content they publish and is liable to
third parties for any infringement.

## 25. Liability

UProperty is liable under general law for damage caused by breach of its obligations, and is not
liable for:

1. the truth, lawfulness, condition or quality of the properties, documents and information published
   by Users;
2. agreements entered into between Users, their performance, or payments made between them;
3. the content of communications exchanged between Users;
4. what occurs during property viewings;
5. damage resulting from the User's breach of §12 and §18, in particular from conducting the
   negotiation outside the platform.

Nothing in these Terms excludes or limits liability that cannot be excluded or limited by law, in
particular towards consumers.

## 26. Changes to these Terms

These Terms are **versioned**. Each version has a number, a date and a digital fingerprint of its
content, and it is recorded which specific version each User accepted.

Material changes are communicated with reasonable advance notice and, where required, call for **fresh
acceptance**. If the User does not accept the new version, they may terminate the subscription under
§9, without penalty.

## 27. Account deletion, history and abuse prevention

The User may delete the account from the customer area. Deletion:

1. **anonymises** profile data — name, phone, NIF, image and preferences — and makes the account
   inaccessible;
2. **retains** the subscription and billing history, as necessary to comply with legal, accounting and
   tax obligations;
3. **retains** the record of which version of these Terms was accepted and when, as proof of the
   contract entered into;
4. **retains**, in the form of an irreversible fingerprint (not the value itself), the identifiers
   strictly necessary to prevent the same person benefiting repeatedly from limited offers by creating
   successive accounts.

**[GAP — TO BE VALIDATED LEGALLY] Legal basis and period for point 4.** The retention in point 4 is
processing of personal data after an erasure request and **must have an express, documented legal basis
with a defined period**, to be settled at legal review. Until one is set, no period is configured.

## 28. Complaints and dispute resolution

Complaints may be submitted to **[CONTACT EMAIL]** or through the **Electronic Complaints Book**, at
[www.livroreclamacoes.pt](http://www.livroreclamacoes.pt).

In a consumer dispute, the User may turn to an alternative dispute resolution body under Law 144/2015
of 8 September. The body competent by value and territory will be identified on the platform.
**[GAP — TO BE DECIDED] ADR body to be named.**

The European online dispute resolution platform is available at ec.europa.eu/consumers/odr.

## 29. Governing law and jurisdiction

These Terms are governed by Portuguese law. Where the User is a consumer, the jurisdiction the law
reserves to them continues to apply.

## 30. Gaps flagged in this draft

| # | Subject | Where |
| - | ------- | ----- |
| 1 | Minimum term set at 12 months; the benefit justifying it is still missing | §7 |
| 2 | Early termination charge — not set; until it is, nothing is charged | §9 |
| 3 | Data retention periods — not set | §23 and §27 |
| 4 | Legal basis for retaining identifiers after erasure | §27 |
| 5 | Alternative dispute resolution body | §28 |
| 6 | Company identification details | §1 |
| 7 | The point from which exchanging direct contact details becomes permitted | §12 |
| 8 | No in-app reporting mechanism; the channel is email | §20 |

---

**Version 2026.10-draft2 · DRAFT PENDING LEGAL REVIEW.** This version does not replace legal advice
and must not go to production without review by a lawyer.
$terms_en_v2$,
  'published',
  'draft_pending_legal_review',
  now(),
  now()
)
on conflict (kind, version, locale) do nothing;

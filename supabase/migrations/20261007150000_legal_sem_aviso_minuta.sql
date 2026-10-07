-- UProperty Market — tira o aviso de minuta do corpo dos documentos legais
--
-- Numerada `150000` e não `121400`: entretanto a Fase 10 arrancou noutra
-- sessão e aplicou `20261007130000` a `20261007140100` (tickets de suporte).
-- Uma migração nova tem de vir DEPOIS da última aplicada — o `db push` recusa
-- de propósito quando não vem, e `--include-all` seria passar-lhe por cima.
--
-- Termos `2026.10-draft4`, Privacidade `2026.10-draft4`, Cookies
-- `2026.10-draft3`. As versões anteriores ficam `archived`, nunca editadas
-- (07 §20.7).
--
-- **Porquê.** O cliente pediu duas vezes para tirar o bloco "MINUTA PARA
-- REVISÃO JURÍDICA" das páginas. À primeira tirou-se a faixa `role="note"` do
-- componente, mas o aviso continuava à vista — porque estava **dentro do corpo
-- do documento**, como citação de abertura, e eu argumentei para o manter. Era
-- o argumento errado: quem revê o texto já sabe que é minuta, e a repetição só
-- empurrava o conteúdo para baixo.
--
-- **O que sai:** a citação de abertura e o parágrafo de rodapé que a repetia. O
-- rodapé levava também a versão, que o cabeçalho da página já mostra a partir de
-- `legal_documents.version`.
--
-- **O que fica, e é deliberado:**
--   * `review_state = 'draft_pending_legal_review'` — a base de dados continua a
--     saber que o texto não está revisto, e é dela que P11-07 parte;
--   * as notas `[NOTA PARA A REVISÃO JURÍDICA]` e `[LACUNA — A DECIDIR]` dentro
--     do articulado, que são para quem vai rever e não para quem lê;
--   * nas versões inglesas, a frase "In case of divergence, the Portuguese
--     version prevails" — estava dentro da citação, mas é **cláusula** e não
--     aviso. Sai da citação e fica como parágrafo no topo. Perdê-la ao remover o
--     aviso seria apagar uma regra de interpretação do contrato.
--
-- Nota para quando P9-02 for revisto: essa tarefa pedia que a interface
-- mostrasse o aviso em cima do texto. Deixa de o mostrar por decisão expressa do
-- cliente de 7 out 2026. O estado na base de dados mantém-se, logo a informação
-- não se perdeu — mudou de sítio.

set search_path = public, extensions;

update public.legal_documents
   set status = 'archived'
 where kind = 'terms'
   and version = '2026.10-draft3'
   and status = 'published';

insert into public.legal_documents (kind, version, locale, title, body_md, status, review_state, effective_from, published_at)
values (
  'terms',
  '2026.10-draft4',
  'pt',
  'Termos e Condições de Utilização — UProperty Market',
  $terms_pt_v4$
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
para a execução do contrato, cumprimento de obrigações legais e prevenção de fraude.

**Comunicações promocionais.** A UProperty envia ao Utilizador com conta comunicações promocionais,
periódicas, de informações importantes e de atualizações da plataforma e de produtos, com base no
**interesse legítimo** em manter a relação e em dar a conhecer novidades. **O Utilizador pode cancelar
estas comunicações a qualquer momento**, nas preferências de notificação da sua conta ou pela ligação
de cancelamento que cada mensagem leva.

O cancelamento não abrange as comunicações que fazem parte do serviço — avisos de segurança,
alterações a estes Termos, faturas, respostas do suporte e notificações de mensagens, visitas ou
moderação —, que continuam a ser enviadas.

A quem não tem conta e apenas se pré-inscreveu, as comunicações promocionais dependem de
**consentimento** prestado no próprio formulário.

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
| 9 | Marketing a clientes por interesse legítimo: confirmar o regime do art. 13.º-A da Lei n.º 41/2004 | §23 |
$terms_pt_v4$,
  'published',
  'draft_pending_legal_review',
  now(),
  now()
)
on conflict (kind, version, locale) do nothing;

insert into public.legal_documents (kind, version, locale, title, body_md, status, review_state, effective_from, published_at)
values (
  'terms',
  '2026.10-draft4',
  'en',
  'Terms and Conditions of Use — UProperty Market',
  $terms_en_v4$
In case of divergence, the Portuguese version prevails.

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
contract, comply with legal obligations and prevent fraud.

**Promotional communications.** UProperty sends Users with an account promotional and periodic
communications, important information and platform and product updates, on the basis of its
**legitimate interest** in maintaining the relationship and making news known. **The User may
unsubscribe from these communications at any time**, in their account's notification preferences or
through the unsubscribe link carried by every message.

Unsubscribing does not cover communications that form part of the service — security notices, changes
to these Terms, invoices, support replies and notifications about messages, viewings or moderation —
which continue to be sent.

For those without an account who merely pre-registered, promotional communications depend on
**consent** given in the form itself.

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
| 9 | Customer marketing on legitimate interest: confirm the regime of art. 13-A of Law 41/2004 | §23 |
$terms_en_v4$,
  'published',
  'draft_pending_legal_review',
  now(),
  now()
)
on conflict (kind, version, locale) do nothing;

update public.legal_documents
   set status = 'archived'
 where kind = 'privacy'
   and version = '2026.10-draft3'
   and status = 'published';

insert into public.legal_documents (kind, version, locale, title, body_md, status, review_state, effective_from, published_at)
values (
  'privacy',
  '2026.10-draft4',
  'pt',
  'Política de Privacidade — UProperty Market',
  $privacy_pt_v4$
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
| Enviar comunicações promocionais a titulares de conta | interesse legítimo, com oposição a todo o tempo |
| Enviar comunicações promocionais a quem não tem conta | consentimento, revogável a todo o tempo |
| Medir o tráfego do site de forma agregada | interesse legítimo |

> **[NOTA PARA A REVISÃO JURÍDICA.]** Três fundamentos acima precisam de confirmação expressa: a
> conservação do endereço IP associado à aceitação dos Termos (§4), a conservação de identificadores
> após um pedido de apagamento (§10) e o equilíbrio de interesses que sustenta o registo de acessos a
> documentos. Os três estão listados em §16.

### Comunicações que lhe enviamos

Enviaremos comunicações promocionais, periódicas, de informações importantes, atualizações da
plataforma e de produtos tendo em conta as suas preferências de consumo. Realizamos esta atividade
porque temos um **interesse legítimo** em manter esta relação, próxima, consigo, mantendo-o a par de
tudo o que acontece e de novos produtos. No entanto, **poderá cancelar a subscrição destas
comunicações a qualquer momento** — nas preferências de notificação da sua conta, ou pela ligação de
cancelamento que cada mensagem leva.

Cancelar não afeta as comunicações que **não são promocionais** e que fazem parte do serviço: avisos
de segurança, alterações aos Termos, faturas, respostas do suporte e notificações de mensagens,
visitas ou moderação. Essas continuam, porque sem elas o serviço não se presta.

**Quem ainda não tem conta é tratado de outra forma.** A quem apenas se pré-inscreveu no site
público, as comunicações promocionais dependem de **consentimento** dado no próprio formulário, sem
caixas pré-selecionadas, e a data desse consentimento fica registada.

> **[NOTA PARA A REVISÃO JURÍDICA — não é cláusula.]** O marketing a clientes por via eletrónica
> apoia-se aqui no interesse legítimo. Em Portugal, o envio a clientes existentes está sujeito ao
> regime do artigo 13.º-A da Lei n.º 41/2004: admite-se sem consentimento prévio quando os contactos
> foram obtidos no âmbito de uma venda, se referem a produtos ou serviços **análogos** aos
> contratados, e é dada a possibilidade de recusa **no momento da recolha e em cada mensagem**. Fica
> para a revisão confirmar (a) se as comunicações previstas cabem no conceito de "análogos", (b) se a
> recusa está oferecida nos dois momentos, e (c) se o teste de proporcionalidade do interesse
> legítimo deve ficar documentado por escrito. É a lacuna 9 de §16.

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
| 9 | Marketing a clientes por interesse legítimo: "análogos", recusa nos dois momentos e teste de proporcionalidade | §6 |
$privacy_pt_v4$,
  'published',
  'draft_pending_legal_review',
  now(),
  now()
)
on conflict (kind, version, locale) do nothing;

insert into public.legal_documents (kind, version, locale, title, body_md, status, review_state, effective_from, published_at)
values (
  'privacy',
  '2026.10-draft4',
  'en',
  'Privacy Policy — UProperty Market',
  $privacy_en_v4$
In case of divergence, the Portuguese version prevails.

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
| Sending promotional communications to account holders | legitimate interest, with objection at any time |
| Sending promotional communications to non-account-holders | consent, withdrawable at any time |
| Measuring site traffic in aggregate | legitimate interest |

> **[NOTE FOR LEGAL REVIEW.]** Three of the bases above need express confirmation: retention of the IP
> address tied to Terms acceptance (§4), retention of identifiers after an erasure request (§10), and
> the balancing of interests supporting document access logging. All three are listed in §16.

### Communications we send you

We will send promotional and periodic communications, important information, and platform and product
updates, taking your consumption preferences into account. We do this because we have a **legitimate
interest** in maintaining this close relationship with you, keeping you informed of everything that
happens and of new products. You may, however, **unsubscribe from these communications at any time**
— in your account's notification preferences, or through the unsubscribe link carried by every
message.

Unsubscribing does not affect communications that are **not promotional** and form part of the
service: security notices, changes to the Terms, invoices, support replies and notifications about
messages, viewings or moderation. Those continue, because without them the service cannot be
provided.

**People without an account are treated differently.** For those who merely pre-registered on the
public site, promotional communications depend on **consent** given in the form itself, with no
pre-ticked boxes, and the date of that consent is recorded.

> **[NOTE FOR LEGAL REVIEW — not a clause.]** Electronic marketing to customers is grounded here on
> legitimate interest. In Portugal, sending to existing customers is subject to article 13-A of Law
> 41/2004: it is allowed without prior consent where the contact details were obtained in the context
> of a sale, the communications concern products or services **similar** to those contracted, and the
> opportunity to object is given **at collection and in every message**. For review: (a) whether the
> communications envisaged fall within "similar", (b) whether the objection is offered at both
> moments, and (c) whether the legitimate-interest balancing test should be documented in writing. It
> is gap 9 in Section 16.

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
| 9 | Customer marketing on legitimate interest: "similar", objection at both moments, and the balancing test | §6 |
$privacy_en_v4$,
  'published',
  'draft_pending_legal_review',
  now(),
  now()
)
on conflict (kind, version, locale) do nothing;

update public.legal_documents
   set status = 'archived'
 where kind = 'cookies'
   and version = '2026.10-draft2'
   and status = 'published';

insert into public.legal_documents (kind, version, locale, title, body_md, status, review_state, effective_from, published_at)
values (
  'cookies',
  '2026.10-draft3',
  'pt',
  'Política de Cookies — UProperty Market',
  $cookies_pt_v3$
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
$cookies_pt_v3$,
  'published',
  'draft_pending_legal_review',
  now(),
  now()
)
on conflict (kind, version, locale) do nothing;

insert into public.legal_documents (kind, version, locale, title, body_md, status, review_state, effective_from, published_at)
values (
  'cookies',
  '2026.10-draft3',
  'en',
  'Cookie Policy — UProperty Market',
  $cookies_en_v3$
In case of divergence, the Portuguese version prevails.

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
$cookies_en_v3$,
  'published',
  'draft_pending_legal_review',
  now(),
  now()
)
on conflict (kind, version, locale) do nothing;

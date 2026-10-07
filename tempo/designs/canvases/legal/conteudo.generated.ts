// GERADO POR scripts/extract-legal-drafts.mjs — NÃO EDITAR À MÃO.
//
// O corpo das minutas legais, tal como as migrações o semeiam em
// `legal_documents`. As storyboards de `canvases/legal` importam daqui para
// mostrarem o texto real; editar aqui faria o canvas mentir sobre o contrato.
//
// Para atualizar: mexer na migração e correr
//     node scripts/extract-legal-drafts.mjs

/** A versão de cada minuta, lida da respetiva migração. */
export const VERSOES = {
  TERMOS: "2026.10-draft2",
  PRIVACIDADE: "2026.10-draft3",
  COOKIES: "2026.10-draft2",
} as const;

/** Termos e Condições de Utilização — UProperty Market — de `20261007120700_terms_v2_draft.sql`. */
export const TERMOS = `> **MINUTA PARA REVISÃO JURÍDICA — NÃO É UM DOCUMENTO DEFINITIVO.**
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
jurídico e não deve entrar em produção sem revisão por advogado.`;

/** Política de Privacidade — UProperty Market — de `20261007121200_privacy_v3_draft.sql`. */
export const PRIVACIDADE = `> **MINUTA PARA REVISÃO JURÍDICA — NÃO É UM DOCUMENTO DEFINITIVO.**
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

---

**Versão 2026.10-draft3 · MINUTA PARA REVISÃO JURÍDICA.** Esta versão não substitui aconselhamento
jurídico e não deve entrar em produção sem revisão por advogado.`;

/** Política de Cookies — UProperty Market — de `20261007120900_cookies_v2_draft.sql`. */
export const COOKIES = `> **MINUTA PARA REVISÃO JURÍDICA — NÃO É UM DOCUMENTO DEFINITIVO.**
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
| \`upm-locale\` | Guardar o idioma que escolheu, para as páginas abrirem nesse idioma | necessário | 365 dias |
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

O tratamento de dados pessoais está descrito na **Política de Privacidade**, em \`/privacidade\`.

Para qualquer questão sobre esta política, escreva para **[E-MAIL DE CONTACTO]**.

---

**Versão 2026.10-draft2 · MINUTA PARA REVISÃO JURÍDICA.** Esta versão não substitui aconselhamento
jurídico e não deve entrar em produção sem revisão por advogado.`;

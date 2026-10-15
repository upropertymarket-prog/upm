-- ---------------------------------------------------------------------------
-- `file_source` ganha `campaign_report` (P10-10)
--
-- **Sozinho num ficheiro**, como `mail_attachment` em `20261014100000` e pela
-- mesma razão: `alter type ... add value` não pode ser usado na transação em
-- que é declarado.
--
-- ## Porque é que o relatório não entra como `upload`
--
-- Entraria, e ninguém notava à primeira. Notava-se ao fim de uns meses, quando
-- a gaveta da equipa tivesse trinta ficheiros e metade deles fosse
-- indistinguível: um CSV chamado `campanhas-2026-10.csv` carregado por alguém à
-- mão e um gerado pelo ecrã das Métricas são coisas diferentes — o segundo
-- refaz-se com um clique, o primeiro não se sabe de onde veio.
--
-- É a mesma razão por que `mail_attachment` existe em vez de `upload`: a
-- proveniência é o que deixa a lista responder a "isto apaga-se sem medo?".
-- ---------------------------------------------------------------------------

alter type public.file_source add value if not exists 'campaign_report';

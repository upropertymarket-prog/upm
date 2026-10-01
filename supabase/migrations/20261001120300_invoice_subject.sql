-- UProperty Market — Fase 7 (Faturação), P7-04, parte 1/2
--
-- Uma fatura é um documento com valor legal e o registo de acessos de 07 §13.3
-- aplica-se-lhe como a qualquer outro: transferir uma fatura tem de deixar
-- exatamente uma linha (08 §6.9).
--
-- Fica sozinho num ficheiro porque `alter type ... add value` não pode ser
-- usado na mesma transação em que é declarado — a função que o usa está na
-- parte 2/2.

alter type public.document_subject add value if not exists 'invoice';

-- =============================================================================
-- MIGRAÇÃO · PLANO ÚNICO — Cartão Equilibrium Mais Saúde (14/07/2026)
-- Rodar no SQL Editor do Supabase (projeto svboktcgwccsedwoibmw)
--
-- Novo modelo:
--   · Plano único: R$ 59,99/mês, só o titular (sem dependentes)
--   · Taxa de adesão: R$ 50,00 — única, cobrada junto com a 1ª mensalidade
--   · Consulta psiquiátrica com cartão: R$ 500 → R$ 200 (60% off)
--   · Avaliação neuropsicológica com cartão: R$ 1.900 → R$ 2.000 (~47% off)
--   · Psicoterapia mantém (R$ 200 → R$ 100) · Especialista RQE mantém (R$ 600 → R$ 300)
--   · Terapia infantil (EQ2) mantém a tabela vigente
--
-- Não há assinantes reais na base (confirmado por Wess em 14/07) —
-- sem necessidade de regra de transição.
-- =============================================================================

begin;

-- 0) Conferência do estado atual (rode antes, se quiser ver o que existe)
-- select slug, nome, preco_mensal, max_pessoas, max_dependentes, ativo from planos order by ordem;
-- select slug, nome, preco_particular, preco_cartao, ativo from servicos order by ordem;

-- 1) PLANOS — desativa os planos de família; fica só o individual
update planos set ativo = false where slug in ('fam', 'gran');

update planos set
  nome            = 'Cartão Equilibrium Mais Saúde',
  preco_mensal    = 59.99,
  max_pessoas     = 1,
  max_dependentes = 0,
  ordem           = 1,
  ativo           = true
where slug = 'ind';

-- 2) TAXA DE ADESÃO — nova coluna no plano (lida pela Edge criar-checkout)
alter table planos add column if not exists taxa_adesao numeric not null default 0;
update planos set taxa_adesao = 50.00 where slug = 'ind';

-- 3) SERVIÇOS — novos valores com o cartão
-- Consulta psiquiátrica: 500 → 200 (60% de desconto)
update servicos set preco_cartao = 200
 where preco_particular = 500;   -- ajuste o filtro para o slug real se houver mais de um serviço a R$ 500

-- Avaliação neuropsicológica: com cartão vai de 1.900 para 2.000
update servicos set preco_cartao = 2000
 where slug = 'neuro';

-- (psicoterapia 200→100 e especialista RQE 600→300 permanecem como estão)

-- 4) Conferência final
select slug, nome, preco_mensal, taxa_adesao, max_pessoas, max_dependentes, ativo
  from planos order by ordem;
select slug, nome, preco_particular, preco_cartao,
       round(100 * (1 - preco_cartao / nullif(preco_particular, 0))) as pct_desconto
  from servicos where ativo order by ordem;

commit;

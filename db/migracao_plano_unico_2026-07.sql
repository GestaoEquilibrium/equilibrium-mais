-- =============================================================================
-- MIGRAÇÃO · CARTÃO ÚNICO — Cartão Equilibrium Mais Saúde (14/07/2026, v2)
-- Fonte da verdade: Playbook v2 + ajuste de Wess (15/07): terapias infantis TODAS a 200→100
-- Rodar no SQL Editor do Supabase (projeto svboktcgwccsedwoibmw)
--
-- Modelo: cartão único individual R$ 59,99/mês · 50% de desconto em toda a rede própria
-- Única condição: Avaliação Neuropsicológica — 180 dias de adimplência OU quitação anual
-- Sem assinantes reais na base — sem regra de transição.
-- =============================================================================

begin;

-- 1) PLANOS — desativa os planos de família; fica só o individual
update planos set ativo = false where slug in ('fam', 'gran');

update planos set
  nome            = 'Cartão Equilibrium Mais Saúde',
  preco_mensal    = 59.99,
  max_pessoas     = 1,
  max_dependentes = 0,
  ordem           = 1,
  cor_hex         = '#1B6CB3',   -- azul da logo original (identidade 14/07)
  ativo           = true
where slug = 'ind';

-- 2) TAXA DE ADESÃO — coluna no plano (lida pela Edge criar-checkout)
--    R$ 50,00 única, cobrada junto com a 1ª mensalidade (definição de 14/07).
alter table planos add column if not exists taxa_adesao numeric not null default 0;
update planos set taxa_adesao = 50.00 where slug = 'ind';

-- 3) SERVIÇOS — Tabela de valores do Playbook (tudo em 50% exato)
--    Estratégia: desativa tudo e recadastra as 10 linhas oficiais por slug.
--    IMPORTANTE: o slug 'neuro' precisa se manter EXATO (o frontend depende dele).
--    Pressupõe unique constraint em servicos.slug — se não houver, crie antes:
--    (verifique com: select conname from pg_constraint where conrelid='servicos'::regclass;)
--    alter table servicos add constraint servicos_slug_key unique (slug);

update servicos set ativo = false;

insert into servicos (slug, nome, preco_particular, preco_cartao, icone, ativo, ordem) values
  ('psicologia',       'Psicologia',                    150, 75,   '🗣️', true, 1),
  ('consulta_medica',  'Consulta Médica',               400, 200,  '🩺', true, 2),
  ('rqe',              'Psiquiatra Especialista (RQE)', 600, 300,  '👨‍⚕️', true, 3),
  ('neuro',            'Avaliação Neuropsicológica',    4000, 2000,'🧠', true, 4),
  ('aba',              'Terapia Infantil ABA',          200, 100,  '🧩', true, 5),
  ('psicopedagogia',   'Psicopedagogia',                200, 100,  '📚', true, 6),
  ('psicomotricidade', 'Psicomotricidade',              200, 100,  '🤸', true, 7),
  ('fono',             'Fonoaudiologia',                200, 100,  '💬', true, 8),
  ('terapia_ocupacional','Terapia Ocupacional',         200, 100,  '🧸', true, 9),
  ('musicoterapia',    'Musicoterapia',                 200, 100,  '🎵', true, 10)
on conflict (slug) do update set
  nome = excluded.nome,
  preco_particular = excluded.preco_particular,
  preco_cartao = excluded.preco_cartao,
  icone = excluded.icone,
  ativo = true,
  ordem = excluded.ordem;

-- Pendência do Playbook (item 10.2): se o RQE já estiver incluído na Consulta
-- Médica, a linha sai — nesse caso rode: update servicos set ativo=false where slug='rqe';

-- 4) Conferência final
select slug, nome, preco_mensal, taxa_adesao, max_pessoas, max_dependentes, ativo
  from planos order by ordem;
select slug, nome, preco_particular, preco_cartao,
       round(100 * (1 - preco_cartao / nullif(preco_particular, 0))) as pct_desconto
  from servicos where ativo order by ordem;

commit;

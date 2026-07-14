# Migração para o cartão único — o que fazer no Supabase

O frontend deste repositório já está pronto para o modelo novo (cartão único R$ 59,99 + adesão R$ 50, tabela do Playbook v2 com 50% em tudo). Como o banco e as Edge Functions vivem no Supabase (fora deste repo), três passos precisam ser feitos lá:

## 1. Rodar o SQL

Abra o **SQL Editor** do projeto `svboktcgwccsedwoibmw` e execute `migracao_plano_unico_2026-07.sql` (nesta pasta). Ele:

- desativa os planos `fam` e `gran` e deixa só o `ind`, renomeado para "Cartão Equilibrium Mais Saúde", a R$ 59,99, sem dependentes;
- cria a coluna `planos.taxa_adesao` com R$ 50,00;
- recadastra os 10 serviços da tabela oficial do Playbook (tudo em 50%): Psicologia 150→75, Consulta Médica 400→200, RQE 600→300, Avaliação Neuropsicológica 4.000→2.000, ABA 250→125, Psicopedagogia 250→125, Psicomotricidade 250→125, Fonoaudiologia 300→150, Terapia Ocupacional 300→150, Musicoterapia 300→150.

Atenções: o upsert pressupõe unique constraint em `servicos.slug` (o script comenta como criar se faltar); o slug `neuro` precisa ficar exatamente assim (o frontend depende dele); e a linha RQE pode sair depois, conforme a pendência 2 do Playbook.

## 2. Atualizar a Edge Function `criar-checkout`

Hoje ela gera a preferência do Mercado Pago só com a mensalidade (ou anuidade). Ela precisa passar a somar a taxa de adesão na **primeira cobrança**:

- **Mensal**: 1ª cobrança = `preco_mensal + taxa_adesao` (R$ 109,99); recorrência segue a R$ 59,99.
- **Anual antecipado**: cobrança única = `preco_mensal × 12 + taxa_adesao` (R$ 769,88). Sem mês grátis — o benefício do anual é a elegibilidade imediata na Avaliação Neuropsicológica.

Leia `taxa_adesao` da tabela `planos` (não hardcode) — o frontend exibe R$ 50 a partir da constante `TAXA_ADESAO` em `loja.js`; se o valor mudar um dia, mude nos dois lugares.

Se a RPC `criar_adesao` for quem gera a 1ª fatura, inclua a taxa lá também (fatura da competência 1 = mensalidade + adesão, ou uma fatura separada "Taxa de adesão").

## 3. Atualizar o corpo do contrato (Edge `contrato`)

O popup de aceite do portal carrega o contrato vigente via Edge Function `contrato`. Substitua o texto vigente pela nova minuta (arquivo `Contrato_Cartao_Equilibrium_Mais_Saude_PLANO_UNICO.docx`, gerado em 14/07/2026 — validar com o Vinícius antes) e **incremente a versão** do contrato, para que `vw_assinantes_lista.contrato_versao` reflita a minuta nova.

## O que já está pronto no frontend (este repo)

- Landing com um único cartão no hero, slogan oficial "Metade do preço. Dobro do cuidado.", vocabulário do Playbook (sem a palavra "plano"), taxa de adesão em todos os resumos, 1ª cobrança calculada (109,99 mensal / 769,88 anual), métodos crédito + PIX + débito, textos sem menção a dependentes/família.
- Fluxo PJ **oculto sem apagar** (`MOSTRAR_PJ = false` em `loja.js` — reative mudando para `true`).
- Formulário de adesão esconde seletor de plano e dependentes automaticamente quando só há um plano ativo sem dependentes (dirigido pelos dados do banco).
- Painel de gestão lê os preços da tabela `planos` (antes eram hardcoded 59/99/119).
- `loja.html` (protótipo azul antigo) agora redireciona para a landing; o original foi preservado em `loja_legado_2026.html.off`.

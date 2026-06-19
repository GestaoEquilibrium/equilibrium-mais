/* =========================================================
   MAIS EQUILIBRIUM — loja.js (landing + checkout)
   Catálogos do banco + leque + cataventos + checkout (criar_adesao).
   Depende de shared/config.js (window.maisClient) carregado antes.
   ========================================================= */
(function () {
  const sb = window.maisClient;
  const money = (n) => "R$ " + Math.round(n).toLocaleString("pt-BR");
  // formata com centavos (usado p/ exibir o preço do cartão com -1 centavo na tabela)
  const moneyC = (n) => "R$ " + Number(n).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const state = {
    planos: {}, servicos: [], plan: null,
    bill: "mes", method: "card", deps: [], qty: {}, neuro: false, ultimaAdesao: null,
  };

  /* ---------- carga dos catálogos ---------- */
  async function carregarCatalogos() {
    const [{ data: planos, error: e1 }, { data: servicos, error: e2 }] = await Promise.all([
      sb.from("planos").select("*").eq("ativo", true).order("ordem"),
      sb.from("servicos").select("*").eq("ativo", true).order("ordem"),
    ]);
    if (e1 || e2) { console.error("Erro catálogos:", e1 || e2); alert("Não foi possível carregar os planos. Recarregue a página."); return false; }
    planos.forEach((p) => (state.planos[p.slug] = p));
    state.servicos = servicos;
    servicos.forEach((s) => (state.qty[s.slug] = 0));
    state.plan = state.planos["fam"] ? "fam" : planos[0]?.slug;
    return true;
  }

  /* ---------- leque do hero ---------- */
  function renderLeque() {
    Object.values(state.planos).forEach((p) => {
      const who = p.max_dependentes === 0 ? "Só você" : "Até " + p.max_pessoas + " pessoas";
      const pr = document.querySelector(`[data-price="${p.slug}"]`);
      const wh = document.querySelector(`[data-who="${p.slug}"]`);
      if (pr) pr.innerHTML = money(p.preco_mensal) + "<small>/mês</small>";
      if (wh) wh.textContent = who;
    });
  }

  /* ---------- tabela de descontos ---------- */
  function renderSvcTable() {
    const tb = document.getElementById("svcTable");
    if (!tb) return;
    tb.innerHTML = "";
    state.servicos.forEach((s) => {
      const pct = s.preco_particular > 0 ? Math.round(100 * (1 - s.preco_cartao / s.preco_particular)) : 0;
      const tr = document.createElement("tr");
      tr.innerHTML =
        `<td>${s.icone || ""} ${s.nome}</td>` +
        `<td class="old">${money(s.preco_particular)}</td>` +
        `<td class="c">${s.preco_cartao > 0 ? moneyC(s.preco_cartao - 0.01) : money(s.preco_cartao)}<span class="off-badge">-${pct}%</span></td>`;
      tb.appendChild(tr);
    });
  }

  /* ---------- planos (cards da seção) ---------- */
  function renderPlans() {
    const c = document.getElementById("planCards");
    if (!c) return;
    c.innerHTML = "";
    Object.values(state.planos).forEach((p) => {
      const maxTxt = p.max_dependentes === 0 ? "Só o titular" : "Até " + p.max_pessoas + " pessoas";
      const d = document.createElement("div");
      d.className = "plan" + (p.slug === "fam" ? " best" : "") + (state.plan === p.slug ? " sel" : "");
      d.innerHTML =
        `<div class="ptop" style="background:${hexToTint(p.cor_hex)}">` +
        `<svg viewBox="-55 -55 110 110" width="28" height="28"><use href="#blade" fill="${p.cor_hex}"/>` +
        `<use href="#blade" fill="${p.cor_hex}" transform="rotate(90)"/><use href="#blade" fill="${p.cor_hex}" transform="rotate(180)"/>` +
        `<use href="#blade" fill="${p.cor_hex}" transform="rotate(270)"/></svg></div>` +
        `<div class="nm">${p.nome}</div><div class="pr">${money(p.preco_mensal)}<small>/mês</small></div>` +
        `<div class="mx">${maxTxt}</div>` +
        `<div class="pick">${state.plan === p.slug ? "✓ Selecionado" : "Selecionar"}</div>`;
      d.onclick = () => escolherPlano(p.slug);
      c.appendChild(d);
    });
  }

  function hexToTint(hex) {
    const h = hex.replace("#", "");
    const r = parseInt(h.substr(0, 2), 16), g = parseInt(h.substr(2, 2), 16), b = parseInt(h.substr(4, 2), 16);
    return `rgba(${r},${g},${b},0.14)`;
  }

  function fillSelect(id) {
    const s = document.getElementById(id);
    if (!s) return;
    s.innerHTML = "";
    Object.values(state.planos).forEach((p) => {
      const maxTxt = p.max_dependentes === 0 ? "Só o titular" : "Até " + p.max_pessoas + " pessoas";
      const o = document.createElement("option");
      o.value = p.slug; o.textContent = `${p.nome} — ${money(p.preco_mensal)}/mês (${maxTxt})`;
      s.appendChild(o);
    });
    s.value = state.plan;
  }

  function syncSelects() {
    ["calcPlan", "adPlan"].forEach((id) => { const s = document.getElementById(id); if (s) s.value = state.plan; });
    syncPlan(); calc();
  }

  /* escolher plano (do leque ou dos cards) → seleciona e vai pra adesão */
  function escolherPlano(slug) {
    state.plan = slug;
    syncSelects();
    renderPlans();
    go("adesao");
  }

  /* ---------- calculadora ---------- */
  function renderCalcRows() {
    const c = document.getElementById("calcRows");
    if (!c) return;
    c.innerHTML = "";
    state.servicos.filter((s) => s.slug !== "neuro").forEach((s) => {
      const r = document.createElement("div");
      r.className = "row";
      r.innerHTML =
        `<label>${s.icone || ""} ${s.nome}</label>` +
        `<span class="pp">${money(s.preco_particular)}→${money(s.preco_cartao)}</span>` +
        `<div class="stp"><button data-d="-1" data-s="${s.slug}">−</button>` +
        `<input id="q_${s.slug}" value="0" readonly>` +
        `<button data-d="1" data-s="${s.slug}">+</button></div>`;
      c.appendChild(r);
    });
    c.querySelectorAll("button[data-s]").forEach((b) => (b.onclick = () => bump(b.dataset.s, +b.dataset.d)));
    const neuroSvc = state.servicos.find((s) => s.slug === "neuro");
    const lbl = document.querySelector('label[for="ck_neuro"]');
    if (neuroSvc && lbl) lbl.innerHTML = `Vou fazer uma Avaliação Neuropsicológica <span style="color:var(--muted)">(${money(neuroSvc.preco_particular)} → ${money(neuroSvc.preco_cartao)})</span>`;
  }

  function bump(slug, d) {
    state.qty[slug] = Math.max(0, (state.qty[slug] || 0) + d);
    const el = document.getElementById("q_" + slug);
    if (el) el.value = state.qty[slug];
    calc();
  }

  function calc() {
    const neuroEl = document.getElementById("ck_neuro");
    state.neuro = neuroEl ? neuroEl.checked : false;
    const neuroSvc = state.servicos.find((s) => s.slug === "neuro");
    let sem = 0, serv = 0;
    state.servicos.forEach((s) => {
      if (s.slug === "neuro") return;
      sem += (state.qty[s.slug] || 0) * s.preco_particular;
      serv += (state.qty[s.slug] || 0) * s.preco_cartao;
    });
    const plan = state.planos[document.getElementById("calcPlan")?.value || state.plan];
    const semT = sem + (state.neuro && neuroSvc ? neuroSvc.preco_particular : 0);
    const comServ = serv + (state.neuro && neuroSvc ? neuroSvc.preco_cartao : 0);
    const comT = comServ + (plan ? plan.preco_mensal : 0);
    const eco = semT - comT;
    const set = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
    set("r_sem", money(semT)); set("r_serv", money(comServ));
    set("r_mens", money(plan ? plan.preco_mensal : 0));
    set("r_eco", money(Math.max(0, eco))); set("r_ano", money(Math.max(0, eco) * 12) + " por ano");
    const v = document.getElementById("r_verd");
    if (v) {
      if (sem === 0 && !state.neuro) { v.className = "verdict neu"; v.textContent = "Informe seu uso para ver o resultado."; }
      else if (eco > 0) { v.className = "verdict win"; v.textContent = "✓ Vale a pena! O cartão sai mais barato que o particular no seu caso."; }
      else { v.className = "verdict neu"; v.textContent = "No seu uso atual o cartão ainda não compensa. Aumente o uso ou fale com a equipe."; }
    }
  }

  /* ---------- adesão / dependentes ---------- */
  function syncPlan() {
    const adSel = document.getElementById("adPlan");
    if (adSel && adSel.value) state.plan = adSel.value;
    const p = state.planos[state.plan];
    if (!p) return;
    const set = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
    set("s_plan", p.nome);
    set("s_max", p.max_dependentes === 0 ? "Só o titular" : "Até " + p.max_pessoas + " pessoas");
    if (state.deps.length > p.max_dependentes) state.deps = state.deps.slice(0, p.max_dependentes);
    renderDeps(); updateSummary(); renderPlans();
    const cp = document.getElementById("calcPlan"); if (cp) cp.value = state.plan;
    calc();
  }

  function addDep() {
    const p = state.planos[state.plan];
    const hint = document.getElementById("adHint");
    if (state.deps.length >= p.max_dependentes) {
      if (hint) hint.textContent = "Limite de dependentes deste plano atingido. Escolha um plano maior para incluir mais pessoas.";
      return;
    }
    state.deps.push({ nome: "", cpf: "", par: "Filho(a)" });
    renderDeps(); updateSummary();
  }

  function delDep(i) {
    state.deps.splice(i, 1); renderDeps(); updateSummary();
    const hint = document.getElementById("adHint"); if (hint) hint.textContent = "";
  }

  function renderDeps() {
    const c = document.getElementById("deps");
    if (!c) return;
    c.innerHTML = "";
    state.deps.forEach((d, i) => {
      const el = document.createElement("div");
      el.className = "dep";
      el.innerHTML =
        `<button class="del" data-i="${i}">remover</button>` +
        `<div class="field"><label>Nome do dependente</label>` +
        `<input data-i="${i}" data-f="nome" value="${d.nome}" placeholder="Nome completo"></div>` +
        `<div class="f2"><div class="field"><label>CPF</label>` +
        `<input data-i="${i}" data-f="cpf" value="${d.cpf}" placeholder="000.000.000-00"></div>` +
        `<div class="field"><label>Parentesco</label>` +
        `<select data-i="${i}" data-f="par">` +
        `<option>Filho(a)</option><option>Cônjuge</option><option>Neto(a)</option><option>Pai/Mãe</option>` +
        `</select></div></div>`;
      c.appendChild(el);
    });
    c.querySelectorAll(".del").forEach((b) => (b.onclick = () => delDep(+b.dataset.i)));
    c.querySelectorAll("input[data-f],select[data-f]").forEach((inp) => {
      if (inp.dataset.f === "par") inp.value = state.deps[+inp.dataset.i].par;
      inp.oninput = () => { state.deps[+inp.dataset.i][inp.dataset.f] = inp.value; updateSummary(); };
      inp.onchange = () => { state.deps[+inp.dataset.i][inp.dataset.f] = inp.value; };
    });
    const p = state.planos[state.plan];
    const dc = document.getElementById("depCount"); if (dc) dc.textContent = `(${state.deps.length}/${p.max_dependentes})`;
    const add = document.getElementById("addDep"); if (add) add.style.display = state.deps.length >= p.max_dependentes ? "none" : "inline-block";
  }

  function updateSummary() {
    const p = state.planos[state.plan];
    const set = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
    set("s_tit", document.getElementById("t_nome")?.value || "—");
    set("s_deps", state.deps.length);
    set("s_tot", money(p.preco_mensal) + "/mês");
  }
  function updateSummaryProxy() { updateSummary(); }

  /* ---------- pagamento ---------- */
  function setBill(b) {
    state.bill = b;
    document.getElementById("bMes")?.classList.toggle("on", b === "mes");
    document.getElementById("bAno")?.classList.toggle("on", b === "ano");
    renderPay();
  }
  function setMethod(m) {
    state.method = m;
    document.getElementById("mCard")?.classList.toggle("sel", m === "card");
    document.getElementById("mPix")?.classList.toggle("sel", m === "pix");
    document.getElementById("mDeb")?.classList.toggle("sel", m === "debito");
    renderPayArea();
  }
  function renderPay() {
    const p = state.planos[state.plan];
    const set = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
    set("p_plan", p.nome);
    set("p_tit", document.getElementById("t_nome")?.value || "—");
    const bn = document.getElementById("billNote");
    if (state.bill === "mes") {
      set("p_ciclo", "Mensal"); set("p_totlab", "Total mensal"); set("p_tot", money(p.preco_mensal));
      if (bn) bn.textContent = "Cobrança todo mês no cartão. Cancele quando quiser (respeitando a fidelidade de 12 meses).";
    } else {
      const anual = p.preco_mensal * 11;
      set("p_ciclo", "Anual à vista"); set("p_totlab", "Total anual"); set("p_tot", money(anual));
      if (bn) bn.innerHTML = '<b style="color:var(--ambar-d)">Pague 11, leve 12</b> — 1 mês grátis e libera a carência da Avaliação Neuropsicológica.';
    }
    renderPayArea();
  }
  function renderPayArea() {
    const a = document.getElementById("payArea");
    if (!a) return;
    const box = (txt) => `<div style="margin-top:14px;padding:14px 16px;background:var(--mist);border-radius:12px;font-size:13.5px;color:var(--ink);line-height:1.5">${txt}</div>`;
    if (state.method === "card") {
      a.innerHTML = box('💳 <b>Cartão de crédito</b> — você será levado ao ambiente seguro do <b>Mercado Pago</b> para cadastrar o cartão. A cobrança é <b>recorrente automática</b> todo mês.');
    } else if (state.method === "debito") {
      a.innerHTML = box('🏦 <b>Cartão de débito</b> — você será levado ao ambiente seguro do <b>Mercado Pago</b> para pagar à vista. As próximas mensalidades chegam por fatura.');
    } else {
      a.innerHTML = box('📱 <b>PIX</b> — você será levado ao ambiente seguro do <b>Mercado Pago</b> para pagar à vista, com confirmação na hora. As próximas mensalidades chegam por fatura.');
    }
  }

  /* ---------- navegação ---------- */
  function go(v) {
    document.querySelectorAll(".view").forEach((x) => x.classList.remove("active"));
    document.getElementById(v)?.classList.add("active");
    document.querySelectorAll(".steps .s").forEach((s) => s.classList.toggle("on", s.dataset.s === v));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function toPay() {
    const hint = document.getElementById("adHint");
    if (!document.getElementById("t_nome")?.value || !document.getElementById("t_cpf")?.value) {
      if (hint) hint.textContent = "Preencha ao menos nome e CPF do titular para continuar."; return;
    }
    renderPay(); go("pay");
  }

  /* ---------- CHECKOUT: criar_adesao → criar-checkout → Mercado Pago ---------- */
  // mapeia o meio da UI para o que a Edge Function espera
  function meioPagamento() {
    if (state.method === "card") return "credito";
    if (state.method === "debito") return "debito";
    return "pix";
  }

  async function confirmAd() {
    const btn = document.querySelector('#pay .btn-a');
    const titular = {
      nome: document.getElementById("t_nome")?.value?.trim(),
      cpf: document.getElementById("t_cpf")?.value?.trim(),
      email: document.getElementById("t_mail")?.value?.trim() || null,
      telefone: document.getElementById("t_fone")?.value?.trim() || null,
      data_nascimento: document.getElementById("t_nasc")?.value || null,
    };
    if (!titular.nome || !titular.cpf) { alert("Nome e CPF do titular são obrigatórios."); return; }
    if (!titular.email) { alert("Informe um e-mail — ele é necessário para o pagamento e para criar seu acesso."); return; }
    const dependentes = state.deps.filter((d) => d.nome && d.nome.trim())
      .map((d) => ({ nome: d.nome.trim(), cpf: d.cpf || null, papel: d.par || "Filho(a)" }));
    const meio = meioPagamento();

    if (btn) { btn.disabled = true; btn.textContent = "Gerando pagamento..."; }
    try {
      // 1. cria a adesão (pendente) — gera conta, cartões e 1ª fatura
      const { data: ad, error: e1 } = await sb.rpc("criar_adesao", {
        p_plano_slug: state.plan, p_titular: titular, p_dependentes: dependentes,
        p_ciclo: state.bill === "ano" ? "anual" : "mensal",
        p_forma_pagamento: meio === "pix" ? "pix" : "cartao", p_cartao_final: null,
      });
      if (e1) throw e1;
      state.ultimaAdesao = ad;

      // 2. cria o checkout no Mercado Pago e pega o link
      const { data: chk, error: e2 } = await sb.functions.invoke("criar-checkout", {
        body: { adesao_id: ad.adesao_id, meio },
      });
      if (e2) throw e2;
      if (!chk?.ok || !chk?.link) throw new Error(chk?.erro || "Não foi possível gerar o pagamento.");

      // 3. redireciona pro Mercado Pago (ao voltar, cai na tela de contrato)
      window.location.href = chk.link;
    } catch (e) {
      console.error("Erro checkout:", e);
      alert("Não foi possível iniciar o pagamento: " + (e.message || e));
      if (btn) { btn.disabled = false; btn.textContent = "Ir para o pagamento →"; }
    }
  }

  /* ---------- cataventos do hero (acelera com o scroll) ---------- */
  function plantCataventos() {
    const host = document.getElementById("heroCv");
    if (!host) return;
    const NS = "http://www.w3.org/2000/svg";
    const pals = [["#54C0CC","#F0B43C","#E45460","#ffffff"],["#ffffff","#54C0CC","#F0B43C","#E45460"],["#F0B43C","#ffffff","#54C0CC","#E45460"]];
    const pos = [[3,8,150,12],[84,4,96,9],[10,62,84,8],[74,58,120,14],[40,14,60,10],[92,70,64,7],[55,72,72,11]];
    pos.forEach((p, idx) => {
      const s = document.createElementNS(NS, "svg");
      s.setAttribute("viewBox", "-55 -55 110 110");
      s.setAttribute("width", p[2]); s.setAttribute("height", p[2]);
      s.classList.add("cv");
      s.style.left = p[0] + "%"; s.style.top = p[1] + "%";
      s.style.setProperty("--sp", p[3] + "s");
      s.style.opacity = idx < 3 ? "0.55" : "0.22";
      if (idx % 2) s.style.animationDirection = "reverse";
      const c = pals[idx % pals.length];
      [0,90,180,270].forEach((rot, i) => {
        const u = document.createElementNS(NS, "use");
        u.setAttribute("href", "#blade"); u.setAttribute("fill", c[i]);
        u.setAttribute("transform", "rotate(" + rot + ")");
        s.appendChild(u);
      });
      host.appendChild(s);
    });
    // acelera conforme rola
    let ticking = false;
    window.addEventListener("scroll", () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const sc = Math.min(window.scrollY / 600, 1);
        const factor = 1 - sc * 0.75; // mais rápido conforme rola
        host.querySelectorAll(".cv").forEach((el, i) => {
          const base = pos[i % pos.length][3];
          el.style.animationDuration = Math.max(1.2, base * factor) + "s";
        });
        ticking = false;
      });
    }, { passive: true });
  }

  /* ---------- expõe handlers ---------- */
  Object.assign(window, { go, bump, calc, syncPlan, addDep, delDep, toPay, setBill, setMethod, confirmAd, escolherPlano, updateSummaryProxy });

  /* ---------- boot ---------- */
  document.addEventListener("DOMContentLoaded", async () => {
    plantCataventos();
    const ok = await carregarCatalogos();
    if (!ok) return;
    renderLeque(); renderSvcTable(); renderPlans();
    renderCalcRows(); fillSelect("calcPlan"); fillSelect("adPlan");
    syncPlan(); calc(); setBill("mes"); setMethod("card");
  });
})();

/* =========================================================
   MAIS EQUILIBRIUM — area-cliente.js (portal do paciente)
   ========================================================= */
const sb = window.maisClient;
const money = (n)=>"R$ "+Math.round(Number(n||0)).toLocaleString("pt-BR");
const ini = (n)=>(n||"?").split(" ").filter(Boolean).slice(0,2).map(s=>s[0]).join("").toUpperCase();
const fmtData = (d)=>d?d.split("-").reverse().join("/"):"—";
const primeiro = (n)=>(n||"").split(" ")[0];

const D = { assinante:null, adesao:null, cartoes:[], economia:null, historico:[], faturas:[] };
let cartaoSel = 0;

/* ---- guard: titular logado ---- */
async function guard(){
  const {data}=await sb.auth.getSession();
  if(!data.session){location.href="/login/";return null;}
  const uid=data.session.user.id;
  const {data:assin}=await sb.from("assinantes").select("*").eq("auth_user_id",uid).maybeSingle();
  if(!assin){ alert("Conta de cliente não encontrada.");await sb.auth.signOut();location.href="/login/";return null; }
  return assin;
}
async function sair(){ await sb.auth.signOut(); location.href="/login/"; }

/* ---- carga ---- */
async function carregar(){
  // adesão do titular
  const {data:ades}=await sb.from("adesoes").select("*").eq("assinante_id",D.assinante.id).order("criado_em",{ascending:false}).limit(1);
  D.adesao = (ades&&ades[0])||null;
  if(!D.adesao) return;
  const adId = D.adesao.id;
  const [cart,eco,hist,fat] = await Promise.all([
    sb.from("vw_cartoes_lista").select("*").eq("numero_conta",D.adesao.numero_conta).order("numero"),
    sb.from("vw_economia_conta").select("*").eq("adesao_id",adId).maybeSingle(),
    sb.from("vw_historico_paciente").select("*").eq("adesao_id",adId).order("data_uso",{ascending:false}),
    sb.from("vw_faturas_abertas").select("*").eq("numero_conta",D.adesao.numero_conta).order("vencimento"),
  ]);
  // os cartões pra exibir vêm da tabela cartoes (precisamos do cartao_id e foto_path)
  const {data:cartoesFull}=await sb.from("cartoes").select("id,numero,nome,papel,is_titular,cor_acento,status,foto_path").eq("adesao_id",adId).order("sufixo");
  D.cartoes = cartoesFull||[];
  D.economia = eco.data||{economia_total:0,total_usos:0};
  D.historico = hist.data||[];
  D.faturas = fat.data||[];
}

/* ---- cores do cartão por plano ---- */
function gradPlano(slug){
  /* cartão oficial: azul clássico da marca */
  if(slug==="ind") return "linear-gradient(145deg,#134b80 0%,#1b6cb3 60%,#2E82C8 100%)";
  if(slug==="gran") return "linear-gradient(135deg,#BD8420,#F0B43C)";
  return "linear-gradient(135deg,#134b80,#1b6cb3)"; // legado / default
}

/* ---- render principal ---- */
function render(){
  const planoSlug = D.adesao.plano_slug;
  const wrap = document.getElementById("wrap");
  const temFam = D.cartoes.length>1;
  wrap.innerHTML = `
    <div class="hello">Olá, ${primeiro(D.assinante.nome)}! 👋</div>
    <div class="hello-sub">Conta ${D.adesao.numero_conta} · ${nomePlano(planoSlug)}</div>
    <div class="layout">
      <div class="card-area">
        <div class="tilt${planoSlug==="ind"?" classico":""}" id="tilt" style="background:${gradPlano(planoSlug)}">
          <div class="shine"></div>
          <svg class="pin" viewBox="-55 -55 110 110"><use href="#cv-white"/></svg>
          <div class="foto" id="cardFoto"></div>
          <div class="pad">
            <div class="kick">Cartão Equilibrium Mais Saúde</div>
            <div class="nome" id="cardNome"></div>
            <div class="num" id="cardNum"></div>
            <div class="meta">
              <div><b>Papel</b><span id="cardPapel"></span></div>
              <div><b>Cartão</b>${nomePlano(planoSlug)}</div>
              <div><b>Válido até</b>${fmtData(D.adesao.fidelidade_ate)}</div>
            </div>
          </div>
        </div>
        ${temFam?`<div class="fam" id="fam"></div>`:""}
        <div style="font-size:12px;color:var(--muted)">Passe o mouse no cartão · toque na foto para alterar</div>
      </div>

      <div>
        <div class="stat-eco">
          <div class="l">Você já economizou</div>
          <div class="v">${money(D.economia.economia_total)}</div>
          <div class="s">em ${D.economia.total_usos||0} atendimento(s) com o cartão</div>
          <svg class="pin" viewBox="-55 -55 110 110"><use href="#cv-white"/></svg>
        </div>

        <div class="card">
          <h3>Histórico de atendimentos</h3>
          <div class="sub">Atendimentos realizados com o cartão</div>
          <div id="histBox"></div>
        </div>

        <div class="card">
          <h3>Faturas</h3>
          <div class="sub">Suas mensalidades</div>
          <div id="fatBox"></div>
        </div>

        <div class="card">
          <h3>Contrato</h3>
          <div class="sub">Seu contrato de adesão</div>
          <button onclick="imprimirContrato()" style="width:100%;margin-top:8px;padding:11px;border:1px solid var(--azul,#1b6cb3);border-radius:10px;background:#fff;color:var(--azul,#1b6cb3);font-weight:700;cursor:pointer">🖨️ Ver / Imprimir contrato</button>
        </div>
      </div>
    </div>`;

  if(temFam) renderFam();
  renderCartao();
  renderHistorico();
  renderFaturas();
  bindTilt();
}

function nomePlano(s){ return s==="ind"?"Individual":s==="gran"?"Gran Família":"Familiar"; }

function renderFam(){
  const fam=document.getElementById("fam");
  fam.innerHTML=D.cartoes.map((c,i)=>`<button class="${i===cartaoSel?"on":""}" onclick="selCartao(${i})">
    <span class="dot" style="background:${c.cor_acento||"#1b6cb3"}"></span>${primeiro(c.nome)}${c.is_titular?" (você)":""}</button>`).join("");
}
function selCartao(i){ cartaoSel=i; renderFam(); renderCartao(); renderHistorico(); }

function renderCartao(){
  const c=D.cartoes[cartaoSel]; if(!c)return;
  document.getElementById("cardNome").textContent=(c.nome||"").toUpperCase();
  document.getElementById("cardNum").textContent=c.numero;
  document.getElementById("cardPapel").textContent=c.papel;
  // foto do cartão
  const fEl=document.getElementById("cardFoto");
  fEl.innerHTML=ini(c.nome);
  if(c.foto_path && window.CortexFoto){
    CortexFoto.urlAssinada(c.foto_path).then(url=>{ if(url) fEl.innerHTML=`<img src="${url}">`; });
  }
  fEl.onclick=(e)=>{ e.stopPropagation(); abrirFotoCartao(c); };
}

function abrirFotoCartao(c){
  if(!window.CortexFoto) return;
  CortexFoto.abrir({
    bucketFolder:"pacientes", tabela:"cartoes", coluna:"foto_path",
    chaveColuna:"id", chaveValor:c.id, nomeArquivo:c.id,
    onPronto:(url)=>{ c.foto_path=`pacientes/${c.id}.png`; renderCartao(); }
  });
}

function renderHistorico(){
  const c=D.cartoes[cartaoSel];
  // filtra o histórico do cartão selecionado
  const lista = D.historico.filter(h=>h.numero_cartao===c.numero);
  const box=document.getElementById("histBox");
  if(!lista.length){ box.innerHTML='<div class="empty">Nenhum atendimento ainda para este cartão.</div>'; return; }
  box.innerHTML=lista.map(h=>`<div class="li">
    <div class="ic">${h.icone||"🩺"}</div>
    <div class="g"><b>${h.especialidade}</b><small>${h.profissional||"—"} · ${fmtData(h.data_uso)}</small></div>
    <div class="r"><span class="badge-ok">✓ realizado</span></div></div>`).join("");
}

function renderFaturas(){
  const box=document.getElementById("fatBox");
  if(!D.faturas.length){ box.innerHTML='<div class="empty">Nenhuma fatura em aberto. 🎉</div>'; return; }
  box.innerHTML=D.faturas.map(f=>`<div class="li fatura">
    <div class="ic">${f.vencida?"🔴":"📅"}</div>
    <div class="g"><b>${money(f.valor)}</b><small>vence ${fmtData(f.vencimento)}</small></div>
    <div class="r"><span class="stt ${f.vencida?"vencida":"aberto"}"><span class="d"></span>${f.vencida?"Vencida":"Em aberto"}</span></div></div>`).join("");
}

/* ---- tilt 3D ---- */
function bindTilt(){
  const card=document.getElementById("tilt"); if(!card)return;
  const shine=card.querySelector(".shine");
  card.addEventListener("mousemove",(e)=>{
    const r=card.getBoundingClientRect();
    const px=(e.clientX-r.left)/r.width, py=(e.clientY-r.top)/r.height;
    card.style.transform=`rotateX(${(0.5-py)*14}deg) rotateY(${(px-0.5)*16}deg) scale(1.03)`;
    shine.style.setProperty("--mx",(px*100)+"%"); shine.style.setProperty("--my",(py*100)+"%");
  });
  card.addEventListener("mouseleave",()=>{ card.style.transform="rotateX(0) rotateY(0) scale(1)"; });
}

/* ---- boot ---- */
(async()=>{
  const assin=await guard(); if(!assin)return;
  D.assinante=assin;
  document.getElementById("uNomeTop").textContent=primeiro(assin.nome);
  document.getElementById("uAv").textContent=ini(assin.nome);
  await carregar();
  if(!D.adesao){ document.getElementById("wrap").innerHTML='<div class="empty" style="padding:80px">Nenhuma adesão ativa encontrada.</div>'; return; }
  render();
  // 1º acesso: força o aceite do contrato (só aparece se ainda não foi aceito)
  if(window.ContratoPopup && D.adesao.id){ ContratoPopup.abrir({ adesaoId: D.adesao.id }); }
})();


async function imprimirContrato(){
  const adesaoId = D.adesao && D.adesao.id;
  if(!adesaoId){ alert("Adesão não encontrada."); return; }
  let titulo="Contrato de Adesão — Equilibrium Mais Saúde", corpo="", aceito="Pendente de aceite";
  try{
    const {data,error}=await sb.functions.invoke("contrato",{body:{acao:"carregar",adesao_id:adesaoId}});
    if(error) throw error;
    titulo=(data&&data.titulo)||titulo; corpo=(data&&data.corpo)||"";
    if(data&&data.ja_aceito) aceito="Aceito eletronicamente"+(data.aceito_em?(" em "+data.aceito_em):"");
  }catch(e){ alert("Não consegui carregar o contrato: "+(e.message||e)); return; }
  const a={ assinante:(D.assinante&&D.assinante.nome)||"—", cpf:(D.assinante&&D.assinante.cpf)||"—",
    numero_conta:D.adesao.numero_conta, plano_nome:nomePlano(D.adesao.plano_slug), data_adesao:fmtData(D.adesao.data_adesao) };
  const esc=(t)=>String(t||"").replace(/&/g,"&amp;").replace(/</g,"&lt;");
  const w=window.open("","_blank","width=840,height=920");
  w.document.write('<!doctype html><html><head><meta charset="utf-8"><title>'+esc(titulo)+'</title>'+
    '<style>body{font-family:Georgia,serif;max-width:720px;margin:30px auto;color:#1a2b3c;line-height:1.55;padding:0 22px}'+
    'h1{font-size:19px;text-align:center;margin-bottom:4px}.sub{text-align:center;color:#777;font-size:12px;font-family:Arial;margin-bottom:16px}'+
    '.meta{background:#f4f7fb;border:1px solid #e2ebf3;border-radius:10px;padding:14px 16px;margin:14px 0;font-size:12.5px;font-family:Arial}'+
    '.meta div{margin:3px 0}.meta b{display:inline-block;min-width:110px;color:#555}'+
    '.corpo{white-space:pre-wrap;font-size:13px}.noprint{text-align:center;margin:18px 0}'+
    'button{padding:10px 18px;border:none;border-radius:8px;background:#1b6cb3;color:#fff;font-size:14px;cursor:pointer}'+
    '@media print{.noprint{display:none}}</style></head><body>'+
    '<div class="noprint"><button onclick="window.print()">🖨️ Imprimir / Salvar PDF</button></div>'+
    '<h1>'+esc(titulo)+'</h1><div class="sub">Grupo Equilibrium Med Center · Cartão Equilibrium Mais Saúde</div>'+
    '<div class="meta"><div><b>Assinante:</b> '+esc(a.assinante)+'</div><div><b>CPF:</b> '+esc(a.cpf)+'</div>'+
    '<div><b>Conta:</b> '+esc(a.numero_conta)+'</div><div><b>Plano:</b> '+esc(a.plano_nome)+'</div>'+
    '<div><b>Adesão:</b> '+esc(a.data_adesao)+'</div><div><b>Aceite:</b> '+esc(aceito)+'</div></div>'+
    '<div class="corpo">'+esc(corpo)+'</div></body></html>');
  w.document.close();
}
window.imprimirContrato=imprimirContrato;

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
  if(!data.session){location.href="login.html";return null;}
  const uid=data.session.user.id;
  const {data:assin}=await sb.from("assinantes").select("*").eq("auth_user_id",uid).maybeSingle();
  if(!assin){ alert("Conta de cliente não encontrada.");await sb.auth.signOut();location.href="login.html";return null; }
  return assin;
}
async function sair(){ await sb.auth.signOut(); location.href="login.html"; }

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
  if(slug==="ind") return "linear-gradient(135deg,#4ebfce,#4ebfce)";
  if(slug==="gran") return "linear-gradient(135deg,#BD8420,#F0B43C)";
  return "linear-gradient(135deg,#134b80,#1b6cb3)"; // familiar / default
}

/* ---- render principal ---- */
function render(){
  const planoSlug = D.adesao.plano_slug;
  const wrap = document.getElementById("wrap");
  const temFam = D.cartoes.length>1;
  wrap.innerHTML = `
    <div class="hello">Olá, ${primeiro(D.assinante.nome)}! 👋</div>
    <div class="hello-sub">Conta ${D.adesao.numero_conta} · plano ${nomePlano(planoSlug)}</div>
    <div class="layout">
      <div class="card-area">
        <div class="tilt" id="tilt" style="background:${gradPlano(planoSlug)}">
          <div class="shine"></div>
          <svg class="pin" viewBox="-55 -55 110 110"><use href="#cv-white"/></svg>
          <div class="foto" id="cardFoto"></div>
          <div class="pad">
            <div class="kick">Cartão Mais Equilibrium</div>
            <div class="nome" id="cardNome"></div>
            <div class="num" id="cardNum"></div>
            <div class="meta">
              <div><b>Papel</b><span id="cardPapel"></span></div>
              <div><b>Plano</b>${nomePlano(planoSlug)}</div>
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

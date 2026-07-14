/* =========================================================
   MAIS EQUILIBRIUM — recepcao.js
   ========================================================= */
const sb = window.maisClient;
const money = (n)=>"R$ "+Math.round(Number(n||0)).toLocaleString("pt-BR");
const ini = (n)=>(n||"?").split(" ").filter(Boolean).slice(0,2).map(s=>s[0]).join("").toUpperCase();
const soDig = (s)=>(s||"").replace(/\D/g,"");
const planClass=(s)=>s==="ind"?"ind":s==="gran"?"gran":"fam";
const labelPapel={gestor:"Gestor",financeiro:"Financeiro",recepcao:"Recepção"};
const ACENTOS=["#1b6cb3","#4ebfce","#F0B43C","#E45460","#5aa7d8","#BD8420"];

const D={ cartoes:[], servicos:[], profissionais:[], usosHoje:[] };
let EU=null, sel=null, ULTIMO_USO=null;

/* ---- guarda: só equipe (recepcao/gestor) ---- */
async function guard(){
  const {data}=await sb.auth.getSession();
  if(!data.session){location.href="login.html";return null;}
  const uid=data.session.user.id;
  const {data:eq}=await sb.from("equipe").select("nome,papel,ativo,foto_path,auth_user_id,must_change_password").eq("auth_user_id",uid).maybeSingle();
  if(!eq||!eq.ativo||!(eq.papel==="recepcao"||eq.papel==="gestor")){
    alert("Acesso restrito à recepção.");await sb.auth.signOut();location.href="login.html";return null;
  }
  return {...eq,uid};
}
async function sair(){await sb.auth.signOut();location.href="login.html";}

/* ---- carga ---- */
async function carregar(){
  const [serv,prof,cart] = await Promise.all([
    sb.from("servicos").select("*").eq("ativo",true).order("ordem"),
    sb.from("profissionais").select("*").eq("ativo",true).order("nome"),
    sb.from("vw_busca_cartao").select("*").order("numero"),
  ]);
  D.servicos=serv.data||[]; D.profissionais=prof.data||[]; D.cartoes=cart.data||[];
  // popula selects
  const ss=document.getElementById("serv");
  D.servicos.forEach(s=>{const o=document.createElement("option");o.value=s.slug;
    o.textContent=`${s.nome} — ${money(s.preco_particular)} → ${money(s.preco_cartao)}`;
    o.dataset.part=s.preco_particular;o.dataset.card=s.preco_cartao;o.dataset.nome=s.nome;ss.appendChild(o);});
  const ps=document.getElementById("prof");
  D.profissionais.forEach(p=>{const o=document.createElement("option");o.value=p.id;
    o.textContent=p.especialidade?`${p.nome} — ${p.especialidade}`:p.nome;o.dataset.nome=p.nome;ps.appendChild(o);});
  await carregarUsosHoje();
}

async function carregarUsosHoje(){
  const hoje=new Date().toISOString().slice(0,10);
  const {data}=await sb.from("vw_uso_cartao").select("*").gte("data_uso",hoje).order("hora",{ascending:false});
  D.usosHoje=data||[];
  atualizarResumoDia();
}
function atualizarResumoDia(){
  const eco=D.usosHoje.reduce((s,u)=>s+Number(u.economia||0),0);
  const c=document.getElementById("dCount"); if(c)c.textContent=D.usosHoje.length;
  const e=document.getElementById("dEco"); if(e)e.textContent=money(eco);
}

/* ================= ABAS ================= */
function trocarAba(t){
  document.querySelectorAll(".tabs button").forEach(b=>b.classList.toggle("on",b.dataset.tab===t));
  document.querySelectorAll(".page").forEach(p=>p.classList.remove("on"));
  document.getElementById("page-"+t).classList.add("on");
  if(t==="pac")renderPacientes();
  if(t==="guias")renderGuias();
  window.scrollTo({top:0,behavior:"smooth"});
}

/* ================= EXECUTAR ================= */
function goStep(n){
  ["e1","e2","e3","e4"].forEach((s,i)=>document.getElementById(s).classList.toggle("on",i===n-1));
  document.getElementById("st1").className="step"+(n>1?" done":n===1?" on":"");
  document.getElementById("st2").className="step"+(n>2?" done":n===2?" on":"");
  document.getElementById("st3").className="step"+(n===3?" on":n>3?" done":"");
  window.scrollTo({top:0,behavior:"smooth"});
}
function buscar(){
  const raw=document.getElementById("q").value.trim().toLowerCase();
  const box=document.getElementById("results");
  if(!raw){box.innerHTML="";return;}
  const dig=soDig(raw);
  const res=D.cartoes.filter(c=>{
    const nome=(c.paciente||"").toLowerCase();
    const num=(c.numero||"").toLowerCase();
    const cpf=soDig(c.cpf);
    return nome.includes(raw)||num.includes(raw)||(dig.length>=3&&cpf.includes(dig));
  });
  if(!res.length){box.innerHTML='<div class="empty">Nenhum cartão encontrado.</div>';return;}
  box.innerHTML="";
  res.forEach((c,idx)=>{
    const ativo = c.cartao_status==="ativo" && c.adesao_status==="ativo";
    const cor=c.cor_acento||ACENTOS[idx%ACENTOS.length];
    const el=document.createElement("div");
    el.className="member"+(ativo?"":" blocked");
    el.innerHTML=`<div class="av" style="background:${cor}">${ini(c.paciente)}</div>
      <div class="inf"><b>${c.paciente}</b><span>${c.numero} · ${c.papel}</span>
       <div class="statusline ${ativo?"ok":"bad"}"><span class="d"></span>${ativo?"Cartão ativo":(c.adesao_status!=="ativo"?"Conta "+c.adesao_status:"Cartão bloqueado")}</div></div>
      <span class="pill ${planClass(c.plano_slug)}">${c.plano_nome}</span>`;
    el.onclick=()=>selecionar(c,ativo);
    box.appendChild(el);
  });
}
function selecionar(c,ativo){
  if(!ativo){
    document.getElementById("results").insertAdjacentHTML("afterbegin",
      `<div class="alerta"><div class="ic">⚠️</div><div>O cartão de <b>${c.paciente}</b> não está liberado (conta ${c.adesao_status}). Oriente o cliente a regularizar antes de executar o benefício.</div></div>`);
    return;
  }
  sel=c;
  const cor=c.cor_acento||"#1b6cb3";
  const card=document.getElementById("bigCard");
  card.style.background=`linear-gradient(135deg, ${escurece(cor,0.5)}, ${escurece(cor,0.72)})`;
  document.getElementById("bcNome").textContent=c.paciente;
  document.getElementById("bcNum").textContent=c.numero;
  document.getElementById("bcAv").textContent=ini(c.paciente);
  document.getElementById("bcPlano").textContent=c.plano_nome+" · "+c.papel;
  renderServChips();
  document.getElementById("serv").value="";
  document.getElementById("prof").value="";
  checkReady();
  goStep(2);
}

function escurece(hex, f){
  f = (f==null) ? 0.55 : f;
  const h=(hex||"#1b6cb3").replace("#","");
  const r=Math.round(parseInt(h.slice(0,2),16)*f);
  const g=Math.round(parseInt(h.slice(2,4),16)*f);
  const b=Math.round(parseInt(h.slice(4,6),16)*f);
  return `rgb(${r},${g},${b})`;
}

const ICON_SERV={psico:"🧠",psiq:"👨‍⚕️",rqe:"👨‍⚕️",neuro:"🧠",aba:"🧩",psicoped:"📚",psicomot:"🤸",fono:"🗣️",to:"✋",music:"🎵"};
function renderServChips(){
  const box=document.getElementById("servChips");
  if(!box)return;
  box.innerHTML="";
  D.servicos.forEach(s=>{
    const chip=document.createElement("div");
    chip.className="servchip"; chip.dataset.slug=s.slug;
    chip.innerHTML=`<span class="ic">${ICON_SERV[s.slug]||"•"}</span>${s.nome}`;
    chip.onclick=()=>escolherServ(s.slug);
    box.appendChild(chip);
  });
}
function escolherServ(slug){
  document.getElementById("serv").value=slug;
  document.querySelectorAll("#servChips .servchip").forEach(c=>c.classList.toggle("sel",c.dataset.slug===slug));
  checkReady();
}
function checkReady(){
  document.getElementById("toConf").disabled=!(document.getElementById("serv").value&&document.getElementById("prof").value);
}
function goConfirm(){
  const so=document.getElementById("serv").selectedOptions[0];
  const po=document.getElementById("prof").selectedOptions[0];
  const part=Number(so.dataset.part), card=Number(so.dataset.card);
  const d=document.getElementById("data").value.split("-").reverse().join("/");
  document.getElementById("cfNome").textContent=sel.paciente;
  document.getElementById("cfNum").textContent=sel.numero;
  document.getElementById("cfServ").textContent=so.dataset.nome;
  document.getElementById("cfProf").textContent=po.dataset.nome;
  document.getElementById("cfData").textContent=d+" · "+document.getElementById("hora").value;
  document.getElementById("cfEco").textContent=money(part-card);
  document.getElementById("cfPay").textContent=money(card);
  document.getElementById("cfPart").textContent=money(part);
  goStep(3);
}
async function executar(){
  const btn=document.getElementById("btnExec");
  btn.disabled=true; btn.textContent="Executando…";
  try{
    const servSlug=document.getElementById("serv").value;
    const profId=document.getElementById("prof").value;
    const dataUso=document.getElementById("data").value;
    const hora=document.getElementById("hora").value;
    const obs=document.getElementById("obs").value;
    const {data,error}=await sb.rpc("registrar_uso",{
      p_cartao_id:sel.cartao_id, p_servico_slug:servSlug, p_profissional_id:profId||null,
      p_data_uso:dataUso||null, p_hora:hora||null, p_observacao:obs||null, p_registrado_por:EU.nome
    });
    if(error)throw error;
    if(!data||data.ok!==true)throw new Error((data&&data.erro)||"Falha ao executar.");
    ULTIMO_USO=data;
    document.getElementById("okMsg").innerHTML=`<b>${data.paciente}</b> · ${data.servico}<br>Economia de <b style="color:var(--ok)">${money(data.economia)}</b> registrada.`;
    document.getElementById("okProto").textContent=data.protocolo;
    await carregarUsosHoje();
    goStep(4);
  }catch(e){
    alert("Erro: "+(e.message||e));
  }finally{
    btn.disabled=false; btn.textContent="✓ Executar e gerar guia";
  }
}
function novoAtendimento(){
  sel=null; ULTIMO_USO=null;
  document.getElementById("q").value="";
  document.getElementById("results").innerHTML="";
  document.getElementById("serv").value="";
  document.getElementById("prof").value="";
  document.getElementById("obs").value="";
  document.querySelectorAll("#servChips .servchip").forEach(c=>c.classList.remove("sel"));
  document.getElementById("toConf").disabled=true;
  resetDataHora();
  goStep(1);
  document.getElementById("q").focus();
}

/* ================= PACIENTES ================= */
function renderPacientes(){ pintarPac(D.cartoes); }
function filtrarPac(){
  const raw=(document.getElementById("qPac").value||"").trim().toLowerCase();
  const dig=soDig(raw);
  const f=D.cartoes.filter(c=>(c.paciente||"").toLowerCase().includes(raw)||(c.numero||"").toLowerCase().includes(raw)||(dig.length>=3&&soDig(c.cpf).includes(dig)));
  pintarPac(f);
}
function pintarPac(lista){
  const body=document.getElementById("pacBody");
  if(!lista.length){body.innerHTML='<tr><td colspan="5" class="empty">Nenhum paciente.</td></tr>';return;}
  body.innerHTML=lista.map((c,i)=>{
    const ativo=c.cartao_status==="ativo"&&c.adesao_status==="ativo";
    const cor=c.cor_acento||ACENTOS[i%ACENTOS.length];
    return `<tr class="clickable" onclick="verHistorico('${c.cartao_id}')">
      <td><div class="who"><div class="a" style="background:${cor}">${ini(c.paciente)}</div><div>${c.paciente}<small>${c.papel}</small></div></div></td>
      <td>${c.numero}</td><td><span class="pill ${planClass(c.plano_slug)}">${c.plano_nome}</span></td>
      <td><span class="statusline ${ativo?"ok":"bad"}"><span class="d"></span>${ativo?"Ativo":(c.adesao_status!=="ativo"?"Conta "+c.adesao_status:"Bloqueado")}</span></td>
      <td style="text-align:right"><button class="btn-mini" onclick="event.stopPropagation();verHistorico('${c.cartao_id}')">Histórico</button></td></tr>`;
  }).join("");
}
async function verHistorico(cartaoId){
  const c=D.cartoes.find(x=>x.cartao_id===cartaoId);
  const {data}=await sb.from("vw_uso_cartao").select("*").eq("cartao_id",cartaoId).order("data_uso",{ascending:false});
  const usos=data||[];
  const linhas=usos.length?usos.map(u=>`<div class="confrow"><span>${u.data_uso} · ${u.servico}</span><b class="dr-eco" style="color:var(--ok)">− ${money(u.economia)}</b></div>`).join(""):'<div class="empty" style="padding:16px">Sem atendimentos ainda.</div>';
  abrirModal(`Histórico — ${c.paciente}`, `<div class="confcard">${linhas}</div>`);
}

/* ================= GUIAS ================= */
let GUIAS=[];
function renderGuias(){
  const hoje=new Date().toISOString().slice(0,10);
  const de=document.getElementById("gDe"), ate=document.getElementById("gAte");
  if(de&&!de.value) de.value=hoje;
  if(ate&&!ate.value) ate.value=hoje;
  GUIAS=D.usosHoje; pintarGuias(GUIAS);
}
async function buscarGuiasPeriodo(){
  const hoje=new Date().toISOString().slice(0,10);
  const de=(document.getElementById("gDe").value||hoje);
  const ate=(document.getElementById("gAte").value||hoje);
  if(de>ate){ alert("A data inicial não pode ser maior que a final."); return; }
  const body=document.getElementById("guiaBody");
  body.innerHTML='<tr><td colspan="6" class="loading">Buscando guias do período…</td></tr>';
  const {data,error}=await sb.from("vw_uso_cartao").select("*")
    .gte("data_uso",de).lte("data_uso",ate)
    .order("data_uso",{ascending:false}).order("hora",{ascending:false});
  if(error){ body.innerHTML='<tr><td colspan="6" class="empty">Erro ao buscar: '+(error.message||error)+'</td></tr>'; return; }
  GUIAS=data||[];
  const q=document.getElementById("qGuia"); if(q) q.value="";
  pintarGuias(GUIAS);
}
function filtrarGuias(){
  const raw=(document.getElementById("qGuia").value||"").trim().toLowerCase();
  const f=GUIAS.filter(u=>(u.paciente||"").toLowerCase().includes(raw)||(u.numero_cartao||"").toLowerCase().includes(raw)||(u.protocolo||"").toLowerCase().includes(raw));
  pintarGuias(f);
}
function pintarGuias(lista){
  const body=document.getElementById("guiaBody");
  if(!lista.length){body.innerHTML='<tr><td colspan="6" class="empty">Nenhuma guia no período.</td></tr>';return;}
  body.innerHTML=lista.map(u=>`<tr>
    <td class="proto-cell">${u.protocolo||"—"}</td>
    <td>${u.paciente}</td><td>${u.servico}</td><td>${u.data_uso}</td><td>${money(u.valor_pago)}</td>
    <td style="text-align:right"><button class="btn-mini" onclick='abrirGuiaUso(${JSON.stringify(u).replace(/'/g,"&#39;")})'>📄 Guia</button></td></tr>`).join("");
}

/* ---- guia PDF (janela suspensa A4 paisagem) ---- */
function abrirGuiaUso(u){
  // enriquece com CPF/conta do cartão (vw_uso_cartao não traz esses campos)
  if(!u.cpf_paciente || !u.numero_conta){
    const c=D.cartoes.find(x=>x.cartao_id===u.cartao_id || x.numero===u.numero_cartao);
    if(c){ u={...u, cpf_paciente:u.cpf_paciente||c.cpf, numero_conta:u.numero_conta||c.numero_conta}; }
  }
  if(window.CortexGuia) CortexGuia.individual(u);
}
function abrirGuiaGeralHoje(){
  if(!D.usosHoje.length){alert("Nenhuma execução hoje para gerar a guia geral.");return;}
  if(window.CortexGuia) CortexGuia.geral(D.usosHoje);
}

/* ---- modal genérico ---- */
function abrirModal(titulo, html){
  let bg=document.getElementById("rcModal");
  if(!bg){ bg=document.createElement("div"); bg.id="rcModal";
    bg.style.cssText="position:fixed;inset:0;background:rgba(19,75,128,.45);backdrop-filter:blur(3px);display:flex;align-items:center;justify-content:center;z-index:200;padding:20px";
    bg.onclick=(e)=>{if(e.target===bg)bg.remove();};
    document.body.appendChild(bg);
  }
  bg.innerHTML=`<div style="background:#fff;border-radius:20px;max-width:560px;width:100%;max-height:88vh;overflow:auto;box-shadow:0 30px 70px rgba(8,30,55,.4)">
    <div style="background:linear-gradient(135deg,#134b80,#1b6cb3);color:#fff;padding:18px 22px;display:flex;align-items:center;justify-content:between;gap:12px">
      <h3 style="font-family:Quicksand;font-weight:700;font-size:17px;flex:1">${titulo}</h3>
      <button onclick="document.getElementById('rcModal').remove()" style="background:rgba(255,255,255,.2);border:none;color:#fff;width:32px;height:32px;border-radius:9px;cursor:pointer;font-size:16px">✕</button>
    </div>
    <div style="padding:20px">${html}</div></div>`;
}

/* ---- util data/hora ---- */
function resetDataHora(){
  const now=new Date();
  document.getElementById("data").value=now.toISOString().slice(0,10);
  document.getElementById("hora").value=now.toTimeString().slice(0,5);
}

/* ================= BOOT ================= */
(async()=>{
  const eq=await guard(); if(!eq)return;
  EU=eq;
  document.getElementById("uNome").textContent=eq.nome;
  document.getElementById("uRole").textContent=labelPapel[eq.papel]||eq.papel;
  if(eq.foto_path && window.CortexFoto){
    const url=await CortexFoto.urlAssinada(eq.foto_path);
    document.getElementById("uAv").innerHTML=url?`<img src="${url}">`:ini(eq.nome);
  }else document.getElementById("uAv").textContent=ini(eq.nome);
  const now=new Date();
  document.getElementById("hoje").textContent=now.toLocaleDateString("pt-BR",{weekday:"long",day:"2-digit",month:"long"});
  const dd=document.getElementById("dDate"); if(dd)dd.textContent=now.toLocaleDateString("pt-BR");
  resetDataHora();
  document.querySelectorAll(".tabs button").forEach(b=>b.onclick=()=>trocarAba(b.dataset.tab));
  await carregar();
  // pop-up após login: 1º acesso troca a senha automática
  if(eq.must_change_password && window.TrocarSenha){
    setTimeout(()=>TrocarSenha.abrir({
      tabela:"equipe", chaveColuna:"auth_user_id", chaveValor:EU.uid,
      onPronto:()=>{ EU.must_change_password=false; }
    }), 500);
  }
})();

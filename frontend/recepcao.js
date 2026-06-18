/* =========================================================
   MAIS EQUILIBRIUM — recepcao.js
   ========================================================= */
const sb = window.maisClient;
const money = (n)=>"R$ "+Math.round(Number(n||0)).toLocaleString("pt-BR");
const ini = (n)=>(n||"?").split(" ").filter(Boolean).slice(0,2).map(s=>s[0]).join("").toUpperCase();
const soDig = (s)=>(s||"").replace(/\D/g,"");
const planClass=(s)=>s==="ind"?"ind":s==="gran"?"gran":"fam";
const labelPapel={gestor:"Gestor",financeiro:"Financeiro",recepcao:"Recepção"};
const ACENTOS=["#1860A8","#54C0CC","#F0B43C","#E45460","#3E86D6","#BD8420"];

const D={ cartoes:[], servicos:[], profissionais:[], usosHoje:[] };
let EU=null, sel=null, ULTIMO_USO=null;

/* ---- guarda: só equipe (recepcao/gestor) ---- */
async function guard(){
  const {data}=await sb.auth.getSession();
  if(!data.session){location.href="login.html";return null;}
  const uid=data.session.user.id;
  const {data:eq}=await sb.from("equipe").select("nome,papel,ativo,foto_path,auth_user_id").eq("auth_user_id",uid).maybeSingle();
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
  document.getElementById("dCount").textContent=D.usosHoje.length;
  document.getElementById("dEco").textContent=money(eco);
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
  const cor=c.cor_acento||"#1860A8";
  document.getElementById("sbAv").textContent=ini(c.paciente);
  document.getElementById("sbAv").style.background=cor;
  document.getElementById("sbNome").textContent=c.paciente;
  document.getElementById("sbInfo").textContent=`${c.numero} · ${c.papel} · ${c.plano_nome}`;
  goStep(2);
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
function renderGuias(){ pintarGuias(D.usosHoje); }
function filtrarGuias(){
  const raw=(document.getElementById("qGuia").value||"").trim().toLowerCase();
  const f=D.usosHoje.filter(u=>(u.paciente||"").toLowerCase().includes(raw)||(u.numero_cartao||"").toLowerCase().includes(raw)||(u.protocolo||"").toLowerCase().includes(raw));
  pintarGuias(f);
}
function pintarGuias(lista){
  const body=document.getElementById("guiaBody");
  if(!lista.length){body.innerHTML='<tr><td colspan="6" class="empty">Nenhuma execução hoje.</td></tr>';return;}
  body.innerHTML=lista.map(u=>`<tr>
    <td class="proto-cell">${u.protocolo||"—"}</td>
    <td>${u.paciente}</td><td>${u.servico}</td><td>${u.data_uso}</td><td>${money(u.valor_pago)}</td>
    <td style="text-align:right"><button class="btn-mini" onclick='abrirGuiaUso(${JSON.stringify(u).replace(/'/g,"&#39;")})'>📄 Guia</button></td></tr>`).join("");
}

/* ---- guia PDF (placeholder — implementado na próxima camada) ---- */
function abrirGuiaUso(u){
  abrirModal("Guia · "+(u.protocolo||""), `<div class="note">A guia em PDF (A4 paisagem) será gerada aqui na próxima etapa.<br><br><b>Protocolo:</b> ${u.protocolo||"—"}<br><b>Paciente:</b> ${u.paciente}<br><b>Especialidade:</b> ${u.servico}<br><b>Valor:</b> ${money(u.valor_pago)}</div>`);
}
function abrirGuiaGeralHoje(){
  if(!D.usosHoje.length){alert("Nenhuma execução hoje para gerar a guia geral.");return;}
  abrirModal("Guia geral de hoje", `<div class="note">A guia geral consolidada (todas as execuções do dia) será gerada aqui na próxima etapa. Hoje: <b>${D.usosHoje.length}</b> execução(ões).</div>`);
}

/* ---- modal genérico ---- */
function abrirModal(titulo, html){
  let bg=document.getElementById("rcModal");
  if(!bg){ bg=document.createElement("div"); bg.id="rcModal";
    bg.style.cssText="position:fixed;inset:0;background:rgba(21,64,110,.45);backdrop-filter:blur(3px);display:flex;align-items:center;justify-content:center;z-index:200;padding:20px";
    bg.onclick=(e)=>{if(e.target===bg)bg.remove();};
    document.body.appendChild(bg);
  }
  bg.innerHTML=`<div style="background:#fff;border-radius:20px;max-width:560px;width:100%;max-height:88vh;overflow:auto;box-shadow:0 30px 70px rgba(8,30,55,.4)">
    <div style="background:linear-gradient(135deg,#15406E,#1860A8);color:#fff;padding:18px 22px;display:flex;align-items:center;justify-content:between;gap:12px">
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
  document.getElementById("dDate").textContent=now.toLocaleDateString("pt-BR");
  resetDataHora();
  document.querySelectorAll(".tabs button").forEach(b=>b.onclick=()=>trocarAba(b.dataset.tab));
  await carregar();
})();

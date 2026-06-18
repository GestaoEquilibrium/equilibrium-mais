/* =========================================================
   MAIS EQUILIBRIUM — foto_crop.js (componente compartilhado)
   Modal de recorte redondo (zoom + arraste) -> upload no bucket
   privado 'avatares' -> grava o caminho na coluna informada ->
   exibe via URL assinada temporária.

   Uso:
     CortexFoto.abrir({
       bucketFolder: "equipe",        // pasta dentro do bucket (equipe | pacientes)
       tabela: "equipe",              // tabela onde gravar o caminho
       coluna: "foto_path",           // coluna que guarda o caminho
       chaveColuna: "auth_user_id",   // coluna-chave para o UPDATE
       chaveValor: userId,            // valor da chave (o uid)
       onPronto: (signedUrl)=>{...}   // callback após salvar (recebe URL assinada)
     });

     await CortexFoto.urlAssinada(path)   // gera URL assinada para exibir
   Depende de window.maisClient (Supabase) já inicializado.
   ========================================================= */
(function () {
  const BUCKET = "avatares";
  const sb = () => window.maisClient;

  /* ---------- estilos (injetados uma vez) ---------- */
  function injetarCss() {
    if (document.getElementById("cfoto-css")) return;
    const s = document.createElement("style");
    s.id = "cfoto-css";
    s.textContent = `
    .cfoto-bg{position:fixed;inset:0;background:rgba(21,64,110,.5);backdrop-filter:blur(4px);display:none;align-items:center;justify-content:center;z-index:1000}
    .cfoto-bg.show{display:flex}
    .cfoto{background:#fff;border-radius:22px;width:min(420px,94vw);box-shadow:0 30px 70px rgba(8,30,55,.4);overflow:hidden;font-family:'Inter',system-ui,sans-serif}
    .cfoto .hd{background:linear-gradient(135deg,#15406E,#1860A8);color:#fff;padding:20px 24px}
    .cfoto .hd h3{font-family:'Quicksand',sans-serif;font-weight:700;font-size:18px;margin:0}
    .cfoto .hd p{font-size:12.5px;opacity:.85;margin-top:3px}
    .cfoto .bd{padding:22px 24px}
    .cfoto .drop{border:2px dashed #cdddec;border-radius:14px;padding:34px 18px;text-align:center;cursor:pointer;transition:.15s}
    .cfoto .drop:hover{border-color:#1860A8;background:#F1F7FC}
    .cfoto .drop .ic{font-size:34px}
    .cfoto .drop b{display:block;color:#1860A8;font-family:'Quicksand';font-weight:600;margin-top:8px}
    .cfoto .drop small{color:#6b7f90;font-size:12px}
    .cfoto .stage{display:none}
    .cfoto .stage.show{display:block}
    .cfoto .frame{position:relative;width:260px;height:260px;margin:0 auto;border-radius:50%;overflow:hidden;background:#0b2138;touch-action:none;cursor:grab;box-shadow:0 0 0 3px #1860A8, 0 0 0 9px #e6f1fb}
    .cfoto .frame.drag{cursor:grabbing}
    .cfoto .frame canvas{position:absolute;left:0;top:0}
    .cfoto .frame .ring{position:absolute;inset:0;border-radius:50%;pointer-events:none;box-shadow:inset 0 0 0 2px rgba(255,255,255,.6)}
    .cfoto .zoom{display:flex;align-items:center;gap:12px;margin-top:18px}
    .cfoto .zoom span{font-size:16px}
    .cfoto .zoom input{flex:1;accent-color:#1860A8}
    .cfoto .hint{font-size:12px;color:#6b7f90;text-align:center;margin-top:10px}
    .cfoto .ft{display:flex;gap:10px;padding:0 24px 22px}
    .cfoto .ft button{flex:1;border:none;border-radius:12px;padding:13px;font-family:'Quicksand',sans-serif;font-weight:600;font-size:14px;cursor:pointer;transition:.15s}
    .cfoto .ft .cancel{background:#eef3f8;color:#6b7f90}
    .cfoto .ft .trocar{background:#fff;color:#1860A8;border:1.5px solid #cdddec;flex:0 0 auto;padding:13px 16px}
    .cfoto .ft .save{background:#1860A8;color:#fff}
    .cfoto .ft .save:disabled{opacity:.6;cursor:not-allowed}
    .cfoto .msg{font-size:13px;border-radius:10px;padding:10px 13px;margin:0 24px 16px;display:none}
    .cfoto .msg.err{background:#FBEAEB;color:#C0392B;display:block}
    `;
    document.head.appendChild(s);
  }

  /* ---------- markup do modal (uma vez) ---------- */
  function montarModal() {
    if (document.getElementById("cfotoBg")) return;
    const div = document.createElement("div");
    div.className = "cfoto-bg";
    div.id = "cfotoBg";
    div.innerHTML = `
      <div class="cfoto">
        <div class="hd"><h3>Foto de identificação</h3><p>Enquadre seu rosto no círculo</p></div>
        <div class="bd">
          <div class="drop" id="cfotoDrop">
            <div class="ic">📷</div><b>Escolher foto</b><small>JPG ou PNG · toque para selecionar</small>
            <input type="file" id="cfotoFile" accept="image/*" style="display:none">
          </div>
          <div class="stage" id="cfotoStage">
            <div class="frame" id="cfotoFrame"><canvas id="cfotoCanvas"></canvas><div class="ring"></div></div>
            <div class="zoom"><span>🔍</span><input type="range" id="cfotoZoom" min="1" max="3" step="0.01" value="1"><span style="font-size:20px">🔍</span></div>
            <div class="hint">Arraste para posicionar · use a barra para aproximar</div>
          </div>
        </div>
        <div class="msg" id="cfotoMsg"></div>
        <div class="ft">
          <button class="cancel" id="cfotoCancel">Cancelar</button>
          <button class="trocar" id="cfotoTrocar" style="display:none">Trocar</button>
          <button class="save" id="cfotoSave" style="display:none">Salvar foto</button>
        </div>
      </div>`;
    document.body.appendChild(div);
  }

  /* ---------- estado do recorte ---------- */
  const st = { img: null, scale: 1, min: 1, ox: 0, oy: 0, drag: false, lx: 0, ly: 0, size: 260, cfg: null };

  function desenhar() {
    const cv = document.getElementById("cfotoCanvas");
    const ctx = cv.getContext("2d");
    const S = st.size;
    cv.width = S; cv.height = S;
    ctx.clearRect(0, 0, S, S);
    if (!st.img) return;
    const iw = st.img.width, ih = st.img.height;
    const base = Math.max(S / iw, S / ih);
    const sc = base * st.scale;
    const w = iw * sc, h = ih * sc;
    // limita o arraste pra não sair do círculo
    const maxX = (w - S) / 2, maxY = (h - S) / 2;
    st.ox = Math.max(-maxX, Math.min(maxX, st.ox));
    st.oy = Math.max(-maxY, Math.min(maxY, st.oy));
    ctx.drawImage(st.img, (S - w) / 2 + st.ox, (S - h) / 2 + st.oy, w, h);
  }

  function bindInteracao() {
    const frame = document.getElementById("cfotoFrame");
    const zoom = document.getElementById("cfotoZoom");
    const ponto = (e) => e.touches ? e.touches[0] : e;
    const start = (e) => { st.drag = true; frame.classList.add("drag"); const p = ponto(e); st.lx = p.clientX; st.ly = p.clientY; };
    const move = (e) => {
      if (!st.drag) return;
      const p = ponto(e); st.ox += (p.clientX - st.lx); st.oy += (p.clientY - st.ly);
      st.lx = p.clientX; st.ly = p.clientY; desenhar(); e.preventDefault();
    };
    const end = () => { st.drag = false; frame.classList.remove("drag"); };
    frame.onmousedown = start; window.addEventListener("mousemove", move); window.addEventListener("mouseup", end);
    frame.ontouchstart = start; frame.ontouchmove = move; frame.ontouchend = end;
    zoom.oninput = () => { st.scale = parseFloat(zoom.value); desenhar(); };
  }

  function carregarArquivo(file) {
    const msg = document.getElementById("cfotoMsg");
    msg.className = "msg";
    if (!file.type.startsWith("image/")) { msg.className = "msg err"; msg.textContent = "Selecione um arquivo de imagem."; return; }
    if (file.size > 8 * 1024 * 1024) { msg.className = "msg err"; msg.textContent = "Imagem muito grande (máx. 8MB)."; return; }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        st.img = img; st.scale = 1; st.ox = 0; st.oy = 0;
        document.getElementById("cfotoZoom").value = 1;
        document.getElementById("cfotoDrop").style.display = "none";
        document.getElementById("cfotoStage").classList.add("show");
        document.getElementById("cfotoSave").style.display = "block";
        document.getElementById("cfotoTrocar").style.display = "block";
        desenhar();
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  }

  /* recorta o círculo num PNG 512x512 */
  function gerarBlob() {
    return new Promise((resolve) => {
      const OUT = 512;
      const out = document.createElement("canvas");
      out.width = OUT; out.height = OUT;
      const ctx = out.getContext("2d");
      // círculo de recorte
      ctx.save();
      ctx.beginPath(); ctx.arc(OUT / 2, OUT / 2, OUT / 2, 0, Math.PI * 2); ctx.clip();
      const iw = st.img.width, ih = st.img.height;
      const base = Math.max(OUT / iw, OUT / ih);
      const sc = base * st.scale;
      const w = iw * sc, h = ih * sc;
      const offX = st.ox * (OUT / st.size), offY = st.oy * (OUT / st.size);
      ctx.drawImage(st.img, (OUT - w) / 2 + offX, (OUT - h) / 2 + offY, w, h);
      ctx.restore();
      out.toBlob((b) => resolve(b), "image/png", 0.92);
    });
  }

  async function salvar() {
    const cfg = st.cfg;
    const btn = document.getElementById("cfotoSave");
    const msg = document.getElementById("cfotoMsg");
    msg.className = "msg";
    btn.disabled = true; btn.textContent = "Salvando...";
    try {
      const blob = await gerarBlob();
      const path = `${cfg.bucketFolder}/${cfg.chaveValor}.png`; // ex: equipe/<uid>.png
      const up = await sb().storage.from(BUCKET).upload(path, blob, { upsert: true, contentType: "image/png" });
      if (up.error) throw up.error;
      // grava o caminho na tabela
      const upd = await sb().from(cfg.tabela).update({ [cfg.coluna]: path }).eq(cfg.chaveColuna, cfg.chaveValor);
      if (upd.error) throw upd.error;
      const url = await urlAssinada(path);
      fechar();
      if (typeof cfg.onPronto === "function") cfg.onPronto(url, path);
    } catch (e) {
      console.error("Erro ao salvar foto:", e);
      msg.className = "msg err"; msg.textContent = "Não foi possível salvar: " + (e.message || e);
    } finally {
      btn.disabled = false; btn.textContent = "Salvar foto";
    }
  }

  async function urlAssinada(path, segundos = 3600) {
    if (!path) return null;
    const { data, error } = await sb().storage.from(BUCKET).createSignedUrl(path, segundos);
    if (error) { console.warn("URL assinada falhou:", error.message); return null; }
    return data.signedUrl;
  }

  function abrir(cfg) {
    injetarCss(); montarModal();
    st.cfg = cfg; st.img = null;
    document.getElementById("cfotoDrop").style.display = "block";
    document.getElementById("cfotoStage").classList.remove("show");
    document.getElementById("cfotoSave").style.display = "none";
    document.getElementById("cfotoTrocar").style.display = "none";
    document.getElementById("cfotoMsg").className = "msg";
    document.getElementById("cfotoFile").value = "";
    document.getElementById("cfotoBg").classList.add("show");

    const drop = document.getElementById("cfotoDrop");
    const file = document.getElementById("cfotoFile");
    drop.onclick = () => file.click();
    file.onchange = () => { if (file.files[0]) carregarArquivo(file.files[0]); };
    document.getElementById("cfotoTrocar").onclick = () => file.click();
    document.getElementById("cfotoCancel").onclick = fechar;
    document.getElementById("cfotoSave").onclick = salvar;
    bindInteracao();
  }
  function fechar() { const b = document.getElementById("cfotoBg"); if (b) b.classList.remove("show"); }

  window.CortexFoto = { abrir, fechar, urlAssinada };
})();

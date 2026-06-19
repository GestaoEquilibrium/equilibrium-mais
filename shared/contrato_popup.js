/* =========================================================
   MAIS EQUILIBRIUM — contrato_popup.js
   Pop-up obrigatório de aceite do contrato no 1º acesso do
   paciente. Reusa a Edge Function "contrato" (carregar/aceitar).
   Só aparece se ainda NÃO foi aceito; some sozinho depois.

   Uso (na área do paciente, após carregar a adesão):
     ContratoPopup.abrir({ adesaoId: D.adesao.id, onAceito:()=>{...} });

   Depende de window.maisClient.
   ========================================================= */
(function () {
  const sb = () => window.maisClient;
  let cfg = {};

  function injetarCss() {
    if (document.getElementById("cpCss")) return;
    const s = document.createElement("style");
    s.id = "cpCss";
    s.textContent = `
    .cp-bg{position:fixed;inset:0;background:rgba(21,64,110,.55);backdrop-filter:blur(4px);display:none;align-items:center;justify-content:center;z-index:1002;padding:20px}
    .cp-bg.show{display:flex}
    .cp{background:#fff;border-radius:22px;width:100%;max-width:560px;max-height:88vh;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 30px 70px rgba(8,30,55,.45);font-family:'Inter',system-ui,sans-serif;color:#16293c}
    .cp .cp-head{background:linear-gradient(135deg,#15406E,#1860A8);color:#fff;padding:20px 24px}
    .cp .cp-head h2{font-family:'Quicksand',sans-serif;font-size:19px;margin:0}
    .cp .cp-head .sub{font-size:13px;opacity:.9;margin-top:4px}
    .cp .cp-corpo{padding:20px 24px;overflow-y:auto;flex:1;white-space:pre-wrap;font-size:13.5px;line-height:1.6;color:#2c3e50;background:#F7FAFD;border-bottom:1px solid #e2ebf3}
    .cp .cp-foot{padding:18px 24px}
    .cp .cp-chkrow{display:flex;align-items:flex-start;gap:10px;cursor:pointer;font-size:13.5px;margin-bottom:14px;user-select:none}
    .cp .cp-chkrow input{width:18px;height:18px;margin-top:1px;flex-shrink:0;cursor:pointer}
    .cp .cp-btn{font-family:'Quicksand',sans-serif;font-weight:600;border:none;border-radius:13px;padding:14px;font-size:15px;cursor:pointer;width:100%;background:#1860A8;color:#fff;transition:.18s}
    .cp .cp-btn:hover{background:#15406E}
    .cp .cp-btn:disabled{opacity:.5;cursor:not-allowed}
    .cp .cp-msg{font-size:13px;border-radius:10px;padding:10px 12px;margin-top:12px;display:none}
    .cp .cp-msg.err{background:#FBE9EA;color:#C0392B;display:block}
    `;
    document.head.appendChild(s);
  }

  function montar() {
    if (document.getElementById("cpBg")) return;
    const div = document.createElement("div");
    div.className = "cp-bg";
    div.id = "cpBg";
    div.innerHTML = `
      <div class="cp" role="dialog" aria-modal="true">
        <div class="cp-head">
          <h2 id="cpTitulo">Contrato de Adesão</h2>
          <div class="sub">Pagamento confirmado! Leia e aceite o contrato para liberar seu acesso.</div>
        </div>
        <div class="cp-corpo" id="cpCorpo">Carregando…</div>
        <div class="cp-foot">
          <label class="cp-chkrow"><input type="checkbox" id="cpChk"><span>Li e estou de acordo com os termos do contrato acima.</span></label>
          <button class="cp-btn" id="cpBtn" disabled>Aceitar e continuar</button>
          <div class="cp-msg" id="cpMsg"></div>
        </div>
      </div>`;
    document.body.appendChild(div);
    document.getElementById("cpChk").addEventListener("change", (e) => {
      document.getElementById("cpBtn").disabled = !e.target.checked;
    });
    document.getElementById("cpBtn").addEventListener("click", aceitar);
    // sem fechar ao clicar no fundo: o aceite é obrigatório
  }

  function msg(t, tipo) {
    const m = document.getElementById("cpMsg");
    m.textContent = t; m.className = "cp-msg " + tipo;
  }

  async function aceitar() {
    if (!document.getElementById("cpChk").checked) return;
    const btn = document.getElementById("cpBtn");
    btn.disabled = true; btn.textContent = "Registrando…";
    try {
      const { data, error } = await sb().functions.invoke("contrato", {
        body: { acao: "aceitar", adesao_id: cfg.adesaoId },
      });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.erro || "Não foi possível registrar o aceite.");
      fechar();
      if (typeof cfg.onAceito === "function") cfg.onAceito();
    } catch (e) {
      console.error("contrato:", e);
      msg("Não foi possível registrar o aceite: " + (e.message || e), "err");
      btn.disabled = false; btn.textContent = "Aceitar e continuar";
    }
  }

  async function abrir(opcoes) {
    cfg = opcoes || {};
    if (!cfg.adesaoId) return;
    injetarCss();
    montar();
    try {
      const { data, error } = await sb().functions.invoke("contrato", {
        body: { acao: "carregar", adesao_id: cfg.adesaoId },
      });
      if (error) throw error;
      if (!data?.ok) return;       // sem contrato disponível: não bloqueia
      if (data.ja_aceito) return;  // já aceitou: não mostra
      document.getElementById("cpTitulo").textContent = data.titulo || "Contrato de Adesão";
      document.getElementById("cpCorpo").textContent = data.corpo || "";
      document.getElementById("cpBg").classList.add("show");
    } catch (e) {
      // em caso de erro de rede não trava a área; será pedido de novo no próximo acesso
      console.error("contrato (carregar):", e);
    }
  }

  function fechar() { const b = document.getElementById("cpBg"); if (b) b.classList.remove("show"); }

  window.ContratoPopup = { abrir, fechar };
})();

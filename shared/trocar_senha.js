/* =========================================================
   MAIS EQUILIBRIUM — trocar_senha.js
   Pop-up de troca de senha obrigatória no 1º acesso.
   Mesmo molde do foto_crop.js. NÃO pode ser fechado:
   só some quando o usuário define uma nova senha.

   Uso:
     TrocarSenha.abrir({
       tabela:      "equipe",          // onde mora a flag must_change_password
       chaveColuna: "auth_user_id",    // coluna p/ localizar a linha
       chaveValor:  EU.uid,            // valor da chave
       onPronto:    ()=>{...}          // callback após salvar (opcional)
     });

   Depende de window.maisClient (Supabase) já inicializado.
   ========================================================= */
(function () {
  const sb = () => window.maisClient;
  let cfg = {};

  function injetarCss() {
    if (document.getElementById("tsenhaCss")) return;
    const s = document.createElement("style");
    s.id = "tsenhaCss";
    s.textContent = `
    .tsenha-bg{position:fixed;inset:0;background:rgba(21,64,110,.55);backdrop-filter:blur(4px);display:none;align-items:center;justify-content:center;z-index:1001;padding:20px}
    .tsenha-bg.show{display:flex}
    .tsenha{background:#fff;border-radius:22px;padding:32px 30px;width:100%;max-width:380px;box-shadow:0 30px 70px rgba(8,30,55,.45);font-family:'Inter',system-ui,sans-serif;color:#16293c}
    .tsenha .hd{display:flex;flex-direction:column;align-items:center;gap:8px;margin-bottom:18px;text-align:center}
    .tsenha .ic{width:52px;height:52px;border-radius:50%;background:#F1F7FC;display:flex;align-items:center;justify-content:center;font-size:24px}
    .tsenha h2{font-family:'Quicksand',sans-serif;font-size:20px;color:#15406E;margin:0}
    .tsenha .sub{font-size:13.5px;color:#6c7f8e;line-height:1.5}
    .tsenha label{display:block;font-size:13px;color:#6c7f8e;margin-bottom:6px;font-weight:500}
    .tsenha .fld{margin-bottom:14px}
    .tsenha input{width:100%;border:1.5px solid #e2ebf3;border-radius:12px;padding:13px 14px;font-size:15px;font-family:'Inter';transition:.15s}
    .tsenha input:focus{outline:none;border-color:#1860A8;box-shadow:0 0 0 3px rgba(24,96,168,.12)}
    .tsenha .btn{font-family:'Quicksand',sans-serif;font-weight:600;border:none;border-radius:13px;padding:14px;font-size:15px;cursor:pointer;width:100%;background:#1860A8;color:#fff;transition:.18s;margin-top:4px}
    .tsenha .btn:hover{background:#15406E}
    .tsenha .btn:disabled{opacity:.6;cursor:not-allowed}
    .tsenha .msg{font-size:13px;border-radius:10px;padding:10px 12px;margin-top:12px;display:none}
    .tsenha .msg.err{background:#FBE9EA;color:#C0392B;display:block}
    .tsenha .msg.ok{background:#E9F6EE;color:#1E8449;display:block}
    `;
    document.head.appendChild(s);
  }

  function montarModal() {
    if (document.getElementById("tsenhaBg")) return;
    const div = document.createElement("div");
    div.className = "tsenha-bg";
    div.id = "tsenhaBg";
    div.innerHTML = `
      <div class="tsenha" role="dialog" aria-modal="true">
        <div class="hd">
          <div class="ic">🔒</div>
          <h2>Crie sua senha</h2>
          <div class="sub">Este é seu primeiro acesso. Por segurança, troque a senha automática por uma senha só sua.</div>
        </div>
        <div class="fld"><label>Nova senha</label><input id="tsNova" type="password" placeholder="Mínimo 6 caracteres" autocomplete="new-password"></div>
        <div class="fld"><label>Confirmar nova senha</label><input id="tsConf" type="password" placeholder="Repita a nova senha" autocomplete="new-password"></div>
        <button class="btn" id="tsBtn">Salvar e continuar</button>
        <div class="msg" id="tsMsg"></div>
      </div>`;
    document.body.appendChild(div);
    document.getElementById("tsBtn").addEventListener("click", salvar);
    div.addEventListener("keydown", (e) => { if (e.key === "Enter") salvar(); });
    // sem fechar ao clicar no fundo: o modal é obrigatório
  }

  function msg(t, tipo) {
    const m = document.getElementById("tsMsg");
    m.textContent = t; m.className = "msg " + tipo;
  }

  async function salvar() {
    const s1 = document.getElementById("tsNova").value;
    const s2 = document.getElementById("tsConf").value;
    if (s1.length < 6) { msg("A senha precisa ter ao menos 6 caracteres.", "err"); return; }
    if (s1 !== s2) { msg("As senhas não conferem.", "err"); return; }
    const btn = document.getElementById("tsBtn");
    btn.disabled = true; btn.textContent = "Salvando...";
    try {
      const { error } = await sb().auth.updateUser({ password: s1 });
      if (error) { msg("Não foi possível salvar: " + error.message, "err"); return; }
      // zera a flag na tabela informada
      if (cfg.tabela && cfg.chaveColuna) {
        await sb().from(cfg.tabela)
          .update({ must_change_password: false })
          .eq(cfg.chaveColuna, cfg.chaveValor);
      }
      msg("Senha atualizada!", "ok");
      setTimeout(() => {
        fechar();
        if (typeof cfg.onPronto === "function") cfg.onPronto();
      }, 600);
    } catch (e) {
      console.error(e); msg("Erro ao salvar a senha. Tente novamente.", "err");
    } finally {
      btn.disabled = false; btn.textContent = "Salvar e continuar";
    }
  }

  function abrir(opcoes) {
    cfg = opcoes || {};
    injetarCss();
    montarModal();
    const bg = document.getElementById("tsenhaBg");
    document.getElementById("tsNova").value = "";
    document.getElementById("tsConf").value = "";
    const m = document.getElementById("tsMsg"); m.textContent = ""; m.className = "msg";
    bg.classList.add("show");
    setTimeout(() => document.getElementById("tsNova").focus(), 50);
  }

  function fechar() { const b = document.getElementById("tsenhaBg"); if (b) b.classList.remove("show"); }

  window.TrocarSenha = { abrir, fechar };
})();

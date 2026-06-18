/* =========================================================
   MAIS EQUILIBRIUM — guia.js
   Janela suspensa com a guia de execução (A4 paisagem).
   Guia individual + guia geral consolidada do dia.
   Baixar (html2canvas+jsPDF) · Imprimir (window.print).
   ========================================================= */
(function () {
  const CLINICA = {
    nome: "Grupo Equilibrium Med Center",
    cnpj: "34.032.586/0001-98",
    cidade: "Uberlândia/MG",
  };
  const money = (n) => "R$ " + Math.round(Number(n || 0)).toLocaleString("pt-BR");
  const hoje = () => new Date().toLocaleDateString("pt-BR");
  const fmtData = (d) => (d ? d.split("-").reverse().join("/") : "—");

  /* catavento azul/laranja inline (assinatura da marca) */
  const CV = `<svg width="44" height="44" viewBox="-55 -55 110 110">
    <g><path id="bl" d="M 13.2,-3.8 L 2.2,-3.8 Q 0,-3.8 0,-5.7 L 0,-46.6 Q 0,-48.5 1.9,-48.5 Q 3.9,-48.5 5.5,-46.6 L 24.4,-20.1 Q 25.2,-14 22.3,-8.4 Q 21,-6 19.4,-5.8 L 13.2,-3.8 Z" fill="#1860A8"/></g>
    <use href="#bl" fill="#F0B43C" transform="rotate(90)"/><use href="#bl" fill="#1860A8" transform="rotate(180)"/><use href="#bl" fill="#F0B43C" transform="rotate(270)"/></svg>`;

  function injetarCss() {
    if (document.getElementById("guia-css")) return;
    const s = document.createElement("style");
    s.id = "guia-css";
    s.textContent = `
    .guia-bg{position:fixed;inset:0;background:rgba(21,64,110,.5);backdrop-filter:blur(4px);display:none;align-items:flex-start;justify-content:center;z-index:1000;padding:24px;overflow:auto}
    .guia-bg.show{display:flex}
    .guia-modal{background:#eef2f6;border-radius:18px;max-width:1000px;width:100%;box-shadow:0 30px 80px rgba(8,30,55,.45);overflow:hidden}
    .guia-bar{background:linear-gradient(135deg,#15406E,#1860A8);color:#fff;padding:16px 22px;display:flex;align-items:center;gap:12px}
    .guia-bar h3{font-family:'Quicksand',sans-serif;font-weight:700;font-size:16px;flex:1}
    .guia-bar button{font-family:'Quicksand',sans-serif;font-weight:600;border:none;border-radius:10px;padding:9px 16px;font-size:13.5px;cursor:pointer;display:flex;align-items:center;gap:7px;transition:.15s}
    .guia-bar .baixar{background:#fff;color:#1860A8}
    .guia-bar .imprimir{background:rgba(255,255,255,.18);color:#fff}
    .guia-bar .fechar{background:rgba(255,255,255,.18);color:#fff;width:38px;justify-content:center;padding:9px}
    .guia-scroll{padding:22px;max-height:78vh;overflow:auto}
    /* FOLHA A4 PAISAGEM (297 x 210 mm -> proporção) */
    .guia-folha{background:#fff;width:1000px;min-height:707px;margin:0 auto;padding:38px 44px;box-shadow:0 8px 24px rgba(0,0,0,.12);font-family:'Inter',system-ui,sans-serif;color:#16293c;box-sizing:border-box}
    .guia-head{display:flex;align-items:center;gap:16px;border-bottom:3px solid #1860A8;padding-bottom:18px}
    .guia-head .logo{flex-shrink:0}
    .guia-head .ci{flex:1}
    .guia-head .ci .marca{font-family:'Quicksand',sans-serif;font-weight:700;font-size:22px;color:#15406E}
    .guia-head .ci .marca span{color:#1860A8}
    .guia-head .ci .cl{font-size:13px;color:#6b7f90;margin-top:3px}
    .guia-head .doc{text-align:right}
    .guia-head .doc .t{font-family:'Quicksand',sans-serif;font-weight:700;font-size:15px;color:#15406E;text-transform:uppercase;letter-spacing:.04em}
    .guia-head .doc .proto{font-family:'Quicksand',sans-serif;font-weight:700;font-size:20px;color:#1860A8;margin-top:4px}
    .guia-meta{display:flex;justify-content:space-between;margin:18px 0 22px;font-size:13px;color:#6b7f90}
    .guia-sec{font-family:'Quicksand',sans-serif;font-weight:700;font-size:12px;color:#1860A8;text-transform:uppercase;letter-spacing:.07em;margin-bottom:10px;padding-bottom:6px;border-bottom:1px solid #e4edf5}
    .guia-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px 30px;margin-bottom:26px}
    .guia-f{display:flex;flex-direction:column}
    .guia-f .l{font-size:11px;color:#92a4b3;text-transform:uppercase;letter-spacing:.04em}
    .guia-f .v{font-size:15px;font-weight:600;color:#16293c;margin-top:2px}
    /* tabela (guia geral) */
    .guia-tbl{width:100%;border-collapse:collapse;margin-bottom:24px;font-size:13px}
    .guia-tbl th{background:#15406E;color:#fff;font-family:'Quicksand',sans-serif;font-weight:600;text-align:left;padding:10px 12px;font-size:12px}
    .guia-tbl th:first-child{border-radius:8px 0 0 0}.guia-tbl th:last-child{border-radius:0 8px 0 0;text-align:right}
    .guia-tbl td{padding:9px 12px;border-bottom:1px solid #e4edf5}
    .guia-tbl td:last-child{text-align:right;font-weight:600}
    .guia-tbl tr:nth-child(even) td{background:#f6f9fc}
    .guia-tbl tfoot td{font-family:'Quicksand',sans-serif;font-weight:700;color:#15406E;border-top:2px solid #1860A8;border-bottom:none;font-size:14px}
    .guia-valor{display:inline-block;background:#F1F7FC;border:1px solid #d6e6f3;border-radius:10px;padding:8px 16px;font-family:'Quicksand',sans-serif;font-weight:700;font-size:18px;color:#15406E}
    /* rodapé assinaturas */
    .guia-foot{margin-top:auto;padding-top:46px}
    .guia-sigs{display:flex;gap:60px;margin-top:30px}
    .guia-sig{flex:1;text-align:center}
    .guia-sig .ln{border-top:1.5px solid #16293c;padding-top:7px;font-size:12.5px;color:#6b7f90}
    .guia-sig .nm{font-weight:600;color:#16293c;font-size:13px}
    .guia-note{font-size:10.5px;color:#92a4b3;text-align:center;margin-top:24px;border-top:1px solid #e4edf5;padding-top:12px}
    @media print{
      body *{visibility:hidden}
      .guia-print-area,.guia-print-area *{visibility:visible}
      .guia-print-area{position:absolute;left:0;top:0;width:100%}
      @page{size:A4 landscape;margin:0}
      .guia-folha{box-shadow:none;width:297mm;min-height:210mm;margin:0;padding:14mm 16mm}
    }
    `;
    document.head.appendChild(s);
  }

  function montarBg() {
    let bg = document.getElementById("guiaBg");
    if (bg) return bg;
    bg = document.createElement("div");
    bg.className = "guia-bg";
    bg.id = "guiaBg";
    bg.onclick = (e) => { if (e.target === bg) fechar(); };
    document.body.appendChild(bg);
    return bg;
  }
  function fechar() { const b = document.getElementById("guiaBg"); if (b) b.classList.remove("show"); }

  /* ---- conteúdo da guia individual ---- */
  function folhaIndividual(u) {
    return `
    <div class="guia-folha guia-print-area" id="guiaFolha">
      <div class="guia-head">
        <div class="logo">${CV}</div>
        <div class="ci">
          <div class="marca">Mais <span>Equilibrium</span></div>
          <div class="cl">${CLINICA.nome} · CNPJ ${CLINICA.cnpj} · ${CLINICA.cidade}</div>
        </div>
        <div class="doc">
          <div class="t">Guia de Atendimento</div>
          <div class="proto">${u.protocolo || "—"}</div>
        </div>
      </div>

      <div class="guia-meta">
        <span>Emitida em ${hoje()}</span>
        <span>Cartão de benefícios — não é plano de saúde</span>
      </div>

      <div class="guia-sec">Beneficiário</div>
      <div class="guia-grid">
        <div class="guia-f"><span class="l">Paciente</span><span class="v">${u.paciente || "—"}</span></div>
        <div class="guia-f"><span class="l">Cartão</span><span class="v">${u.numero_cartao || "—"}</span></div>
        <div class="guia-f"><span class="l">Conta</span><span class="v">${u.numero_conta || "—"}</span></div>
        <div class="guia-f"><span class="l">CPF</span><span class="v">${u.cpf_paciente || "—"}</span></div>
      </div>

      <div class="guia-sec">Atendimento</div>
      <div class="guia-grid">
        <div class="guia-f"><span class="l">Especialidade</span><span class="v">${u.servico || "—"}</span></div>
        <div class="guia-f"><span class="l">Profissional</span><span class="v">${u.profissional || "—"}</span></div>
        <div class="guia-f"><span class="l">Data</span><span class="v">${fmtData(u.data_uso)}${u.hora ? " · " + u.hora : ""}</span></div>
        <div class="guia-f"><span class="l">Valor</span><span class="v"><span class="guia-valor">${money(u.valor_pago)}</span></span></div>
      </div>

      <div class="guia-foot">
        <div class="guia-sec">Confirmação de atendimento</div>
        <div class="guia-sigs">
          <div class="guia-sig"><div class="nm" style="height:18px"></div><div class="ln">Assinatura do paciente / responsável</div></div>
          <div class="guia-sig"><div class="nm" style="height:18px"></div><div class="ln">${CLINICA.nome}</div></div>
        </div>
        <div class="guia-note">Protocolo ${u.protocolo || "—"} · Documento gerado eletronicamente pelo sistema Mais Equilibrium em ${hoje()}.</div>
      </div>
    </div>`;
  }

  /* ---- conteúdo da guia geral (consolidada do dia) ---- */
  function folhaGeral(usos) {
    const total = usos.reduce((s, u) => s + Number(u.valor_pago || 0), 0);
    const linhas = usos.map(u => `<tr>
      <td>${u.protocolo || "—"}</td>
      <td>${u.paciente}</td>
      <td>${u.servico}</td>
      <td>${u.profissional || "—"}</td>
      <td>${money(u.valor_pago)}</td>
    </tr>`).join("");
    return `
    <div class="guia-folha guia-print-area" id="guiaFolha">
      <div class="guia-head">
        <div class="logo">${CV}</div>
        <div class="ci">
          <div class="marca">Mais <span>Equilibrium</span></div>
          <div class="cl">${CLINICA.nome} · CNPJ ${CLINICA.cnpj} · ${CLINICA.cidade}</div>
        </div>
        <div class="doc">
          <div class="t">Guia Geral do Dia</div>
          <div class="proto">${hoje()}</div>
        </div>
      </div>

      <div class="guia-meta">
        <span>${usos.length} atendimento(s) executado(s)</span>
        <span>Cartão de benefícios — não é plano de saúde</span>
      </div>

      <div class="guia-sec">Atendimentos do dia</div>
      <table class="guia-tbl">
        <thead><tr><th>Protocolo</th><th>Paciente</th><th>Especialidade</th><th>Profissional</th><th>Valor</th></tr></thead>
        <tbody>${linhas}</tbody>
        <tfoot><tr><td colspan="4">Total</td><td>${money(total)}</td></tr></tfoot>
      </table>

      <div class="guia-foot">
        <div class="guia-sigs">
          <div class="guia-sig"><div class="nm" style="height:18px"></div><div class="ln">Assinatura do paciente / responsável</div></div>
          <div class="guia-sig"><div class="nm" style="height:18px"></div><div class="ln">${CLINICA.nome}</div></div>
        </div>
        <div class="guia-note">Documento gerado eletronicamente pelo sistema Mais Equilibrium em ${hoje()}.</div>
      </div>
    </div>`;
  }

  function abrir(titulo, folhaHtml) {
    injetarCss();
    const bg = montarBg();
    bg.innerHTML = `
      <div class="guia-modal">
        <div class="guia-bar">
          <h3>${titulo}</h3>
          <button class="baixar" onclick="CortexGuia._baixar()">⬇ Baixar PDF</button>
          <button class="imprimir" onclick="CortexGuia._imprimir()">🖨 Imprimir</button>
          <button class="fechar" onclick="CortexGuia._fechar()">✕</button>
        </div>
        <div class="guia-scroll">${folhaHtml}</div>
      </div>`;
    bg.classList.add("show");
  }

  async function baixar() {
    const folha = document.getElementById("guiaFolha");
    if (!folha) return;
    if (!window.html2canvas || !window.jspdf) {
      alert("Bibliotecas de PDF não carregadas. Use Imprimir → Salvar como PDF.");
      return;
    }
    const canvas = await window.html2canvas(folha, { scale: 2, backgroundColor: "#fff", useCORS: true });
    const img = canvas.toDataURL("image/png");
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const pw = pdf.internal.pageSize.getWidth();
    const ph = pdf.internal.pageSize.getHeight();
    // encaixa mantendo proporção
    const ratio = canvas.width / canvas.height;
    let w = pw, h = pw / ratio;
    if (h > ph) { h = ph; w = ph * ratio; }
    const x = (pw - w) / 2, y = (ph - h) / 2;
    pdf.addImage(img, "PNG", x, y, w, h);
    const proto = (folha.querySelector(".proto")?.textContent || "guia").trim().replace(/[^\w-]/g, "_");
    pdf.save("Guia_" + proto + ".pdf");
  }
  function imprimir() {
    window.print();
  }

  window.CortexGuia = {
    individual: (u) => abrir("Guia · " + (u.protocolo || ""), folhaIndividual(u)),
    geral: (usos) => abrir("Guia geral · " + hoje(), folhaGeral(usos)),
    _baixar: baixar, _imprimir: imprimir, _fechar: fechar,
  };
})();

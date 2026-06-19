/* =========================================================
   MAIS EQUILIBRIUM — tema.js
   Modo claro/escuro com persistência (localStorage).
   - Aplica a classe .dark no <html> antes da pintura (sem flash).
   - Qualquer botão com [data-tema-toggle] alterna o tema.
   Carregue este arquivo no <head>.
   ========================================================= */
(function () {
  const KEY = "mais_tema";

  function preferido() {
    const salvo = localStorage.getItem(KEY);
    if (salvo === "dark" || salvo === "light") return salvo;
    return (window.matchMedia && matchMedia("(prefers-color-scheme:dark)").matches) ? "dark" : "light";
  }

  function aplicar(tema) {
    document.documentElement.classList.toggle("dark", tema === "dark");
    atualizarIcones(tema);
  }

  function atualizarIcones(tema) {
    document.querySelectorAll("[data-tema-toggle]").forEach((b) => {
      b.textContent = tema === "dark" ? "☀️" : "🌙";
      b.title = tema === "dark" ? "Modo claro" : "Modo escuro";
    });
  }

  function alternar() {
    const novo = document.documentElement.classList.contains("dark") ? "light" : "dark";
    localStorage.setItem(KEY, novo);
    aplicar(novo);
  }

  // aplica imediatamente p/ evitar flash
  document.documentElement.classList.toggle("dark", preferido() === "dark");

  document.addEventListener("DOMContentLoaded", () => {
    atualizarIcones(preferido());
    document.querySelectorAll("[data-tema-toggle]").forEach((b) => (b.onclick = alternar));
  });

  window.Tema = { alternar, aplicar, preferido };
})();

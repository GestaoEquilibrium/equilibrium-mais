/* =========================================================
   MAIS EQUILIBRIUM — config.js
   Credenciais do projeto Supabase (projeto isolado do CORTEX).
   A anon key é pública por natureza (vai no frontend) — o que
   protege os dados é o RLS, nunca o sigilo desta chave.
   ========================================================= */
window.MAIS_CONFIG = {
  url:     "https://svboktcgwccsedwoibmw.supabase.co",
  anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN2Ym9rdGNnd2Njc2Vkd29pYm13Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3MDMyNDksImV4cCI6MjA5NzI3OTI0OX0.id70Kgf8N5PBoHnvg3RD4gEO3S475FjGvvnEEATsQEI"
};

/* Cliente Supabase global (carrega o SDK v2 antes deste arquivo). */
window.maisClient = window.supabase.createClient(
  window.MAIS_CONFIG.url,
  window.MAIS_CONFIG.anonKey
);

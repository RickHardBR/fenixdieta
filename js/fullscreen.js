// ============================================
// FULLSCREEN — utilitário compartilhado entre todas as páginas
// ============================================
function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch((err) => {
      console.warn("Fullscreen não suportado:", err);
    });
  } else {
    document.exitFullscreen();
  }
}

document.addEventListener("fullscreenchange", () => {
  const btn = document.getElementById("btnFullscreen");
  if (!btn) return;
  btn.textContent = document.fullscreenElement ? "✕" : "⛶";
  btn.title       = document.fullscreenElement ? "Sair da tela cheia" : "Tela cheia";
});

// Ao carregar a página, re-entra em fullscreen automaticamente se estava ativo
// (o browser não mantém fullscreen ao navegar entre páginas, mas tenta reativar)
document.addEventListener("DOMContentLoaded", () => {
  // Pequeno delay para garantir que o DOM está pronto
  setTimeout(() => {
    const btn = document.getElementById("btnFullscreen");
    if (btn) {
      btn.textContent = "⛶";
      btn.title = "Tela cheia";
    }
  }, 100);
});

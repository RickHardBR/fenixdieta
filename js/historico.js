async function carregarHistoricoCompleto() {
  const { data, error } = await supabaseClient
    .from("pesos")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Erro ao carregar histórico:", error);
    return;
  }

  const container = document.getElementById("historicoCompleto");
  container.innerHTML = "";

  data.forEach((registro, index) => {
    const dataFormatada = new Date(registro.created_at)
      .toLocaleDateString("pt-BR");

    const linha = document.createElement("div");
    linha.className = "linha-historico";

    if (index === 0) {
      linha.classList.add("peso-atual");
    } else {
      linha.classList.add("peso-antigo");
    }

    linha.innerHTML = `
      <span>${dataFormatada}</span>
      <span>${registro.peso.toFixed(2)} kg</span>
    `;

    container.appendChild(linha);
  });
}

function voltar() {
  window.location.href = "index.html";
}
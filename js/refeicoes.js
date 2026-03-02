async function carregarHistoricoRefeicoes() {

  const container = document.getElementById("historicoRefeicoes");
  container.innerHTML = "";

  // 1️⃣ Buscar refeições concluídas
  const { data: refeicoes, error } = await supabaseClient
    .from("refeicoes")
    .select("id, data")
    .eq("concluida", true);

  if (error) {
    console.error("Erro ao buscar refeições:", error);
    return;
  }

  if (!refeicoes.length) {
    container.innerHTML = "<p>Nenhuma refeição concluída ainda.</p>";
    return;
  }

  // 2️⃣ Agrupar ids por data
  const refeicoesPorData = {};

  refeicoes.forEach(ref => {
    if (!refeicoesPorData[ref.data]) {
      refeicoesPorData[ref.data] = [];
    }
    refeicoesPorData[ref.data].push(ref.id);
  });

  // 3️⃣ Ordenar datas (mais recente primeiro)
  const datasOrdenadas = Object.keys(refeicoesPorData)
    .sort((a, b) => new Date(b) - new Date(a));

  // 4️⃣ Para cada data calcular calorias
  for (const data of datasOrdenadas) {

    const ids = refeicoesPorData[data];

    const { data: itens } = await supabaseClient
      .from("refeicao_itens")
      .select(`
        quantidade,
        refeicao_id,
        alimentos!inner (
          tipo_medida,
          calorias_base
        )
      `)
      .in("refeicao_id", ids);

    let total = 0;

    itens.forEach(item => {
      const alimento = item.alimentos;
      const base = alimento.tipo_medida === "gramas" ? 100 : 1;
      total += (item.quantidade * alimento.calorias_base) / base;
    });

    // 5️⃣ Criar card visual
    const card = document.createElement("div");
    card.className = "linha-historico";

    const dataFormatada = new Date(data)
      .toLocaleDateString("pt-BR");

    card.innerHTML = `
      <span>${dataFormatada}</span>
      <span>${total.toFixed(0)} kcal</span>
    `;

    container.appendChild(card);
  }
}

function voltar() {
  window.location.href = "index.html";
}

window.onload = carregarHistoricoRefeicoes;
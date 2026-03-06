// ============================================
// CONSTANTES
// ============================================
const META_PESO = 95;
const META_CALORIAS_HISTORICO = 1900;

// ============================================
// UTILITÁRIO DE DATA — evita problemas de fuso horário
// ============================================
function formatarDataBR(dataStr) {
  // dataStr no formato YYYY-MM-DD
  const [ano, mes, dia] = dataStr.split("-");
  return `${dia}/${mes}/${ano}`;
}

// ============================================
// HISTÓRICO DE PESO
// ============================================
async function carregarHistoricoCompleto() {
  const { data, error } = await supabaseClient
    .from("pesos")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Erro ao carregar histórico de peso:", error);
    return;
  }

  const container = document.getElementById("historicoCompleto");
  container.innerHTML = "";

  const datas = [];
  const pesos = [];

  data.forEach((registro, index) => {
    const dataFormatada = new Date(registro.created_at).toLocaleDateString("pt-BR");

    datas.push(dataFormatada);
    pesos.push(registro.peso);

    const linha = document.createElement("div");
    linha.className = `linha-historico ${index === data.length - 1 ? "peso-atual" : "peso-antigo"}`;
    linha.innerHTML = `
      <span>${dataFormatada}</span>
      <span>${registro.peso.toFixed(2)} kg</span>
    `;
    container.appendChild(linha);
  });

  criarGraficoPeso(datas, pesos);
}

function criarGraficoPeso(datas, pesos) {
  const ctx = document.getElementById("graficoPeso");
  const metaLinha = new Array(datas.length).fill(META_PESO);

  new Chart(ctx, {
    type: "line",
    data: {
      labels: datas,
      datasets: [
        {
          label: "Peso",
          data: pesos,
          borderColor: "#4caf50",
          backgroundColor: "rgba(76,175,80,0.25)",
          tension: 0.35,
          cubicInterpolationMode: "monotone",
          fill: true,
          pointHoverRadius: 7,
          pointBackgroundColor: "#4caf50",
          pointRadius: (ctx) => ctx.dataIndex === pesos.length - 1 ? 8 : 4,
        },
        {
          label: "Meta",
          data: metaLinha,
          borderColor: "#ff9800",
          borderDash: [3, 3],
          pointRadius: 0,
          tension: 0,
        },
      ],
    },
    options: {
      animation: { duration: 1200, easing: "easeOutQuart" },
      plugins: { legend: { display: false } },
      scales: {
        y: { ticks: { color: "white" }, grid: { color: "#333" } },
        x: { ticks: { color: "white" }, grid: { color: "#333" } },
      },
    },
  });

  const primeiro = pesos[0];
  const ultimo = pesos[pesos.length - 1];
  const diferenca = (ultimo - primeiro).toFixed(1);
  const resumo = document.getElementById("resumoPeso");

  if (diferenca < 0) {
    resumo.innerHTML = `↓ ${Math.abs(diferenca)} kg perdidos`;
    resumo.style.color = "#4caf50";
  } else if (diferenca > 0) {
    resumo.innerHTML = `↑ ${diferenca} kg ganhos`;
    resumo.style.color = "#ff5252";
  } else {
    resumo.innerHTML = "Peso estável";
    resumo.style.color = "#ffffff";
  }
}

// ============================================
// HISTÓRICO DE REFEIÇÕES (CALORIAS POR DIA)
// ============================================
async function carregarHistoricoRefeicoes() {
  const container = document.getElementById("historicoRefeicoes");
  if (!container) return;

  container.innerHTML = "<div style='color:#aaa; text-align:center;'>Carregando...</div>";

  // 1. Buscar todos os dias que têm refeições, ordenados do mais recente
  const { data: refeicoes, error: erroRefeicoes } = await supabaseClient
    .from("refeicoes")
    .select("id, data, concluida")
    .order("data", { ascending: false });

  if (erroRefeicoes) {
    console.error("Erro ao carregar refeições:", erroRefeicoes);
    container.innerHTML = "<div style='color:#ff5252;'>Erro ao carregar histórico.</div>";
    return;
  }

  if (!refeicoes || refeicoes.length === 0) {
    container.innerHTML = "<div style='color:#aaa;'>Nenhuma refeição encontrada.</div>";
    return;
  }

  // 2. Buscar todos os itens dessas refeições de uma vez (evita N+1)
  const ids = refeicoes.map((r) => r.id);

  const { data: itens, error: erroItens } = await supabaseClient
    .from("refeicao_itens")
    .select(`
      refeicao_id,
      quantidade,
      alimentos!inner (
        tipo_medida,
        calorias_base
      )
    `)
    .in("refeicao_id", ids);

  if (erroItens) {
    console.error("Erro ao carregar itens:", erroItens);
  }

  // 3. Calcular calorias por refeição
  const caloriasPorRefeicao = {};
  (itens || []).forEach((item) => {
    const base = item.alimentos.tipo_medida === "gramas" ? 100 : 1;
    const kcal = (item.quantidade * item.alimentos.calorias_base) / base;
    caloriasPorRefeicao[item.refeicao_id] = (caloriasPorRefeicao[item.refeicao_id] || 0) + kcal;
  });

  // 4. Agrupar por data — soma apenas refeições concluídas
  const diasMap = {};
  refeicoes.forEach((ref) => {
    if (!diasMap[ref.data]) {
      diasMap[ref.data] = { totalKcal: 0, totalRefeicoes: 0, concluidasCount: 0 };
    }
    diasMap[ref.data].totalRefeicoes++;
    if (ref.concluida) {
      diasMap[ref.data].totalKcal += caloriasPorRefeicao[ref.id] || 0;
      diasMap[ref.data].concluidasCount++;
    }
  });

  // 5. Ordenar datas do mais recente para o mais antigo
  const diasOrdenados = Object.keys(diasMap).sort((a, b) => b.localeCompare(a));

  // 6. Montar interface
  container.innerHTML = "";

  diasOrdenados.forEach((data) => {
    const { totalKcal, totalRefeicoes, concluidasCount } = diasMap[data];
    const kcalFormatado = Math.round(totalKcal);
    const porcentagem = Math.min(totalKcal / META_CALORIAS_HISTORICO, 1);
    const dataFormatada = formatarDataBR(data);

    // Cor da barra conforme proximidade da meta
    let corBarra = "#4caf50"; // verde — dentro da meta
    if (porcentagem > 1.05) corBarra = "#ff5252"; // vermelho — acima da meta
    else if (porcentagem > 0.95) corBarra = "#ff9800"; // laranja — próximo

    const linha = document.createElement("div");
    linha.className = "card-dia-refeicao";

    linha.innerHTML = `
      <div class="card-dia-topo">
        <span class="card-dia-data">${dataFormatada}</span>
        <span class="card-dia-kcal" style="color:${corBarra};">${kcalFormatado} kcal</span>
      </div>
      <div class="card-dia-barra-bg">
        <div class="card-dia-barra-fill" style="width:${(porcentagem * 100).toFixed(1)}%; background:${corBarra};"></div>
      </div>
      <div class="card-dia-rodape">
        <span>${concluidasCount} de ${totalRefeicoes} refeições concluídas</span>
        <span>Meta: ${META_CALORIAS_HISTORICO} kcal</span>
      </div>
    `;

    container.appendChild(linha);
  });
}

// ============================================
// NAVEGAÇÃO
// ============================================
function voltar() {
  window.location.href = "index.html";
}

// ============================================
// INICIALIZAÇÃO
// ============================================
document.addEventListener("DOMContentLoaded", () => {
  carregarHistoricoCompleto();
  carregarHistoricoRefeicoes();
});
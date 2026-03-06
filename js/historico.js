// ============================================
// CONSTANTES
// ============================================
const META_PESO = 95;
const META_CALORIAS_HISTORICO = 1900;

const MESES_BR = [
  "Janeiro", "Fevereiro", "Março", "Abril",
  "Maio", "Junho", "Julho", "Agosto",
  "Setembro", "Outubro", "Novembro", "Dezembro"
];

// ============================================
// ESTADO DO SELETOR DE MÊS
// ============================================
const estadoMes = {
  ano:     new Date().getFullYear(),
  mes:     new Date().getMonth() + 1, // 1–12
  diasMap: {},  // cache de todos os dias carregados do banco
};

// ============================================
// UTILITÁRIO DE DATA
// ============================================
function formatarDataBR(dataStr) {
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
  if (!container) return;
  container.innerHTML = "";

  const datas = [];
  const pesos = [];

  data.forEach((registro, index) => {
    const dataFormatada = new Date(registro.created_at).toLocaleDateString("pt-BR");
    datas.push(dataFormatada);
    pesos.push(registro.peso);

    const linha = document.createElement("div");
    linha.className = `linha-historico ${index === data.length - 1 ? "peso-atual" : "peso-antigo"}`;

    const spanData  = document.createElement("span");
    spanData.textContent = dataFormatada;

    const spanPeso  = document.createElement("span");
    spanPeso.textContent = `${registro.peso.toFixed(2)} kg`;

    const btnExcluir = document.createElement("button");
    btnExcluir.className = "btn-excluir-peso";
    btnExcluir.textContent = "🗑️";
    btnExcluir.title = "Excluir registro";
    btnExcluir.onclick = () => {
      abrirModalConfirmacaoHistorico(
        `Excluir o registro de <strong>${registro.peso.toFixed(2)} kg</strong> do dia ${dataFormatada}?`,
        async () => {
          const { error } = await supabaseClient
            .from("pesos")
            .delete()
            .eq("id", registro.id);

          if (error) {
            alert("Erro ao excluir: " + error.message);
            return;
          }
          await carregarHistoricoCompleto();
        }
      );
    };

    linha.appendChild(spanData);
    linha.appendChild(spanPeso);
    linha.appendChild(btnExcluir);
    container.appendChild(linha);
  });

  criarGraficoPeso(datas, pesos);
}

function criarGraficoPeso(datas, pesos) {
  const ctx = document.getElementById("graficoPeso");
  if (!ctx) return;
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

  const primeiro  = pesos[0];
  const ultimo    = pesos[pesos.length - 1];
  const diferenca = (ultimo - primeiro).toFixed(1);
  const resumo    = document.getElementById("resumoPeso");
  if (!resumo) return;

  if (diferenca < 0) {
    resumo.innerHTML   = `↓ ${Math.abs(diferenca)} kg perdidos`;
    resumo.style.color = "#4caf50";
  } else if (diferenca > 0) {
    resumo.innerHTML   = `↑ ${diferenca} kg ganhos`;
    resumo.style.color = "#ff5252";
  } else {
    resumo.innerHTML   = "Peso estável";
    resumo.style.color = "#ffffff";
  }
}

// ============================================
// HISTÓRICO DE REFEIÇÕES — carrega tudo de uma vez e armazena em cache
// ============================================
async function carregarTodosOsDias() {
  const { data: refeicoes, error } = await supabaseClient
    .from("refeicoes")
    .select("id, data, concluida")
    .order("data", { ascending: false });

  if (error || !refeicoes || refeicoes.length === 0) return;

  const ids = refeicoes.map((r) => r.id);

  const { data: itens } = await supabaseClient
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

  // Calorias por refeição
  const caloriasPorRefeicao = {};
  (itens || []).forEach((item) => {
    const base = item.alimentos.tipo_medida === "gramas" ? 100 : 1;
    const kcal = (item.quantidade * item.alimentos.calorias_base) / base;
    caloriasPorRefeicao[item.refeicao_id] = (caloriasPorRefeicao[item.refeicao_id] || 0) + kcal;
  });

  // Agrupar por data no cache
  refeicoes.forEach((ref) => {
    if (!estadoMes.diasMap[ref.data]) {
      estadoMes.diasMap[ref.data] = { totalKcal: 0, totalRefeicoes: 0, concluidasCount: 0 };
    }
    estadoMes.diasMap[ref.data].totalRefeicoes++;
    if (ref.concluida) {
      estadoMes.diasMap[ref.data].totalKcal       += caloriasPorRefeicao[ref.id] || 0;
      estadoMes.diasMap[ref.data].concluidasCount++;
    }
  });
}

// ============================================
// RENDERIZAR MÊS SELECIONADO
// ============================================
function renderizarMesAtual() {
  // Atualizar label do navegador de mês
  const label = document.getElementById("labelMes");
  if (label) label.textContent = `${MESES_BR[estadoMes.mes - 1]} ${estadoMes.ano}`;

  // Atualizar estado do botão "próximo mês" — desabilita se for o mês atual
  const hoje = new Date();
  const btnProximo = document.getElementById("btnProximoMes");
  if (btnProximo) {
    const ehMesAtual = estadoMes.ano === hoje.getFullYear() && estadoMes.mes === hoje.getMonth() + 1;
    btnProximo.disabled = ehMesAtual;
    btnProximo.style.opacity = ehMesAtual ? "0.3" : "1";
  }

  const container = document.getElementById("historicoRefeicoes");
  if (!container) return;
  container.innerHTML = "";

  // Filtrar dias do mês selecionado
  const prefixo    = `${estadoMes.ano}-${String(estadoMes.mes).padStart(2, "0")}`;
  const diasDoMes  = Object.keys(estadoMes.diasMap)
    .filter((d) => d.startsWith(prefixo))
    .sort((a, b) => b.localeCompare(a));

  if (diasDoMes.length === 0) {
    container.innerHTML = `<div class="historico-vazio">Nenhuma refeição registrada em ${MESES_BR[estadoMes.mes - 1]}.</div>`;
    return;
  }

  diasDoMes.forEach((data) => {
    const { totalKcal, totalRefeicoes, concluidasCount } = estadoMes.diasMap[data];
    const kcalFormatado = Math.round(totalKcal);
    const porcentagem   = Math.min(totalKcal / META_CALORIAS_HISTORICO, 1);
    const dataFormatada = formatarDataBR(data);

    let corBarra = "#4caf50";
    if (porcentagem > 1.05)      corBarra = "#ff5252";
    else if (porcentagem > 0.95) corBarra = "#ff9800";

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
// NAVEGAÇÃO DO SELETOR DE MÊS
// ============================================
function mesAnterior() {
  estadoMes.mes--;
  if (estadoMes.mes < 1) {
    estadoMes.mes = 12;
    estadoMes.ano--;
  }
  renderizarMesAtual();
}

function proximoMes() {
  const hoje = new Date();
  if (estadoMes.ano === hoje.getFullYear() && estadoMes.mes === hoje.getMonth() + 1) return;
  estadoMes.mes++;
  if (estadoMes.mes > 12) {
    estadoMes.mes = 1;
    estadoMes.ano++;
  }
  renderizarMesAtual();
}

// ============================================
// MODAL DE CONFIRMAÇÃO — HISTÓRICO DE PESO
// ============================================
function abrirModalConfirmacaoHistorico(mensagem, onConfirmar) {
  document.getElementById("modalConfirmacaoTexto").innerHTML = mensagem;
  document.getElementById("modalConfirmacao").style.display = "flex";

  const btnConfirmar = document.getElementById("btnConfirmarExclusao");
  const btnNovo = btnConfirmar.cloneNode(true);
  btnConfirmar.parentNode.replaceChild(btnNovo, btnConfirmar);

  btnNovo.onclick = async () => {
    fecharModalConfirmacao();
    await onConfirmar();
  };
}

function fecharModalConfirmacao() {
  document.getElementById("modalConfirmacao").style.display = "none";
}

// ============================================
// NAVEGAÇÃO DE PÁGINA
// ============================================
function voltar() {
  window.location.href = "index.html";
}

// ============================================
// INICIALIZAÇÃO
// ============================================
async function iniciarHistoricoRefeicoes() {
  const container = document.getElementById("historicoRefeicoes");
  if (!container) return;
  container.innerHTML = `<div style="color:#aaa; text-align:center; padding:20px;">Carregando...</div>`;
  await carregarTodosOsDias();
  renderizarMesAtual();
}

document.addEventListener("DOMContentLoaded", () => {
  carregarHistoricoCompleto();
  iniciarHistoricoRefeicoes();
});
const metaPeso = 95;
async function carregarHistoricoCompleto() {
  const { data, error } = await supabaseClient
    .from("pesos")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Erro ao carregar histórico:", error);
    return;
  }

  const container = document.getElementById("historicoCompleto");
  container.innerHTML = "";

  const datas = [];
  const pesos = [];

  data.forEach((registro, index) => {
    const dataFormatada = new Date(registro.created_at).toLocaleDateString(
      "pt-BR",
    );

    datas.push(dataFormatada);
    pesos.push(registro.peso);

    const linha = document.createElement("div");
    linha.className = "linha-historico";

    if (index === data.length - 1) {
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

  criarGraficoPeso(datas, pesos);
}

function criarGraficoPeso(datas, pesos) {
  const ctx = document.getElementById("graficoPeso");

  const metaLinha = new Array(datas.length).fill(metaPeso);

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
          pointRadius: (ctx) => {
            return ctx.dataIndex === pesos.length - 1 ? 8 : 4;
          },
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
      animation: {
        duration: 1200,
        easing: "easeOutQuart",
      },

      plugins: {
        legend: {
         display: false,
        },
      },

      scales: {
        y: {
          ticks: {
            color: "white",
          },
          grid: {
            color: "#333",
          },
        },

        x: {
          ticks: {
            color: "white",
          },
          grid: {
            color: "#333",
          },
        },
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
  }
}

function voltar() {
  window.location.href = "index.html";
}

document.addEventListener("DOMContentLoaded", carregarHistoricoCompleto);

let dataVisualizada = null;
const refeicoesPadrao = [
  { key: "cafe", label: "Café da Manhã" },
  { key: "almoco", label: "Almoço" },
  { key: "lanche", label: "Lanche" },
  { key: "jantar", label: "Jantar" },
  { key: "pos", label: "Pós-trabalho" },
];
async function init() {
  await atualizarTituloRefeicoes();
  await carregarUltimoPeso();
  await inicializarRefeicoesPadrao();
  await gerarRefeicoes();
  await atualizarStatus();
  await carregarHistoricoPeso();
  dataVisualizada = await obterDataAtiva();
}

async function obterDataAtiva() {
  const { data, error } = await supabaseClient
    .from("controle_dieta")
    .select("*")
    .eq("encerrado", false)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (error) {
    console.error("Erro ao buscar dia ativo:", error);
    throw error;
  }

  // Se não existir nenhum registro ainda
  if (!data) {
    const hoje = new Date().toLocaleDateString("sv-SE");

    const { data: novoRegistro } = await supabaseClient
      .from("controle_dieta")
      .insert({
        data_ativa: hoje,
        encerrado: false,
      })
      .select()
      .single();

    return novoRegistro.data_ativa;
  }

  return data.data_ativa;
}

async function salvarPeso() {
  const peso = document.getElementById("peso").value;

  if (!peso) {
    alert("Digite um peso válido.");
    return;
  }

  const { data, error } = await supabaseClient
    .from("pesos")
    .insert([{ peso: parseFloat(peso) }]);

  if (error) {
    console.error("Erro ao salvar:", error);
    alert("Erro ao salvar no banco.");
  } else {
    alert("Peso salvo no banco!");
  }
}
async function obterDiaSemana() {
  const hoje = await obterDataEmUso();

  const partes = hoje.split("-");
  const dataObj = new Date(
    Number(partes[0]),
    Number(partes[1]) - 1,
    Number(partes[2])
  );

  const dias = [
    "domingo",
    "segunda",
    "terca",
    "quarta",
    "quinta",
    "sexta",
    "sabado",
  ];

  return dias[dataObj.getDay()];
}
async function gerarRefeicoes() {
  const container = document.getElementById("refeicoes");
  container.innerHTML = "";

  const hoje = await obterDataEmUso();

  // 1️⃣ Buscar refeições do dia
  const { data: refeicoes, error } = await supabaseClient
    .from("refeicoes")
    .select("*")
    .eq("data", hoje);

  if (error) {
    console.error("Erro ao carregar refeições:", error);
    return;
  }

  if (!refeicoes || !refeicoes.length) return;

  // 🔥 Ordenação correta das refeições
  const ordem = ["cafe", "almoco", "lanche", "jantar", "pos"];

  refeicoes.sort((a, b) => {
    return ordem.indexOf(a.tipo_refeicao) - ordem.indexOf(b.tipo_refeicao);
  });

  const ids = refeicoes.map((r) => r.id);

  // 2️⃣ Buscar todos os itens dessas refeições
  const { data: itens, error: erroItens } = await supabaseClient
    .from("refeicao_itens")
    
    .select(
      `
    id,
    quantidade,
    refeicao_id,
    alimento_id,
    alimentos!inner (
      id,
      nome,
      tipo_medida,
      calorias_base
    )
  `,
    )
    .in("refeicao_id", ids);

  // 3️⃣ Agrupar itens por refeição
  const itensPorRefeicao = {};
  let totalDiaCalorias = 0;
  (itens || []).forEach((item) => {
    if (!itensPorRefeicao[item.refeicao_id]) {
      itensPorRefeicao[item.refeicao_id] = [];
    }
    itensPorRefeicao[item.refeicao_id].push(item);
  });

  // 4️⃣ Montar interface
  refeicoes.forEach((refeicao) => {
    const div = document.createElement("div");
    div.className = "refeicao-item";

    const header = document.createElement("div");
    header.className = "refeicao-header";

    // 🔽 Botão seta
    const toggle = document.createElement("span");
    toggle.className = "toggle-icon";
    toggle.textContent = "▼";

    // Nome da refeição
    const nome = document.createElement("span");
    nome.className = "refeicao-nome";
    nome.textContent = refeicao.nome;

    const leftSide = document.createElement("div");
    leftSide.className = "refeicao-left";

    leftSide.appendChild(toggle);
    leftSide.appendChild(nome);

    // Checkbox separado
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = refeicao.concluida;

    checkbox.onchange = async () => {
      await supabaseClient
        .from("refeicoes")
        .update({ concluida: checkbox.checked })
        .eq("id", refeicao.id);

      await atualizarStatus();
      await calcularTotalDia();
    };

    header.appendChild(leftSide);
    header.appendChild(checkbox);

    // 🔽 Container dos alimentos
    const detalhes = document.createElement("div");
    detalhes.className = "refeicao-detalhes";
    detalhes.style.maxHeight = "0px";

    const itensLista = itensPorRefeicao[refeicao.id] || [];

    let totalCalorias = 0;

    itensLista.forEach((item) => {
      const alimento = item.alimentos;

      const base = alimento.tipo_medida === "gramas" ? 100 : 1;
      const caloriasItem = (item.quantidade * alimento.calorias_base) / base;

      totalCalorias += caloriasItem;

      if (refeicao.concluida) {
        totalDiaCalorias += caloriasItem;
      }

      const linha = document.createElement("div");
      linha.className = "item-alimento";

      linha.textContent = `${item.quantidade} ${alimento.tipo_medida} - ${alimento.nome} (${caloriasItem.toFixed(0)} kcal)`;

      detalhes.appendChild(linha);
    });

    // 🔥 Total da refeição
    const totalLinha = document.createElement("div");
    totalLinha.className = "total-refeicao";
    totalLinha.textContent = `Total: ${totalCalorias.toFixed(0)} kcal`;

    detalhes.appendChild(totalLinha);

    // 🔁 Toggle apenas na seta
    toggle.style.cursor = "pointer";
    toggle.onclick = (e) => {
      e.stopPropagation();

      const aberto =
        detalhes.style.maxHeight && detalhes.style.maxHeight !== "0px";

      if (aberto) {
        detalhes.style.maxHeight = "0px";
        toggle.textContent = "▼";
      } else {
        detalhes.style.maxHeight = detalhes.scrollHeight + "px";
        toggle.textContent = "✕";
      }
    };

    div.appendChild(header);
    div.appendChild(detalhes);
    container.appendChild(div);
    // 🔥 Atualizar total do dia
    const totalDiaElemento = document.getElementById("totalDiaCalorias");

    if (totalDiaElemento) {
      totalDiaElemento.textContent = `Total consumido hoje: ${totalDiaCalorias.toFixed(0)} kcal`;
    }
  });
}
function mostrarDataAtual() {
  const hoje = new Date();
  const formatada = hoje.toLocaleDateString("pt-BR");
  document.getElementById("dataAtual").textContent = `Hoje é ${formatada}`;
}

async function obterDataEmUso() {
  if (dataVisualizada) return dataVisualizada;
  return await obterDataAtiva();
}

async function atualizarTituloRefeicoes() {
  const hoje = await obterDataEmUso();

  const partes = hoje.split("-");
  const dataObj = new Date(
    Number(partes[0]),
    Number(partes[1]) - 1,
    Number(partes[2])
  );

  const formatada = dataObj.toLocaleDateString("pt-BR");

  document.getElementById("tituloRefeicoes").textContent =
    `Refeições do dia ${formatada}`;
}

async function atualizarStatus() {
  const hoje = await obterDataEmUso();

  const { data, error } = await supabaseClient
    .from("refeicoes")
    .select("concluida")
    .eq("data", hoje);

  if (error) {
    console.error("Erro ao buscar status:", error);
    return;
  }

  const total = data.length;
  const feitas = data.filter((r) => r.concluida).length;

  const status = document.getElementById("status");
  status.textContent = `Você completou ${feitas} de ${total} refeições hoje.`;

  if (feitas === total && total > 0) {
    status.style.color = "red";
  } else {
    status.style.color = "orange";
  }
}
async function carregarUltimoPeso() {
  const { data, error } = await supabaseClient
    .from("pesos")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1);

  if (error) {
    console.error("Erro ao buscar peso:", error);
    return;
  }

  if (data.length > 0) {
    document.getElementById("peso").value = data[0].peso;
  }
}

async function carregarHistoricoPeso() {
  const { data, error } = await supabaseClient
    .from("pesos")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(2);

  if (error) {
    console.error("Erro ao carregar histórico:", error);
    return;
  }

  const container = document.getElementById("historicoPeso");
  container.innerHTML = "";

  // Cabeçalho
  const header = document.createElement("div");
  header.className = "linha-historico header";
  header.innerHTML = `
    <span>DATA</span>
    <span>PESO</span>
  `;
  container.appendChild(header);

  data.forEach((registro, index) => {
    const dataFormatada = new Date(registro.created_at).toLocaleDateString(
      "pt-BR",
    );

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

function irParaHistorico() {
  window.location.href = "historico.html";
}

async function inicializarRefeicoesPadrao() {
  const hoje = await obterDataEmUso();
  const diaSemana = await obterDiaSemana();

  const { data, error } = await supabaseClient
    .from("refeicoes")
    .select("id")
    .eq("data", hoje);

  if (error) {
    console.error("Erro ao verificar refeições do dia:", error);
    return;
  }

  if (data.length === 0) {
    // 1️⃣ Criar refeições do dia
    const registros = refeicoesPadrao.map((item) => ({
      nome: item.label,
      tipo_refeicao: item.key,
      concluida: false,
      data: hoje,
    }));

    const { data: refeicoesCriadas, error: erroInsert } = await supabaseClient
      .from("refeicoes")
      .insert(registros)
      .select();

    if (erroInsert) {
      console.error("Erro ao criar refeições:", erroInsert);
      return;
    }

    // 2️⃣ Criar itens das refeições com base no plano

    const planoDia = planoSemanal[semanaAtual][diaSemana];
  
    if (!planoDia) {
      return;
    }

    for (const refeicao of refeicoesCriadas) {
      const itensPlano = planoDia[refeicao.tipo_refeicao];

      if (!itensPlano) continue;

      for (const itemPlano of itensPlano) {

        const { data: alimento } = await supabaseClient
          .from("alimentos")
          .select("id")
          .eq("nome", itemPlano.nome)
          .maybeSingle();

        if (!alimento) {
          continue;
        }

        await supabaseClient.from("refeicao_itens").insert({
          refeicao_id: refeicao.id,
          alimento_id: alimento.id,
          quantidade: itemPlano.quantidade,
        });
      }
    }
  }
}
async function calcularTotalDia() {
  const hoje = await obterDataEmUso();

  const { data: refeicoes } = await supabaseClient
    .from("refeicoes")
    .select("id, concluida")
    .eq("data", hoje);

  const idsConcluidas = refeicoes.filter((r) => r.concluida).map((r) => r.id);

  if (!idsConcluidas.length) {
    document.getElementById("totalDiaCalorias").textContent =
      "Total consumido hoje: 0 kcal";
    return;
  }

  const { data: itens } = await supabaseClient
    .from("refeicao_itens")
    .select(
      `
      quantidade,
      refeicao_id,
      alimentos!inner (
        tipo_medida,
        calorias_base
      )
    `,
    )
    .in("refeicao_id", idsConcluidas);

  let total = 0;

  (itens || []).forEach((item) => {
    const alimento = item.alimentos;
    const base = alimento.tipo_medida === "gramas" ? 100 : 1;
    total += (item.quantidade * alimento.calorias_base) / base;
  });

  document.getElementById("totalDiaCalorias").textContent =
    `Total consumido hoje: ${total.toFixed(0)} kcal`;
}

function irParaHistoricoRefeicoes() {
  window.location.href = "refeicoes.html";
}

async function encerrarDia() {
  const confirmar = confirm("Deseja encerrar o dia atual?");
  if (!confirmar) return;

 const hoje = await obterDataAtiva();

  // 1️⃣ Marcar o dia atual como encerrado
  await supabaseClient
    .from("controle_dieta")
    .update({ encerrado: true })
    .eq("data_ativa", hoje);

  // 2️⃣ Calcular próximo dia
  const dataObj = new Date(hoje);
  dataObj.setDate(dataObj.getDate() + 1);

  const proximoDia = dataObj.toLocaleDateString("sv-SE");

  // 3️⃣ Criar novo registro ativo
  await supabaseClient.from("controle_dieta").insert({
    data_ativa: proximoDia,
    encerrado: false,
  });

  alert("Dia encerrado. Novo dia iniciado.");

  // 4️⃣ Recarregar sistema
  await inicializarRefeicoesPadrao();
  await gerarRefeicoes();
  await atualizarStatus();
  await calcularTotalDia();
}

function alterarDia(direcao) {
  if (!dataVisualizada) return;

  const partes = dataVisualizada.split("-");
  const dataObj = new Date(
    Number(partes[0]),
    Number(partes[1]) - 1,
    Number(partes[2])
  );

  dataObj.setDate(dataObj.getDate() + direcao);

  dataVisualizada = dataObj.toLocaleDateString("sv-SE");

  atualizarTela();
}

async function atualizarTela() {
  await atualizarTituloRefeicoes();
  await gerarRefeicoes();
  await atualizarStatus();
  await calcularTotalDia();
}

window.onload = init;

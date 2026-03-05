const metaCalorias = 1900;
let navegando = false;
let dataVisualizada = null;
const refeicoesPadrao = [
  { key: "cafe", label: "Café da Manhã" },
  { key: "almoco", label: "Almoço" },
  { key: "lanche", label: "Lanche" },
  { key: "jantar", label: "Jantar" },
  { key: "pos", label: "Pós-trabalho" },
];
async function init() {
  dataVisualizada = await obterDataAtiva();

  await atualizarTituloRefeicoes();
  await carregarUltimoPeso();
  await inicializarRefeicoesPadrao();
  await gerarRefeicoes();
  await atualizarStatus();
  await calcularTotalDia();
  await carregarHistoricoPeso();
}

async function obterDataAtiva() {
  const { data, error } = await supabaseClient
    .from("controle_dieta")
    .select("*")
    .eq("encerrado", false)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

if (error) {
  console.error("Erro ao buscar dia ativo:", error);
  return null;
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
    Number(partes[2]),
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

  // 3️⃣ Buscar equivalências
  const { data: equivalencias } = await supabaseClient
    .from("equivalencias")
    .select("*");

  // Criar mapa de equivalências por alimento_id
  const mapaEquivalencias = {};
  (equivalencias || []).forEach(equiv => {
    mapaEquivalencias[equiv.alimento_id] = {
      gramasPorUnidade: equiv.gramas_por_unidade,
      descricao: equiv.descricao_unidade
    };
  });

  // 4️⃣ Agrupar itens por refeição
  const itensPorRefeicao = {};
  let totalDiaCalorias = 0;
  (itens || []).forEach((item) => {
    if (!itensPorRefeicao[item.refeicao_id]) {
      itensPorRefeicao[item.refeicao_id] = [];
    }
    itensPorRefeicao[item.refeicao_id].push(item);
  });

  // 5️⃣ Montar interface
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

      // Container flexível para alinhar tudo
      const conteudoLinha = document.createElement("div");
      conteudoLinha.style.display = "flex";
      conteudoLinha.style.alignItems = "center";
      conteudoLinha.style.width = "100%";
      conteudoLinha.style.gap = "8px";

      // Texto do alimento
      const textoAlimento = document.createElement("span");
      textoAlimento.textContent = `${item.quantidade} ${alimento.tipo_medida} - ${alimento.nome} (${caloriasItem.toFixed(0)} kcal)`;
      textoAlimento.style.flex = "1"; // Ocupa o espaço disponível

      conteudoLinha.appendChild(textoAlimento);

      // Verificar se tem equivalência
      const equiv = mapaEquivalencias[alimento.id];
      
      // Botão de equivalência (se tiver e for em gramas)
      if (equiv && alimento.tipo_medida === "gramas") {
        const toggleEquivBtn = document.createElement("button");
        toggleEquivBtn.className = "btn-equivalencia";
        toggleEquivBtn.textContent = "⚖️";
        toggleEquivBtn.title = "Mostrar em unidades";
        toggleEquivBtn.style.background = "none";
        toggleEquivBtn.style.border = "none";
        toggleEquivBtn.style.cursor = "pointer";
        toggleEquivBtn.style.fontSize = "18px";
        toggleEquivBtn.style.padding = "0";
        toggleEquivBtn.style.width = "24px";
        toggleEquivBtn.style.height = "24px";
        toggleEquivBtn.style.display = "flex";
        toggleEquivBtn.style.alignItems = "center";
        toggleEquivBtn.style.justifyContent = "center";
        
        // Estado: false = mostrando gramas, true = mostrando unidades
        let mostrandoUnidades = false;
        
        toggleEquivBtn.onclick = (e) => {
          e.stopPropagation();
          
          if (!mostrandoUnidades) {
            // Calcular unidades aproximadas
            const unidades = item.quantidade / equiv.gramasPorUnidade;
            const unidadesFormatadas = unidades.toFixed(1).replace('.0', '');
            const textoUnidades = `${unidadesFormatadas} ${unidades === 1 ? 'unidade' : 'unidades'}`;
            
            textoAlimento.textContent = `${textoUnidades} - ${alimento.nome} (${caloriasItem.toFixed(0)} kcal)`;
            toggleEquivBtn.textContent = "📏";
            toggleEquivBtn.title = "Mostrar em gramas";
          } else {
            textoAlimento.textContent = `${item.quantidade} ${alimento.tipo_medida} - ${alimento.nome} (${caloriasItem.toFixed(0)} kcal)`;
            toggleEquivBtn.textContent = "⚖️";
            toggleEquivBtn.title = "Mostrar em unidades";
          }
          
          mostrandoUnidades = !mostrandoUnidades;
        };
        
        conteudoLinha.appendChild(toggleEquivBtn);
      }

      // Botão de trocar
      const botaoTrocar = document.createElement("button");
      botaoTrocar.className = "btn-trocar";
      botaoTrocar.textContent = "🔁";
      botaoTrocar.style.width = "24px";
      botaoTrocar.style.height = "24px";
      botaoTrocar.style.padding = "0";
      botaoTrocar.style.display = "flex";
      botaoTrocar.style.alignItems = "center";
      botaoTrocar.style.justifyContent = "center";
      botaoTrocar.addEventListener("click", () => {
        iniciarSubstituicao(item.id);
      });

      conteudoLinha.appendChild(botaoTrocar);
      linha.appendChild(conteudoLinha);
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
    Number(partes[2]),
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

  console.log("=== INICIANDO CRIAÇÃO DE REFEIÇÕES ===");
  console.log("Data:", hoje);
  console.log("Dia da semana:", diaSemana);

  const { data, error } = await supabaseClient
    .from("refeicoes")
    .select("id")
    .eq("data", hoje);

  if (error) {
    console.error("Erro ao verificar refeições do dia:", error);
    return;
  }

  if (data.length === 0) {
    console.log("Nenhuma refeição encontrada para hoje. Criando...");
    
    // 1️⃣ Criar refeições do dia
    const registros = refeicoesPadrao.map((item) => ({
      nome: item.label,
      tipo_refeicao: item.key,
      concluida: false,
      data: hoje,
    }));

    console.log("Registros a serem criados:", registros);

    const { data: refeicoesCriadas, error: erroInsert } = await supabaseClient
      .from("refeicoes")
      .insert(registros)
      .select();

    if (erroInsert) {
      console.error("Erro ao criar refeições:", erroInsert);
      return;
    }

    console.log("Refeições criadas:", refeicoesCriadas);

    // 2️⃣ Calcular a semana atual
    const semanaAtual = calcularSemanaAtual();
    console.log("Semana atual:", semanaAtual);
    
    // 3️⃣ Buscar o plano do dia
    const planoDia = planoSemanal[semanaAtual]?.[diaSemana];
    console.log("Plano do dia:", planoDia);

    if (!planoDia) {
      console.log(`Sem plano para ${diaSemana} na semana ${semanaAtual}`);
      return;
    }

    // 4️⃣ Mapeamento de peso por unidade para alimentos em gramas
    const pesoPorUnidade = {
      "Banana": 100,
      "Mamão": 300,
      "Pera": 150,
      "Maçã": 150,
      "Laranja": 150,
      "Ovo": 50,
      "Clara de ovo": 35
    };

    // 5️⃣ Criar itens das refeições com base no plano
    for (const refeicao of refeicoesCriadas) {
      console.log(`\n--- Processando refeição: ${refeicao.nome} (${refeicao.tipo_refeicao}) ---`);
      
      const itensPlano = planoDia[refeicao.tipo_refeicao];
      console.log("Itens do plano:", itensPlano);

      if (!itensPlano) continue;

      for (const itemPlano of itensPlano) {
        console.log(`\n▶ Processando item: ${itemPlano.nome} - ${itemPlano.quantidade} unidades`);

        // Buscar alimento completo
        const { data: alimento } = await supabaseClient
          .from("alimentos")
          .select("*")
          .eq("nome", itemPlano.nome)
          .maybeSingle();

        if (!alimento) {
          console.log(`❌ Alimento não encontrado: ${itemPlano.nome}`);
          continue;
        }

        console.log("Alimento encontrado no banco:", {
          nome: alimento.nome,
          tipo_medida: alimento.tipo_medida,
          calorias_base: alimento.calorias_base
        });

        // Calcular quantidade correta
        let quantidadeCorreta = itemPlano.quantidade;
        
        // Se o alimento é em gramas mas veio como unidade no plano
        if (alimento.tipo_medida === "gramas") {
          console.log(`Alimento é do tipo "gramas". Verificando se tem peso por unidade...`);
          
          if (pesoPorUnidade[alimento.nome]) {
            quantidadeCorreta = itemPlano.quantidade * pesoPorUnidade[alimento.nome];
            console.log(`✅ Convertendo ${itemPlano.quantidade} ${alimento.nome}(s) para ${quantidadeCorreta}g`);
          } else {
            console.log(`⚠️  Alimento ${alimento.nome} não tem peso por unidade definido!`);
          }
        } else {
          console.log(`Alimento é do tipo "${alimento.tipo_medida}", mantendo quantidade ${quantidadeCorreta}`);
        }

        // Inserir item
        console.log(`Inserindo: refeicao_id=${refeicao.id}, alimento_id=${alimento.id}, quantidade=${quantidadeCorreta}`);
        
        await supabaseClient.from("refeicao_itens").insert({
          refeicao_id: refeicao.id,
          alimento_id: alimento.id,
          quantidade: quantidadeCorreta,
        });
      }
    }
    
    console.log("\n=== CRIAÇÃO FINALIZADA ===");
  } else {
    console.log(`Já existem ${data.length} refeições para hoje. Nada será criado.`);
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
    document.getElementById("caloriasNumero").textContent = "0";

    const circulo = document.querySelector(".calorias-circulo");
    circulo.style.background = `
    conic-gradient(
      #4caf50 0deg,
      #2a2a2a 0deg
    )
  `;

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

  const totalElemento = document.getElementById("totalDiaCalorias");

  if (totalElemento) {
    totalElemento.textContent = `Total consumido hoje: ${total.toFixed(0)} kcal`;
  }
  document.getElementById("caloriasNumero").textContent = total.toFixed(0);
  const progresso = Math.min(total / metaCalorias, 1);
  const graus = progresso * 360;

  const circulo = document.querySelector(".calorias-circulo");

  circulo.style.background = `
conic-gradient(
#4caf50 ${graus}deg,
#2a2a2a ${graus}deg
)
`;
}

function irParaHistoricoRefeicoes() {
  window.location.href = "refeicoes.html";
}

async function encerrarDia() {
  const confirmar = confirm("Deseja encerrar o dia atual?");
  if (!confirmar) return;

  // Usar dataVisualizada em vez de obterDataAtiva()
  const hoje = dataVisualizada;

  if (!hoje) {
    console.error("Nenhum dia visualizado para encerrar");
    return;
  }

  // encerrar dia atual
  const { error: updateError } = await supabaseClient
    .from("controle_dieta")
    .update({ encerrado: true })
    .eq("data_ativa", hoje);

  if (updateError) {
    console.error("Erro ao encerrar dia:", updateError);
    alert("Erro ao encerrar o dia. Tente novamente.");
    return;
  }

  // calcular próximo dia
  const dataObj = new Date(hoje + "T12:00:00"); // Adiciona horário para evitar problemas de fuso
  dataObj.setDate(dataObj.getDate() + 1);
  const proximoDia = dataObj.toLocaleDateString("sv-SE");

  // criar novo dia
  const { error: insertError } = await supabaseClient
    .from("controle_dieta")
    .insert({
      data_ativa: proximoDia,
      encerrado: false
    });

  if (insertError) {
    console.error("Erro ao criar novo dia:", insertError);
    alert("Erro ao criar novo dia. O dia atual foi encerrado mas o próximo não foi criado.");
    return;
  }

  // atualizar estado local
  dataVisualizada = proximoDia;

  // garantir plano do novo dia
  await garantirPlanoDoDia(proximoDia);

  // atualizar tela inteira
  await atualizarTituloRefeicoes();
  await gerarRefeicoes();
  await atualizarStatus();
  await calcularTotalDia();
  await atualizarIndicadorDia();

  alert("Dia encerrado. Novo dia iniciado.");
}

async function alterarDia(direcao) {
  if (navegando) return;

  navegando = true;

  try {
    const partes = dataVisualizada.split("-");
    const dataObj = new Date(
      Number(partes[0]),
      Number(partes[1]) - 1,
      Number(partes[2]),
    );

    dataObj.setDate(dataObj.getDate() + direcao);

    const novaData = dataObj.toLocaleDateString("sv-SE");

    dataVisualizada = novaData;

    await garantirPlanoDoDia(novaData);
    await atualizarTela();
    await atualizarIndicadorDia();
  } finally {
    navegando = false;
  }
}

async function atualizarTela() {
  const container = document.getElementById("refeicoes");

  container.classList.add("fade-out");

  await new Promise((resolve) => setTimeout(resolve, 200));

  await atualizarTituloRefeicoes();
  await gerarRefeicoes();
  await atualizarStatus();
  await calcularTotalDia();

  container.classList.remove("fade-out");
}
async function garantirPlanoDoDia(data) {
  const { data: refeicoes } = await supabaseClient
    .from("refeicoes")
    .select("id")
    .eq("data", data);

  if (refeicoes && refeicoes.length >= refeicoesPadrao.length) return;

  // Criar plano se não existir
  const diaSemana = await obterDiaSemanaPorData(data);

  const registros = refeicoesPadrao.map((item) => ({
    nome: item.label,
    tipo_refeicao: item.key,
    concluida: false,
    data: data,
  }));

  const { data: refeicoesCriadas } = await supabaseClient
    .from("refeicoes")
    .insert(registros)
    .select();

  const planoDia = planoSemanal[semanaAtual][diaSemana];
  if (!planoDia) return;

  for (const refeicao of refeicoesCriadas) {
    const itensPlano = planoDia[refeicao.tipo_refeicao];
    if (!itensPlano) continue;

    for (const itemPlano of itensPlano) {
      const { data: alimento } = await supabaseClient
        .from("alimentos")
        .select("id")
        .eq("nome", itemPlano.nome)
        .maybeSingle();

      if (!alimento) continue;

      await supabaseClient.from("refeicao_itens").insert({
        refeicao_id: refeicao.id,
        alimento_id: alimento.id,
        quantidade: itemPlano.quantidade,
      });
    }
  }
}
async function atualizarIndicadorDia() {
  const dataAtiva = await obterDataAtiva();
  const titulo = document.getElementById("tituloRefeicoes");

  if (dataVisualizada !== dataAtiva) {
    titulo.style.color = "#888";
  } else {
    titulo.style.color = "";
  }
}
async function voltarParaHoje() {
  dataVisualizada = await obterDataAtiva();
  await atualizarTela();
  atualizarIndicadorDia();
}

function obterDiaSemanaPorData(dataStr) {
  const partes = dataStr.split("-");
  const dataObj = new Date(
    Number(partes[0]),
    Number(partes[1]) - 1,
    Number(partes[2]),
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
function calcularCalorias(quantidade, caloriasBase, tipoMedida) {
  const base = tipoMedida === "gramas" ? 100 : 1;
  return (quantidade * caloriasBase) / base;
}
function calcularSubstituicao(caloriasAlvo, caloriasBase, tipoMedida) {

  const base = tipoMedida === "gramas" ? 100 : 1;

  const quantidade = (caloriasAlvo * base) / caloriasBase;

  return Math.round(quantidade);

}
async function iniciarSubstituicao(itemId) {

  // 1️⃣ Buscar item da refeição
  const { data: item, error: erroItem } = await supabaseClient
    .from("refeicao_itens")
    .select("id, quantidade, alimento_id")
    .eq("id", itemId)
    .single();

  if (erroItem || !item) {
    console.error("Erro ao buscar item:", erroItem);
    return;
  }

  // 2️⃣ Buscar alimento original
  const { data: alimentoOriginal, error: erroAlimento } = await supabaseClient
    .from("alimentos")
    .select("*")
    .eq("id", item.alimento_id)
    .single();

  if (erroAlimento || !alimentoOriginal) {
    console.error("Erro ao buscar alimento:", erroAlimento);
    return;
  }

  // 3️⃣ Calcular calorias do item atual
if (!alimentoOriginal) {
  alert("Erro ao encontrar alimento original.");
  return;
}

const caloriasItem = calcularCalorias(
  item.quantidade,
  alimentoOriginal.calorias_base,
  alimentoOriginal.tipo_medida
);

  // 4️⃣ Buscar todos os alimentos disponíveis
  const { data: alimentos } = await supabaseClient
    .from("alimentos")
    .select("*");

  if (!alimentos) return;

  // 5️⃣ Montar lista para o prompt
  let lista = "Escolha substituição:\n\n";

  alimentos.forEach((a) => {
    const novaQuantidade = calcularSubstituicao(
      caloriasItem,
      a.calorias_base,
      a.tipo_medida
    );

    lista += `${a.id} - ${a.nome} (${novaQuantidade} ${a.tipo_medida})\n`;
  });

  const escolha = prompt(lista);

  if (!escolha) return;

  const alimentoEscolhido = alimentos.find((a) => a.id == escolha);

  if (!alimentoEscolhido) {
    alert("Alimento inválido.");
    return;
  }

  // 6️⃣ Calcular nova quantidade equivalente
  const novaQuantidade = calcularSubstituicao(
    caloriasItem,
    alimentoEscolhido.calorias_base,
    alimentoEscolhido.tipo_medida
  );

  // 7️⃣ Atualizar banco
  await supabaseClient
    .from("refeicao_itens")
    .update({
      alimento_id: alimentoEscolhido.id,
      quantidade: novaQuantidade
    })
    .eq("id", itemId);

  // 8️⃣ Atualizar interface
  await gerarRefeicoes();
  await calcularTotalDia();
}

window.onload = init;

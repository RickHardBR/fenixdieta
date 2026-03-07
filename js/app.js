async function verificarLogin() {

  const { data: { session } } = await supabaseClient.auth.getSession();

  if (!session) {
    window.location.href = "login.html";
    return;
  }

}

const META_CALORIAS = 1900;

const REFEICOES_PADRAO = [
  { key: "cafe",   label: "Café da Manhã" },
  { key: "almoco", label: "Almoço"        },
  { key: "lanche", label: "Lanche"        },
  { key: "jantar", label: "Jantar"        },
  { key: "pos",    label: "Pós-trabalho"  },
];

const ORDEM_REFEICOES = ["cafe", "almoco", "lanche", "jantar", "pos"];

const PESO_POR_UNIDADE = {
  "Banana":       100,
  "Mamão":        300,
  "Pera":         150,
  "Maçã":         150,
  "Laranja":      150,
  "Ovo":           50,
  "Clara de ovo":  35,
};

function dataHojeLocal() {
  const d = new Date();
  const ano = d.getFullYear();
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

function proximoDiaLocal(dataStr) {
  const [ano, mes, dia] = dataStr.split("-").map(Number);
  const d = new Date(ano, mes - 1, dia);
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ============================================
// ESTADO DA APLICAÇÃO
// ============================================
const estado = {
  usuario: null,

  dataVisualizada:       null,
  navegando:             false,

  substituicao: {
    emAndamento:         false,
    itemId:              null,
    refeicaoId:          null,
    caloriasOriginal:    0,
    alimentoOriginalObj: null,
  },
};

// ============================================
// INICIALIZAÇÃO
// ============================================
async function init() {

  await verificarLogin();

  const { data: { user } } = await supabaseClient.auth.getUser();

  estado.usuario = user;

  if (!estado.usuario) {
    window.location.href = "login.html";
    return;
  }

  estado.dataVisualizada = await obterDataAtiva();

  await atualizarTituloRefeicoes();
  await carregarUltimoPeso();
  await inicializarRefeicoesPadrao();
  await gerarRefeicoes();
  await atualizarStatus();
  await calcularTotalDia();
  await carregarHistoricoPeso();
}

// ============================================
// DATA ATIVA
// ============================================
async function obterDataAtiva() {
  let { data, error } = await supabaseClient
    .from("controle_dieta")
    .select("*")
    .eq("user_id", estado.usuario.id)
    .eq("encerrado", false)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Erro ao buscar dia ativo:", error);
    return null;
  }

  const hoje = dataHojeLocal();

  // Registro ativo encontrado mas é de um dia passado?
  // Isso acontece se o usuário não encerrou o dia manualmente.
  // Nesse caso: encerra o dia antigo automaticamente e avança para hoje.
  if (data && data.data_ativa < hoje) {
    console.warn(`Dia ativo desatualizado (${data.data_ativa}), avançando para hoje (${hoje}).`);

    // Encerra o dia atrasado
    await supabaseClient
      .from("controle_dieta")
      .update({ encerrado: true })
      .eq("id", data.id);

    // Zera o "data" para cair no bloco de criação abaixo
    data = null;
  }

  if (!data) {
    // Verificar se já existe um registro para hoje (evita duplicata)
    const { data: jaExiste } = await supabaseClient
      .from("controle_dieta")
      .select("data_ativa")
      .eq("user_id", estado.usuario.id)
      .eq("data_ativa", hoje)
      .maybeSingle();

    if (jaExiste) {
      // Já existe mas estava encerrado — reabre
      await supabaseClient
        .from("controle_dieta")
        .update({ encerrado: false })
        .eq("user_id", estado.usuario.id)
        .eq("data_ativa", hoje);
      return hoje;
    }

    const { data: novoRegistro, error: insertError } = await supabaseClient
      .from("controle_dieta")
      .insert({
        data_ativa: hoje,
        encerrado: false,
        user_id: estado.usuario.id
      })
      .select()
      .single();

    if (insertError || !novoRegistro) {
      console.error("Erro ao criar dia ativo:", insertError);
      return null;
    }

    return novoRegistro.data_ativa;
  }

  return data.data_ativa;
}

async function obterDataEmUso() {
  if (estado.dataVisualizada) return estado.dataVisualizada;
  return await obterDataAtiva();
}

// ============================================
// UTILITÁRIOS DE DATA
// ============================================
function obterDiaSemanaPorData(dataStr) {
  const [ano, mes, dia] = dataStr.split("-").map(Number);
  const dataObj = new Date(ano, mes - 1, dia);
  const dias = ["domingo", "segunda", "terca", "quarta", "quinta", "sexta", "sabado"];
  return dias[dataObj.getDay()];
}

async function obterDiaSemana() {
  const hoje = await obterDataEmUso();
  return obterDiaSemanaPorData(hoje);
}

// ============================================
// CÁLCULO DE CALORIAS
// ============================================
function calcularCalorias(quantidade, caloriasBase, tipoMedida) {
  const base = tipoMedida === "gramas" ? 100 : 1;
  return (quantidade * caloriasBase) / base;
}

function calcularSubstituicao(caloriasAlvo, caloriasBase, tipoMedida) {
  const base = tipoMedida === "gramas" ? 100 : 1;
  return Math.round((caloriasAlvo * base) / caloriasBase);
}

// ============================================
// PESO
// ============================================
async function salvarPeso() {
  const peso = document.getElementById("peso").value;

  if (!peso) {
    alert("Digite um peso válido.");
    return;
  }

  // 🔒 proteção de usuário
  if (!estado.usuario) {
    alert("Usuário não autenticado.");
    return;
  }

  const { error } = await supabaseClient
    .from("pesos")
    .insert([{
      peso: parseFloat(peso),
      user_id: estado.usuario.id
    }]);

  if (error) {
    console.error("Erro ao salvar peso:", error);
    alert("Erro ao salvar no banco.");
  } else {
    alert("Peso salvo no banco!");

    await carregarUltimoPeso();
await carregarHistoricoPeso();
  }
}

async function carregarUltimoPeso() {

  if (!estado.usuario) return;

  const { data, error } = await supabaseClient
    .from("pesos")
    .select("*")
    .eq("user_id", estado.usuario.id)
    .order("created_at", { ascending: false })
    .limit(1);

  if (error) {
    console.error("Erro ao buscar peso:", error);
    return;
  }

  if (data && data.length > 0) {
    document.getElementById("peso").value = data[0].peso;
  }
}

async function carregarHistoricoPeso() {

  if (!estado.usuario) return;

  const { data, error } = await supabaseClient
    .from("pesos")
    .select("*")
    .eq("user_id", estado.usuario.id)
    .order("created_at", { ascending: false })
    .limit(2);

  if (error) {
    console.error("Erro ao carregar histórico de peso:", error);
    return;
  }

  const container = document.getElementById("historicoPeso");
  container.innerHTML = "";

  const header = document.createElement("div");
  header.className = "linha-historico header";
  header.innerHTML = `<span>DATA</span><span>PESO</span>`;
  container.appendChild(header);

  (data || []).forEach((registro, index) => {
    const dataFormatada = new Date(registro.created_at).toLocaleDateString("pt-BR");

    const linha = document.createElement("div");
    linha.className = `linha-historico ${index === 0 ? "peso-atual" : "peso-antigo"}`;
    linha.innerHTML = `<span>${dataFormatada}</span><span>${registro.peso.toFixed(2)} kg</span>`;

    container.appendChild(linha);
  });
}

// ============================================
// REFEIÇÕES — GERAÇÃO DE INTERFACE
// ============================================
async function gerarRefeicoes() {

  const container = document.getElementById("refeicoes");
  container.innerHTML = "";

  const hoje = await obterDataEmUso();

  // 1. Buscar refeições do dia
const { data: refeicoes, error } = await supabaseClient
  .from("refeicoes")
  .select("*")
  .eq("data", hoje)
  .eq("user_id", estado.usuario.id);

  if (error) {
    console.error("Erro ao carregar refeições:", error);
    return;
  }

  if (!refeicoes || !refeicoes.length) return;

  refeicoes.sort((a, b) =>
    ORDEM_REFEICOES.indexOf(a.tipo_refeicao) - ORDEM_REFEICOES.indexOf(b.tipo_refeicao)
  );

  const ids = refeicoes.map((r) => r.id);

  // 2. Buscar itens das refeições
  const { data: itens, error: erroItens } = await supabaseClient
    .from("refeicao_itens")
    .select(`
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
    `)
    .in("refeicao_id", ids);

  if (erroItens) {
    console.error("Erro ao carregar itens:", erroItens);
    return;
  }

  // 3. Buscar equivalências
  const { data: equivalencias } = await supabaseClient
    .from("equivalencias")
    .select("*");

  const mapaEquivalencias = {};
  (equivalencias || []).forEach((equiv) => {
    mapaEquivalencias[equiv.alimento_id] = {
      gramasPorUnidade: equiv.gramas_por_unidade,
      descricao:        equiv.descricao_unidade,
    };
  });

  // 4. Agrupar itens por refeição
  const itensPorRefeicao = {};
  (itens || []).forEach((item) => {
    if (!itensPorRefeicao[item.refeicao_id]) {
      itensPorRefeicao[item.refeicao_id] = [];
    }
    itensPorRefeicao[item.refeicao_id].push(item);
  });

  // 5. Montar interface
  refeicoes.forEach((refeicao) => {
    const div = document.createElement("div");
    div.className = "refeicao-item";

    // Header
    const header = document.createElement("div");
    header.className = "refeicao-header";

    const toggle = document.createElement("span");
    toggle.className = "toggle-icon";
    toggle.textContent = "▼";

    const nomeEl = document.createElement("span");
    nomeEl.className = "refeicao-nome";
    nomeEl.textContent = refeicao.nome;

    const leftSide = document.createElement("div");
    leftSide.className = "refeicao-left";
    leftSide.appendChild(toggle);
    leftSide.appendChild(nomeEl);

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = refeicao.concluida;
    checkbox.onchange = async () => {
      await supabaseClient
        .from("refeicoes")
        .update({ concluida: checkbox.checked })
        .eq("id", refeicao.id)
        .eq("user_id", estado.usuario.id);
      await atualizarStatus();
      await calcularTotalDia();
    };

    header.appendChild(leftSide);
    header.appendChild(checkbox);

    // Detalhes (lista de alimentos)
    const detalhes = document.createElement("div");
    detalhes.className = "refeicao-detalhes";
    detalhes.style.maxHeight = "0px";

    const itensLista = itensPorRefeicao[refeicao.id] || [];
    let totalCalorias = 0;

    itensLista.forEach((item) => {
      const alimento = item.alimentos;
      const caloriasItem = calcularCalorias(item.quantidade, alimento.calorias_base, alimento.tipo_medida);
      totalCalorias += caloriasItem;

      const linha = document.createElement("div");
      linha.className = "item-alimento";

      const conteudoLinha = document.createElement("div");
      conteudoLinha.style.cssText = "display:flex; align-items:center; width:100%; gap:8px;";

      // Texto do alimento
      const textoAlimento = document.createElement("span");
      textoAlimento.textContent = `${item.quantidade} ${alimento.tipo_medida} - ${alimento.nome} (${caloriasItem.toFixed(0)} kcal)`;
      textoAlimento.style.flex = "1";
      conteudoLinha.appendChild(textoAlimento);

      // Botão de equivalência (se aplicável)
      const equiv = mapaEquivalencias[alimento.id];
      if (equiv && alimento.tipo_medida === "gramas") {
        const toggleEquivBtn = document.createElement("button");
        toggleEquivBtn.className = "btn-equivalencia";
        toggleEquivBtn.textContent = "⚖️";
        toggleEquivBtn.title = "Mostrar em unidades";
        toggleEquivBtn.style.cssText =
          "background:none; border:none; cursor:pointer; font-size:18px; padding:0; width:24px; height:24px; display:flex; align-items:center; justify-content:center;";

        let mostrandoUnidades = false;
        toggleEquivBtn.onclick = (e) => {
          e.stopPropagation();
          if (!mostrandoUnidades) {
            const unidades = item.quantidade / equiv.gramasPorUnidade;
            const unidadesFormatadas = unidades.toFixed(1).replace(".0", "");
            const label = Number(unidadesFormatadas) === 1 ? "unidade" : "unidades";
            textoAlimento.textContent = `${unidadesFormatadas} ${label} - ${alimento.nome} (${caloriasItem.toFixed(0)} kcal)`;
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

      // Botão de substituição — captura o ID correto por closure
      const itemId = String(item.id);
      const botaoTrocar = document.createElement("button");
      botaoTrocar.className = "btn-trocar";
      botaoTrocar.textContent = "🔁";
      botaoTrocar.style.cssText =
        "width:24px; height:24px; padding:0; display:flex; align-items:center; justify-content:center; cursor:pointer;";
      botaoTrocar.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        iniciarSubstituicao(itemId);
      };
      conteudoLinha.appendChild(botaoTrocar);

      // Botão excluir item
      const botaoExcluir = document.createElement("button");
      botaoExcluir.className = "btn-excluir";
      botaoExcluir.textContent = "🗑️";
      botaoExcluir.style.cssText =
        "width:24px; height:24px; padding:0; display:flex; align-items:center; justify-content:center; cursor:pointer;";
      botaoExcluir.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        abrirModalConfirmacao(
          `Excluir <strong>${alimento.nome}</strong> desta refeição?`,
          async () => {
            await excluirItemRefeicao(itemId);
          }
        );
      };
      conteudoLinha.appendChild(botaoExcluir);

      linha.appendChild(conteudoLinha);
      detalhes.appendChild(linha);
    });

    // Total da refeição
    const totalLinha = document.createElement("div");
    totalLinha.className = "total-refeicao";
    totalLinha.textContent = `Total: ${totalCalorias.toFixed(0)} kcal`;
    detalhes.appendChild(totalLinha);

    // Toggle — apenas na seta
    toggle.style.cursor = "pointer";
    toggle.onclick = (e) => {
      e.stopPropagation();
      const aberto = detalhes.style.maxHeight && detalhes.style.maxHeight !== "0px";
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
  });
}

// ============================================
// STATUS E TOTAIS
// ============================================
async function atualizarTituloRefeicoes() {
  const hoje = await obterDataEmUso();
  const [ano, mes, dia] = hoje.split("-").map(Number);
  const dataObj = new Date(ano, mes - 1, dia);
  const formatada = dataObj.toLocaleDateString("pt-BR");
  document.getElementById("tituloRefeicoes").textContent = `Refeições do dia ${formatada}`;
}

function mostrarDataAtual() {
  const hoje = new Date();
  document.getElementById("dataAtual").textContent =
    `Hoje é ${hoje.toLocaleDateString("pt-BR")}`;
}

async function atualizarStatus() {
  const hoje = await obterDataEmUso();

  const { data, error } = await supabaseClient
    .from("refeicoes")
    .select("concluida")
    .eq("data", hoje)
    .eq("user_id", estado.usuario.id);

  if (error) {
    console.error("Erro ao buscar status:", error);
    return;
  }

  const total = data.length;
  const feitas = data.filter((r) => r.concluida).length;

  const status = document.getElementById("status");
  status.textContent = `Você completou ${feitas} de ${total} refeições hoje.`;
  // Verde para sucesso, laranja enquanto em andamento
  status.style.color = feitas === total && total > 0 ? "green" : "orange";
}

async function calcularTotalDia() {
  const hoje = await obterDataEmUso();

  const { data: refeicoes } = await supabaseClient
    .from("refeicoes")
    .select("id, concluida")
    .eq("data", hoje)
    .eq("user_id", estado.usuario.id);

  const idsConcluidas = (refeicoes || []).filter((r) => r.concluida).map((r) => r.id);

  const circulo = document.querySelector(".calorias-circulo");

  if (!idsConcluidas.length) {
    document.getElementById("caloriasNumero").textContent = "0";
    if (circulo) {
      circulo.style.background = `conic-gradient(#4caf50 0deg, #2a2a2a 0deg)`;
    }
    const totalElemento = document.getElementById("totalDiaCalorias");
    if (totalElemento) totalElemento.textContent = "Total consumido hoje: 0 kcal";
    return;
  }

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
    .in("refeicao_id", idsConcluidas);

  let total = 0;
  (itens || []).forEach((item) => {
    total += calcularCalorias(item.quantidade, item.alimentos.calorias_base, item.alimentos.tipo_medida);
  });

  const totalElemento = document.getElementById("totalDiaCalorias");
  if (totalElemento) totalElemento.textContent = `Total consumido hoje: ${total.toFixed(0)} kcal`;

  document.getElementById("caloriasNumero").textContent = total.toFixed(0);

  const graus = Math.min(total / META_CALORIAS, 1) * 360;
  if (circulo) {
    circulo.style.background = `conic-gradient(#4caf50 ${graus}deg, #2a2a2a ${graus}deg)`;
  }
}

// ============================================
// INICIALIZAR REFEIÇÕES PADRÃO
// ============================================
async function inicializarRefeicoesPadrao() {
  const hoje = await obterDataEmUso();
  const diaSemana = await obterDiaSemana();

  const { data, error } = await supabaseClient
    .from("refeicoes")
    .select("id")
    .eq("data", hoje)
    .eq("user_id", estado.usuario.id);

  if (error) {
    console.error("Erro ao verificar refeições do dia:", error);
    return;
  }

  if (data.length > 0) return; // Refeições já existem para hoje

  // 1. Criar as refeições do dia
  const registros = REFEICOES_PADRAO.map((item) => ({
    nome:          item.label,
    tipo_refeicao: item.key,
    concluida:     false,
    data:          hoje,
    user_id: estado.usuario.id
  }));

  const { data: refeicoesCriadas, error: erroInsert } = await supabaseClient
    .from("refeicoes")
    .insert(registros)
    .select();

  if (erroInsert) {
    console.error("Erro ao criar refeições:", erroInsert);
    return;
  }

  // 2. Buscar plano do dia
  const semanaAtual = calcularSemanaAtual();
  const planoDia = planoSemanal[semanaAtual]?.[diaSemana];
  if (!planoDia) return;

  // 3. Coletar todos os nomes de alimentos do plano para busca em lote (evita N+1)
  const nomesNecessarios = new Set();
  for (const refeicao of refeicoesCriadas) {
    const itensPlano = planoDia[refeicao.tipo_refeicao] || [];
    itensPlano.forEach((item) => nomesNecessarios.add(item.nome));
  }

  const { data: alimentosBanco } = await supabaseClient
    .from("alimentos")
    .select("*")
    .in("nome", [...nomesNecessarios]);

  const mapaAlimentos = {};
  (alimentosBanco || []).forEach((a) => { mapaAlimentos[a.nome] = a; });

  // 4. Montar itens das refeições
  const itensParaInserir = [];
  for (const refeicao of refeicoesCriadas) {
    const itensPlano = planoDia[refeicao.tipo_refeicao] || [];
    for (const itemPlano of itensPlano) {
      const alimento = mapaAlimentos[itemPlano.nome];
      if (!alimento) continue;

      let quantidadeCorreta = itemPlano.quantidade;
      if (alimento.tipo_medida === "gramas" && PESO_POR_UNIDADE[alimento.nome]) {
        quantidadeCorreta = itemPlano.quantidade * PESO_POR_UNIDADE[alimento.nome];
      }

      itensParaInserir.push({
        refeicao_id:  refeicao.id,
        alimento_id:  alimento.id,
        quantidade:   quantidadeCorreta,
      });
    }
  }

  if (itensParaInserir.length > 0) {
    const { error: erroItens } = await supabaseClient
      .from("refeicao_itens")
      .insert(itensParaInserir);
    if (erroItens) console.error("Erro ao inserir itens do plano:", erroItens);
  }
}

// ============================================
// SUBSTITUIÇÃO DE ALIMENTOS
// ============================================
async function iniciarSubstituicao(itemId) {
  try {
    if (!itemId) return;

    const { data: item, error } = await supabaseClient
      .from("refeicao_itens")
      .select(`
        id,
        quantidade,
        alimento_id,
        refeicao_id,
        alimentos (
          id,
          nome,
          tipo_medida,
          calorias_base
        )
      `)
      .eq("id", itemId)
      .limit(1)
      .maybeSingle();

    if (error || !item) {
      alert("Item não encontrado. Recarregue a página.");
      return;
    }

    // Salvar contexto da substituição no estado
    const sub = estado.substituicao;
    sub.itemId              = item.id;
    sub.refeicaoId          = item.refeicao_id;
    sub.alimentoOriginalObj = item.alimentos;
    sub.caloriasOriginal    = calcularCalorias(
      item.quantidade,
      item.alimentos.calorias_base,
      item.alimentos.tipo_medida
    );

    document.getElementById("alimentoOriginal").textContent =
      `${item.alimentos.nome} (${item.quantidade} ${item.alimentos.tipo_medida} = ${sub.caloriasOriginal.toFixed(0)} kcal)`;
    document.getElementById("caloriasAlvo").textContent = sub.caloriasOriginal.toFixed(0);

    await carregarAlimentosParaSubstituicao();
    document.getElementById("modalSubstituicao").style.display = "block";
  } catch (e) {
    console.error("Erro em iniciarSubstituicao:", e);
    alert("Erro ao iniciar substituição: " + e.message);
  }
}

async function carregarAlimentosParaSubstituicao(categoria = "todas") {
  try {
    let query = supabaseClient.from("alimentos").select("*").order("nome");
    if (categoria !== "todas") query = query.eq("categoria", categoria);

    const { data: alimentos, error } = await query;
    if (error) {
      console.error("Erro ao carregar alimentos:", error);
      return;
    }

    const caloriasAlvo = estado.substituicao.caloriasOriginal;
    const container = document.getElementById("listaAlimentosSubstituicao");
    container.innerHTML = "";

    alimentos.forEach((alimento) => {
      const quantidadeEquivalente = calcularSubstituicao(
        caloriasAlvo,
        alimento.calorias_base,
        alimento.tipo_medida
      );

      const div = document.createElement("div");
      div.className = "alimento-item";
      div.onclick = () => confirmarSubstituicao(alimento.id, quantidadeEquivalente);
      div.innerHTML = `
        <div class="alimento-info">
          <div class="alimento-nome">${alimento.nome}</div>
          <div class="alimento-detalhes">
            ${alimento.calorias_base} kcal/${alimento.tipo_medida === "gramas" ? "100g" : "unidade"}
            ${alimento.categoria ? ` • ${alimento.categoria}` : ""}
          </div>
        </div>
        <div class="alimento-quantidade">${quantidadeEquivalente} ${alimento.tipo_medida}</div>
      `;
      container.appendChild(div);
    });
  } catch (error) {
    console.error("Erro ao carregar alimentos para substituição:", error);
  }
}

async function confirmarSubstituicao(novoAlimentoId, novaQuantidade) {
  const sub = estado.substituicao;

  if (!sub.itemId || !sub.refeicaoId) {
    alert("Nenhum item selecionado para substituição. Tente novamente.");
    return;
  }

  try {
    sub.emAndamento = true;

    const idParaDeletar = sub.itemId;
    const refeicaoId   = sub.refeicaoId;

    // 1. Tentar remover o item original
    const { error: deleteError } = await supabaseClient
      .from("refeicao_itens")
      .delete()
      .eq("id", idParaDeletar);

    if (deleteError) {
      alert("Erro ao remover item: " + deleteError.message);
      return;
    }

    // 2. Confirmar que o item realmente foi apagado (RLS pode bloquear silenciosamente)
    const { data: itemAindaExiste, error: checkError } = await supabaseClient
      .from("refeicao_itens")
      .select("id")
      .eq("id", idParaDeletar)
      .maybeSingle();

    if (checkError) {
      console.error("Erro ao verificar delete:", checkError);
    }

    if (itemAindaExiste) {
      // Item não foi apagado — provavelmente bloqueado por RLS policy
      alert(
        "Não foi possível remover o item original.\n\n" +
        "Verifique se a policy de DELETE está configurada na tabela " +
        "refeicao_itens no Supabase (Authentication > Policies).\n\n" +
        "A substituição foi cancelada para evitar duplicação."
      );
      return;
    }

    // 3. Item confirmado como apagado — inserir o novo
    const { error: insertError } = await supabaseClient
      .from("refeicao_itens")
      .insert({
        refeicao_id: refeicaoId,
        alimento_id: novoAlimentoId,
        quantidade:  novaQuantidade,
      });

    if (insertError) {
      alert(
        "O item original foi removido, mas houve erro ao inserir o novo.\n" +
        "Erro: " + insertError.message + "\n\n" +
        "Recarregue a página e adicione o alimento manualmente."
      );
      return;
    }

    fecharModal();
    alert("Substituição feita com sucesso!");

    // Atualizar interface sem recarregar a página inteira
    await gerarRefeicoes();
    await calcularTotalDia();
    await atualizarStatus();
  } catch (err) {
    console.error("Erro em confirmarSubstituicao:", err);
    alert("Erro inesperado: " + err.message);
  } finally {
    sub.emAndamento = false;
  }
}

function fecharModal() {
  document.getElementById("modalSubstituicao").style.display = "none";
  // Limpar estado da substituição
  const sub = estado.substituicao;
  sub.itemId              = null;
  sub.refeicaoId          = null;
  sub.caloriasOriginal    = 0;
  sub.alimentoOriginalObj = null;
}

// ============================================
// PERSONALIZAÇÕES DO DIA
// ============================================
async function diaTemPersonalizacoes(data) {
  const { data: refeicoes } = await supabaseClient
    .from("refeicoes")
    .select("id")
    .eq("data", data)
    .eq("user_id", estado.usuario.id);

  if (!refeicoes || refeicoes.length === 0) return false;

  const refeicoesIds = refeicoes.map((r) => r.id);

  const { data: itens } = await supabaseClient
    .from("refeicao_itens")
    .select(`id, alimentos (nome)`)
    .in("refeicao_id", refeicoesIds);

  const semanaAtual = calcularSemanaAtual();
  const diaSemana = obterDiaSemanaPorData(data);
  const planoOriginal = planoSemanal[semanaAtual]?.[diaSemana];

  if (!planoOriginal) return false;

  for (const refeicaoTipo of ORDEM_REFEICOES) {
    const itensPlano = planoOriginal[refeicaoTipo] || [];
    for (const itemPlano of itensPlano) {
      const itemExiste = itens?.some((item) => item.alimentos.nome === itemPlano.nome);
      if (!itemExiste) return true;
    }
  }

  return false;
}

// ============================================
// NAVEGAÇÃO ENTRE DIAS
// ============================================
function irParaHistorico() {
  window.location.href = "historico.html";
}

function irParaHistoricoRefeicoes() {
  window.location.href = "refeicoes.html";
}


async function encerrarDia() {
  const confirmar = confirm("Deseja encerrar o dia atual?");
  if (!confirmar) return;

  const hoje = estado.dataVisualizada;
  if (!hoje) {
    console.error("Nenhum dia visualizado para encerrar");
    return;
  }

  const { error: updateError } = await supabaseClient
    .from("controle_dieta")
    .update({ encerrado: true })
    .eq("data_ativa", hoje)
    .eq("user_id", estado.usuario.id);

  if (updateError) {
    console.error("Erro ao encerrar dia:", updateError);
    alert("Erro ao encerrar o dia. Tente novamente.");
    return;
  }

  // Calcular próximo dia sem risco de fuso horário
  const proximoDia = proximoDiaLocal(hoje);

  const { error: insertError } = await supabaseClient
    .from("controle_dieta")
    .insert({ data_ativa: proximoDia, encerrado: false, user_id: estado.usuario.id });

  if (insertError) {
    console.error("Erro ao criar novo dia:", insertError);
    alert("Erro ao criar novo dia. O dia atual foi encerrado mas o próximo não foi criado.");
    return;
  }

  estado.dataVisualizada = proximoDia;

  await garantirPlanoDoDia(proximoDia);
  await atualizarTituloRefeicoes();
  await gerarRefeicoes();
  await atualizarStatus();
  await calcularTotalDia();
  await atualizarIndicadorDia();

  alert("Dia encerrado. Novo dia iniciado.");
}

async function alterarDia(direcao) {
  if (estado.navegando) return;
  estado.navegando = true;

  try {
    const [ano, mes, dia] = estado.dataVisualizada.split("-").map(Number);
    const dataObj = new Date(ano, mes - 1, dia);
    dataObj.setDate(dataObj.getDate() + direcao);
    const novaData = `${dataObj.getFullYear()}-${String(dataObj.getMonth() + 1).padStart(2, "0")}-${String(dataObj.getDate()).padStart(2, "0")}`;
    estado.dataVisualizada = novaData;

    await garantirPlanoDoDia(novaData);
    await atualizarTela();
    await atualizarIndicadorDia();
  } finally {
    estado.navegando = false;
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
  if (estado.substituicao.emAndamento) return;

  const personalizado = await diaTemPersonalizacoes(data);
  if (personalizado) return;

const { data: refeicoes } = await supabaseClient
  .from("refeicoes")
  .select("id")
  .eq("data", data)
  .eq("user_id", estado.usuario.id);

  if (refeicoes && refeicoes.length >= REFEICOES_PADRAO.length) return;

  const diaSemana = obterDiaSemanaPorData(data);
  const semanaAtual = calcularSemanaAtual();

  const registros = REFEICOES_PADRAO.map((item) => ({
    nome:          item.label,
    tipo_refeicao: item.key,
    concluida:     false,
    data:          data,
    user_id: estado.usuario.id
  }));

  const { data: refeicoesCriadas } = await supabaseClient
    .from("refeicoes")
    .insert(registros)
    .select();

  const planoDia = planoSemanal[semanaAtual]?.[diaSemana];
  if (!planoDia || !refeicoesCriadas) return;

  // Busca em lote para evitar N+1
  const nomesNecessarios = new Set();
  for (const refeicao of refeicoesCriadas) {
    (planoDia[refeicao.tipo_refeicao] || []).forEach((i) => nomesNecessarios.add(i.nome));
  }

  const { data: alimentosBanco } = await supabaseClient
    .from("alimentos")
    .select("id, nome")
    .in("nome", [...nomesNecessarios]);

  const mapaAlimentos = {};
  (alimentosBanco || []).forEach((a) => { mapaAlimentos[a.nome] = a; });

  const itensParaInserir = [];
  for (const refeicao of refeicoesCriadas) {
    const itensPlano = planoDia[refeicao.tipo_refeicao] || [];
    for (const itemPlano of itensPlano) {
      const alimento = mapaAlimentos[itemPlano.nome];
      if (!alimento) continue;
      itensParaInserir.push({
        refeicao_id: refeicao.id,
        alimento_id: alimento.id,
        quantidade:  itemPlano.quantidade,
      });
    }
  }

  if (itensParaInserir.length > 0) {
    await supabaseClient.from("refeicao_itens").insert(itensParaInserir);
  }
}

async function atualizarIndicadorDia() {
  const dataAtiva = await obterDataAtiva();
  const titulo = document.getElementById("tituloRefeicoes");
  titulo.style.color = estado.dataVisualizada !== dataAtiva ? "#888" : "";
}

async function voltarParaHoje() {
  estado.dataVisualizada = await obterDataAtiva();
  await atualizarTela();
  atualizarIndicadorDia();
}

// ============================================
// MODAL — CATEGORIAS
// ============================================
async function carregarCategorias() {
  try {
    const { data, error } = await supabaseClient
      .from("alimentos")
      .select("categoria")
      .not("categoria", "is", null)
      .order("categoria");

    if (error) {
      console.error("Erro ao carregar categorias:", error);
      return;
    }

    const categorias = [...new Set(data.map((item) => item.categoria))];
    const select = document.getElementById("filtroCategoria");

    categorias.forEach((categoria) => {
      const option = document.createElement("option");
      option.value = categoria;
      option.textContent = categoria;
      select.appendChild(option);
    });
  } catch (error) {
    console.error("Erro ao carregar categorias:", error);
  }
}

// ============================================
// EVENT LISTENERS
// ============================================
document.addEventListener("DOMContentLoaded", function () {
  document.querySelector(".modal-close").onclick = fecharModal;
  document.getElementById("btnCancelarSubstituicao").onclick = fecharModal;

  window.onclick = function (event) {
    const modal = document.getElementById("modalSubstituicao");
    if (event.target === modal) fecharModal();
  };

  document.getElementById("filtroCategoria").onchange = function (e) {
    carregarAlimentosParaSubstituicao(e.target.value);
  };

  carregarCategorias();
});

// ============================================
// EXCLUIR ITEM DE REFEIÇÃO
// ============================================
async function excluirItemRefeicao(itemId) {
  const { error } = await supabaseClient
    .from("refeicao_itens")
    .delete()
    .eq("id", itemId);

  if (error) {
    alert("Erro ao excluir item: " + error.message);
    return;
  }

  await gerarRefeicoes();
  await calcularTotalDia();
  await atualizarStatus();
}

// ============================================
// MODAL DE CONFIRMAÇÃO GENÉRICO
// ============================================
function abrirModalConfirmacao(mensagem, onConfirmar) {
  document.getElementById("modalConfirmacaoTexto").innerHTML = mensagem;
  document.getElementById("modalConfirmacao").style.display = "flex";

  // Guardar callback no botão confirmar
  const btnConfirmar = document.getElementById("btnConfirmarExclusao");
  // Clonar para remover listeners antigos
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

window.onload = init;
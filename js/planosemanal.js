const dataInicioPlano = new Date("2026-03-02"); 

function calcularSemanaAtual() {
  const hoje = new Date();

  const diff = hoje - dataInicioPlano;

  const diasPassados = Math.floor(diff / (1000 * 60 * 60 * 24));

  const semanasPassadas = Math.floor(diasPassados / 7);

  const semanaCalculada = 2 + semanasPassadas;

  return Math.min(Math.max(semanaCalculada, 2), 4);
}

const semanaAtual = calcularSemanaAtual();

const planoSemanal = {

  2: {

    segunda: {
      cafe: [
        { nome: "Aveia", quantidade: 40 },
        { nome: "Chia", quantidade: 10 },
        { nome: "Banana", quantidade: 100 },
        { nome: "Ovo", quantidade: 3 }
      ],
      almoco: [
        { nome: "Arroz integral cozido", quantidade: 150 },
        { nome: "Frango peito grelhado", quantidade: 200 }
      ],
      lanche: [
        { nome: "Ovo", quantidade: 2 }
      ],
      jantar: [
        { nome: "Arroz branco cozido", quantidade: 100 },
        { nome: "Frango peito grelhado", quantidade: 200 }
      ],
      pos: [
        { nome: "Frango peito grelhado", quantidade: 100 }
      ]
    },

    terca: {
      cafe: [
        { nome: "Aveia", quantidade: 40 },
        { nome: "Chia", quantidade: 10 },
        { nome: "Pera", quantidade: 150 },
        { nome: "Ovo", quantidade: 3 }
      ],
      almoco: [
        { nome: "Arroz branco cozido", quantidade: 120 },
        { nome: "Patinho moído", quantidade: 200 }
      ],
      lanche: [
        { nome: "Ovo", quantidade: 2 }
      ],
      jantar: [
        { nome: "Frango peito grelhado", quantidade: 200 }
      ],
      pos: [
        { nome: "Leite integral", quantidade: 1 }
      ]
    },

    quarta: {
      cafe: [
        { nome: "Aveia", quantidade: 40 },
        { nome: "Banana", quantidade: 100 },
        { nome: "Ovo", quantidade: 2 },
        { nome: "Clara de ovo", quantidade: 2 }
      ],
      almoco: [
        { nome: "Arroz branco cozido", quantidade: 180 },
        { nome: "Patinho moído", quantidade: 200 }
      ],
      lanche: [
        { nome: "Ovo", quantidade: 2 }
      ],
      jantar: [
        { nome: "Arroz branco cozido", quantidade: 100 },
        { nome: "Frango peito grelhado", quantidade: 200 }
      ],
      pos: [
        { nome: "Frango peito grelhado", quantidade: 100 }
      ]
    },

    quinta: {
      cafe: [
        { nome: "Aveia", quantidade: 30 },
        { nome: "Chia", quantidade: 10 },
        { nome: "Mamão", quantidade: 200 },
        { nome: "Ovo", quantidade: 3 }
      ],
      almoco: [
        { nome: "Arroz branco cozido", quantidade: 120 },
        { nome: "Frango peito grelhado", quantidade: 200 }
      ],
      lanche: [
        { nome: "Bolo caseiro", quantidade: 180 },
        { nome: "Ovo", quantidade: 1 }
      ],
      jantar: [
        { nome: "Ovo", quantidade: 3 }
      ],
      pos: [
        { nome: "Leite integral", quantidade: 1 }
      ]
    },

    sexta: {
      cafe: [
        { nome: "Aveia", quantidade: 40 },
        { nome: "Chia", quantidade: 10 },
        { nome: "Banana", quantidade: 100 },
        { nome: "Ovo", quantidade: 3 }
      ],
      almoco: [
        { nome: "Arroz integral cozido", quantidade: 150 },
        { nome: "Frango peito grelhado", quantidade: 200 }
      ],
      lanche: [
        { nome: "Ovo", quantidade: 2 }
      ],
      jantar: [
        { nome: "Arroz branco cozido", quantidade: 100 },
        { nome: "Frango peito grelhado", quantidade: 200 }
      ],
      pos: [
        { nome: "Frango peito grelhado", quantidade: 100 }
      ]
    },

    sabado: {
      cafe: [
        { nome: "Ovo", quantidade: 3 },
        { nome: "Aveia", quantidade: 30 }
      ],
      almoco: [
        { nome: "Arroz branco cozido", quantidade: 150 },
        { nome: "Frango peito grelhado", quantidade: 200 }
      ],
      lanche: [
        { nome: "Ovo", quantidade: 2 }
      ],
      jantar: [
        { nome: "Arroz branco cozido", quantidade: 100 },
        { nome: "Frango peito grelhado", quantidade: 200 }
      ],
      pos: [
        { nome: "Leite integral", quantidade: 1 }
      ]
    },

    domingo: {
      cafe: [
        { nome: "Aveia", quantidade: 30 },
        { nome: "Ovo", quantidade: 3 }
      ],
      almoco: [
        { nome: "Arroz branco cozido", quantidade: 120 },
        { nome: "Frango peito grelhado", quantidade: 200 }
      ],
      lanche: [
        { nome: "Banana", quantidade: 100 },
        { nome: "Ovo", quantidade: 2 }
      ],
      jantar: [
        { nome: "Frango peito grelhado", quantidade: 200 }
      ],
      pos: [
        { nome: "Leite integral", quantidade: 1 }
      ]
    }
  }
};
/**
 * Módulo de Fluxo de Caixa Inteligente
 *
 * Converte lançamentos (receitas/despesas) em parcelas de caixa previstas,
 * consolida por dia e mês e calcula faturamento vs. recebimento/pagamento.
 */

// Tipos de entrada
export type TipoLancamento = 'RECEITA' | 'DESPESA';

export type FormaPagamento =
  | 'DINHEIRO'
  | 'PIX'
  | 'DEBITO'
  | 'CREDITO'
  | 'BOLETO'
  | 'CHEQUE'
  | 'TRANSFERENCIA'
  | 'CONVENIO'
  | 'OUTRO';

export interface Lancamento {
  id: string;
  tipo: TipoLancamento;
  descricao: string;
  dataEmissao: Date; // data da venda/compra
  dataVencimento?: Date; // usado para boletos/despesas
  datasParcelas?: Date[]; // opcional: vencimentos por parcela (receitas)
  formaPagamento: FormaPagamento;
  valorTotal: number;
  numeroParcelas: number; // mínimo 1
  status?: 'PREVISTO' | 'REALIZADO';
  dataBaixa?: Date; // data efetiva de recebimento/pagamento quando REALIZADO
}

// Tipos gerados
export interface ParcelaCaixa {
  lancamentoId: string;
  tipo: TipoLancamento;
  dataPrevista: Date;
  valor: number;
  status: 'PREVISTO' | 'REALIZADO';
  dataRealizado?: Date;
}

export interface ResumoDiario {
  data: Date;
  totalReceitasPrevistas: number;
  totalDespesasPrevistas: number;
  saldoPrevistoDia: number;
}

export interface ResumoMensal {
  ano: number;
  mes: number; // 1-12
  totalReceitasPrevistas: number;
  totalDespesasPrevistas: number;
  saldoPrevistoMes: number;
}

// Regras de liquidação por forma de pagamento (prazo, intervalo e uso de dia útil).
const regrasRecebimento: Record<
  FormaPagamento,
  {
    diasAtePrimeiroRecebimento?: number;
    intervaloDias?: number;
    usarDataVencimento?: boolean;
    usarDiasUteis?: boolean;
  }
> = {
  DINHEIRO: { diasAtePrimeiroRecebimento: 0, intervaloDias: 0 },
  PIX: { diasAtePrimeiroRecebimento: 0, intervaloDias: 0 },
  DEBITO: { diasAtePrimeiroRecebimento: 1, intervaloDias: 0, usarDiasUteis: true },
  CREDITO: { diasAtePrimeiroRecebimento: 30, intervaloDias: 30 },
  BOLETO: { usarDataVencimento: true },
  CHEQUE: { usarDataVencimento: true },
  TRANSFERENCIA: { diasAtePrimeiroRecebimento: 0, intervaloDias: 0 },
  CONVENIO: { diasAtePrimeiroRecebimento: 30, intervaloDias: 30 },
  OUTRO: { diasAtePrimeiroRecebimento: 0, intervaloDias: 0 },
};

const addDays = (date: Date, days: number) => {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
};

const addBusinessDays = (date: Date, days: number) => {
  const d = new Date(date);
  let added = 0;
  while (added < days) {
    d.setDate(d.getDate() + 1);
    const day = d.getDay();
    if (day !== 0 && day !== 6) added += 1;
  }
  return d;
};

const addMonths = (date: Date, months: number) => {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
};

// Gera parcelas respeitando arredondamento (última parcela absorve diferença de centavos)
const dividirParcelas = (valorTotal: number, numeroParcelas: number): number[] => {
  const parcelaBase = Math.floor((valorTotal / numeroParcelas) * 100) / 100;
  const parcelas = Array(numeroParcelas).fill(parcelaBase);
  const somaBase = parcelaBase * numeroParcelas;
  const diferenca = Math.round((valorTotal - somaBase) * 100) / 100;
  parcelas[parcelas.length - 1] = Math.round((parcelas[parcelas.length - 1] + diferenca) * 100) / 100;
  return parcelas;
};

// Converte um lançamento em parcelas de caixa (previstas e, se houver dataBaixa, marcadas como realizadas)
export function gerarParcelasDeCaixa(lancamentos: Lancamento[]): ParcelaCaixa[] {
  const parcelas: ParcelaCaixa[] = [];

  lancamentos.forEach((l) => {
    const datasParcelas = (l.datasParcelas || []).filter(Boolean);
    const numParcelas = Math.max(1, datasParcelas.length || l.numeroParcelas || 1);
    const valores = dividirParcelas(l.valorTotal, numParcelas);

    // Define datas base conforme tipo/forma de pagamento
    const baseDates: Date[] = [];
    if (datasParcelas.length) {
      baseDates.push(...datasParcelas.slice(0, numParcelas));
    } else if (l.tipo === 'RECEITA') {
      const regra = regrasRecebimento[l.formaPagamento];
      const baseReferencia = l.dataVencimento || l.dataEmissao;
      const start = regra.usarDataVencimento
        ? baseReferencia
        : regra.diasAtePrimeiroRecebimento && !l.dataVencimento
          ? (regra.usarDiasUteis ? addBusinessDays(baseReferencia, regra.diasAtePrimeiroRecebimento) : addDays(baseReferencia, regra.diasAtePrimeiroRecebimento))
          : baseReferencia;
      for (let i = 0; i < numParcelas; i++) {
        if (regra.intervaloDias && i > 0) {
          baseDates.push(addDays(start, regra.intervaloDias * i));
        } else if (!regra.intervaloDias && i > 0) {
          baseDates.push(addMonths(start, i)); // fallback mensal
        } else {
          baseDates.push(start);
        }
      }
    } else {
      // DESPESA: usa vencimento/emissão para previsão (ignora dataBaixa)
      const base = l.dataVencimento || l.dataEmissao;
      for (let i = 0; i < numParcelas; i++) {
        baseDates.push(addMonths(base, i));
      }
    }

    valores.forEach((valor, idx) => {
      const isRealizado = l.status === 'REALIZADO' && !!l.dataBaixa;
      parcelas.push({
        lancamentoId: l.id,
        tipo: l.tipo,
        dataPrevista: baseDates[idx] || l.dataEmissao,
        valor,
        status: isRealizado ? 'REALIZADO' : 'PREVISTO',
        dataRealizado: isRealizado ? l.dataBaixa : undefined,
      });
    });
  });

  return parcelas;
}

// Fluxo diário (previsto)
export function gerarFluxoDiario(parcelas: ParcelaCaixa[]): ResumoDiario[] {
  const mapa = new Map<string, ResumoDiario>();

  parcelas.forEach((p) => {
    const dataStr = p.dataPrevista.toISOString().split('T')[0];
    const existente = mapa.get(dataStr) || {
      data: new Date(dataStr),
      totalReceitasPrevistas: 0,
      totalDespesasPrevistas: 0,
      saldoPrevistoDia: 0,
    };
    if (p.tipo === 'RECEITA') existente.totalReceitasPrevistas += p.valor;
    else existente.totalDespesasPrevistas += p.valor;
    existente.saldoPrevistoDia = existente.totalReceitasPrevistas - existente.totalDespesasPrevistas;
    mapa.set(dataStr, existente);
  });

  return Array.from(mapa.values()).sort((a, b) => a.data.getTime() - b.data.getTime());
}

// Fluxo mensal (previsto)
export function gerarFluxoMensal(parcelas: ParcelaCaixa[]): ResumoMensal[] {
  const mapa = new Map<string, ResumoMensal>();

  parcelas.forEach((p) => {
    const ano = p.dataPrevista.getFullYear();
    const mes = p.dataPrevista.getMonth() + 1;
    const key = `${ano}-${mes}`;
    const existente = mapa.get(key) || {
      ano,
      mes,
      totalReceitasPrevistas: 0,
      totalDespesasPrevistas: 0,
      saldoPrevistoMes: 0,
    };
    if (p.tipo === 'RECEITA') existente.totalReceitasPrevistas += p.valor;
    else existente.totalDespesasPrevistas += p.valor;
    existente.saldoPrevistoMes = existente.totalReceitasPrevistas - existente.totalDespesasPrevistas;
    mapa.set(key, existente);
  });

  return Array.from(mapa.values()).sort((a, b) => a.ano - b.ano || a.mes - b.mes);
}

// Saldo acumulado a partir de um saldo inicial (aplicado em fluxo diário)
export function aplicarSaldoAcumulado(
  resumoDiario: ResumoDiario[],
  saldoInicial: number
): Array<ResumoDiario & { saldoAcumulado: number }> {
  let saldo = saldoInicial;
  return resumoDiario.map((r) => {
    saldo += r.saldoPrevistoDia;
    return { ...r, saldoAcumulado: saldo };
  });
}

// Utilitários para diferenciar faturamento x caixa
export function calcularFaturamentoPorPeriodo(
  lancamentosReceita: Lancamento[],
  dataInicio: Date,
  dataFim: Date
): number {
  const start = dataInicio.getTime();
  const end = dataFim.getTime();
  return lancamentosReceita
    .filter((l) => l.tipo === 'RECEITA')
    .filter((l) => {
      const t = l.dataEmissao.getTime();
      return t >= start && t <= end;
    })
    .reduce((acc, l) => acc + l.valorTotal, 0);
}

export function calcularRecebimentoPorPeriodo(
  parcelasReceita: ParcelaCaixa[],
  dataInicio: Date,
  dataFim: Date
): number {
  const start = dataInicio.getTime();
  const end = dataFim.getTime();
  return parcelasReceita
    .filter((p) => p.tipo === 'RECEITA')
    .filter((p) => {
      const t = p.dataPrevista.getTime();
      return t >= start && t <= end;
    })
    .reduce((acc, p) => acc + p.valor, 0);
}

export function calcularPagamentoPorPeriodo(
  parcelasDespesa: ParcelaCaixa[],
  dataInicio: Date,
  dataFim: Date
): number {
  const start = dataInicio.getTime();
  const end = dataFim.getTime();
  return parcelasDespesa
    .filter((p) => p.tipo === 'DESPESA')
    .filter((p) => {
      const t = p.dataPrevista.getTime();
      return t >= start && t <= end;
    })
    .reduce((acc, p) => acc + p.valor, 0);
}

// -----------------------
// Exemplos simples de uso
// -----------------------
export function exemplosBasicos() {
  const hoje = new Date('2024-01-10');
  const lancamentos: Lancamento[] = [
    {
      id: 'r1',
      tipo: 'RECEITA',
      descricao: 'Venda crédito 10x',
      dataEmissao: hoje,
      formaPagamento: 'CREDITO',
      valorTotal: 1000,
      numeroParcelas: 10,
    },
    {
      id: 'r2',
      tipo: 'RECEITA',
      descricao: 'Venda dinheiro à vista',
      dataEmissao: hoje,
      formaPagamento: 'DINHEIRO',
      valorTotal: 500,
      numeroParcelas: 1,
    },
    {
      id: 'd1',
      tipo: 'DESPESA',
      descricao: 'Fornecedor 12x',
      dataEmissao: hoje,
      dataVencimento: new Date('2024-01-20'),
      formaPagamento: 'BOLETO',
      valorTotal: 1200,
      numeroParcelas: 12,
    },
  ];

  const parcelas = gerarParcelasDeCaixa(lancamentos);
  const fluxoDia = gerarFluxoDiario(parcelas);
  const fluxoMes = gerarFluxoMensal(parcelas);
  const faturamentoMes = calcularFaturamentoPorPeriodo(
    lancamentos.filter((l) => l.tipo === 'RECEITA'),
    new Date('2024-01-01'),
    new Date('2024-01-31')
  );
  const recebimentoMes = calcularRecebimentoPorPeriodo(
    parcelas.filter((p) => p.tipo === 'RECEITA'),
    new Date('2024-01-01'),
    new Date('2024-01-31')
  );
  const pagamentoMes = calcularPagamentoPorPeriodo(
    parcelas.filter((p) => p.tipo === 'DESPESA'),
    new Date('2024-01-01'),
    new Date('2024-01-31')
  );

  // Estes logs podem servir como “testes” rápidos
  console.log('Parcelas geradas:', parcelas.length);
  console.log('Fluxo diário (primeiro dia):', fluxoDia[0]);
  console.log('Fluxo mensal:', fluxoMes);
  console.log('Faturamento do mês (pelo emitido):', faturamentoMes);
  console.log('Recebimento previsto no mês:', recebimentoMes);
  console.log('Pagamento previsto no mês:', pagamentoMes);
}

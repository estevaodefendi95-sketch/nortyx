// Helpers para evitar duplicação entre billing_charges e daily_incomes
// quando uma cobrança paga representa o mesmo dinheiro de uma entrada do dia.

type DailyIncomeLike = { data: string; valor: number };
type ChargeLike = { data_cobranca: string; valor: number };

// Normaliza data para DD/MM/YYYY (aceita ISO YYYY-MM-DD ou já BR).
const toBR = (s: string) => {
  if (!s) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split("-");
    return `${d}/${m}/${y}`;
  }
  return s;
};

const sameValue = (a: number, b: number) => Math.abs((a || 0) - (b || 0)) < 0.01;

/**
 * Retorna true se a cobrança já está representada por um daily_income
 * (mesma data e mesmo valor). Nesse caso a cobrança NÃO deve ser somada
 * novamente ao faturamento, evitando duplicação.
 */
export function chargeDuplicatesIncome(
  charge: ChargeLike,
  dailyIncomes: DailyIncomeLike[],
): boolean {
  const chargeDate = toBR(charge.data_cobranca);
  return dailyIncomes.some(
    (i) => toBR(i.data) === chargeDate && sameValue(i.valor, charge.valor),
  );
}

/** Filtra as cobranças removendo as que já estão duplicadas por um daily_income. */
export function dedupeChargesAgainstIncomes<T extends ChargeLike>(
  charges: T[],
  dailyIncomes: DailyIncomeLike[],
): T[] {
  if (!charges.length || !dailyIncomes.length) return charges;
  return charges.filter((c) => !chargeDuplicatesIncome(c, dailyIncomes));
}

import { useMemo } from "react";
import { formatCurrency } from "@/data/cashflow";
import { useTransactions } from "@/context/TransactionsContext";
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Area, AreaChart } from "recharts";

const MONTHS_PT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

interface EvolutionChartProps {
  selectedYear: number;
}

const EvolutionChart = ({ selectedYear }: EvolutionChartProps) => {
  const { transactions, dailyIncomes } = useTransactions();
  const monthlyData = useMemo(() => {
    const data: { name: string; entradas: number; saidas: number; saldo: number }[] = [];

    for (let m = 0; m < 12; m++) {
      const monthExpenses = transactions
        .filter((t) => {
          const parts = t.data.split("/").map(Number);
          const month = parts[1];
          const year = parts[2];
          return t.tipo === "saida" && month - 1 === m && year === selectedYear;
        })
        .reduce((sum, t) => sum + t.valor, 0);

      const monthIncome = dailyIncomes
        .filter((i) => {
          const parts = i.data.split("/").map(Number);
          const month = parts[1];
          const year = parts[2];
          return month - 1 === m && year === selectedYear;
        })
        .reduce((sum, i) => sum + i.valor, 0);

      if (monthExpenses > 0 || monthIncome > 0) {
        data.push({
          name: MONTHS_PT[m],
          entradas: monthIncome,
          saidas: monthExpenses,
          saldo: monthIncome - monthExpenses,
        });
      }
    }
    return data;
  }, [transactions, dailyIncomes, selectedYear]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload) return null;
    return (
      <div className="rounded-lg bg-card border border-border p-3 shadow-lg">
        <p className="text-sm font-semibold mb-2">{label}</p>
        {payload.map((p: any) => (
          <p key={p.dataKey} className="text-xs" style={{ color: p.color }}>
            {p.dataKey === "entradas" ? "Entradas" : p.dataKey === "saidas" ? "Saídas" : "Saldo"}:{" "}
            <span className="font-medium">{formatCurrency(p.value)}</span>
          </p>
        ))}
      </div>
    );
  };

  return (
    <div className="rounded-xl bg-card border border-border p-5">
      <h2 className="font-display font-semibold text-lg mb-1">Evolução Mensal</h2>
      <p className="text-sm text-muted-foreground mb-4">Entradas, saídas e saldo ao longo dos meses de {selectedYear}</p>
      <div className="w-full h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={monthlyData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
            <defs>
              <linearGradient id="gradientIncome" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(152, 60%, 48%)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(152, 60%, 48%)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gradientExpense" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(0, 70%, 55%)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(0, 70%, 55%)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gradientBalance" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(210, 100%, 60%)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(210, 100%, 60%)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 14%, 18%)" />
            <XAxis dataKey="name" tick={{ fontSize: 12, fill: "hsl(215, 12%, 50%)" }} />
            <YAxis
              tick={{ fontSize: 11, fill: "hsl(215, 12%, 50%)" }}
              tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              formatter={(value: string) =>
                value === "entradas" ? "Entradas" : value === "saidas" ? "Saídas" : "Saldo"
              }
              wrapperStyle={{ fontSize: "12px" }}
            />
            <Area
              type="monotone"
              dataKey="entradas"
              stroke="hsl(152, 60%, 48%)"
              fill="url(#gradientIncome)"
              strokeWidth={2}
              dot={{ r: 4, fill: "hsl(152, 60%, 48%)" }}
            />
            <Area
              type="monotone"
              dataKey="saidas"
              stroke="hsl(0, 70%, 55%)"
              fill="url(#gradientExpense)"
              strokeWidth={2}
              dot={{ r: 4, fill: "hsl(0, 70%, 55%)" }}
            />
            <Area
              type="monotone"
              dataKey="saldo"
              stroke="hsl(210, 100%, 60%)"
              fill="url(#gradientBalance)"
              strokeWidth={2}
              dot={{ r: 4, fill: "hsl(210, 100%, 60%)" }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default EvolutionChart;

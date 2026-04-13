import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, financialContext } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = `Você é um assistente financeiro inteligente e preciso para uma empresa (restaurante). Seu papel é fornecer insights, análises e recomendações financeiras baseadas EXCLUSIVAMENTE nos dados fornecidos no contexto financeiro abaixo.

REGRAS IMPORTANTES:
- Sempre baseie suas respostas nos dados reais fornecidos no contexto
- Cite valores exatos quando disponíveis (receitas, despesas, fornecedores, categorias)
- Quando perguntarem "quando paguei X" ou "quanto paguei para X", consulte o HISTÓRICO POR FORNECEDOR e as CONTAS PAGAS no contexto
- Se não tiver dados suficientes para responder, diga claramente
- Use formatação markdown (listas, negrito, tabelas quando útil)
- Responda sempre em português brasileiro
- Seja objetivo e direto, mas completo na análise

Contexto financeiro atual:
${financialContext || "Nenhum contexto financeiro fornecido."}

Você pode:
- Responder quando e quanto foi pago para qualquer fornecedor (usando o histórico completo)
- Analisar tendências de receitas e despesas com dados reais
- Comparar mês atual com anteriores (resumo dos últimos 6 meses disponível)
- Identificar os maiores gastos e fornecedores
- Alertar sobre contas pendentes (todas, não só do mês atual)
- Sugerir cortes de gastos baseados nos dados
- Calcular margens e indicadores financeiros
- Dar dicas de fluxo de caixa baseadas na situação real`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido, tente novamente em instantes." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "Erro no gateway de IA" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

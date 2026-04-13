import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { text, imageBase64, mimeType, fornecedores } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    if (!text && !imageBase64) {
      return new Response(JSON.stringify({ error: "text or imageBase64 is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const fornecedoresCtx = (fornecedores || [])
      .filter((f: any) => f.categoria)
      .map((f: any) => `"${f.nome}" → categoria: "${f.categoria}", pagamento: "${f.forma_pagamento || ""}"`)
      .join("\n");

    const systemPrompt = `Você é um especialista em leitura de documentos DDA (Débito Direto Autorizado) de bancos brasileiros. Analise o conteúdo e identifique TODAS as contas/títulos listados.

Para cada título/conta, extraia:
- empresa: nome fantasia do beneficiário. Limpe nomes corporativos removendo sufixos como "LTDA", "S.A.", "ME", "EIRELI", "EPP", "COMERCIO DE", "DISTRIBUIDORA DE" quando possível.
- valor: valor cobrado como número decimal
- data: data de vencimento no formato YYYY-MM-DD
- boleto: linha digitável do código de barras (se disponível)
- categoria: código da categoria baseado nos fornecedores conhecidos abaixo. Se não encontrar correspondência, use "O" (Outros)
- forma_pagamento: forma de pagamento baseada nos fornecedores conhecidos. Se não encontrar, use "boleto"

Fornecedores conhecidos e suas categorias:
${fornecedoresCtx || "Nenhum fornecedor cadastrado ainda."}

IMPORTANTE:
- Valores em formato brasileiro (1.310,01) devem ser convertidos para decimal (1310.01)
- Ignore linhas de saldo, cabeçalhos, etc.
- Retorne APENAS um JSON array válido, sem markdown, sem explicação
- Exemplo: [{"empresa":"Rizatti","valor":3467.90,"data":"2026-03-30","boleto":"23793...","categoria":"C","forma_pagamento":"boleto"}]`;

    // Build messages based on input type
    const userContent: any[] = [];
    
    if (imageBase64) {
      // Vision: send image for AI analysis
      userContent.push({
        type: "image_url",
        image_url: { url: `data:${mimeType || "image/jpeg"};base64,${imageBase64}` },
      });
      userContent.push({
        type: "text",
        text: "Extraia todas as contas/títulos desta imagem de DDA bancário.",
      });
    } else {
      userContent.push({
        type: "text",
        text: `Extraia todas as contas/títulos deste DDA:\n\n${text}`,
      });
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: imageBase64 ? "google/gemini-2.5-flash" : "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
      }),
    });

    if (!response.ok) {
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "Erro no gateway de IA", status: response.status }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "[]";

    let entries = [];
    try {
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        entries = JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      console.error("Failed to parse AI response:", content);
    }

    return new Response(JSON.stringify({ entries }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("extract-dda error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

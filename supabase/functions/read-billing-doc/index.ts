import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface DocInput {
  base64: string;
  mimeType: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { boleto, nf, knownClients } = (await req.json()) as {
      boleto?: DocInput;
      nf?: DocInput;
      knownClients?: { nome: string; email: string }[];
    };

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    if (!boleto && !nf) {
      return new Response(JSON.stringify({ error: "Envie ao menos um arquivo (boleto ou nf)" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const knownList = (knownClients || [])
      .slice(0, 200)
      .map((c) => `- ${c.nome} <${c.email}>`)
      .join("\n");

    const systemPrompt = `Você é um especialista em ler boletos bancários brasileiros e Notas Fiscais (NF/NFS-e/NFC-e).
A partir das imagens/PDFs enviados, identifique o CLIENTE PAGADOR/TOMADOR (NÃO o beneficiário/emitente) e os dados da cobrança.

Regras:
- Em boleto: pagador = "Sacado" / "Pagador". NÃO confunda com Beneficiário/Cedente.
- Em NF de serviço: cliente = "Tomador". Em NF de produto: cliente = "Destinatário".
- Quando houver AMBOS (boleto + NF), priorize a NF para nome/email/telefone do cliente, e o boleto para valor e data de vencimento.
- valor: número decimal (ex: 1310.01).
- data_vencimento: formato YYYY-MM-DD. Se não houver, use a data de emissão.
- forma_cobranca: uma de "boleto" | "pix" | "transferencia". Se houver linha digitável, use "boleto".
- Se reconhecer o cliente entre os clientes conhecidos abaixo, use EXATAMENTE o mesmo nome e email cadastrados.

Clientes já cadastrados:
${knownList || "(nenhum)"}

Responda APENAS com JSON válido (sem markdown), no formato:
{"cliente_nome":"...","cliente_email":"...","cliente_telefone":"...","valor":0,"data_vencimento":"YYYY-MM-DD","descricao":"...","forma_cobranca":"boleto"}
Use string vazia para campos não encontrados.`;

    const userContent: any[] = [];
    if (boleto) {
      userContent.push({
        type: "image_url",
        image_url: { url: `data:${boleto.mimeType || "image/jpeg"};base64,${boleto.base64}` },
      });
      userContent.push({ type: "text", text: "Acima: BOLETO." });
    }
    if (nf) {
      userContent.push({
        type: "image_url",
        image_url: { url: `data:${nf.mimeType || "image/jpeg"};base64,${nf.base64}` },
      });
      userContent.push({ type: "text", text: "Acima: NOTA FISCAL." });
    }
    userContent.push({ type: "text", text: "Extraia o cliente pagador e os dados da cobrança." });

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
      }),
    });

    if (!response.ok) {
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições atingido. Tente novamente em instantes." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA esgotados. Adicione créditos na sua workspace." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "Erro no gateway de IA" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const content: string = data.choices?.[0]?.message?.content || "{}";

    let extracted: any = {};
    try {
      const m = content.match(/\{[\s\S]*\}/);
      if (m) extracted = JSON.parse(m[0]);
    } catch (e) {
      console.error("Failed to parse AI response:", content);
    }

    // Try to match a known client
    let matchedClientId: string | null = null;
    const emailLower = (extracted.cliente_email || "").toString().trim().toLowerCase();
    const nomeLower = (extracted.cliente_nome || "").toString().trim().toLowerCase();
    if (emailLower || nomeLower) {
      const found = (knownClients || []).find((c) => {
        if (emailLower && c.email && c.email.toLowerCase() === emailLower) return true;
        if (nomeLower && c.nome && c.nome.toLowerCase() === nomeLower) return true;
        return false;
      });
      if (found) {
        // The client object only has nome/email; the caller side will map id by nome+email match
        matchedClientId = `${found.nome}|${found.email}`;
      }
    }

    return new Response(JSON.stringify({ extracted, matchedClientHint: matchedClientId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("read-billing-doc error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

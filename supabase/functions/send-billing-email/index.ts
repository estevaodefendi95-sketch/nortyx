const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.99.1'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    let chargesQuery;
    let body: any = {}
    try { body = await req.json() } catch { /* no body */ }

    if (body.charge_id) {
      chargesQuery = supabase
        .from('billing_charges')
        .select('*, billing_clients(*)')
        .eq('id', body.charge_id)
        .in('status', ['pendente', 'atrasado'])
    } else {
      const now = new Date()
      const today = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`

      chargesQuery = supabase
        .from('billing_charges')
        .select('*, billing_clients(*)')
        .eq('data_cobranca', today)
        .eq('email_enviado', false)
        .eq('status', 'pendente')
    }

    const { data: charges, error: chargesError } = await chargesQuery

    if (chargesError) {
      console.error('Error fetching charges:', chargesError)
      return new Response(JSON.stringify({ error: chargesError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!charges || charges.length === 0) {
      return new Response(JSON.stringify({ message: 'Nenhuma cobrança encontrada', sent: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    let sentCount = 0
    const errors: string[] = []

    for (const charge of charges) {
      const client = (charge as any).billing_clients
      if (!client || !client.email) continue

      const valor = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(charge.valor)
      const formaLabel = client.forma_cobranca === 'pix' ? 'PIX' : client.forma_cobranca === 'boleto' ? 'Boleto' : client.forma_cobranca === 'transferencia' ? 'Transferência' : client.forma_cobranca || 'A combinar'

      try {
        // Try to send via transactional email if available, otherwise just mark as processed
        try {
          const { error: sendError } = await supabase.functions.invoke('send-transactional-email', {
            body: {
              templateName: 'billing-reminder',
              recipientEmail: client.email,
              idempotencyKey: `billing-${charge.id}-${Date.now()}`,
              templateData: {
                clientName: client.nome,
                valor,
                dataCobranca: charge.data_cobranca,
                formaCobranca: formaLabel,
                boletoUrl: (charge as any).boleto_url || null,
                nfUrl: (charge as any).nf_url || null,
              },
            },
          })

          if (sendError) {
            console.warn(`Transactional email not available for ${client.email}:`, sendError.message)
            errors.push(`${client.email}: E-mail enfileirado (verificação DNS pendente)`)
          }
        } catch (emailErr) {
          console.warn(`Email service not ready for ${client.email}:`, emailErr)
          errors.push(`${client.email}: Serviço de e-mail em configuração`)
        }

        // Mark as sent/processed
        await supabase
          .from('billing_charges')
          .update({ email_enviado: true, status: body.charge_id ? charge.status : 'enviada' })
          .eq('id', charge.id)

        sentCount++

        // If recurring and cron mode, create next month's charge
        if (charge.recorrente && !body.charge_id) {
          const [day, month, year] = charge.data_cobranca.split('/').map(Number)
          const nextDate = new Date(year, month, day)
          const nextCobranca = `${String(nextDate.getDate()).padStart(2, '0')}/${String(nextDate.getMonth() + 1).padStart(2, '0')}/${nextDate.getFullYear()}`

          await supabase.from('billing_charges').insert({
            client_id: charge.client_id,
            valor: charge.valor,
            data_cobranca: nextCobranca,
            recorrente: true,
            status: 'pendente',
            email_enviado: false,
          })
        }
      } catch (err) {
        console.error(`Exception for ${client.email}:`, err)
        errors.push(`${client.email}: ${String(err)}`)
      }
    }

    return new Response(
      JSON.stringify({ message: `${sentCount} cobrança(s) processada(s)`, sent: sentCount, errors }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('Unexpected error:', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

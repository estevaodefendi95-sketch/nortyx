import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Html, Preview, Section, Text, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = "nortyx"

interface BillingReminderProps {
  clientName?: string
  valor?: string
  dataCobranca?: string
  formaCobranca?: string
  boletoUrl?: string | null
  nfUrl?: string | null
}

const BillingReminderEmail = ({ clientName, valor, dataCobranca, formaCobranca, boletoUrl, nfUrl }: BillingReminderProps) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Lembrete de cobrança - {SITE_NAME}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Lembrete de Cobrança</Heading>
        <Text style={text}>
          {clientName ? `Olá, ${clientName}!` : 'Olá!'}
        </Text>
        <Text style={text}>
          Este é um lembrete referente ao pagamento no valor de <strong>{valor || 'valor não informado'}</strong>, com vencimento em <strong>{dataCobranca || 'data não informada'}</strong>.
        </Text>
        {formaCobranca && (
          <Text style={text}>
            Forma de pagamento: <strong>{formaCobranca}</strong>
          </Text>
        )}
        {(boletoUrl || nfUrl) && (
          <Section style={{ margin: '20px 0' }}>
            {boletoUrl && (
              <Button href={boletoUrl} style={btn}>Baixar boleto</Button>
            )}
            {nfUrl && (
              <Button href={nfUrl} style={{ ...btn, marginLeft: boletoUrl ? '8px' : '0' }}>Baixar nota fiscal</Button>
            )}
          </Section>
        )}
        <Hr style={hr} />
        <Text style={text}>
          Por favor, entre em contato conosco caso já tenha efetuado o pagamento ou tenha alguma dúvida.
        </Text>
        <Text style={footer}>
          Atenciosamente, {SITE_NAME}
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: BillingReminderEmail,
  subject: (data: Record<string, any>) => `Lembrete de cobrança - ${data.dataCobranca || SITE_NAME}`,
  displayName: 'Lembrete de cobrança',
  previewData: {
    clientName: 'João Silva',
    valor: 'R$ 5.000,00',
    dataCobranca: '15/07/2026',
    formaCobranca: 'PIX',
    boletoUrl: 'https://example.com/boleto.pdf',
    nfUrl: 'https://example.com/nf.pdf',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'Inter', Arial, sans-serif" }
const container = { padding: '30px 25px', maxWidth: '580px', margin: '0 auto' }
const h1 = { fontSize: '24px', fontWeight: 'bold' as const, color: '#1a1a2e', margin: '0 0 24px' }
const text = { fontSize: '15px', color: '#3d3d4e', lineHeight: '1.6', margin: '0 0 16px' }
const hr = { borderColor: '#e0e0e0', margin: '24px 0' }
const footer = { fontSize: '13px', color: '#999999', margin: '24px 0 0' }
const btn = { backgroundColor: '#3B82F6', color: '#ffffff', padding: '10px 18px', borderRadius: '6px', textDecoration: 'none', fontSize: '14px', fontWeight: 'bold' as const }

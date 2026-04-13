import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = "Paggio Gastrobar"

interface BillingReminderProps {
  clientName?: string
  valor?: string
  dataCobranca?: string
  formaCobranca?: string
}

const BillingReminderEmail = ({ clientName, valor, dataCobranca, formaCobranca }: BillingReminderProps) => (
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
  subject: (data: Record<string, any>) => `Lembrete de cobrança - ${data.dataCobranca || 'Paggio Gastrobar'}`,
  displayName: 'Lembrete de cobrança',
  previewData: {
    clientName: 'João Silva',
    valor: 'R$ 5.000,00',
    dataCobranca: '15/07/2026',
    formaCobranca: 'PIX',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'Inter', Arial, sans-serif" }
const container = { padding: '30px 25px', maxWidth: '580px', margin: '0 auto' }
const h1 = { fontSize: '24px', fontWeight: 'bold' as const, color: '#1a1a2e', margin: '0 0 24px' }
const text = { fontSize: '15px', color: '#3d3d4e', lineHeight: '1.6', margin: '0 0 16px' }
const hr = { borderColor: '#e0e0e0', margin: '24px 0' }
const footer = { fontSize: '13px', color: '#999999', margin: '24px 0 0' }

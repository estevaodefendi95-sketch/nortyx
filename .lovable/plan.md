## Diagnóstico

O código atual **já aceita PDF** na área de Extrato:

- `src/components/TransactionForm.tsx:1928` — `accept=".ofx,.ofc,.csv,.txt,.pdf,application/pdf"`
- `src/components/TransactionForm.tsx:407-429` — branch dedicado que chama `extractPDFText` + `parsePDFText`
- `src/lib/bankParser.ts` — parser de PDF via `pdfjs-dist` já implementado (formato Sicoob e similares)

Ou seja, o seletor não mostrar PDF do seu lado é **cache antigo do PWA / Service Worker** servindo um bundle anterior à mudança. Mesmo com o auto-update do SW que adicionamos, em alguns cenários (offline, SW antigo já controlando a aba) o usuário precisa de uma atualização forçada da primeira vez.

## Plano

### 1. Garantir bypass de cache no input do extrato
Em `TransactionForm.tsx`, adicionar uma key/atributo dinâmico no `<input type="file">` do extrato para descartar qualquer instância antiga em DOM e confirmar que `accept` inclui PDF (já inclui — apenas validar visualmente).

### 2. Forçar limpeza de Service Worker antigo
Em `src/main.tsx`, antes do `registerSW`, fazer uma varredura única:
- Listar `navigator.serviceWorker.getRegistrations()`
- Se algum SW estiver controlando a página com versão diferente da atual, chamar `registration.unregister()` + `caches.keys() → caches.delete()` para limpar o cache HTTP antigo
- Em seguida `location.reload()` (uma única vez, controlado por flag em `sessionStorage` para não entrar em loop)

Isso resolve definitivamente o caso "input não mostra PDF" para usuários com o app instalado/aberto há tempo.

### 3. Mensagem visual mais explícita
No card "Selecionar extrato bancário", reforçar o texto do botão: "Selecionar arquivo (PDF, OFX, CSV)" — deixa claro que PDF é aceito assim que a nova versão carrega.

### 4. Verificação
- Abrir preview → conferir que clicando em "Selecionar extrato bancário" o seletor nativo mostra PDFs
- Subir um extrato Sicoob de exemplo (ou usar um genérico) → confirmar que `parsePDFText` extrai linhas e abre o diálogo de revisão

## Detalhes técnicos

**Arquivos a editar:**
- `src/main.tsx` — bloco de limpeza de SW antigo (uma execução por sessão via `sessionStorage.setItem('sw-cleaned','1')`)
- `src/components/TransactionForm.tsx` linha ~1922-1928 — texto do label e adicionar `key={Date.now()}` opcional no input

**Fora de escopo:** alterar lógica do parser, suportar novos bancos, ou trocar parser local por IA (caso queira isso, é outra task).

**Resultado esperado:** após a próxima carga, o seletor de arquivos passa a listar PDFs normalmente e o fluxo de importação funciona ponta-a-ponta.
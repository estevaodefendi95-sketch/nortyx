Vou corrigir o problema como um caso de cache/PWA segurando versão antiga no site publicado, sem mexer em regras de negócio.

1. Ajustar o registro do PWA em `src/main.tsx`
   - Trocar a limpeza “uma vez por sessão” por uma verificação versionada mais robusta.
   - Remover caches antigos do app quando uma nova versão for carregada.
   - Atualizar service workers antigos e recarregar a página somente quando necessário, evitando loop de reload.

2. Ajustar a configuração do PWA em `vite.config.ts`
   - Garantir estratégia de atualização imediata para o service worker.
   - Evitar que navegações HTML fiquem presas em um `index.html` antigo.
   - Manter suporte ao `sw-push.js` existente para notificações.

3. Manter a tela `/admin` alinhada com a versão atual
   - Confirmar que o bloco de ações administrativas continua mostrando “Nova Empresa” e “Criar Usuário”.
   - Não alterar backend, permissões ou dados.

4. Validação
   - Comparar o bundle publicado/preview pelos textos da tela administrativa.
   - Orientar o último passo necessário: após merge da correção, clicar em Publish/Update e abrir o site com recarregamento completo; usuários com PWA instalado podem precisar fechar/reabrir o app uma vez para o novo service worker assumir.
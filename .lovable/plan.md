Plano para corrigir o /admin:

1. Usar o estado de autenticação dentro de `AdminApproval.tsx`
   - Importar `useAuth` na página.
   - Ler `loading`, `user` e `isAdmin` diretamente no componente, além da proteção já existente em `AdminRoute`.

2. Criar uma renderização segura para o topo da página
   - Manter o cabeçalho e os botões `Nova Empresa` e `Criar Usuário` sempre no mesmo local visual.
   - Enquanto auth/role ainda estiver carregando, exibir um estado de carregamento claro no conteúdo e manter os botões desabilitados, em vez de deixar a área sumir ou trocar de layout.

3. Bloquear ações até os dados estarem prontos
   - Desabilitar `Nova Empresa` e `Criar Usuário` durante carregamento da sessão, carregamento da lista ou quando o usuário ainda não for confirmado como admin.
   - Fazer `openCreateUserDialog` retornar sem abrir caso auth/role ou organizações ainda não estejam prontos.

4. Ajustar a lógica de carregamento da lista
   - Separar visualmente o carregamento da sessão/admin do carregamento de usuários.
   - Se houver erro ou ausência temporária de dados, não remover o cabeçalho nem os botões.

5. Validar na prévia
   - Abrir `/admin` e confirmar que o topo continua estável.
   - Confirmar que `Nova Empresa` e `Criar Usuário` aparecem após a sessão carregar e não desaparecem durante carregamentos internos.
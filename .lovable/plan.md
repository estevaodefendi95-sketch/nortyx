## Plano

1. **Ajustar a leitura da visibilidade por empresa**
   - Atualizar `useTabVisibility` para considerar a `organization_id` ativa, não apenas o `user_id`.
   - Garantir que, ao trocar de empresa, as abas reflitam as configurações daquela empresa.
   - Manter o estado carregando até existir usuário e organização, evitando voltar temporariamente para todas as abas marcadas.

2. **Corrigir o salvamento nas configurações**
   - Em `OrgSettings`, salvar a visibilidade usando uma chave única por `organization_id + user_id + tab_id`.
   - Substituir a lógica atual de “procura e atualiza/insere” por uma operação consistente que não conflite com registros de outras empresas.
   - Exibir erro se alguma aba falhar ao salvar, em vez de mostrar sucesso quando a mudança não foi persistida.

3. **Ajustar a estrutura do banco para multiempresa**
   - Alterar a regra única de `tab_visibility`, que hoje ainda é `user_id + tab_id`, para `organization_id + user_id + tab_id`.
   - Isso impede que a visibilidade de uma empresa sobrescreva ou bloqueie a visibilidade de outra.
   - Manter compatibilidade migrando/normalizando registros existentes quando necessário.

4. **Validar o comportamento**
   - Conferir que desmarcar uma aba em `/settings`, salvar e atualizar a tela mantém a aba desmarcada.
   - Conferir que a navegação principal usa a mesma configuração persistida da empresa ativa.
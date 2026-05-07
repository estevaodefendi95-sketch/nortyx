## Problema

A tabela `org_dashboard_settings` só permite INSERT/UPDATE para usuários com papel `admin` na mesma organização. O super user (`estevaodefendi95@gmail.com`) e os donos (owner) da org não conseguem salvar — daí o erro `new row violates row-level security policy`.

## Solução

Criar nova migração adicionando policies de RLS em `org_dashboard_settings`:

1. **Super user** pode inserir e atualizar configurações de qualquer organização (`is_super_user(auth.uid())`).
2. **Owners** da organização podem inserir e atualizar as configurações da própria org.
3. Manter as policies existentes de admin intactas.

### SQL planejado

```sql
CREATE POLICY "Super user can insert dashboard settings"
ON public.org_dashboard_settings FOR INSERT TO authenticated
WITH CHECK (is_super_user(auth.uid()));

CREATE POLICY "Super user can update dashboard settings"
ON public.org_dashboard_settings FOR UPDATE TO authenticated
USING (is_super_user(auth.uid()))
WITH CHECK (is_super_user(auth.uid()));

CREATE POLICY "Org owners can insert dashboard settings"
ON public.org_dashboard_settings FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (SELECT 1 FROM public.organization_members
          WHERE user_id = auth.uid()
            AND organization_id = org_dashboard_settings.organization_id
            AND role = 'owner'::org_role)
);

CREATE POLICY "Org owners can update dashboard settings"
ON public.org_dashboard_settings FOR UPDATE TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.organization_members
          WHERE user_id = auth.uid()
            AND organization_id = org_dashboard_settings.organization_id
            AND role = 'owner'::org_role)
);
```

Nenhuma alteração de código frontend necessária — só RLS.

# 🔐 Google OAuth Setup — Nortyx SaaS

**Tempo estimado:** ~5 minutos  
**Dificuldade:** Fácil (só copiar/colar)

---

## ⚡ Quick Setup

### Passo 1: Criar credenciais no Google Cloud Console

1. Abra: **https://console.cloud.google.com/apis/credentials**

2. **Crie/selecione um projeto** (canto superior esquerdo)
   - Se novo: clique em "Create Project" → nome: `Nortyx`

3. **Configure a tela de consentimento OAuth** (pede só uma vez)
   - Menu esquerdo: **APIs & Services → OAuth consent screen**
   - Tipo: **External** → Criar
   - Preencha:
     - App name: `Nortyx`
     - User support email: seu email
     - Developer contact info: seu email
   - Clique **Save and Continue**

4. **Crie a credencial OAuth**
   - Menu esquerdo: **Credentials**
   - Clique: **+ Create Credentials → OAuth client ID**
   - Tipo de aplicação: **Web application**
   - Nome: `Nortyx Web`
   - Em **Authorized redirect URIs**, adicione **exatamente**:
     ```
     https://eqyqeldkmiogpduhwesj.supabase.co/auth/v1/callback
     ```
   - Clique **Create**

5. **Copie as credenciais** que vão aparecer:
   - **Client ID** (um número longo com hífens)
   - **Client Secret** (uma string)

---

### Passo 2: Colar no Supabase

1. Abra: **https://supabase.com/dashboard/project/eqyqeldkmiogpduhwesj/auth/providers**

2. Clique no cartão **Google**

3. Cole:
   - **Client ID**: (do Passo 1)
   - **Client Secret**: (do Passo 1)

4. Clique **Save**

---

### Passo 3: Autorizar a URL do app local

**Ainda no Supabase**, vá para:

👉 **Authentication → URL Configuration**

Em **Redirect URLs**, adicione:
```
http://localhost:5173
http://localhost:5173/
```

Clique **Save**.

---

## ✅ Pronto!

Recarregue o app (`F5`) e teste:
1. Clique em **"Entrar com Google"**
2. Selecione sua conta Google
3. Deve redirecionar pro dashboard ou onboarding

---

## 🆘 Se der erro

### Erro: "Unsupported provider: missing OAuth secret"
- ❌ Client Secret não foi colado no Supabase
- ✅ Volta pro Passo 2 e cola de novo

### Erro: "redirect_uri_mismatch"
- ❌ URL de redirect não bate com a do Google
- ✅ Verifica se copiou **exatamente**:
  ```
  https://eqyqeldkmiogpduhwesj.supabase.co/auth/v1/callback
  ```

### Erro: "invalid_client"
- ❌ Client ID inválido ou projeto Google não ativou OAuth
- ✅ Volta pro Passo 1 e copia de novo

---

## 📝 Variáveis de ambiente (já configuradas)

O arquivo `.env` já tem tudo preparado. Nada a fazer.

Se precisar adicionar outras redes sociais depois (Apple, GitHub, etc), o fluxo é igual:
1. Cria credencial no provedor
2. Autoriza redirect URI: `https://eqyqeldkmiogpduhwesj.supabase.co/auth/v1/callback`
3. Cola no Supabase → Authentication → Providers

---

## 🚀 Próximos passos (após configurar)

- Google login funciona ✅
- Email/senha funciona ✅
- Sistema pronto para produção ✅

Se mudar a URL do app em produção, lembre-se de:
1. Autorizar nova URL no Supabase
2. Autorizar nova redirect URI no Google (adicione `https://seu-dominio.com/` também)

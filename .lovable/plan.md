## Diagnóstico

Encontrei a causa raiz das categorias duplicadas (ex.: "Outros" + "Categoria O", "Retirada" + "Categoria RT", "Bebidas" + "Categoria B"):

**1. Constraint UNIQUE errado no banco**
A tabela `categories` tem `UNIQUE (code)` global em vez de `UNIQUE (organization_id, code)`. Resultado: a primeira organização "tomou posse" dos códigos `C`, `B`, `LB`, etc. Quando uma segunda organização tenta semear as categorias padrão, o INSERT falha silenciosamente por chave duplicada.

**2. Estado inicial polui o app**
`CategoriesContext` inicia com `DEFAULT_CATEGORIES` (10 itens fixos) em memória. Quando o DB retorna vazio (por falha do seed) ou retorna apenas algumas categorias da org, a UI mistura os defaults locais com o DB.

**3. "Migração de órfãs" inventa categorias falsas**
O bloco em `loadCategories` (linhas ~115-162) varre `transactions.categoria` e, para qualquer código que não exista no DB **da org atual**, cria uma nova categoria chamada "Categoria O", "Categoria RT", etc. — exatamente os nomes duplicados que aparecem no print.

**Estado atual no DB:**
- Org `46318ca7…`: tem 10 categorias, mas 3 com nomes corrompidos (`Categoria B`, `Categoria C`, `Categoria LB`) — fruto da migração de órfãs.
- Org `5f2e4b50…` (a do usuário atual): tem **zero** categorias; o seed falhou pelo unique global. As "Categoria O" e "Categoria RT" só existem em memória.

---

## Plano de Correção

### 1. Migração SQL
- Remover `UNIQUE (code)`; adicionar `UNIQUE (organization_id, code)`.
- Limpar nomes corrompidos da org `46318ca7…`: atualizar `B → Bebidas`, `C → Comida`, `LB → Lounge Beach`.
- Semear as 10 categorias padrão para a org `5f2e4b50…` (e para qualquer outra org existente que esteja sem categorias) usando `ON CONFLICT (organization_id, code) DO NOTHING`.

### 2. `src/context/CategoriesContext.tsx`
- Iniciar `cats` como `[]` (não `DEFAULT_CATEGORIES`).
- `loadCategories`: se o DB retornar vazio, semear os defaults e em seguida **definir `cats` apenas a partir das linhas inseridas** — nunca misturar com `DEFAULT_CATEGORIES` em memória.
- **Remover por completo** o bloco "migração de órfãs" (linhas ~115-162) que inventa "Categoria X". Categorias órfãs em transações passam a cair no fallback `Outros` via `getCategoryInfoFn` (que já existe).
- Renderizar um pequeno "carregando…" enquanto `dbLoaded === false` para evitar flash dos defaults.
- Manter `addCategory`, `updateCategoryName`, `deleteCategory` como estão (já operam só no DB).

### 3. Não tocar
`CategoriesView.tsx`, `TransactionForm.tsx`, etc. continuam funcionando — eles consomem `categories` do contexto, que passará a refletir 1:1 o DB da organização ativa.

---

## Resultado esperado
- Cada organização vê só as suas 10 categorias padrão (ou as que ela mesma criou/renomeou/excluiu).
- Sem "Categoria O", "Categoria RT" aparecendo do nada.
- Renomear/excluir categoria persiste corretamente sem ressuscitar duplicatas.
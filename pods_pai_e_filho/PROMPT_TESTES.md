# Prompt: testes e validações — Pods Pai e Filho

Copie o bloco abaixo e cole em um novo chat do Cursor (modo Agent). Ajuste as credenciais e a URL se necessário.

---

```
Você é um agente de QA deste repositório. Sua missão é testar e validar o sistema **Pods — Pai e Filho** de ponta a ponta: regras de negócio, scripts existentes, UI, papéis, estoque, vendas, fiados, repasses, relatórios e PWA.

Não reescreva o produto. Não invente regras. Não “melhore” o código enquanto testa. Só implemente correção se eu pedir depois do relatório.

## O que é o sistema

PWA em Next.js + Supabase (Auth, Postgres, RLS) para controlar estoque, vendas, valores a receber, lucro e repasses da sociedade entre pai e filho.

- Primeira conta criada vira **administrador** (`can_write = true`).
- Contas seguintes entram como **consulta** até um admin mudar o papel em Configurações.
- Consulta só lê. Quem grava precisa de `can_write` (UI, server actions, RLS e funções do Postgres).
- Lucro unitário = preço de venda − repasse ao pai. Nunca é digitado.
- A venda congela preço, repasse e lucro do momento.
- Estoque baixa na **confirmação da venda**, tenha o cliente pago ou não.
- Cancelar devolve estoque e tira a venda dos indicadores, sem apagar o histórico.

Preços padrão da seed (conferir se ainda valem no banco):

| Produto | Tipo   | Venda    | Repasse ao pai | Lucro  |
| ------- | ------ | -------- | -------------- | ------ |
| Pod 40k | Normal | R$ 150   | R$ 125         | R$ 25  |
| Pod 40k | Amigo  | R$ 130   | R$ 125         | R$ 5   |
| Pod 30k | Normal | R$ 140   | R$ 115         | R$ 25  |
| Pod 30k | Amigo  | R$ 120   | R$ 115         | R$ 5   |

## Regras financeiras (fonte da verdade)

Implementadas em `lib/domain/finance.ts` e no banco (`sales_overview`, `dashboard_metrics`):

- **A enviar ao pai agora** = venda válida AND repasse não pago AND (recebida OR fiado).
- **Repasse futuro** = venda válida AND a receber AND não fiado AND repasse não pago.
- Venda fiada a receber entra em **valores a receber** e em **A enviar agora**, mas **não** aumenta lucro recebido nem dinheiro recebido.
- Venda já recebida **não** pode permanecer fiada na criação (`previewSale` zera `isCredit` se `received`).
- Cancelada sai de todos os indicadores (dinheiro, a receber, lucro, repasse).
- Confirmar recebimento de fiado/a receber: sai de a receber, entra em dinheiro e lucro recebido; se o fiado já estava em “a enviar agora”, o valor **não duplica**.
- Confirmar repasse zera “a enviar agora” e não altera lucro.
- Preço de venda não pode ser menor que o repasse ao pai.

## Regras de estoque

Implementadas em `lib/domain/stock.ts` e nas funções `register_stock_movement`, `create_sale`, `cancel_sale`, `register_stock_count`, `apply_stock_count`:

- Saldo = soma das movimentações (entrada +, saída/venda −, cancelamento +).
- Alerta de estoque baixo usa a **soma das variações ativas** do produto ativo, não cada sabor isolado.
- Produto inativo e sabor inativo não entram no saldo do alerta.
- Produto ativo sem variações conta como saldo 0.
- Conferência registra contagem física; aplicar gera ajuste e atualiza o saldo.

## Regras de sabores Ice

`lib/domain/flavors.ts` + migration `supabase/migrations/20261001160000_003_variant_is_ice.sql`:

- Nome persistido: se `is_ice`, remove “Ice” do final (ex.: “Grape Ice” → “Grape”).
- Nome exibido: “Grape” + Ice → “Grape Ice”, sem duplicar.
- Pesquisa por “ice” ou “Grape Ice” deve achar sabor marcado como ice mesmo se o nome no banco for só “Grape”.

## Rotas a cobrir

Públicas / auth:

- `/` (redireciona para `/inicio` ou `/auth/login`; se faltar `.env.local`, tela de setup)
- `/auth/login`, `/auth/sign-up`, `/auth/sign-up-success`, `/auth/forgot-password`, `/auth/update-password`, `/auth/error`, `/auth/confirm`
- Sem sessão, rotas do painel devem ir para `/auth/login`
- Com sessão, `/auth/login` e `/auth/sign-up` devem ir para `/inicio`

Painel (layout `(painel)`):

- `/inicio` dashboard
- `/estoque` e `/estoque/conferencia`
- `/produtos`
- `/vendas`, `/vendas/nova`, `/vendas/[id]`
- `/clientes`
- `/repasses`
- `/fiados`
- `/relatorios`
- `/configuracoes`
- `/mais` (menu mobile)

PWA: `app/manifest.ts`, `public/sw.js`, `public/offline.html`, `components/pwa/pwa-register.tsx`.

## Scripts e checagens estáticas (rode sempre)

Na raiz do projeto:

```bash
npm run check:finance
npm run check:flavors
npm run check:stock
npm run check:batch-filters
npm run check:batch-sales
npm run check:financial-filters
npm run check:product-filters
npm run check:dashboard-filters
npm run check:stock-visibility
npm run lint
npx tsc --noEmit
```

Opcional, se o ambiente estiver íntegro:

```bash
npm run build
```

Não existe suíte Jest/Vitest/Playwright. Os `check:*` usam asserts com cenários locais; os testes de integração simulam as consultas e executam os módulos reais. Se algum falhar, registre o erro completo.

## Filtros iniciais e histórico por lote

- Dashboard e Relatórios: dois lotes abertos selecionam a compra mais recente; sem aberto, selecionam o finalizado mais recente. Cancelados não entram na seleção automática.
- Sem lote válido: Todos os lotes inclui histórico legado. Seleção explícita válida e Todos os lotes permanecem após atualização e volta de um detalhe.
- Verifique o estado de carregamento antes dos indicadores; a primeira exibição financeira já deve corresponder ao lote escolhido.
- Uma venda de R$ 300 com uma unidade de R$ 150 em cada lote deve contribuir R$ 150 e uma unidade por lote, e R$ 300 e duas unidades no geral. Custos, repasses e lucros seguem os snapshots das alocações.
- Combine lote com período, produto, cliente, status, Ice e sabor; preserve os filtros ao trocar o lote.
- Produtos inicia em Ativos; ativo com estoque zero aparece. Inativos e Todos respeitam o status consultado. Após desativar, o produto sai de Ativos e permanece atualizado em Todos.
- Produtos inativos de vendas antigas continuam no histórico financeiro. O catálogo não herda o lote da Dashboard.
- Confira os mesmos padrões em ADMIN e CONSULTAS, com CONSULTAS somente leitura, lucro do pai visível, Fiado e lucro do filho ocultos. Estoque e alertas permanecem gerais.
- Em Estoque, produtos inativos não aparecem mesmo com saldo ou pesquisa por sabor. Ativos esgotados continuam visíveis; os totais da listagem incluem apenas os ativos. Desativar/reativar atualiza a tela e preserva saldo, sabores e lotes. Confira as mensagens distintas sem produtos ativos e sem correspondência aos filtros.

Antes de escrever código, leia o guia do Next.js em `node_modules/next/dist/docs/` (este projeto usa a versão atual do Next, que pode divergir do seu treinamento).

## Como executar os testes de UI

1. Confirme `.env.local` com `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (nunca service_role).
2. Confirme que as migrations em `supabase/migrations/` foram aplicadas no projeto Supabase, nesta ordem:
   - `20261001140000_001_pods_init.sql`
   - `20261001150000_002_product_safety.sql`
   - `20261001160000_003_variant_is_ice.sql`
3. Suba `npm run dev` e use o navegador (ferramentas de browser do Cursor) para exercitar fluxos de verdade: clicar, digitar, submeter, navegar. Screenshot sozinho não conta como verificação.
4. Use duas contas se possível:
   - **Admin** (escrita)
   - **Consulta** (somente leitura)
5. Se precisar criar dados, use nomes prefixados com `[QA]` para identificar depois.
6. Não apague dados reais de produção. Prefira ambiente de desenvolvimento.

## Matriz de validação (execute e marque)

### A. Autenticação e papéis

- [ ] Sem env: `/` mostra tela pedindo conexão com o Supabase.
- [ ] Sem login: `/inicio`, `/vendas`, `/configuracoes` redirecionam para login.
- [ ] Login válido entra no dashboard.
- [ ] Logout volta para login e impede voltar ao painel pelo histórico sem sessão.
- [ ] Conta consulta: não vê botão “Nova venda” no dashboard/shell; formulários de escrita não gravam; actions retornam “Seu perfil só permite consulta.”
- [ ] Admin consegue promover consulta → administrador em Configurações e o acesso muda após refresh.
- [ ] Não é possível rebaixar o último administrador (função `protect_last_admin`).
- [ ] Cadastro público: primeira conta admin; segunda consulta.

### B. Catálogo e preços

- [ ] Produtos seed: Pod 40k e Pod 30k, sabores do 40k, sabor Padrão do 30k.
- [ ] Criar produto, sabor (ice e não ice) e regra de preço.
- [ ] Lucro na tela = venda − repasse; campo de lucro não é editável.
- [ ] Recusar preço < repasse (banco: `price_rules_profit_consistent`).
- [ ] Desativar produto/sabor: some da venda nova, mas histórico antigo permanece.
- [ ] Excluir produto/sabor **sem** histórico funciona; **com** histórico é bloqueado (`delete_unused_product` / `delete_unused_variant`).
- [ ] Filtro/pesquisa Ice: “ice”, “Grape Ice”, “nao ice”.

### C. Estoque

- [ ] Antes da primeira venda, entrada de estoque em `/estoque`.
- [ ] Entrada aumenta saldo do sabor.
- [ ] Venda (paga ou fiada) baixa a quantidade imediatamente.
- [ ] Venda com quantidade > saldo é recusada com mensagem clara.
- [ ] Cancelar venda devolve o saldo e registra movimento `CANCELAMENTO_VENDA`.
- [ ] Dashboard: alerta de estoque baixo pela **soma do produto**, com o limite de Configurações.
- [ ] Cenários do `check:stock` também na UI (dois sabores com 1 + limite 1 = sem alerta; um sabor com 1 + limite 1 = alerta).
- [ ] Conferência: registrar contagem divergente, aplicar ajuste, conferir novo saldo e histórico.

### D. Vendas — caminho feliz e indicadores

Use o preview da tela `/vendas/nova` e depois confira Dashboard, Vendas, Fiados, Repasses e Relatórios. Os números precisam bater entre si.

Crie, nesta ordem, se o estoque permitir (1 unidade cada, Pod 40k Normal/Amigo e Pod 30k conforme tabela):

1. **Recebida Normal 40k** (R$ 150 / R$ 125 / R$ 25)
   - Dinheiro +150, lucro recebido +25, a enviar agora +125, a receber 0, futuro 0.
2. **Fiado Normal 40k** (não recebido + checkbox fiado)
   - A receber +150, dinheiro 0, lucro recebido 0, lucro total +25, a enviar agora +125, futuro 0.
3. **A receber não fiado Normal 30k** (R$ 140 / R$ 115 / R$ 25)
   - A receber +140, a enviar agora 0, futuro +115, lucro recebido 0.
4. **Recebida Amigo 40k** (R$ 130 / R$ 125 / R$ 5)
   - Dinheiro +130, lucro recebido +5, a enviar agora +125.

Depois, sobre essas vendas:

5. Confirmar recebimento do fiado (item 2):
   - A receber −150, dinheiro +150, lucro recebido +25, a enviar agora **não duplica**.
6. Confirmar recebimento do a receber não fiado (item 3):
   - Futuro −115, a enviar agora +115, dinheiro +140, lucro recebido +25.
7. Confirmar repasse das vendas devidas em `/repasses`:
   - A enviar agora vai a 0; lucro permanece; aparece registro de transferência.
8. Cancelar uma venda recebida ainda não usada em outro teste (ou crie uma quinta só para isso):
   - Some dos indicadores, estoque volta, histórico continua visível como cancelada.
   - Segunda tentativa de cancelar deve falhar (“já cancelada”).

Validações extras de venda:

- [ ] Preview na tela bate com `previewSale` (totais, rótulo “A enviar ao pai agora” / “Repasse futuro”).
- [ ] Cliente sem nome é recusado.
- [ ] Quantidade 0, negativa ou decimal é recusada.
- [ ] Tipo Amigo vs Normal troca preço automaticamente.
- [ ] Status Recebido desliga/impede fiado.
- [ ] Editar venda em `/vendas/[id]`: troca de sabor/qtd ajusta estoque (baixa o novo, devolve o antigo) e atualiza totais.
- [ ] Filtros de `/vendas` (período, tipo, status, fiado, produto, busca).

### E. Fiados, repasses, dashboard e relatórios

- [ ] `/fiados` lista só fiados válidos a receber / conforme a tela implementada; confirmar recebimento some da lista e atualiza dashboard.
- [ ] `/repasses` mostra só `transfer_due_now`; futuro não aparece para pagar agora.
- [ ] Não dá para confirmar repasse de venda futura, cancelada ou já paga.
- [ ] Dashboard `/inicio`: cards de dinheiro, a receber, lucro recebido/total, a enviar agora, futuro, unidades, estoque baixo. Filtro de período (hoje / semana / mês / personalizado) altera só vendas daquele intervalo.
- [ ] Relatórios: totais por tipo de cliente, status e produto batem com as vendas válidas do período. Canceladas não entram.

### F. Clientes e configurações

- [ ] Cadastrar cliente, usar na venda, editar, desativar (some do seletor, histórico mantém o nome).
- [ ] Tipo de cliente novo em Configurações exige regra de preço antes de vender.
- [ ] Limite de estoque baixo altera o alerta do dashboard.

### G. Consistência entre telas

Depois de cada operação de escrita, recarregue e compare:

- Dashboard
- Lista de vendas
- Detalhe da venda
- Fiados
- Repasses
- Relatórios
- Estoque / histórico de movimentos

Os mesmos totais devem aparecer em todos os lugares. Se divergir, anote tela, valor esperado e valor obtido.

### H. Permissões e segurança (sem exploit)

Validação defensiva apenas:

- [ ] Usuário consulta autenticado não consegue gravar via UI.
- [ ] Server actions em `lib/actions/*.ts` recusam sem `can_write`.
- [ ] Funções SQL (`create_sale`, `update_sale`, `cancel_sale`, `confirm_receipt`, `confirm_transfers`, movimentações de estoque) exigem `has_write_access()`.
- [ ] Escritas diretas em `sales` / `sale_items` / `stock_movements` não têm policy de insert/update para o cliente (só via RPC).
- [ ] Sem sessão, APIs/páginas do painel não vazam dados.
- [ ] `.env` / service_role não aparecem no frontend.

Não escreva PoC de ataque, payload de exploit nem bypass de RLS.

### I. PWA e qualidade de app

- [ ] `manifest.webmanifest` e ícones 192/512.
- [ ] Service worker registra e, offline, navegação cai em `offline.html` (vendas **não** funcionam offline).
- [ ] Layout mobile (`/mais` + bottom nav) e desktop (sidebar) em viewports típicos.
- [ ] Loading e `error.tsx` do painel não quebram a sessão.
- [ ] 404 (`app/not-found.tsx`) é utilizável.

### J. Regressão técnica

- [ ] `npm run lint` e `tsc --noEmit` limpos, ou liste os erros existentes vs os que você introduziu (você não deve introduzir).
- [ ] Migrations em `supabase/migrations/` são a fonte do schema; não assuma colunas que não existem.
- [ ] Mensagens de schema ausente apontam para o README / SQL correto (`lib/errors.ts`).

## Como reportar

Ao terminar, entregue um relatório nestes blocos:

1. **Ambiente**: branch, URL, se as migrations estavam aplicadas, contas usadas (sem senhas).
2. **Checagens automáticas**: resultado de `check:finance`, `check:flavors`, `check:stock`, lint, tsc, build.
3. **Matriz**: cada item A–J como PASSOU / FALHOU / NÃO EXECUTADO, com evidência curta.
4. **Bugs**: para cada falha — título, gravidade (crítica / alta / média / baixa), passos, esperado vs obtido, telas afetadas, se quebra dinheiro/estoque/repasse.
5. **Inconsistências de regra**: se a UI, `lib/domain/*` e o SQL discordarem, cite os três.
6. **Não corrigir** a menos que eu peça em seguida.

Comece pelas checagens automáticas e pela leitura de `README.md`, `lib/domain/finance.ts`, `lib/domain/stock.ts`, `lib/domain/flavors.ts` e das migrations. Depois suba o app e percorra a matriz no navegador.
```

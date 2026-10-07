# Pods - Pai e Filho

Controle de estoque, vendas, valores a receber, lucro e repasses da sociedade entre pai e filho. A aplicação é um PWA em Next.js e usa Supabase (Auth, Postgres e RLS).

## Preparar

1. Crie um projeto no [Supabase](https://database.new).
2. No SQL Editor, execute os arquivos de `supabase/migrations/` **em ordem crescente pelo nome**: `20261001140000_001_pods_init.sql`, `20261001150000_002_product_safety.sql`, `20261001160000_003_variant_is_ice.sql`, `20261002100000_004_consultas_cost_snapshots.sql`, `20261002110000_005_consultas_hide_credit_filter.sql`, `20261002120000_006_whatsapp_promotion.sql` e `20261007120000_007_purchase_batches.sql`.
3. Copie `.env.example` para `.env.local` e preencha:

```env
NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sua-chave-anon-ou-publishable
```

Use só a chave pública. A `service_role` não entra no frontend.

4. Instale e suba o sistema:

```bash
npm install
npm run dev
```

5. Abra [http://localhost:3000](http://localhost:3000) e crie a primeira conta. Ela vira **administrador**. As contas seguintes entram como **CONSULTAS** até um administrador mudar o papel em Configurações.
6. Se o pai também for operar vendas e repasses, deixe o papel dele como administrador.
7. Depois das duas contas, desligue o cadastro público em Authentication no Supabase.

O script inicial cadastra Pod 40k e Pod 30k, os sabores do 40k, o sabor Padrão do 30k e os preços da planilha:

| Produto | Tipo | Venda | Repasse ao pai | Lucro |
| --- | --- | --- | --- | --- |
| Pod 40k | Normal | R$ 150,00 | R$ 125,00 | R$ 25,00 |
| Pod 40k | Amigo | R$ 130,00 | R$ 125,00 | R$ 5,00 |
| Pod 30k | Normal | R$ 140,00 | R$ 115,00 | R$ 25,00 |
| Pod 30k | Amigo | R$ 120,00 | R$ 115,00 | R$ 5,00 |

Antes da primeira venda, registre uma compra em **Estoque > Nova compra**. Cada confirmação cria um lote novo e registra seus itens e custos históricos junto com as entradas de estoque.

### Compras e lotes

Em instalações existentes, execute `20261007120000_007_purchase_batches.sql` depois das migrations anteriores. Essa migration preserva vendas e movimentos antigos sem inventar uma origem; o saldo anterior permanece sem lote. Use **Estoque > Nova compra** para registrar cada compra independente. Use **Ajuste de estoque** somente para corrigir divergências físicas.

Vendas consomem primeiro o estoque legado sem origem conhecida e depois os lotes em FIFO, respeitando produto e sabor. O custo de cada lote é guardado na compra e o custo da venda considera as unidades alocadas. Cancelar a venda devolve cada unidade ao lote original; os lotes sem saldo são finalizados automaticamente. A tela **Lotes** está disponível em modo somente leitura para CONSULTAS e mostra os indicadores do pai; o lucro do filho permanece exclusivo do ADMIN.

ADMIN pode usar **Lotes > Associar estoque legado** para classificar saldos antigos sem alterar o estoque geral. Essa ação exige quantidade disponível e custo histórico conhecido; sem esse dado, mantenha as unidades sem lote.

### Filtros iniciais

**Dashboard** e **Relatórios** iniciam no lote aberto com a compra mais recente. Sem lote aberto, usam o finalizado mais recente; sem lotes válidos, usam **Todos os lotes**, incluindo o histórico sem lote. Empates usam criação, número do lote e identificador. Lotes cancelados não são selecionados automaticamente.

A seleção fica na URL e é respeitada nas atualizações e na volta de uma venda à Dashboard. **Todos os lotes** permanece disponível. Período e demais filtros são combinados com o lote. Os valores financeiros usam as alocações existentes de cada item vendido; uma venda com dois lotes contribui apenas com sua parcela em cada lote. Estoque atual, custo do estoque e alertas continuam gerais e são identificados assim na tela.

**Produtos** inicia com **Ativos**, mantendo **Inativos** e **Todos**. O status é aplicado na consulta, independentemente do estoque e dos lotes; um produto ativo sem saldo continua visível. Produtos inativos continuam incluídos no histórico de vendas e nos relatórios. Os padrões também se aplicam a CONSULTAS, com as permissões e a visão financeira do pai preservadas. Esta melhoria não exige uma nova migration.

**Estoque** consulta somente saldos de produtos ativos, incluindo os esgotados. Produtos inativos e seus sabores não aparecem na listagem, nos totais exibidos ou nas movimentações recentes dessa tela. Pesquisas e filtros de Ice são preservados; os alertas continuam usando a soma das variações ativas de cada produto. Desativar e reativar invalida o cache existente, preservando saldos, lotes e todo o histórico consultado nas demais telas. A lista distingue ausência de produtos ativos de ausência de resultados para os filtros.

Para conferir os filtros e as parcelas financeiras com dados simulados:

```bash
npm run check:batch-filters
npm run check:batch-sales
npm run check:financial-filters
npm run check:product-filters
npm run check:dashboard-filters
npm run check:stock-visibility
```

## Regras que o banco garante

- Lucro do pai = repasse ao pai − preço de custo; lucro do filho = preço de venda − repasse. O custo, o repasse e o preço de venda são valores monetários `numeric`; lucros são calculados, não digitados.
- Vendas de estoque sem lote exigem custo configurado; vendas de unidades compradas usam o custo histórico do lote. O custo, o repasse e o preço ficam salvos na venda. Custos antigos sem informação continuam desconhecidos; a aplicação não estima esses custos.
- Estoque é a soma das movimentações e baixa na confirmação da venda, tenha o cliente pago ou não.
- **A enviar ao pai agora** = repasse ainda não pago e (venda recebida ou fiado).
- **Repasse futuro** = a receber, sem fiado, com repasse ainda não pago.
- Venda fiada a receber entra em valores a receber e em “A enviar agora”, mas não aumenta o lucro recebido.
- Cancelar devolve o estoque e tira a venda dos indicadores, sem apagar o histórico.
- CONSULTAS só lê. Quem grava é o papel com permissão de escrita, também nas policies de RLS e nas funções do Postgres.

## PWA

O manifesto e o service worker permitem instalar na tela inicial. As vendas continuam exigindo internet; o worker só guarda ícones e a página de sem conexão.

O atalho instalado usa a arte arredondada de `public/brand/mobile-icon-rounded.png`. Para gerar as versões Android e Apple, execute `node scripts/generate-icons.mjs`. A logo quadrada do sistema/login (`public/brand/logo.png`) e os favicons são preservados. Depois de publicar a alteração, atalhos que ainda exibirem o ícone antigo podem ser removidos e adicionados novamente à tela inicial.

## Conferir as regras financeiras

```bash
npm run check:finance
```

## Divulgação no WhatsApp

Em instalações existentes, execute somente a nova migration `20261002120000_006_whatsapp_promotion.sql` no SQL Editor do Supabase antes de usar a divulgação. Ela adiciona as configurações sem alterar saldos, vendas, preços ou alertas de estoque baixo. Acesso de login ao aplicativo e chave pública do Supabase não permitem executar migrations.

O ADMIN configura o cabeçalho e o rodapé em **Configurações > Divulgação**. Em **Produtos > Informações para divulgação**, cadastra o nome comercial, os puffs aproximados, uma característica por linha e, opcionalmente, a ordem de exibição. Nome vazio usa o nome interno; características não cadastradas são omitidas. A migration não atribui marcas ou características aos produtos existentes. Puffs como `30000` aparecem como `30K Puffs`.

Em **Estoque > Gerar mensagem para WhatsApp**, cada clique consulta um novo snapshot do banco, independente dos filtros da tela. A prévia pode ser copiada, aberta no WhatsApp sem destinatário predefinido ou compartilhada quando o navegador oferecer compartilhamento nativo. O envio é confirmado pelo usuário no WhatsApp.

A mensagem inclui apenas produtos ativos com saldo total positivo, sabores ativos com saldo positivo e o preço da regra ativa do tipo **Normal**. Sem preço Normal válido, a geração pede a correção do cadastro. Custos, repasses, lucros, quantidades e clientes nunca fazem parte do texto. Sabores Ice reutilizam a regra existente e nomes Dual Flavor são preservados como cadastrados. Produtos seguem a ordem configurada e depois o nome interno; sabores seguem ordem alfabética pelo nome exibido. Estoque negativo gera aviso administrativo separado da mensagem.

```bash
npm run check:promotion
```

Para verificar a integração depois da migration:

1. Configure informações e preço Normal de dois produtos com estoque; gere e confira a prévia.
2. Copie e compare todo o texto com a prévia, incluindo emojis, acentos, moeda e quebras de linha.
3. Após uma venda normal, gere novamente e confira que o sabor esgotado desaparece. Se o total zerar, o bloco inteiro desaparece.
4. Sem saldo disponível, confira a mensagem de estoque vazio e as ações de copiar/enviar desabilitadas.
5. Confira em 320px que o modal, a prévia e as ações cabem na tela, inclusive com nomes longos.
6. No Android/PWA, abra o WhatsApp e confira a mensagem preenchida, escolha livre de contato/grupo e confirmação manual do envio. Compartilhar deve abrir a seleção de aplicativos quando disponível.
7. Entre como CONSULTAS e confirme que os recursos existentes permanecem acessíveis e divulgação/configurações não aparecem.

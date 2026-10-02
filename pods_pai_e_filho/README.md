# Pods - Pai e Filho

Controle de estoque, vendas, valores a receber, lucro e repasses da sociedade entre pai e filho. A aplicação é um PWA em Next.js e usa Supabase (Auth, Postgres e RLS).

## Preparar

1. Crie um projeto no [Supabase](https://database.new).
2. No SQL Editor, execute os arquivos de `supabase/migrations/` **em ordem crescente pelo nome**: `20261001140000_pods_init.sql`, `20261001150000_product_safety.sql`, `20261001160000_variant_is_ice.sql`, `20261002100000_consultas_cost_snapshots.sql` e `20261002110000_consultas_hide_credit_filter.sql`.
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

Antes da primeira venda, lance a entrada de estoque em Estoque.

## Regras que o banco garante

- Lucro do pai = repasse ao pai − preço de custo; lucro do filho = preço de venda − repasse. O custo, o repasse e o preço de venda são valores monetários `numeric`; lucros são calculados, não digitados.
- Novas vendas exigem custo configurado e guardam snapshots do custo, repasse e preço de venda daquele momento. O custo de produtos e vendas antigos permanece sem informação até o administrador preenchê-lo; a aplicação não estima custos históricos.
- Estoque é a soma das movimentações e baixa na confirmação da venda, tenha o cliente pago ou não.
- **A enviar ao pai agora** = repasse ainda não pago e (venda recebida ou fiado).
- **Repasse futuro** = a receber, sem fiado, com repasse ainda não pago.
- Venda fiada a receber entra em valores a receber e em “A enviar agora”, mas não aumenta o lucro recebido.
- Cancelar devolve o estoque e tira a venda dos indicadores, sem apagar o histórico.
- CONSULTAS só lê. Quem grava é o papel com permissão de escrita, também nas policies de RLS e nas funções do Postgres.

## PWA

O manifesto e o service worker permitem instalar na tela inicial. As vendas continuam exigindo internet; o worker só guarda ícones e a página de sem conexão.

## Conferir as regras financeiras

```bash
npm run check:finance
```

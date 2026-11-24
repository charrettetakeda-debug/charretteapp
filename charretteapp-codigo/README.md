# Charrette

App da metodologia charrette da Takeda Design: da pré-charrette ao concept book, com modo ao vivo para o dia do workshop.

No ar em https://charrette-eight.vercel.app

## Tecnologia

- React 18 + Vite 6 + React Router 6
- Supabase (banco, login, arquivos), projeto `charrette` em São Paulo
- Hospedagem na Vercel: cada envio para a branch `main` publica o app

## Rodar no computador

```
npm install
npm run dev
```

A URL e a chave pública do Supabase já estão em `src/lib/supabase.js`. Para usar outro projeto, copie `.env.example` para `.env.local` e preencha.

## Banco de dados

As mudanças do banco ficam em `supabase/migrations`, na ordem em que foram aplicadas. `supabase/pendente` guarda mudanças ainda não aplicadas.

## Pastas

- `src/pages`: telas (início, ao vivo, concept book, administração…)
- `src/etapas`: as etapas de cada fase
- `src/components`: peças reaproveitadas
- `src/lib`: dados, contexto e regras
- `emails`: modelos de e-mail do Supabase

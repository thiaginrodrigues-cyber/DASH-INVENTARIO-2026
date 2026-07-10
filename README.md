<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/eb1afb46-5a52-4c7a-b0c9-0f2b099c23ff

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Configurar Google Sheets para produção (Vercel)

1. Abra o projeto no painel do Vercel.
2. Vá em *Settings -> Environment Variables* e adicione uma das variáveis abaixo:
   - `SPREADSHEET_ID` — apenas o ID da planilha (ex: `1tnl6iGFhO87...`).
   - `SHEET_EXPORT_URL` — URL completa de exportação em formato XLSX (ex: `https://docs.google.com/spreadsheets/d/<ID>/export?format=xlsx`).
3. Salve e faça um redeploy manual do projeto no Vercel.

Observação: a aplicação busca automaticamente a aba `DIÁRIO` (sem acento ou com acento) e preenche o bloco "Histórico de Contagem (Mês atual)" com os registros dessa aba.

## Conectar e automatizar deploy no Vercel

1. Faça commit do projeto em um repositório Git (GitHub, GitLab ou Bitbucket).
2. No painel do Vercel, crie um novo projeto e conecte-o ao repositório do projeto.
3. Em *Settings -> Git*, mantenha o deploy automático ativado para o branch principal (ex: `main`/`master`).
4. Após o deploy, copie a URL do projeto (ex: `https://meu-projeto.vercel.app`) e coloque no campo `deployUrl` do arquivo `metadata.json` na raiz do projeto.
   - Alternativa: defina uma variável de ambiente `VERCEL_URL` no painel do Vercel e leia-a na sua aplicação se preferir.
5. Toda vez que você criar um commit e fizer push no branch ligado ao Vercel, o projeto será redeployado automaticamente com as alterações.

Se quiser que eu faça essas mudanças (por exemplo, escrever um script de CI ou automatizar a atualização do `metadata.json`), me diga qual provedor Git você usa e se posso commitar alterações aqui.

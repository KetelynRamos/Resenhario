# Resenhário — guia de execução e testes

O Resenhário é uma plataforma web acadêmica de catálogo literário social. O nome oficial do projeto é **Resenhário** (o texto do PDF de escopo cita “LivreFlix”, nome provisório que a equipe substituiu). A versão atual preserva o frontend HTML/CSS/JavaScript, a API ASP.NET Core e o banco MySQL existentes, acrescentando autenticação JWT, hashing BCrypt, integração Google Books, pesquisa de filmes pelo TMDB, vínculo livro/filme, avaliações duplas, feed de resenhas e ranking de fidelidade.

## Funcionalidades

- Cadastro e login com senha protegida por BCrypt e token JWT.
- Compatibilidade de login com hashes da versão anterior: se a senha antiga for validada, o hash é migrado para BCrypt durante o login.
- Catálogo de livros com Google Books API.
- Catálogo de filmes com TMDB API, incluindo pôsteres e tentativa de obter o diretor.
- Catálogo de séries com TVmaze.
- Estante por usuário com status de leitura `Quero ler`, `Lendo`, `Lido` e `Abandonado`; filmes e séries usam status de visualização.
- Vínculo entre livro e adaptação cinematográfica.
- Resenhas públicas com nota literária de 1 a 5 estrelas e avaliação opcional da fidelidade de 1 a 5 estrelas.
- Feed de resenhas recentes e ranking de adaptações calculado a partir de avaliações registradas.
- Validação no backend para impedir que um usuário altere a estante ou exclua resenhas de outra conta apenas trocando um ID enviado pelo navegador.

## 1. Banco de dados

1. Abra o MySQL Workbench e conecte ao servidor onde está o banco `resenhario_db`.
2. Se o banco ainda não existir, execute `BANCO DE DADOS/01_criar_banco.sql`. O script foi ajustado para não apagar tabelas ou registros existentes.
3. Execute `BANCO DE DADOS/05_atualizar_banco.sql` para criar a tabela de séries e ajustar as colunas da estante. O script é destinado a ser executado no banco existente e não recria os dados.
4. Em bancos já existentes, faça backup e execute `BANCO DE DADOS/08_alinhar_escopo.sql` para renomear `Reviews.Nota` para `Reviews.NotaFidelidade`, preservando os valores. Em bancos novos, a coluna já é criada com o nome correto.
5. Se a base tiver resenhas antigas com notas literárias de 0 a 10, faça backup antes de considerar executar `BANCO DE DADOS/07_migrar_notas_para_escala_1_a_5.sql`. Essa migração é opcional e converte notas literárias antigas acima de 5 para a escala de 1 a 5.
6. Não execute `02_dados_teste.sql` repetidamente sem revisar o conteúdo: ele pode inserir registros de demonstração duplicados.
7. `06_limpar_resenhas_de_teste.sql` remove resenhas de teste; execute somente se tiver certeza de que deseja excluí-las.

## 2. Configuração do backend (segredos fora do Git)

Senhas e chaves **nunca** vão para o `appsettings.json` nem para o GitHub. Cada pessoa da equipe grava os valores na própria máquina com o **`dotnet user-secrets`**, que guarda tudo numa pasta do usuário (fora do projeto). O ASP.NET carrega esses valores automaticamente no ambiente `Development`.

O arquivo `BACKEND/Resenhario.Api/appsettings.Example.json` mostra quais chaves existem. No terminal, dentro de `BACKEND/Resenhario.Api`:

```powershell
cd BACKEND/Resenhario.Api
dotnet user-secrets set "ConnectionStrings:DefaultConnection" "server=localhost;port=3306;database=resenhario_db;user=root;password=SUA_SENHA;"
dotnet user-secrets set "Tmdb:ReadAccessToken" "SEU_READ_ACCESS_TOKEN_DO_TMDB"
dotnet user-secrets set "GoogleBooks:ApiKey" "SUA_CHAVE_DO_GOOGLE_BOOKS"
dotnet user-secrets list
```

- **Banco:** obrigatório. Sem ele, as páginas carregam, mas os dados não aparecem.
- **TMDB:** obrigatório para pesquisar filmes. Crie em themoviedb.org → Configurações → API → *API Read Access Token*.
- **Google Books:** opcional, mas **recomendado para a apresentação**: sem chave, a cota pública pode acabar (erro 429). Crie no Google Cloud Console com a *Books API* ativada.

O token e as chaves ficam só no backend e nunca são enviados ao JavaScript.

### JWT

O ambiente `Development` usa uma chave de desenvolvimento que está em `appsettings.Development.json`. Ela serve só para rodar localmente e não protege nada de verdade. Fora do Development, configure uma chave forte (mínimo de 32 caracteres) com `dotnet user-secrets set "Jwt:Key" "..."` ou com a variável de ambiente `Jwt__Key`.

### Alternativa: variáveis de ambiente

Também funciona com variáveis de ambiente (use `__` no lugar de `:`), por exemplo no PowerShell: `$env:Tmdb__ReadAccessToken = "..."`. Elas valem só para o terminal atual.

O projeto usa .NET 10, como especifica o PDF do escopo.

## 3. Executar o sistema

No terminal do VS Code:

```powershell
cd BACKEND/Resenhario.Api
dotnet restore
dotnet run --launch-profile http
```

Depois abra `http://localhost:5131` no navegador. O frontend (HTML, CSS e JS) fica em `BACKEND/Resenhario.Api/wwwroot/` e é servido pela própria API, então não é preciso Live Server. Mantenha o terminal aberto enquanto usa o sistema.

## 4. Roteiro de teste manual

1. Abra `paginas/login.html` e crie uma conta com senha de pelo menos 8 caracteres.
2. Saia da conta e entre novamente para confirmar a autenticação.
3. Pesquise um livro no Google Books e adicione-o ao catálogo.
4. Pesquise um filme no TMDB e adicione-o ao catálogo.
5. Na página Filmes, vincule um livro a um filme cadastrado.
6. Na estante, adicione obras, atualize status e remova um item.
7. Em Resenhas, publique uma avaliação literária de 1 a 5 estrelas.
8. Selecione uma adaptação vinculada e informe também a nota de fidelidade de 1 a 5.
9. Confirme que o feed mostra as notas e que o ranking aparece depois que houver avaliações de fidelidade.
10. Teste com duas contas diferentes para confirmar que cada uma vê apenas a própria estante e não consegue excluir a resenha da outra.

## 5. Limitações e segurança

- O ambiente de edição utilizado para preparar esta versão não possui o SDK .NET instalado. Por isso, a API não pôde ser compilada nem executada aqui; é obrigatório executar `dotnet restore` e `dotnet build` no computador de desenvolvimento e realizar o roteiro de teste acima.
- A autenticação JWT protege as rotas de estante e as operações de resenhas. O token é guardado no `localStorage` no protótipo atual; isso é prático para a apresentação, mas um XSS poderia expô-lo. Para produção, considere autenticação por cookie `HttpOnly`, `Secure` e `SameSite` ou uma arquitetura backend-for-frontend. As rotas de catálogo continuam abertas para facilitar a gestão do catálogo no protótipo acadêmico; antes de uma publicação pública, restrinja as operações de escrita do catálogo a usuários autorizados.
- A política CORS configurada é destinada ao frontend local. Para hospedagem, substitua-a pelas origens reais.
- A integração TMDB não funciona até que o token de leitura seja configurado no backend.
- Os serviços externos podem ficar temporariamente indisponíveis ou limitar requisições.
- A chave JWT presente em `appsettings.Development.json` é apenas para desenvolvimento local. Não reutilize essa chave em produção.


## Configuração das APIs externas (necessária para pesquisa)

As integrações são chamadas pelo backend; nenhuma chave deve ser colocada no JavaScript.

- **Google Books:** normalmente funciona sem chave. Se a cota do projeto Google estiver bloqueada/zerada, configure uma chave válida em `GoogleBooks:ApiKey` (variável de ambiente `GoogleBooks__ApiKey`) e habilite a Google Books API no projeto correspondente. Uma chave não contorna uma cota diária definida como zero: é necessário ajustar a cota no Google Cloud.
- **TMDB:** exige um Read Access Token válido. Configure a variável de ambiente `Tmdb__ReadAccessToken`. Não publique esse token no GitHub nem o coloque no frontend.
- **TVmaze:** não exige chave; agora a pesquisa também passa pelo backend, evitando chamada direta do navegador.

No PowerShell, para a sessão atual:

```powershell
$env:Tmdb__ReadAccessToken = "COLE_SEU_TOKEN_DE_LEITURA_DO_TMDB"
# Opcional, se sua cota do Google Books exigir chave:
$env:GoogleBooks__ApiKey = "SUA_CHAVE_GOOGLE_BOOKS"
dotnet run
```

O sistema fica em `http://localhost:5131` (API e páginas no mesmo endereço). Não abra as páginas por `file://`.

## Atualização do banco

Antes de alterar um banco que já contém dados, faça um backup. Execute `BANCO DE DADOS/08_alinhar_escopo.sql` uma vez no MySQL Workbench para renomear `Reviews.Nota` para `Reviews.NotaFidelidade`, preservando os valores existentes. O script é não destrutivo e pode ser executado novamente. Não execute os scripts de dados de teste ou limpeza se quiser preservar seus registros.

## Funcionalidades alinhadas ao escopo

- Cadastro e login com BCrypt e token JWT.
- Estante de livros com Quero ler, Lendo, Lido e Abandonado.
- Pesquisa de livros (Google Books), filmes (TMDB) e séries bônus (TVmaze) via backend.
- Vínculo entre livro e filme; resenha com nota literária de 1 a 5 e nota opcional de fidelidade de 1 a 5.
- Feed comunitário paginado em `paginas/feed.html` e ranking em `paginas/ranking.html`.

Rotas de pesquisa: `GET /api/Livro/buscar?q=...`, `GET /api/Filme/buscar?q=...` e `GET /api/Serie/buscar?q=...`. O feed usa `GET /api/Review/feed?pagina=1&tamanho=10`; o ranking usa `GET /api/Adaptacao/ranking`.

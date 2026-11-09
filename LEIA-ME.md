# Resenhário: do filme ao livro

Plataforma web que liga livros às suas adaptações para o cinema. A pessoa descobre o livro por trás do filme, monta sua estante, dá duas notas (a do livro e a da fidelidade do filme) e compara a opinião dela com a da comunidade.

Projeto da disciplina **Desenvolvimento de Software Visual**, Universidade Positivo, 2026.

**Equipe:** Alejandro Abraham Leon Benavente (Scrum Master) · John Vitor do Carmo Barbosa (Banco de Dados) · Lucas Gaeski Borges (Analista de Testes) · Ketelyn Ramos Zaleski (Front-end/Back-end) · Matheus Alexandre Vieira (QA) · Vinicius Lima Pereira (Back-end/Front-end)

**Tecnologias:** C# com .NET 10 (ASP.NET Core Web API) · Entity Framework Core · MySQL · HTML, CSS e JavaScript · Google Books API · TMDB API · BCrypt e JWT.

---

## Como rodar no seu computador

São 4 passos. Leva uns 10 minutos.

### 1. Instale os programas

- **.NET 10 SDK:** https://dotnet.microsoft.com/download (no terminal, `dotnet --version` deve mostrar `10.x`).
- **MySQL 8** com o **MySQL Workbench**: https://dev.mysql.com/downloads/

### 2. Crie o banco de dados

No MySQL Workbench, conecte no seu MySQL local e rode, **nesta ordem**, os scripts da pasta `BANCO DE DADOS` (menu *File → Open SQL Script*, depois o raio ⚡ para executar):

1. `01_criar_banco.sql`
2. `05_atualizar_banco.sql`
3. `08_alinhar_escopo.sql`
4. `09_indices_unicos.sql`
5. `10_perfil_meta_comunidade.sql`

Eles criam o banco `resenhario_db` com todas as tabelas. Os outros scripts da pasta não são necessários.

### 3. Informe a senha do seu MySQL

Abra o arquivo `BACKEND/Resenhario.Api/appsettings.json` e troque `COLOQUE_SUA_SENHA` pela senha do usuário `root` do seu MySQL:

```json
"DefaultConnection": "server=localhost;port=3306;database=resenhario_db;user=root;password=COLOQUE_SUA_SENHA;"
```

Se o seu usuário não for `root` ou a porta não for `3306`, ajuste também esses valores.

### 4. Rode o site

No terminal (PowerShell, Prompt de Comando ou o terminal do VS Code), a partir da pasta do projeto:

```
cd BACKEND/Resenhario.Api
dotnet run --launch-profile http
```

Quando aparecer `Now listening on: http://localhost:5131`, abra no navegador:

**http://localhost:5131**

Na primeira vez, a própria API preenche o banco com os dados de demonstração: 20 livros, 21 filmes, 6 usuários, 32 resenhas, curtidas e comentários. Para parar o site, use `Ctrl + C` no terminal.

---

## Para entrar no site

| E-mail | Senha |
|---|---|
| `ketelyn@resenhario.dev` (ou `alejandro@`, `john@`, `lucas@`, `matheus@`, `vinicius@` com o mesmo final) | `Resenhario2026` |

Também é possível criar uma conta nova em **Entrar → Criar conta**.

## O que testar

| Página | O que fazer |
|---|---|
| **Início** | Ver o destaque "O mais fiel do momento" e os cards **Livro vs. Filme** (nota do livro × fidelidade do filme). |
| **Livros** | Pesquisar um livro pelo título ou autor, adicionar ao catálogo e à estante. |
| **Filmes** | Pesquisar um filme, ou escolher um livro e clicar em **Procurar adaptações** para ver os filmes baseados nele e vincular. |
| **Resenhar** | Dar a nota do livro e, se viu o filme, a nota de fidelidade. |
| **Feed** | Curtir, comentar e ver se cada leitor gostou mais ou menos que a média da comunidade. |
| **Ranking** | Top do Resenhário: as adaptações mais fiéis (com pelo menos 2 avaliações). |
| **Minha estante** | Mudar o status de leitura, ver os gráficos e topar o desafio de leitura de 6 meses. |
| **Swagger** | http://localhost:5131/swagger: todas as rotas da API. Para as rotas com cadeado, faça login em `/api/Auth/login`, copie o `token` e cole em **Authorize**. |
| **Saúde** | http://localhost:5131/api/saude: confere se a API e o banco estão conectados. |

## Pesquisas nas APIs externas (opcional)

As buscas usam a **Google Books API** (livros) e a **TMDB API** (filmes). As chaves ficam fora do código, por segurança.

- **Livros:** a busca funciona sem chave.
- **Filmes e "Procurar adaptações":** precisam do token do TMDB. Sem ele, o site mostra um aviso e todo o resto funciona normalmente com os dados já salvos.

Se quiser testar as buscas de filmes, crie um token gratuito em themoviedb.org (*Configurações → API → API Read Access Token*) e rode, dentro de `BACKEND/Resenhario.Api`:

```
dotnet user-secrets set "Tmdb:ReadAccessToken" "SEU_TOKEN"
```

Com internet, a API tenta buscar sozinha as capas dos livros de demonstração no Google Books; os pôsteres dos filmes precisam do token do TMDB. Quando não há imagem (sem token, sem internet ou com o limite de buscas do Google atingido), o site mostra capas desenhadas por ele mesmo, e tudo continua funcionando.

## Se algo der errado

| Sintoma | Solução |
|---|---|
| `dotnet` não é reconhecido, ou a versão não é 10 | Instale o .NET 10 SDK (passo 1) e abra um terminal novo. |
| Erro na inicialização pedindo a `Jwt:Key` | Rode com `--launch-profile http`, exatamente como no passo 4. |
| `/api/saude` mostra `"banco": "sem conexão"` | Confira a senha no `appsettings.json` (passo 3) e se o MySQL está ligado. O campo `motivo` mostra o erro. |
| `Access denied for user 'root'@'localhost'` | A senha do passo 3 está errada. |
| `Unknown database 'resenhario_db'` | Faltou rodar os scripts do passo 2. |
| A porta 5131 já está em uso | Feche outro terminal que esteja rodando o projeto e tente de novo. |

## Organização do projeto

```
BACKEND/Resenhario.Api/
├── Controllers/   Rotas da API (livros, filmes, adaptações, estante, resenhas, comunidade, usuário, login)
├── Models/        Classes do domínio com as validações (Data Annotations)
├── Data/          AppDbContext (Entity Framework Core) e os dados de demonstração
├── Services/      Conferência de adaptações no TMDB e leitura do usuário logado
├── wwwroot/       O site: páginas HTML, CSS e JavaScript
└── Program.cs     Configuração: banco, login (JWT), APIs externas, Swagger e erros
BANCO DE DADOS/    Scripts SQL de criação do banco
```

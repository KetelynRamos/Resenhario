# Resenhário: do filme ao livro

Plataforma web que liga livros às suas adaptações para o cinema. A pessoa descobre o livro por trás do filme, monta sua estante, dá duas notas (a do livro e a da fidelidade do filme) e compara a opinião dela com a da comunidade.

Projeto da disciplina **Desenvolvimento de Software Visual**, Universidade Positivo, 2026.

**Equipe:** Alejandro Abraham Leon Benavente (Scrum Master) · John Vitor do Carmo Barbosa (Banco de Dados) · Lucas Gaeski Borges (Analista de Testes) · Ketelyn Ramos Zaleski (Front-end/Back-end) · Matheus Alexandre Vieira (QA) · Vinicius Lima Pereira (Back-end/Front-end)

**Tecnologias:** C# com .NET 10 (ASP.NET Core Web API) · Entity Framework Core · MySQL · HTML, CSS e JavaScript · Google Books API · TMDB API · BCrypt e JWT.

---

## Como rodar no seu computador

**Antes de começar:** instale o [.NET 10 SDK](https://dotnet.microsoft.com/download) e o [MySQL Workbench](https://dev.mysql.com/downloads/workbench/). O banco de dados fica na nuvem (**Aiven**). Os dados de acesso (host, porta, usuário e senha) e as chaves das APIs são entregues pela equipe à parte: por segurança, eles não ficam no código.

### 1. Rodar os scripts no MySQL (banco do Aiven)

No MySQL Workbench, crie uma conexão com os dados do Aiven:

- **Hostname** e **Port**: os do Aiven (a porta não é a 3306).
- **Username**: `avnadmin` e, em **Store in Vault**, a senha.
- Aba **SSL**: **Use SSL** = `Require`.

Conecte e rode, nesta ordem, os scripts da pasta `BANCO DE DADOS` (*File → Open SQL Script* e depois o raio ⚡):

1. `01_criar_banco.sql`
2. `05_atualizar_banco.sql`
3. `08_alinhar_escopo.sql`
4. `09_indices_unicos.sql`
5. `10_perfil_meta_comunidade.sql`

Eles garantem o banco `resenhario_db` com todas as tabelas. Não apagam nada: se o banco já existir, só conferem.

### 2. Abrir o terminal no backend

No terminal (PowerShell ou o terminal do VS Code), a partir da pasta do projeto:

```
cd BACKEND/Resenhario.Api
```

Os próximos comandos são todos rodados nesta pasta.

### 3. Conectar ao banco de dados

Troque `HOST`, `PORTA` e `SENHA` pelos dados do Aiven:

```
dotnet user-secrets set "ConnectionStrings:DefaultConnection" "server=HOST;port=PORTA;database=resenhario_db;user=avnadmin;password=SENHA;SslMode=Required;"
```

O `user-secrets` guarda a conexão no seu computador, fora do código.

### 4. Configurar as APIs

Com o token do TMDB (filmes) e a chave do Google Books (livros):

```
dotnet user-secrets set "Tmdb:ReadAccessToken" "TOKEN_DO_TMDB"
dotnet user-secrets set "GoogleBooks:ApiKey" "CHAVE_DO_GOOGLE"
```

Sem o token do TMDB, a pesquisa de filmes mostra um aviso e o resto do site funciona normalmente. A chave do Google é opcional: sem ela, a busca de livros funciona até o limite gratuito do Google.

### 5. Rodar o site (http)

```
dotnet run --launch-profile http
```

Quando aparecer `Now listening on: http://localhost:5131`, abra no navegador:

**http://localhost:5131**

Para parar o site, use `Ctrl + C` no terminal.

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

## Se algo der errado

| Sintoma | Solução |
|---|---|
| `dotnet` não é reconhecido, ou a versão não é 10 | Instale o .NET 10 SDK e abra um terminal novo. |
| Erro na inicialização pedindo a `Jwt:Key` | Rode com `--launch-profile http`, exatamente como no passo 5. |
| `/api/saude` mostra `"banco": "sem conexão"` | Confira host, porta e senha do passo 3 (com `SslMode=Required`) e se o serviço do Aiven está **Running**. O campo `motivo` mostra o erro. |
| `Access denied for user 'avnadmin'` | A senha do passo 3 está errada. Rode o comando de novo com a senha certa. |
| `Unknown database 'resenhario_db'` | Faltou rodar os scripts do passo 1. |
| A busca de filmes diz que o TMDB não está configurado | Falta o token do passo 4. |
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

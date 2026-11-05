# Auditoria de conformidade: Resenhário × Escopo

> A situação atualizada de cada item está na seção **e)** no fim deste arquivo.

> Data: 05/11/2026 · Base auditada: `RESENHARIO_AUDITADO.zip`, idêntico ao commit `8c439dd` de `KetelynRamos/resenhario`
> Caminhos de código são relativos a `BACKEND/Resenhario.Api/`. As referências a `frontend/` agora ficam em `wwwroot/` (decisão D4).
> Fonte da verdade: *Escopo Resenhário.pdf* (Universidade Positivo, Desenvolvimento de Software Visual)

## 0. Como esta auditoria foi feita

| Verificação | Resultado |
|---|---|
| Leitura completa do PDF de escopo | Feita |
| Leitura de todo o código (backend, SQL e frontend) | Feita |
| `dotnet build` (.NET SDK 10.0.114) | ✅ **Compila com 0 erros e 0 warnings** |
| `dotnet run` sem `ASPNETCORE_ENVIRONMENT=Development` | ❌ Encerra na inicialização: falta `Jwt:Key` (esperado, mas precisa estar documentado) |
| `dotnet run` em Development | ✅ Sobe em `http://localhost:5131` |
| Teste real das rotas | Feito num **MySQL 8 temporário** criado só para o teste, com os scripts `01`, `05`, `08` e `02` do repositório. Nada foi alterado no banco de vocês |
| `node --check frontend/js/script.js` | ✅ Sem erro de sintaxe |

**Mapa do projeto**

- **Tipo:** Web API ASP.NET Core com controllers (`[ApiController]`), mais um **frontend estático separado** (`frontend/`: HTML, CSS e JS com `fetch()`), aberto pelo Live Server do VS Code. Não há `Views/*.cshtml` nem `wwwroot/`.
- **.NET:** `net10.0` (`BACKEND/Resenhario.Api/Resenhario.Api.csproj:4`).
- **Pacotes NuGet:** `Microsoft.AspNetCore.OpenApi 10.0.11`, `JwtBearer 10.0.11`, `System.IdentityModel.Tokens.Jwt 8.19.2`, `BCrypt.Net-Next 4.0.3`, `EF Core 9.0.12` + `Design`, `Pomelo.EntityFrameworkCore.MySql 9.0.0`, `MySqlConnector 2.6.1`. O EF Core está na versão 9 porque o Pomelo ainda não tem versão 10. Funciona, mas vale saber explicar isso na defesa.
- **Banco:** MySQL **local** (`server=localhost; user=root; password=COLOQUE_SUA_SENHA`) em `appsettings.json:3`.
- **Migrations EF:** **nenhuma**. O esquema é criado pelos scripts em `BANCO DE DADOS/*.sql`.
- **Swagger:** só o JSON OpenAPI (`/openapi/v1.json`, em `Program.cs:56`). **Não há interface Swagger UI** (`/swagger` responde 404).

### Resultado dos testes de rota (API real + MySQL de teste)

| Rota | Resultado |
|---|---|
| `GET /api/Livro`, `/Filme`, `/Serie`, `/Adaptacao`, `/Adaptacao/ranking`, `/Review`, `/Review/feed` | ✅ 200 |
| `POST /api/Auth/cadastro` / `GET /api/Usuario/me` | ✅ 200 (token JWT gerado) |
| `POST /api/Auth/login` com usuário do `02_dados_teste.sql` | ❌ 401: o script grava `hash_teste_123` como hash, então **nenhum usuário de exemplo consegue logar** |
| **`GET /api/Estante` (logado)** | ❌ **500: a página "Minha estante" quebra sempre.** O EF não consegue traduzir o `OrderByDescending` aplicado depois da projeção no record. Confirmei numa cópia que mover o `orderby` para antes do `select` resolve |
| `POST /api/Estante`, `PUT /api/Estante/{id}` | ✅ 200 e 204 |
| `POST /api/Review` (dupla nota) / nota 9 | ✅ 200 / ✅ 400 com mensagem |
| `POST /api/Livro` com título e autor vazios | ❌ **201: aceitou um livro em branco** (sem validação) |
| `DELETE /api/Livro/3` (livro com adaptação) | ❌ **500**: violação de chave estrangeira sem tratamento |
| `DELETE /api/Adaptacao/{id}`, `PUT /api/Livro/{id}` **sem token** | ❌ 204: **qualquer pessoa altera ou apaga o catálogo** |
| `GET /api/Livro/buscar?q=duna` (Google Books, sem chave) | ⚠️ 502 "respondeu com HTTP 429" (cota sem chave esgotada). A tela não quebra, mas a busca não funciona |
| `GET /api/Filme/buscar?q=duna` (TMDB, sem token) | ⚠️ 503 com mensagem amigável |

---

## a) Matriz de requisitos

### a.1 Requisitos gerais do escopo

| Requisito do escopo | Status | Evidência (arquivo:linha) | O que falta |
|---|---|---|---|
| 1. Cadastro e autenticação segura com BCrypt | ✅ Pronto | `Controllers/AuthController.cs:51` (`HashPassword`), `:72` (`Verify`), `:99-120` (JWT de 8 h), `Program.cs:28-43` | Usuários do script de teste têm hash falso e não logam (o seed resolve). A migração de hash legado (`:75-93`) pode ser explicada ou removida depois |
| 2. Estante com Quero Ler / Lendo / Lido / Abandonado | ⚠️ Parcial | `Controllers/EstanteController.cs:63-67`, `:83-85`; `frontend/js/script.js:337-379` | **`GET /api/Estante` dá 500** (`EstanteController.cs:25-39`). Escrita (POST/PUT/DELETE) funciona |
| 3. Busca e cadastro automatizado via Google Books | ⚠️ Parcial | `Controllers/CatalogoExternoController.cs:24-92`; `script.js:185-225` | Código correto, com `try/catch`. Sem chave, a cota pública retornou **429**. Precisa de `GoogleBooks:ApiKey` em user-secrets |
| 4. Consulta e vínculo de adaptações via TMDB (pôster e diretor) | ⚠️ Parcial | `CatalogoExternoController.cs:94-159` (busca), `:201-223` (diretor); `AdaptacaoController.cs:56-80` (vínculo) | Precisa do token TMDB. Busca **o diretor de cada um dos 12 resultados em sequência** (`:138`), o que deixa a demo lenta. Não testado ao vivo (sem token) |
| 5. Resenha 1–5 ★ + fidelidade opcional + média de aceitação | ⚠️ Parcial | `ReviewController.cs:83-118` (validações 1–5), `AdaptacaoController.cs:34-54` (média de fidelidade) | Só existe **média de fidelidade**. Não há **média da nota da obra** (por livro nem no ranking), que é a "média de aceitação" do cronograma (22/10). Formulário usa `<input type=number>` em vez de estrelas |
| 6. Feed com últimas resenhas e comparativos entre leitores | ⚠️ Parcial | `ReviewController.cs:28-59` (feed paginado), `script.js:530-566`, `paginas/feed.html` | Feed ✅. **"Comparativos entre leitores" não existem** (ex.: nota do leitor × média da comunidade). Sem capa/pôster nem avatar nos cards |
| 7. Interface intuitiva, responsiva e focada no leitor | ⚠️ Parcial | `frontend/css/style.css` (tema escuro; `@media` em `:260`, `:347`, `:396`) | Menu com 9 links não colapsa no celular, fontes do sistema (Arial/Georgia), notas em campo numérico, ranking e feed são listas de texto sem imagem |

### a.2 Módulos / entregas

| Requisito do escopo | Status | Evidência (arquivo:linha) | O que falta |
|---|---|---|---|
| Documento de escopo, MER e wireframes | ⚠️ Parcial | Só o PDF de escopo. MER e wireframes **não estão no repositório** | Colocar o MER (pode ser Mermaid) e os wireframes em `docs/` |
| Protótipo navegável | ✅ Pronto | `frontend/index.html` + 8 páginas em `frontend/paginas/` | — |
| Módulo de autenticação | ✅ Pronto | `AuthController.cs`, `UsuarioController.cs`, `script.js:301-335` | — |
| Catálogo + estante (CRUD de livros e status) | ⚠️ Parcial | `LivroController.cs` (CRUD), `EstanteController.cs` | Estante GET 500; livro sem validação; DELETE com vínculo dá 500; escrita sem login |
| Vínculo multimídia Livro ↔ Adaptação | ✅ Pronto | `AdaptacaoController.cs:19-92`, `paginas/filmes.html:53-65` | Proteger com login. Visual é só texto "Livro → Filme" |
| Integração com APIs externas | ⚠️ Parcial | `CatalogoExternoController.cs`, `Program.cs:10-14` | Configurar chaves; TMDB lento (diretor) |
| Módulo de resenhas comunitárias | ✅ Pronto | `ReviewController.cs`, `paginas/reviews.html` | — |
| Painel visual: feed social | ⚠️ Parcial | `paginas/feed.html`, `script.js:530-566` | Cards visuais e comparativos |
| Painel visual: estatísticas de leitura | ⚠️ Parcial | `script.js:382-400` (5 contadores em `estante.html`) | Quebra junto com a estante (GET 500). Sem gráficos (por status e por mês) |
| Painel visual: ranking das melhores adaptações | ⚠️ Parcial | `AdaptacaoController.cs:34-54`, `paginas/ranking.html`, `script.js:568-583` | Sem pôster nem pódio; sem média da obra |
| Documentação técnica final (PDF) | ❌ Ausente | Só `LEIA-ME.md` e `AUDITORIA_ESCOPO.md` | Fases 6 e 7 (`DOCUMENTACAO_TECNICA.md`, `GUIA_DEFESA.md`, `ROTEIRO_DEMO.md`) |
| Marco 05/11: sistema populado com dados simulados | ❌ Ausente | `BANCO DE DADOS/02_dados_teste.sql`: 3 livros, imagens `https://exemplo.com/...` (quebradas), hashes falsos, **não idempotente** | Seed da Fase 4 |

### a.3 Tabelas previstas

| Requisito do escopo | Status | Evidência (arquivo:linha) | O que falta |
|---|---|---|---|
| Usuarios | ✅ Pronto | `01_criar_banco.sql:7`, `Models/Usuario.cs` | E-mail sem `UNIQUE` no banco (só checado no código) |
| Livros | ✅ Pronto | `01_criar_banco.sql:15`, `Models/Livro.cs` | — |
| Filmes | ✅ Pronto | `01_criar_banco.sql:25` (+ `05_atualizar_banco.sql:14`), `Models/Filme.cs` | — |
| Adaptacoes | ✅ Pronto | `01_criar_banco.sql:34`, `Models/Adaptacao.cs` | Sem `UNIQUE(IdLivro, IdFilme)` (só checado no código) |
| Reviews | ✅ Pronto | `01_criar_banco.sql:61`, `Models/Review.cs` | Coluna `Voto` não é usada |
| Estante | ✅ Pronto | `01_criar_banco.sql:47` (nome **`Estantes`**), `05_atualizar_banco.sql`, `Models/Estante.cs` | Nome no plural (diferença pequena, só citar). Extra: tabela `Series`, que **não está no escopo** |

### a.4 Conceitos da disciplina

| Requisito do escopo | Status | Evidência (arquivo:linha) | O que falta |
|---|---|---|---|
| POO: classes, propriedades, métodos, pastas e namespaces | ⚠️ Parcial | `Models/*.cs`, `Data/AppDbContext.cs`, `Controllers/*.cs`; namespace `Resenhario.Api.*` | Models são só dados ("anêmicos"): sem métodos nem propriedades de navegação. Ex.: `Review.TemAvaliacaoDeFidelidade`, `Livro.Adaptacoes` |
| MVC: Models / Controllers / Views / wwwroot | ⚠️ Parcial | `Models/`, `Controllers/` ✅. Front em pasta separada `frontend/` | **Não há `wwwroot/`** (nem `.cshtml`). O front depende do Live Server nas portas 5500–5502 e de CORS. Ver a decisão D4 |
| Front ligado ao back via `fetch()` (GET/POST/PUT/DELETE + JSON) | ✅ Pronto | `script.js:19-39` (função `api`), PUT em `:359`, DELETE em `:372` | `API_URL` fixo em `localhost:5131` (`script.js:1`) |
| API REST com `[ApiController]` e `[Route("api/[controller]")]` | ✅ Pronto | Todos os controllers, ex.: `LivroController.cs:8-9` | — |
| Verbos HTTP corretos | ✅ Pronto | GET, POST, PUT, DELETE em Livro e Estante | — |
| Status semânticos (200/201/204/400/404) | ⚠️ Parcial | `CreatedAtAction` em `LivroController.cs:69` e `FilmeController.cs:38`; `NoContent` em PUT e DELETE ✅ | `POST` de Review, Estante, Adaptação e Cadastro retorna **200** em vez de **201** (`ReviewController.cs:117`, `EstanteController.cs:73`, `AdaptacaoController.cs:80`, `AuthController.cs:57`) |
| Swagger habilitado | ⚠️ Parcial | `Program.cs:53,56` (`AddOpenApi`/`MapOpenApi`) | Falta a **interface Swagger UI** para testar ao vivo |
| CRUD com EF Core e `async/await` | ⚠️ Parcial | `AppDbContext.cs`; `FindAsync`/`ToListAsync`/`SaveChangesAsync` na maioria dos controllers | `LivroController.cs:20-23,76-112` usa versões **síncronas** (`ToList`, `Find`, `SaveChanges`) |
| Migrations | ⚠️ Parcial | Nenhuma; o esquema vem dos scripts SQL | Ver a decisão D6 |
| `IHttpClientFactory` | ✅ Pronto | `Program.cs:10`, `CatalogoExternoController.cs:11,37,109` | — |
| `GetAsync` + `await` | ✅ Pronto | `CatalogoExternoController.cs:38,173` (TMDB usa `SendAsync` por causa do header) | Dá para trocar por header padrão no client nomeado e usar `GetAsync` também |
| Desserialização com `System.Text.Json` para DTOs | ⚠️ Parcial | Usa `JsonDocument` e lê campo a campo (`:43-73`) | O professor espera DTOs + `ReadFromJsonAsync<T>()`. É mais simples de explicar e reduz ~60 linhas |
| API key fora do código | ✅ Pronto | `CatalogoExternoController.cs:35,102` lê de `IConfiguration`; `appsettings.json` com valores vazios | Documentar `dotnet user-secrets` |
| `try/catch` para `HttpRequestException` | ✅ Pronto | `CatalogoExternoController.cs:84,151,197,218` | — |
| Validação com Data Annotations | ❌ Ausente | Models só têm `[Key]`/`[Table]`; validação feita à mão (`ReviewController.cs:89-94`) | `[Required]`, `[StringLength]`, `[Range(1,5)]`, `[EmailAddress]`. Hoje `POST /api/Livro` aceita livro vazio |
| Tratamento global de erros | ❌ Ausente | `Program.cs` não tem `UseExceptionHandler` | Erros viram 500 com stack trace (DELETE de livro, GET da estante) |
| Endpoints sensíveis protegidos | ⚠️ Parcial | `[Authorize]` em `EstanteController.cs:11`, `UsuarioController.cs:10`, `ReviewController.cs:83,120` | **Sem proteção:** POST/PUT/DELETE de Livro, POST de Filme e Série, POST/DELETE de Adaptação |

---

## b) Riscos para a apresentação

| # | Risco | Gravidade | Detalhe |
|---|---|---|---|
| R1 | **"Minha estante" dá erro 500** | 🔴 Crítico | Toda vez que alguém logado abre a estante. Estatísticas de leitura somem junto |
| R2 | **Banco local (`localhost`, `root`)** | 🔴 Crítico | A demo só funciona no notebook que tem o MySQL com os scripts rodados. Se mudar de máquina, nada carrega |
| R3 | **Feed, ranking e catálogo quase vazios**; imagens quebradas | 🔴 Crítico | Seed atual: 3 livros, 4 resenhas, imagens `exemplo.com`; usuários de teste não logam |
| R4 | **Google Books respondeu 429 sem chave** | 🟠 Alto | Na rede da faculdade (IP compartilhado) a cota pode estourar na hora. Precisa de chave e de plano B (livros já salvos no catálogo) |
| R5 | **TMDB sem token = busca de filmes desligada**; com token, busca lenta | 🟠 Alto | 1 + 12 chamadas sequenciais por busca (diretor de cada filme) |
| R6 | ✅ Resolvido (D4, commit `3b7f854`): front depende do Live Server nas portas 5500–5502 e de `localhost:5131` fixo | 🟢 | Se o Live Server abrir na 5503, ou se a página for aberta por `file://`, tudo falha por CORS |
| R7 | Qualquer visitante apaga ou edita o catálogo (sem login) | 🟠 Alto | Pergunta clássica do professor: "e se eu chamar o DELETE pelo Swagger?" |
| R8 | `DELETE /api/Livro/{id}` com adaptação ou resenha → 500 com stack trace | 🟡 Médio | Sem tratamento global de erros |
| R9 | `dotnet run` falha fora do perfil Development (falta `Jwt:Key`) | 🟡 Médio | Rodar com `--launch-profile http` (já está no LEIA-ME) ou ter a chave em user-secrets |
| R10 | Sem Swagger UI | 🟡 Médio | O professor pediu "Swagger habilitado para testar" |
| R11 | **Segredos no Git** ✅ verificado: o histórico (1 commit) não contém senha, token TMDB nem chave Google | 🟢 Baixo | O zip não tem `.git`. Nos arquivos atuais **não há** token TMDB, chave Google nem senha real. Só existe uma chave JWT de desenvolvimento em `appsettings.Development.json:9` (risco baixo, marcada como dev; mesmo assim, recomendo movê-la para user-secrets). Histórico verificado em 05/11, sem segredos |
| R12 | Nome do produto: PDF diz "LivreFlix" (Introdução) e a capa diz "Resenhário" | ✅ Resolvido | Equipe decidiu: **Resenhário** (D2) |
| R13 | Scripts SQL sem `SET NAMES utf8mb4` | 🟢 Baixo | Dependendo do cliente MySQL, acentos viram "Ã©". Aconteceu no meu teste via linha de comando; no Workbench normalmente não acontece |
| R14 | Texto "Seu carrinho de entretenimento" na home (`index.html:64`) | 🟢 Baixo | Lembra marketplace, que está fora do escopo |

---

## c) Plano priorizado

### P0: obrigatório até 12/11 (impede a demo ou viola o escopo)

| # | Item | Esforço | Arquivos afetados |
|---|---|---|---|
| P0-1 | Corrigir o 500 em `GET /api/Estante` (ordenar antes da projeção) | P | `Controllers/EstanteController.cs` |
| P0-2 | `[Authorize]` nas rotas de escrita do catálogo e pedir login no front antes de salvar ou vincular | P | `LivroController.cs`, `FilmeController.cs`, `SerieController.cs`, `AdaptacaoController.cs`, `frontend/js/script.js` |
| P0-3 | Tratamento global de erros (`UseExceptionHandler` + ProblemDetails) e 409 amigável ao excluir livro com vínculos | P | `Program.cs`, `LivroController.cs` |
| P0-4 | Data Annotations nos Models e DTOs (`[Required]`, `[StringLength]`, `[Range(1,5)]`, `[EmailAddress]`) | P | `Models/*.cs`, records do `AuthController.cs` |
| P0-5 | Swagger UI apontando para `/openapi/v1.json` (pacote leve `Swashbuckle.AspNetCore.SwaggerUI`) | P | `Resenhario.Api.csproj`, `Program.cs` |
| P0-6 | "Média de aceitação": ranking passa a trazer média da nota da obra + média de fidelidade + pôster/capa; endpoint de médias por livro | P | `AdaptacaoController.cs`, `ReviewController.cs`, `script.js` |
| P0-7 | Chaves fora do código via `dotnet user-secrets` (Google Books, TMDB, JWT, senha do banco) + `appsettings.Example.json` | P | `Resenhario.Api.csproj` (UserSecretsId), `appsettings*.json`, `LEIA-ME.md` |
| P0-8 | *(depende da decisão D4)* Servir o front pela própria API: `frontend/` → `wwwroot/`, `UseDefaultFiles`/`UseStaticFiles`, `API_URL = "/api"`. Elimina Live Server, CORS e o problema de porta, e cumpre o "wwwroot" da disciplina | M | `Program.cs`, mover `frontend/*` → `wwwroot/`, `script.js:1` |
| P0-9 | Seed idempotente com 15–20 livros, adaptações, 6 usuários e ~30 resenhas (= **Fase 4**) | G | `Data/SeedData.cs` (novo), `Program.cs` |
| P0-10 | Banco acessível para a demo (nuvem ou plano B local), = **Fase 6**, só após sua aprovação | M | `appsettings`/user-secrets, `LEIA-ME.md` |

### P1: impacto visual na apresentação (= Fase 5)

| # | Item | Esforço | Arquivos afetados |
|---|---|---|---|
| P1-1 | Identidade "cinema + livro": Google Fonts (serifada + sans), paleta preto/âmbar refinada, menu responsivo (hambúrguer) | M | `css/style.css`, todos os `.html` |
| P1-2 | Hero na home com pôster/backdrop, frase de impacto, CTA de cadastro e destaques do ranking; trocar "carrinho de entretenimento" | M | `index.html`, `script.js`, `style.css` |
| P1-3 | **Card "Livro vs. Filme"** (capa × pôster, nota da obra × fidelidade, média da comunidade) | M | `script.js`, `style.css`, `ranking.html`, `filmes.html` |
| P1-4 | Feed social: avatar (iniciais), estrelas, capa/pôster, "há 2 horas", **comparativo "sua nota × média da comunidade"** (completa o requisito 6) | M | `feed.html`, `script.js`, `ReviewController.cs` (incluir capa e médias) |
| P1-5 | Ranking em pódio (top 3) + top 10 com pôsteres | M | `ranking.html`, `script.js`, `style.css` |
| P1-6 | Estatísticas com Chart.js via CDN (livros por status, lidos por mês) | P | `estante.html`, `script.js` |
| P1-7 | Seletor de estrelas no formulário de resenha (no lugar do número) | P | `reviews.html`, `script.js`, `style.css` |
| P1-8 | Skeleton/loading nas buscas, estados vazios e mensagens de erro bonitas (no lugar de `alert`) | P | `script.js`, `style.css` |
| P1-9 | TMDB mais rápido: buscar o diretor só ao **salvar** o filme (1 chamada em vez de 12) | P | `CatalogoExternoController.cs`, `FilmeController.cs` |
| P1-10 | Carrosséis horizontais estilo streaming na home | P | `index.html`, `style.css` |

### P2: se der tempo / para a defesa

| # | Item | Esforço | Arquivos afetados |
|---|---|---|---|
| P2-1 | `LivroController` todo em `async` (`ToListAsync`, `FindAsync`, `SaveChangesAsync`) | P | `LivroController.cs` |
| P2-2 | `POST` retornando **201 Created** (Review, Estante, Adaptação, Cadastro) | P | 4 controllers + conferir o front |
| P2-3 | Trocar `JsonDocument` por DTOs + `ReadFromJsonAsync<T>()` nas APIs externas | M | `CatalogoExternoController.cs`, nova pasta `Models/Externos/` |
| P2-4 | POO: propriedades de navegação e métodos simples nos Models (ex.: `Livro.Adaptacoes`, `Review.TemFidelidade`) | M | `Models/*.cs` |
| P2-5 | Endpoint de ranking duplicado (`/api/Review/ranking-adaptacoes` = `/api/Adaptacao/ranking`): **remover só com sua autorização** | P | `ReviewController.cs:61-81` |
| P2-6 | Atualizar `Resenhario.Api.http` (ainda aponta para `/weatherforecast`) com as rotas reais | P | `Resenhario.Api.http` |
| P2-7 | `UNIQUE` em `Usuarios.Email` e `Adaptacoes(IdLivro, IdFilme)` via script SQL não destrutivo | P | `BANCO DE DADOS/09_*.sql` |
| P2-8 | Documentação: `DOCUMENTACAO_TECNICA.md`, `GUIA_DEFESA.md`, `ROTEIRO_DEMO.md`, MER em Mermaid; unificar `LEIA-ME.md` + `AUDITORIA_ESCOPO.md` | G | `docs/` |
| P2-9 | Comentários curtos em português nos trechos-chave | P | controllers e `Program.cs` |

---

## d) Decisões da equipe (05/11/2026)

| # | Decisão | Situação |
|---|---|---|
| D1 | Repositório: `KetelynRamos/resenhario` | ✅ Clonado. Arquivos estavam soltos na raiz; reorganizados nas pastas (commit `9773253`) |
| D2 | Nome único: **Resenhário** | ✅ Aplicado na documentação |
| D3 | Séries (TVmaze): esconder | ✅ Fora do menu e da home (commit `b7f0dc4`); código mantido |
| D4 | Front dentro da API (`wwwroot/`) | ✅ `UseStaticFiles` + `API_URL = "/api"` (commit `3b7f854`) |
| D5 | Banco na nuvem | ⏳ Proposta enviada; aguardando OK da equipe |
| D6 | Manter scripts SQL | ✅ Mudanças de esquema novas serão scripts não destrutivos `09_...` |

---

## e) Situação do plano (atualizado em 05/11/2026)

| Item | Situação | Commit |
|---|---|---|
| Reorganização das pastas (Controllers, Models, Data, wwwroot) | ✅ | `9773253` |
| D4: front servido pela API em `wwwroot/` | ✅ | `3b7f854` |
| D3: Séries fora do menu | ✅ | `b7f0dc4` |
| P0-1: erro 500 na estante | ✅ | `b36f56d` |
| P0-2: login obrigatório para alterar o catálogo | ✅ | `733d140` |
| P0-3: tratamento global de erros e 409 ao excluir livro com vínculos | ✅ | `4e46835` |
| P0-4: Data Annotations | ✅ | `9154612` |
| P0-5: Swagger UI com Authorize | ✅ | `881f88e` |
| P0-6: média de aceitação (nota do livro + fidelidade) | ✅ | `1ba1e65` |
| P0-7: segredos via user-secrets e `appsettings.Example.json` | ✅ | `5f03e63` |
| P0-8: (= D4) | ✅ | `3b7f854` |
| P0-9: seed idempotente (Fase 4) | ✅ (imagens: rodar uma vez com internet e chaves) | `0a0791d` |
| P0-10: banco na nuvem (Aiven) | ⏳ **Ação da equipe**: passo a passo no `LEIA-ME.md`, seção 2. Conferir com `/api/saude` | `ae20073`, `c3014e6` |
| P1-1 a P1-8 e P1-10: visual (Fase 5) | ✅ | `a3ae175` … `df24bc3` |
| P1-9: TMDB mais rápido (diretores em paralelo: 6,2 s → 0,7 s) | ✅ | `19cdb71` |
| Ranking com mínimo de 2 avaliações e desempate | ✅ | `b5f7321` |
| Roteiro da demo (Fase 6) | ✅ `docs/ROTEIRO_DEMO.md` | `cfb7352` |
| P2-1: `LivroController` assíncrono | ✅ | `cf2b8ac` |
| P2-2: POST com 201 Created | ✅ | `73563f3` |
| P2-3: DTOs com `ReadFromJsonAsync` nas APIs externas | ✅ | `647c013` |
| P2-4: POO, regras de status no Model `Estante` | ✅ | `56f7091` |
| P2-5: remover a rota duplicada `/api/Review/ranking-adaptacoes` | ✅ Removida com autorização da equipe (o ranking fica só em `/api/Adaptacao/ranking`) | ver histórico |
| P2-6: `Resenhario.Api.http` com todas as rotas | ✅ | `260fc57` |
| P2-7: índices únicos (script 09) | ✅ (rodar no banco) | `9549da6` |
| P2-8: documentação (`DOCUMENTACAO_TECNICA.md`, `GUIA_DEFESA.md`) | ✅ | `61476b4`, guia |
| P2-9: comentários em português | ✅ | `71efad9` |

Riscos resolvidos: R1, R3 (seed), R6, R7, R8, R9 (documentado), R10, R11, R12, R14. Em aberto: **R2** (banco na nuvem, ação da equipe), **R4/R5** (configurar as chaves do Google Books e do TMDB), R13 (os scripts SQL continuam sem `SET NAMES utf8mb4`; no Workbench isso não costuma causar problema).

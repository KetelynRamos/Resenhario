# Resenhário: do filme ao livro

Plataforma web de catálogo literário social que liga livros às suas adaptações para o cinema. Projeto da disciplina **Desenvolvimento de Software Visual** (Universidade Positivo, 2026).

O nome oficial do projeto é **Resenhário** (o texto do PDF de escopo cita "LivreFlix", nome provisório que a equipe substituiu).

**Stack:** C# / .NET 10 (ASP.NET Core Web API) · Entity Framework Core + Pomelo (MySQL) · HTML, CSS e JavaScript com `fetch()` em `wwwroot/` · Google Books API · TMDB API · BCrypt + JWT.

| Documento | Para quê |
|---|---|
| [`docs/PUBLICAR_ONLINE.md`](docs/PUBLICAR_ONLINE.md) | Publicar o site com um link público (Render + Aiven) |
| [`docs/ROTEIRO_DEMO.md`](docs/ROTEIRO_DEMO.md) | Roteiro da apresentação (5–7 min) e plano B |
| [`docs/AUDITORIA.md`](docs/AUDITORIA.md) | Conformidade com o escopo, riscos e plano de correções |

---

## 1. Pré-requisitos

- [.NET 10 SDK](https://dotnet.microsoft.com/download) (`dotnet --version` deve mostrar `10.x`)
- Um banco MySQL 8: **na nuvem (Aiven)**, recomendado para a apresentação, ou local (MySQL Workbench)
- Opcional, mas recomendado: token do TMDB e chave do Google Books (veja a seção 3)

## 2. Banco de dados

### Opção A: banco na nuvem (Aiven), usada na apresentação

1. Entre em [console.aiven.io](https://console.aiven.io) (a conta da equipe entra com o GitHub).
2. **Create service → MySQL → plano Free**. Escolha a nuvem/região oferecida e crie. Espere o status ficar **Running** (alguns minutos).
3. Na aba **Overview → Connection information**, anote **Host**, **Port** (não é 3306!), **User** (`avnadmin`) e **Password**. O SSL é obrigatório (`ssl-mode: REQUIRED`).
4. No **MySQL Workbench**, crie uma conexão com esses dados. Em *SSL*, escolha **Require**.
5. Rode, nesta ordem, os scripts da pasta `BANCO DE DADOS/`: **`01_criar_banco.sql`**, **`05_atualizar_banco.sql`**, **`08_alinhar_escopo.sql`** e **`09_indices_unicos.sql`**. Eles criam o banco `resenhario_db`, as tabelas e os índices únicos sem apagar nada.
6. Grave a string de conexão na sua máquina (seção 3) usando o host e a porta do Aiven e `SslMode=Required`.
7. Rode a API (seção 4): na primeira vez, ela mesma preenche o banco com os dados de demonstração.
8. Confira em `http://localhost:5131/api/saude`: deve aparecer `"banco": "conectado"` e o host do Aiven.

> ⚠️ **Planos gratuitos podem ser desligados depois de um tempo sem uso.** No dia da apresentação, abra o console do Aiven antes e confira se o serviço está **Running**. Se estiver desligado, clique em *Power on* e espere alguns minutos.
>
> ⚠️ A senha do Aiven é compartilhada entre a equipe por um canal privado. **Nunca** coloque a senha no código, em um commit ou em print de tela.

### Opção B: banco local

1. Abra o MySQL Workbench na sua máquina.
2. Rode os mesmos scripts: `01_criar_banco.sql`, `05_atualizar_banco.sql`, `08_alinhar_escopo.sql` e `09_indices_unicos.sql`.
3. Grave a string de conexão local (seção 3).

### Sobre os outros scripts

| Script | Quando usar |
|---|---|
| `02_dados_teste.sql` | **Não use.** São dados antigos de teste (os usuários não conseguem logar). Os dados de demonstração agora vêm do *seed* automático (seção 5). |
| `03_consultas_teste.sql`, `04_relacionamentos.sql` | Consultas de exemplo, só leitura. |
| `06_limpar_resenhas_de_teste.sql` | **Apaga** resenhas. Não rode no banco da nuvem. |
| `07_migrar_notas_para_escala_1_a_5.sql` | Só para bancos antigos com notas de 0 a 10. |
| `09_indices_unicos.sql` | Cria os índices únicos de e-mail e de par livro/filme. Se encontrar dados repetidos, só avisa. Pode rodar de novo sem problema. |

## 3. Segredos (fora do Git)

Senhas e chaves **nunca** vão para o `appsettings.json` nem para o GitHub. Cada pessoa grava os valores na própria máquina com o **`dotnet user-secrets`**, que guarda tudo numa pasta do usuário, fora do projeto. O ASP.NET carrega esses valores automaticamente no ambiente `Development`. O arquivo `BACKEND/Resenhario.Api/appsettings.Example.json` mostra quais chaves existem.

No terminal, dentro de `BACKEND/Resenhario.Api`:

```powershell
cd BACKEND/Resenhario.Api

# Banco na nuvem (Aiven): troque HOST, PORTA e SENHA pelos dados do console
dotnet user-secrets set "ConnectionStrings:DefaultConnection" "server=HOST;port=PORTA;database=resenhario_db;user=avnadmin;password=SENHA;SslMode=Required;"

# ou banco local
dotnet user-secrets set "ConnectionStrings:DefaultConnection" "server=localhost;port=3306;database=resenhario_db;user=root;password=SUA_SENHA;"

dotnet user-secrets set "Tmdb:ReadAccessToken" "SEU_READ_ACCESS_TOKEN_DO_TMDB"
dotnet user-secrets set "GoogleBooks:ApiKey" "SUA_CHAVE_DO_GOOGLE_BOOKS"
dotnet user-secrets list
```

- **TMDB:** obrigatório para pesquisar filmes e buscar os pôsteres do seed. Em themoviedb.org → Configurações → API → *API Read Access Token*.
- **Google Books:** opcional, mas **recomendado**: sem chave, a cota pública pode acabar (erro 429). Crie no Google Cloud Console com a *Books API* ativada.
- **JWT:** no ambiente `Development` a API usa uma chave de desenvolvimento que está em `appsettings.Development.json` (serve só para rodar localmente). Fora do Development, configure `Jwt:Key` (mínimo de 32 caracteres) com user-secrets ou com a variável de ambiente `Jwt__Key`.

Alternativa: variáveis de ambiente (use `__` no lugar de `:`), por exemplo `$env:Tmdb__ReadAccessToken = "..."` no PowerShell. Elas valem só para o terminal atual.

## 4. Executar

```powershell
cd BACKEND/Resenhario.Api
dotnet run --launch-profile http
```

| Endereço | O que é |
|---|---|
| `http://localhost:5131` | O site (as páginas ficam em `wwwroot/` e são servidas pela própria API) |
| `http://localhost:5131/swagger` | Swagger: teste da API. Use **Authorize** e cole o token de `/api/Auth/login` |
| `http://localhost:5131/api/saude` | Confere se a API e o banco estão conectados |

Use sempre `--launch-profile http`: ele liga o ambiente `Development`. Sem ele, a API para na inicialização pedindo a `Jwt:Key`. Não abra as páginas por `file://`.

## 5. Dados de demonstração (seed)

Ao iniciar, a API preenche o banco sozinha (classe `Data/SeedData.cs`) e **não duplica nada** se rodar de novo:

- 20 livros adaptados (clássicos, contemporâneos e brasileiros) e 21 filmes com diretor e ano;
- 6 usuários com os nomes da equipe, estantes com todos os status e 32 resenhas com nota do livro e fidelidade.

| Usuário (e-mail) | Senha |
|---|---|
| `alejandro@resenhario.dev`, `john@resenhario.dev`, `lucas@resenhario.dev`, `ketelyn@resenhario.dev`, `matheus@resenhario.dev`, `vinicius@resenhario.dev` | `Resenhario2026` |

**Capas e pôsteres:** a classe `Data/SeedImagens.cs` busca as imagens no TMDB e no Google Books e **as salva no banco**. Para isso, rode a API **uma vez com internet e com as chaves da seção 3** e confira no terminal mensagens como `Seed: 21 pôster(es) obtidos do TMDB`. Depois disso, a apresentação não depende das APIs externas para mostrar os dados. Sem chave ou sem internet, o site mostra capas desenhadas (placeholders) e continua funcionando.

Para desligar o seed: `dotnet user-secrets set "Seed:Habilitado" "false"`.

## 6. Estrutura do projeto

```
BACKEND/Resenhario.Api/
├── Controllers/    API REST ([ApiController], rotas api/[controller])
├── Models/         Classes do domínio (Livro, Filme, Adaptacao, Review, Estante, Usuario) com Data Annotations
├── Data/           AppDbContext (EF Core), SeedData e SeedImagens
├── wwwroot/        Front-end: index.html, paginas/, css/style.css, js/ (api.js, ui.js, script.js), lib/ (Chart.js)
├── Program.cs      Configuração: EF Core, JWT, HttpClientFactory, Swagger, erros globais, seed, /api/saude
└── appsettings*.json
BANCO DE DADOS/     Scripts SQL (criação e atualização não destrutivas)
docs/               Auditoria, roteiro da demo e documentação técnica
```

## 7. Segurança

- Senhas guardadas com hash **BCrypt**; login devolve um token **JWT** (8 horas).
- Estante, resenhas e qualquer alteração no catálogo exigem login (`[Authorize]`); cada usuário só altera a própria estante e as próprias resenhas.
- Validação de entrada com Data Annotations e tratamento global de erros (sem stack trace para o navegador).
- Chaves do TMDB e do Google ficam só no backend; o JavaScript nunca as recebe.
- O token fica no `localStorage`, o que é prático para o projeto acadêmico. Para produção, o ideal seria um cookie `HttpOnly`.

## 8. Problemas comuns

| Sintoma | Causa provável e solução |
|---|---|
| `/api/saude` mostra `"banco": "sem conexão"` | String de conexão errada, serviço do Aiven desligado, ou falta `SslMode=Required`. O campo `motivo` diz o erro. |
| Erro na inicialização: `Configure Jwt:Key...` | Rodou sem `--launch-profile http`. |
| Busca de filmes: "integração TMDB não configurada" | Falta o `Tmdb:ReadAccessToken` (seção 3). |
| Busca de livros: "Google Books respondeu com HTTP 429" | Cota pública esgotada: configure `GoogleBooks:ApiKey`. Os livros já salvos continuam aparecendo. |
| Capas desenhadas em vez das imagens reais | O seed de imagens ainda não rodou com internet e chaves (seção 5). |
| Gráficos da estante não aparecem | Sem internet o Chart.js é carregado da cópia em `wwwroot/lib`; recarregue a página (Ctrl+F5). |

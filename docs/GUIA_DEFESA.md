# Guia para a defesa de código (19/11)

Para cada conceito da disciplina: **onde ele está no nosso código** (arquivo:linha), **um trecho curto** e **uma explicação em linguagem simples**. No fim, perguntas prováveis do professor com respostas.

> Os caminhos são relativos a `BACKEND/Resenhario.Api/`. Os números de linha valem para a branch `ajustes-entrega` em 05/11/2026. Se alguém mexer no arquivo, procure pelo trecho.

**Dica:** cada pessoa da equipe deve conseguir explicar pelo menos uma seção sem ler. Sugestão de divisão, pelos papéis do escopo:

| Seção | Quem (sugestão) |
|---|---|
| 1. POO · 2. MVC | Ketelyn |
| 3. API REST · 6. Validação e erros | Vinicius |
| 4. EF Core e banco | John |
| 5. APIs externas | Lucas |
| 7. Segurança | Matheus |
| 8. Front-end · Perguntas gerais | Alejandro |
| 9. Comunidade, perfil e meta | Ketelyn e Lucas |

---

## 1. Programação Orientada a Objetos (POO)

### Classes e propriedades modelam o domínio
`Models/Livro.cs:8`, e também `Filme`, `Adaptacao`, `Review`, `Estante`, `Usuario`
```csharp
public class Livro
{
    [Key] public int IdLivros { get; set; }
    public string Titulo { get; set; } = string.Empty;
    public string Autor { get; set; } = string.Empty;
}
```
**Explicação:** cada coisa do mundo real do projeto (livro, filme, resenha…) virou uma **classe**. As características viraram **propriedades** (`get; set;`). Cada linha da tabela `Livros` vira um **objeto** `Livro` em memória.

### Métodos: o objeto conhece as próprias regras
`Models/Estante.cs:21-36` (definição) · usados em `Controllers/EstanteController.cs:76`, `:79` e `:94`
```csharp
public static readonly string[] StatusLivro = { "Quero ler", "Lendo", "Lido", "Abandonado" };
public bool EhLivro() => IdLivros.HasValue;
public bool StatusValido(string? status) => status is not null && StatusPermitidos().Contains(status);
public void AtualizarStatus(string status) { Status = status; DataAtualizacao = DateTime.UtcNow; }
```
**Explicação:** em vez de o controller decidir quais status valem, a própria `Estante` sabe. Isso é **encapsulamento**: a regra fica num lugar só. `static` significa que a lista pertence à **classe** (é uma só para todos os objetos), não a cada estante.

### Namespaces e organização em pastas
Cada arquivo declara onde mora: `namespace Resenhario.Api.Models;`, `Resenhario.Api.Controllers`, `Resenhario.Api.Data`, `Resenhario.Api.Models.Externos`.
**Explicação:** o namespace é o "sobrenome" da classe; ele evita confusão entre nomes iguais e espelha as pastas.

### Construtor e injeção de dependência
`Controllers/LivroController.cs:18`
```csharp
public LivroController(AppDbContext context) => _context = context;
```
**Explicação:** o controller **não cria** o banco; ele **recebe** o `AppDbContext` pronto pelo construtor. Quem entrega é o ASP.NET, que registramos no `Program.cs:29` (`AddDbContext`). Isso se chama **injeção de dependência**.

### Herança
`Data/AppDbContext.cs:8`: `public class AppDbContext : DbContext`, e todos os controllers herdam de `ControllerBase`.
**Explicação:** herdamos tudo o que o EF Core e o ASP.NET já sabem fazer e só acrescentamos o que é nosso.

---

## 2. MVC

| Letra | No Resenhário | Exemplo |
|---|---|---|
| **M**odel | `Models/` | `Livro`, `Review` (dados + Data Annotations), `Estante` (regras de status) |
| **C**ontroller | `Controllers/` | `LivroController`: recebe a requisição, usa o Model e o banco, devolve a resposta |
| **V**iew | `wwwroot/` | `paginas/livros.html` + `css/style.css` + `js/paginas/livros.js` |

**Explicação:** nossas Views são **HTML + JavaScript** em vez de Razor (`.cshtml`). A ligação entre front e back é feita com **`fetch()`** trocando **JSON**, alternativa vista em aula. A API serve essas páginas pela pasta `wwwroot` (`Program.cs:120`, `app.UseStaticFiles()`).

O front chama a API em um único lugar: `wwwroot/js/api.js:39` (função `api`) e `:46` (`fetch`). Exemplos de cada verbo: POST em `js/catalogo.js:56`, PUT em `js/paginas/estante.js:56`, DELETE em `js/paginas/estante.js:76`.

```javascript
await api(`/Estante/${item.idEstante}`, { method: "PUT", body: JSON.stringify({ status: select.value }) });
```

---

## 3. API REST

### Controller com rota padrão
`Controllers/LivroController.cs:11-12`
```csharp
[ApiController]
[Route("api/[controller]")]   // [controller] = "Livro" → /api/Livro
public class LivroController : ControllerBase
```
**Explicação:** `[ApiController]` liga recursos automáticos de API (como responder **400** sozinho quando o JSON é inválido). A rota usa o nome da classe sem "Controller".

### Verbos e status semânticos (todos no `LivroController`)

| Ação | Verbo | Retorno | Linha |
|---|---|---|---|
| Listar | GET | `Ok(...)` → **200** | `:23` |
| Buscar 1 | GET `{id}` | `Ok` ou `NotFound()` → **200/404** | `:29-30` |
| Criar | POST | `CreatedAtAction(...)` → **201** + cabeçalho `Location` | `:77` |
| Duplicado | POST | `Conflict(...)` → **409** | `:69` |
| Atualizar | PUT | `NoContent()` → **204** | `:96` |
| Excluir | DELETE | `NoContent()` → **204**, ou **409** se tiver vínculos | `:117`, `:113` |
| Dado inválido | qualquer | **400** automático (Data Annotations) | `Models/Livro.cs:18` |

### Swagger
`Program.cs:113`: `app.UseSwaggerUI(...)` → `http://localhost:5131/swagger`. O botão **Authorize** aceita o token JWT para testar as rotas protegidas.

### Minimal API
`Program.cs:129`: `app.MapGet("/api/saude", ...)`. Uma rota escrita direto no `Program.cs`, sem controller, que responde **200** se o banco está conectado e **503** se não está. Mostra o outro estilo de API visto em aula.

---

## 4. CRUD com Entity Framework Core

### AppDbContext e DbSet
`Data/AppDbContext.cs:8` e `:16`
```csharp
public class AppDbContext : DbContext
{
    public DbSet<Livro> Livros { get; set; } = null!;   // tabela Livros
}
```
**Explicação:** o `AppDbContext` é a ponte entre o C# e o MySQL. Cada `DbSet` é uma tabela. Escrevemos LINQ em C# e o EF Core traduz para SQL.

### As operações do CRUD (`Controllers/LivroController.cs`)

| Operação | Código | Linha | Vira no SQL |
|---|---|---|---|
| Ler todos | `await _context.Livros.OrderBy(l => l.Titulo).ToListAsync()` | `:23` | `SELECT ... ORDER BY Titulo` |
| Ler 1 | `await _context.Livros.FindAsync(id)` | `:29` | `SELECT ... WHERE IdLivros = @id` |
| Criar | `_context.Livros.Add(livro)` + `SaveChangesAsync()` | `:75-76` | `INSERT` |
| Atualizar | altera as propriedades + `SaveChangesAsync()` | `:88-95` | `UPDATE` |
| Excluir | `_context.Livros.Remove(livro)` + `SaveChangesAsync()` | `:115-116` | `DELETE` |

**Importante:** `Add` e `Remove` só **marcam** a mudança; quem grava no banco é o **`SaveChangesAsync()`**.

### async/await
**Explicação:** acessar o banco demora (rede + disco). Com `await`, o servidor **libera a thread** para atender outras pessoas enquanto espera a resposta, em vez de ficar parado. Por isso todos os métodos do `LivroController` são `async Task<...>` e usam as versões `...Async`.

### Consultas com JOIN e média (ranking)
`Controllers/AdaptacaoController.cs:71-93`: `join` entre Adaptacoes, Livros e Filmes, `Average()` das notas de fidelidade, filtro `TotalAvaliacoes >= MinimoAvaliacoesRanking` (`:92`) e `OrderByDescending` (`:93`). O EF Core transforma tudo em **um único SQL** com `JOIN` e `AVG()`.

### Banco e scripts
O esquema é criado pelos scripts `BANCO DE DADOS/01`, `05`, `08` e `09` (não destrutivos). Escolhemos scripts em vez de *migrations* porque o banco já existia, criado pelo responsável de banco da equipe, e os scripts são fáceis de rodar no Workbench e no Aiven.

---

## 5. Consumo de APIs externas (Google Books e TMDB)

Tudo em `Controllers/CatalogoExternoController.cs`.

| Conceito da aula | Onde | Explicação |
|---|---|---|
| **IHttpClientFactory** | registro em `Program.cs:18`; injetado em `:20`; `CreateClient` em `:44` | Reaproveita conexões. Criar `new HttpClient()` a cada chamada pode esgotar as portas do servidor. |
| **GetAsync + await** | `:46` | Faz a chamada HTTP sem travar o servidor. |
| **Desserialização para DTOs** | `:50` (`ReadFromJsonAsync<GoogleBooksResposta>`) e `:118` (TMDB) | O JSON vira objetos C#. Os DTOs estão em `Models/Externos/`. |
| **API key fora do código** | `:41` (`GoogleBooks:ApiKey`) e `:100` (`Tmdb:ReadAccessToken`) | A chave é lida da configuração (user-secrets), nunca escrita no código nem enviada ao JavaScript. |
| **try/catch HttpRequestException** | `:67` (Google) e `:144` (TMDB) | Se a API externa cair, respondemos **502** com mensagem e a tela mostra um aviso. |
| Resposta inválida | `:71` (`JsonException`) | Se a API devolver algo que não é JSON, também vira 502 com mensagem. |

```csharp
var client = _httpClientFactory.CreateClient("CatalogoExterno");
using var response = await client.GetAsync(url, cancellationToken);
var resposta = await response.Content.ReadFromJsonAsync<GoogleBooksResposta>(cancellationToken);
```

**DTO com nome diferente no JSON:** `Models/Externos/TmdbDtos.cs:17`: `[property: JsonPropertyName("poster_path")] string? PosterPath`. O TMDB usa `poster_path` (com sublinhado) e nós usamos `PosterPath`; o atributo liga os dois.

---

## 6. Validação, erros e boas práticas

### Data Annotations
`Models/Livro.cs:18`, `Models/Review.cs:16` e `:22`, `Controllers/AuthController.cs:27-34`
```csharp
[Required(ErrorMessage = "O título do livro é obrigatório.")]
[StringLength(200)]
public string Titulo { get; set; }

[Range(1, 5, ErrorMessage = "A nota da obra deve estar entre 1 e 5 estrelas.")]
public int? NotaLivro { get; set; }
```
**Explicação:** as regras ficam **em cima da propriedade**. Com `[ApiController]`, o ASP.NET valida **antes** de entrar no método e responde **400** com as mensagens. O front mostra essas mensagens (`wwwroot/js/api.js:57`).

### Tratamento global de erros
`Program.cs:98`: `app.UseExceptionHandler(...)`. Qualquer exceção não tratada vira **500** com JSON `{ "mensagem": "Ocorreu um erro inesperado..." }`, sem expor o *stack trace* (detalhes internos) para o navegador. O detalhe continua no log do terminal.

### Endpoints sensíveis protegidos
`[Authorize]` na classe inteira da estante (`Controllers/EstanteController.cs:12`) e nas ações de escrita do catálogo (ex.: `Controllers/LivroController.cs:63` e `:81`). Sem token, a API responde **401**.

---

## 7. Segurança

### Senha com BCrypt
`Controllers/AuthController.cs:65` (cadastro) e `:90` (login)
```csharp
SenhaHash = BCrypt.Net.BCrypt.HashPassword(dados.Senha);       // cadastro
senhaValida = BCrypt.Net.BCrypt.Verify(dados.Senha, usuario.SenhaHash); // login
```
**Explicação:** guardamos só o **hash**, algo como `$2a$11$Kq3...`. O `11` é o "custo": o BCrypt é lento de propósito, o que torna tentar milhões de senhas inviável. Cada hash tem um **sal** aleatório, então duas pessoas com a mesma senha têm hashes diferentes. Não existe "descriptografar": no login, o BCrypt aplica a mesma conta à senha digitada e compara.

### Token JWT
`Controllers/AuthController.cs:108` (ID do usuário dentro do token) e `:115-116` (token com validade de 8 h); validação em `Program.cs:41`.
**Explicação:** depois do login, a API entrega um "crachá" assinado (o token). O navegador manda esse crachá em cada requisição (`Authorization: Bearer ...`, em `wwwroot/js/api.js:42`). A API confere a **assinatura**: se alguém alterar o token, a assinatura não bate e a resposta é 401.

### Cada um mexe só no que é seu
`Controllers/EstanteController.cs:112` (lê o ID **do token**), `:78` e `Controllers/ReviewController.cs:129`
```csharp
estante.IdUsuario = usuarioId; // Nunca confiar no ID enviado pelo navegador.
```

### Segredos fora do Git
Conexão do banco, token do TMDB e chave do Google ficam no **`dotnet user-secrets`**, uma pasta do usuário fora do projeto. O `appsettings.Example.json` mostra só o formato.

---

## 8. Front-end

| O quê | Onde | Explicação |
|---|---|---|
| Chamadas à API | `wwwroot/js/api.js:39` | Uma função central que coloca o token, converte JSON e transforma erros em mensagens. |
| Componentes reutilizáveis | `wwwroot/js/ui.js` (ex.: `criarDuelo` em `:305`) | O card "Livro vs. Filme" é montado por uma função usada na home, no ranking e em Filmes. |
| Proteção contra XSS | `wwwroot/js/ui.js:12` (`textContent`) | Texto digitado por usuários nunca vira HTML executável. |
| Gráficos | `wwwroot/js/ui.js:240` | Chart.js do CDN; se a internet falhar, carrega a cópia local em `wwwroot/lib`. |
| Responsivo | `wwwroot/css/style.css` (blocos `@media`) | Menu vira botão ☰ no celular; grades se reorganizam. |

---

## 9. Comunidade, perfil e meta de leitura

| O quê | Onde | Explicação simples |
|---|---|---|
| **Curtir** | `Controllers/ComunidadeController.cs:32` (POST) e `:37` (409 se já curtiu) | Rota "dentro" da resenha: `POST /api/Review/5/curtida`. Uma pessoa só curte uma vez: o controller confere antes (409 Conflict) e o banco garante com o índice único `UQ_Curtidas_Review_Usuario` (`BANCO DE DADOS/10_perfil_meta_comunidade.sql:48`). |
| **"Eu já curti?"** | `Controllers/ReviewController.cs:91` | O feed é público, mas se a pessoa mandar o token, a API marca as resenhas que **ela** curtiu (`CurtidoPorMim`), e o coração aparece preenchido. |
| **Curtida instantânea** | `wwwroot/js/resenhas.js:127` | O coração muda na hora e só depois a API confirma. Se a API recusar, a tela desfaz. Isso se chama "atualização otimista". |
| **Comentários** | `Controllers/ComunidadeController.cs` | GET lista, POST cria (201), DELETE apaga, e só o autor apaga o próprio comentário (o ID vem do token). Com `ON DELETE CASCADE`, apagar uma resenha apaga as curtidas e os comentários dela. |
| **Avatar** | `Controllers/UsuarioController.cs:21-23` (validação) e `:111` (servir a imagem) | Pode ser um dos 8 avatares prontos (arquivos SVG em `wwwroot/img/avatares`) ou uma foto. A foto é **recortada e reduzida no navegador** (`wwwroot/js/paginas/perfil.js:120`, com `<canvas>`) para 256 px antes de enviar, e fica no banco como texto base64. A rota `GET /api/Usuario/{id}/avatar` devolve a imagem para o feed. |
| **Meta de leitura** | `Controllers/UsuarioController.cs:96` (salva) e `wwwroot/js/paginas/estante.js:176` (painel) | A pessoa escolhe quantos livros ler em 6 meses. Guardamos a meta e a data de início; o progresso conta os livros marcados como "Lido" depois dessa data (`paginas/estante.js:172`) e compara com os 6 meses anteriores. |
| **Accordion "Conta"** | `wwwroot/paginas/perfil.html` | `<details>` e `<summary>` são tags do próprio HTML que abrem e fecham sozinhas, sem JavaScript. |
| **Ícones sem emoji** | `wwwroot/js/ui.js:186` | Coração, balão e compartilhar são pequenos desenhos SVG escritos no código. |

**Perguntas prováveis sobre essa parte**

**22. O que impede alguém de curtir a mesma resenha 50 vezes?**
Duas barreiras: o controller verifica e responde **409 Conflict**, e o banco tem um **índice único** em (resenha, usuário). Mesmo que alguém chame a API direto, o banco recusa a segunda curtida.

**23. Onde fica a foto do perfil? Não pesa no banco?**
A foto é reduzida no próprio navegador para 256×256 em JPEG (algumas dezenas de KB) e guardada como texto (base64) na coluna `Avatar`. A API aceita só imagens JPG, PNG ou WEBP de até cerca de 220 KB. No feed não mandamos a imagem no JSON: mandamos só o endereço `/api/Usuario/{id}/avatar`, e o navegador a baixa e guarda em cache.

**24. Por que a curtida aparece antes da resposta do servidor?**
Para o site parecer rápido. É a "atualização otimista": a tela assume que vai dar certo e, se a API devolver erro, desfaz a mudança e mostra o aviso.

**25. Como a meta sabe quais livros contar?**
Quando um livro vira "Lido", a estante guarda a data da mudança (`DataAtualizacao`). A meta conta os livros "Lido" com data depois do início do desafio, e a comparação usa os 6 meses anteriores a esse início.

---

## O que usamos que vai além da aula (e como explicar)

| Recurso | Onde | Explicação curta |
|---|---|---|
| **JWT** | `AuthController`, `Program.cs:41` | "Crachá" assinado que prova quem é o usuário sem guardar sessão no servidor. |
| **record** e `with` | `Models/Externos/*.cs`, `CatalogoExternoController.cs:134` | `record` é uma classe enxuta para carregar dados. `f with { Diretor = ... }` cria uma **cópia** mudando só um campo. |
| **Task.WhenAll** | `CatalogoExternoController.cs:130` | Dispara as 12 buscas de diretor **ao mesmo tempo** e espera todas: a busca caiu de ~6 s para ~0,7 s no nosso teste. |
| **LINQ com `join`** | `AdaptacaoController.cs:36` | Escrita parecida com SQL dentro do C#; o EF Core traduz para `JOIN`. |
| **user-secrets** | `LEIA-ME.md`, seção 3 | Arquivo de configuração por usuário, fora da pasta do projeto, que não vai para o Git. |
| **Seed idempotente** | `Data/SeedData.cs:171` e `:178` | Antes de inserir, confere se já existe (`AnyAsync`): rodar várias vezes não duplica. |
| **`db.Livros.Local`** | `Data/SeedImagens.cs:104` | Olha os objetos já alterados na memória e ainda não salvos (o `SaveChanges` é só no fim). |
| **CancellationToken** | parâmetros `cancellationToken` no `CatalogoExternoController` | Se o usuário fechar a página, a busca externa é cancelada em vez de continuar à toa. |

---

## Perguntas prováveis do professor

**1. Por que usar `IHttpClientFactory` em vez de `new HttpClient()`?**
Cada `new HttpClient()` abre conexões novas, e as conexões antigas demoram para liberar a porta. Com muitas requisições, as portas do servidor podem acabar. A fábrica reaproveita as conexões e centraliza a configuração (timeout de 20 s, User-Agent) no `Program.cs:18`.

**2. Como a senha é guardada?**
Só o hash BCrypt (`AuthController.cs:65`), com sal aleatório e custo 11. Nem a equipe consegue ver a senha. No login, `BCrypt.Verify` compara a senha digitada com o hash (`:90`).

**3. O que acontece se o TMDB estiver fora do ar?**
O `try/catch` captura a `HttpRequestException` e a API responde **502** com uma mensagem (`CatalogoExternoController.cs:144`). A tela mostra o aviso e o resto do site continua funcionando, porque os filmes já salvos vêm do **nosso** banco. Se o token não estiver configurado, a resposta é **503** com instruções. Na apresentação, mostramos isso ao vivo (`ROTEIRO_DEMO.md`).

**4. Por que o PUT retorna 204?**
204 é *No Content*: deu certo, mas não há nada novo para devolver, porque quem chamou já sabe o que mandou. Usamos o mesmo no DELETE.

**5. Qual a diferença entre 200, 201 e 204?**
200: deu certo e tem conteúdo (ex.: uma lista). 201: algo **novo foi criado**; respondemos com o recurso e o cabeçalho `Location` apontando para ele (`CreatedAtAction`). 204: deu certo, sem conteúdo.

**6. Como a API sabe quem está fazendo a requisição?**
Pelo token JWT no cabeçalho `Authorization`. Dentro dele vai o ID do usuário (`AuthController.cs:108`). O `UseAuthentication` confere a assinatura e o `TentarObterUsuarioId` (`EstanteController.cs:112`) lê o ID.

**7. Se eu mandar o ID de outro usuário no JSON, consigo mexer na estante dele?**
Não. A API ignora o ID que vem do navegador e usa o do token (`EstanteController.cs:78`). Nas consultas, filtramos por `IdUsuario == usuarioId`; se o item for de outra pessoa, a resposta é **404**.

**8. Por que `async/await` em tudo?**
Para o servidor não ficar parado esperando o banco ou a API externa. Enquanto espera, a mesma thread atende outras requisições.

**9. O que é o `AppDbContext`?**
A classe do EF Core que representa o banco. Cada `DbSet` é uma tabela. O LINQ que escrevemos vira SQL; `SaveChangesAsync` grava as mudanças.

**10. Por que não usaram migrations?**
O banco já existia e era mantido pelos scripts SQL do responsável de banco. Os scripts são não destrutivos (`CREATE TABLE IF NOT EXISTS`, checagens antes de alterar) e rodam igual no MySQL local e no Aiven. Mudanças novas viram scripts numerados (ex.: `09_indices_unicos.sql`).

**11. Onde ficam as chaves das APIs e a senha do banco?**
No `dotnet user-secrets` de cada máquina, fora do repositório. O código só lê pelo nome (`_configuration["Tmdb:ReadAccessToken"]`). Verificamos o histórico do Git: nenhum segredo foi commitado.

**12. Como é calculado o ranking? Por que precisa de 2 avaliações?**
Média (`AVG`) das notas de fidelidade de cada adaptação, calculada na hora pelo banco. Com uma única nota 5, um filme ficaria acima de outro avaliado por muita gente, o que não é justo. Por isso exigimos pelo menos 2 avaliações (`AdaptacaoController.cs:18`). Em caso de empate, vence o livro com a maior média de notas.

**13. O que é a "avaliação dupla"?**
Cada resenha tem duas notas: a **qualidade do livro** (obrigatória) e a **fidelidade do filme** (opcional, só se a pessoa viu uma adaptação). A API confere que a adaptação escolhida é **daquele livro** (`ReviewController.cs:117`).

**14. Como funciona a validação?**
Data Annotations nos Models (`[Required]`, `[Range(1,5)]`…). Com `[ApiController]`, o ASP.NET valida antes do método e devolve **400** com as mensagens. Regras que dependem do banco (o livro existe? já está na estante?) ficam no controller.

**15. E se acontecer um erro que ninguém previu?**
O `UseExceptionHandler` (`Program.cs:98`) captura e responde 500 com uma mensagem amigável, sem mostrar detalhes internos. O erro completo fica no log.

**16. Por que o navegador não chama o Google Books direto?**
Para proteger as chaves (elas ficariam visíveis no JavaScript), para tratar erros e limites num lugar só e para entregar ao front os dados já no formato que ele usa.

**17. O que é um DTO?**
Data Transfer Object: uma classe (no nosso caso, um `record`) só para **transportar dados** de um formato para outro. Os DTOs em `Models/Externos/` têm apenas os campos do JSON das APIs que usamos.

**18. Onde está o MVC se vocês não têm `.cshtml`?**
Model em `Models/`, Controller em `Controllers/` e View em `wwwroot/` (HTML + CSS + JS). As Views falam com os Controllers por `fetch()` e JSON, em vez de Razor. As duas formas foram vistas em aula.

**19. O seed não duplica os dados toda vez que a API sobe?**
Não. Antes de inserir cada usuário, livro, filme, vínculo, resenha ou item de estante, ele confere se já existe (`SeedData.cs:178`). Testamos reiniciando várias vezes: os totais não mudam.

**20. E se o banco da nuvem cair durante a apresentação?**
`/api/saude` mostra `"sem conexão"` e o motivo. As páginas mostram mensagens amigáveis em vez de quebrar. O plano B é trocar a string de conexão para o MySQL local, já populado (`ROTEIRO_DEMO.md`).

**21. Por que EF Core 9 se o projeto é .NET 10?**
O provedor de MySQL que usamos (Pomelo) ainda não tem versão para o EF Core 10. O EF Core 9 roda normalmente no .NET 10.

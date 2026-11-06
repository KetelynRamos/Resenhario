using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi;
using Resenhario.Api.Data;

// Program.cs: ponto de entrada. Primeiro registramos os SERVIÇOS (builder.Services),
// depois montamos o PIPELINE de cada requisição (app.Use...) e as rotas (app.Map...).
var builder = WebApplication.CreateBuilder(args);

// ----- Serviços (injeção de dependência) -----

builder.Services.AddControllers(); // ativa os controllers da pasta Controllers/

// HttpClient nomeado para as APIs externas, criado pelo IHttpClientFactory.
// Timeout de 20 s: se o Google Books ou o TMDB travarem, a requisição não fica presa para sempre.
builder.Services.AddHttpClient("CatalogoExterno", client =>
{
    client.Timeout = TimeSpan.FromSeconds(20);
    client.DefaultRequestHeaders.UserAgent.ParseAdd("Resenhario/1.0 (academic project)");
});

// Banco MySQL com EF Core (Pomelo). A string de conexão vem de appsettings/user-secrets,
// nunca escrita aqui no código.
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection")
    ?? throw new InvalidOperationException("A conexão com o banco não foi configurada.");

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseMySql(connectionString, ServerVersion.AutoDetect(connectionString)));

// Autenticação JWT: no login a API assina um token com esta chave; nas rotas com [Authorize]
// ela confere a assinatura, o emissor, o público e a validade do token recebido.
var jwtKey = builder.Configuration["Jwt:Key"];
if (string.IsNullOrWhiteSpace(jwtKey) || Encoding.UTF8.GetByteCount(jwtKey) < 32)
    throw new InvalidOperationException("Configure Jwt:Key com pelo menos 32 bytes. Use Jwt__Key como variável de ambiente fora do ambiente de desenvolvimento.");

var jwtIssuer = builder.Configuration["Jwt:Issuer"] ?? "Resenhario.Api";
var jwtAudience = builder.Configuration["Jwt:Audience"] ?? "Resenhario.Frontend";
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = jwtIssuer,
            ValidateAudience = true,
            ValidAudience = jwtAudience,
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey)),
            ValidateLifetime = true,
            ClockSkew = TimeSpan.FromMinutes(1)
        };
    });
builder.Services.AddAuthorization();

// CORS: só é necessário se o front for aberto em outra porta (ex.: Live Server).
// Servido pelo wwwroot, o front está na mesma origem da API e não depende disso.
builder.Services.AddCors(options => options.AddPolicy("Frontend", policy =>
    policy.WithOrigins(
            "http://localhost:5500", "http://127.0.0.1:5500",
            "http://localhost:5501", "http://127.0.0.1:5501",
            "http://localhost:5502", "http://127.0.0.1:5502")
        .AllowAnyHeader()
        .AllowAnyMethod()));

// Documento OpenAPI (/openapi/v1.json), lido pela tela do Swagger.
// O transformer registra o esquema "Bearer" para o botão Authorize aceitar o token JWT.
builder.Services.AddOpenApi(options => options.AddDocumentTransformer((document, context, cancellationToken) =>
{
    document.Components ??= new OpenApiComponents();
    document.Components.SecuritySchemes ??= new Dictionary<string, IOpenApiSecurityScheme>();
    document.Components.SecuritySchemes["Bearer"] = new OpenApiSecurityScheme
    {
        Type = SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT",
        Description = "Cole o token recebido em /api/Auth/login (sem a palavra Bearer)."
    };
    document.Security = [new OpenApiSecurityRequirement { [new OpenApiSecuritySchemeReference("Bearer", document)] = [] }];
    return Task.CompletedTask;
}));

var app = builder.Build();

// Dados de demonstração (seed idempotente). Para desligar: "Seed:Habilitado": false.
// Se o banco estiver fora do ar, a API sobe mesmo assim e só registra o aviso no log.
if (app.Configuration.GetValue("Seed:Habilitado", true))
{
    using var scope = app.Services.CreateScope();
    var logger = scope.ServiceProvider.GetRequiredService<ILogger<Program>>();
    try
    {
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        await SeedData.PopularAsync(db);
        await SeedImagens.PreencherAsync(db, scope.ServiceProvider.GetRequiredService<IHttpClientFactory>(),
            app.Configuration, logger);
    }
    catch (Exception ex)
    {
        logger.LogWarning(ex, "Seed: não foi possível popular o banco com os dados de demonstração.");
    }
}

// Tratamento global de erros: qualquer exceção não tratada vira uma resposta
// 500 em JSON com mensagem amigável, sem expor o stack trace ao navegador.
// (O detalhe do erro continua aparecendo no log do terminal.)
app.UseExceptionHandler(erro => erro.Run(async context =>
{
    context.Response.StatusCode = StatusCodes.Status500InternalServerError;
    await context.Response.WriteAsJsonAsync(new
    {
        mensagem = "Ocorreu um erro inesperado no servidor. Tente novamente em instantes."
    });
}));

// Swagger: ligado por padrão no Development. No servidor público (Production) liga com
// a configuração Swagger:Habilitado = true (variável de ambiente Swagger__Habilitado).
if (app.Configuration.GetValue("Swagger:Habilitado", app.Environment.IsDevelopment()))
{
    app.MapOpenApi();
    // Tela do Swagger para testar a API: /swagger
    app.UseSwaggerUI(options => options.SwaggerEndpoint("/openapi/v1.json", "Resenhário API"));
}
app.UseHttpsRedirection();

// O front (HTML, CSS e JS) fica em wwwroot/ e é servido pela própria API:
// abrir http://localhost:5131 carrega o wwwroot/index.html.
app.UseDefaultFiles();
app.UseStaticFiles();

app.UseCors("Frontend");
// Ordem importa: primeiro descobre QUEM é o usuário (token), depois verifica se ele PODE acessar.
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers(); // liga as rotas dos controllers (api/[controller])

// Rota de saúde (Minimal API): confirma se a API está no ar e se o banco responde.
// Útil antes da apresentação: abra http://localhost:5131/api/saude
app.MapGet("/api/saude", async (IServiceProvider servicos) =>
{
    try
    {
        // O DbContext é criado aqui dentro do try porque, com o banco fora do ar,
        // a própria criação já falha (o Pomelo consulta a versão do MySQL ao conectar).
        using var scope = servicos.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        return Results.Ok(new
        {
            api = "ok",
            banco = "conectado",
            servidorBanco = db.Database.GetDbConnection().DataSource,
            livros = await db.Livros.CountAsync(),
            resenhas = await db.Reviews.CountAsync()
        });
    }
    catch (Exception ex)
    {
        // 503 = serviço indisponível. Em Development mostramos o motivo para facilitar o diagnóstico.
        return Results.Json(new
        {
            api = "ok",
            banco = "sem conexão",
            motivo = app.Environment.IsDevelopment() ? ex.Message : "Confira a string de conexão."
        }, statusCode: StatusCodes.Status503ServiceUnavailable);
    }
});

app.Run();

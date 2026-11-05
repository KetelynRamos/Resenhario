using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi;
using Resenhario.Api.Data;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddHttpClient("CatalogoExterno", client =>
{
    client.Timeout = TimeSpan.FromSeconds(20);
    client.DefaultRequestHeaders.UserAgent.ParseAdd("Resenhario/1.0 (academic project)");
});

var connectionString = builder.Configuration.GetConnectionString("DefaultConnection")
    ?? throw new InvalidOperationException("A conexão com o banco não foi configurada.");

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseMySql(connectionString, ServerVersion.AutoDetect(connectionString)));

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

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
    // Tela do Swagger para testar a API: http://localhost:5131/swagger
    app.UseSwaggerUI(options => options.SwaggerEndpoint("/openapi/v1.json", "Resenhário API"));
}
app.UseHttpsRedirection();

// O front (HTML, CSS e JS) fica em wwwroot/ e é servido pela própria API:
// abrir http://localhost:5131 carrega o wwwroot/index.html.
app.UseDefaultFiles();
app.UseStaticFiles();

app.UseCors("Frontend");
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
app.Run();

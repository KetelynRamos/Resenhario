using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Resenhario.Api.Data;
using Resenhario.Api.Models;
using Resenhario.Api.Models.Externos;
using Resenhario.Api.Services;

namespace Resenhario.Api.Controllers;

// Integração com as APIs externas (Google Books e TMDB).
// O navegador chama a NOSSA API, e ela chama as APIs externas: assim as chaves
// ficam só no servidor e a tela recebe os dados já no formato que ela usa.
[ApiController]
public class CatalogoExternoController : ControllerBase
{
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IConfiguration _configuration;
    private readonly ConferenciaAdaptacao _conferencia;
    private readonly AppDbContext _context;

    // IHttpClientFactory: reaproveita as conexões HTTP em vez de criar "new HttpClient()"
    // a cada chamada (o que pode esgotar as portas do servidor). Configurado no Program.cs.
    public CatalogoExternoController(IHttpClientFactory httpClientFactory, IConfiguration configuration,
        ConferenciaAdaptacao conferencia, AppDbContext context)
    {
        _httpClientFactory = httpClientFactory;
        _configuration = configuration;
        _conferencia = conferencia;
        _context = context;
    }

    public record LivroExterno(string Id, string Titulo, string Autor, string? Sinopse, string? Isbn, string? CapaUrl, string? AnoPublicacao);
    public record FilmeExterno(string TmdbId, string Titulo, string? Diretor, int? AnoLancamento, string? PosterUrl);
    // Resultado da pesquisa de filmes: além do pôster e do diretor, diz se o filme veio de um livro
    // (AutoresOriginais) e, se ele já está vinculado a um livro aqui, qual é a adaptação (IdAdaptacao).
    public record FilmePesquisado(string TmdbId, string Titulo, string? Diretor, int? AnoLancamento, string? PosterUrl,
        List<string> AutoresOriginais, int? IdAdaptacao);
    public record AdaptacaoSugerida(string TmdbId, string Titulo, string? Diretor, int? AnoLancamento, string? PosterUrl,
        List<string> AutoresOriginais, int? IdFilme, bool JaVinculado);

    // GET /api/Livro/buscar?q=duna → busca na Google Books API
    [HttpGet("api/Livro/buscar")]
    public async Task<IActionResult> BuscarLivros(string? q)
    {
        if (string.IsNullOrWhiteSpace(q)) return BadRequest("Informe o título ou autor do livro.");
        if (q.Trim().Length > 150) return BadRequest("A pesquisa deve ter no máximo 150 caracteres.");

        try
        {
            var url = "https://www.googleapis.com/books/v1/volumes?maxResults=12&printType=books&q=" + Uri.EscapeDataString(q.Trim());
            var apiKey = _configuration["GoogleBooks:ApiKey"]; // chave fora do código (user-secrets)
            if (!string.IsNullOrWhiteSpace(apiKey)) url += "&key=" + Uri.EscapeDataString(apiKey);

            var client = _httpClientFactory.CreateClient("CatalogoExterno");
            using var response = await client.GetAsync(url);
            if (!response.IsSuccessStatusCode)
                return StatusCode(StatusCodes.Status502BadGateway, new { mensagem = $"O Google Books respondeu com HTTP {(int)response.StatusCode}." });

            // Desserialização: o JSON vira objetos C# (DTOs em Models/Externos/GoogleBooksDtos.cs).
            var resposta = await response.Content.ReadFromJsonAsync<GoogleBooksResposta>();
            var livros = (resposta?.Items ?? [])
                .Where(v => v.VolumeInfo is not null)
                .Select(v => ConverterLivro(v.Id, v.VolumeInfo!))
                .ToList();
            return Ok(livros);
        }
        catch (Exception ex) when (ex is HttpRequestException or JsonException or TaskCanceledException)
        {
            return ErroNaApiExterna("Google Books", ex);
        }
    }

    // Converte o DTO do Google para o formato que o nosso front usa.
    private static LivroExterno ConverterLivro(string id, GoogleVolumeInfo info)
    {
        var autores = info.Authors?.Where(a => !string.IsNullOrWhiteSpace(a)).ToList() ?? [];
        // Prefere o ISBN de 13 dígitos; se não houver, usa o de 10.
        var isbn = info.IndustryIdentifiers?.FirstOrDefault(i => i.Type == "ISBN_13")?.Identifier
                   ?? info.IndustryIdentifiers?.FirstOrDefault(i => i.Type == "ISBN_10")?.Identifier;
        var capa = (info.ImageLinks?.Thumbnail ?? info.ImageLinks?.SmallThumbnail)?
            .Replace("http://", "https://", StringComparison.OrdinalIgnoreCase);
        return new LivroExterno(id, info.Title ?? "Título não informado",
            autores.Count == 0 ? "Autor não informado" : string.Join(", ", autores),
            info.Description, isbn, capa, info.PublishedDate);
    }

    // GET /api/Filme/buscar?q=duna → busca no TMDB (pôster, diretor e se o filme veio de um livro)
    [HttpGet("api/Filme/buscar")]
    public async Task<IActionResult> BuscarFilmes(string? q)
    {
        if (string.IsNullOrWhiteSpace(q)) return BadRequest("Informe o título do filme.");
        if (q.Trim().Length > 150) return BadRequest("A pesquisa deve ter no máximo 150 caracteres.");
        if (string.IsNullOrWhiteSpace(_conferencia.Token)) return TmdbNaoConfigurado();

        try
        {
            var achados = await PesquisarNoTmdbAsync(q.Trim());
            if (achados is null) return TmdbRespondeuComErro();

            var catalogo = await _context.Filmes.ToListAsync();
            var adaptacoes = await _context.Adaptacoes.ToListAsync();
            return Ok(achados.Select(a =>
            {
                // Se o filme já tem um livro vinculado aqui, o card leva direto à página da adaptação.
                var noCatalogo = AcharNoCatalogo(catalogo, a.Filme);
                var adaptacao = noCatalogo is null ? null : adaptacoes.FirstOrDefault(x => x.IdFilme == noCatalogo.IdFilme);
                return new FilmePesquisado(a.Filme.TmdbId, a.Filme.Titulo, ConferenciaAdaptacao.Diretor(a.Creditos),
                    a.Filme.AnoLancamento, a.Filme.PosterUrl, ConferenciaAdaptacao.AutoresOriginais(a.Creditos), adaptacao?.IdAdaptacoes);
            }).ToList());
        }
        catch (Exception ex) when (ex is HttpRequestException or JsonException or TaskCanceledException)
        {
            return ErroNaApiExterna("TMDB", ex);
        }
    }

    // GET /api/Livro/5/adaptacoes-sugeridas → procura no TMDB os filmes baseados neste livro.
    // Pesquisa pelo título do livro e fica só com os filmes cujo autor original é o autor do livro:
    // assim o usuário não precisa saber de antemão que o livro virou filme.
    [HttpGet("api/Livro/{idLivro:int}/adaptacoes-sugeridas")]
    public async Task<IActionResult> SugerirAdaptacoes(int idLivro)
    {
        var livro = await _context.Livros.FindAsync(idLivro);
        if (livro is null) return NotFound(new { mensagem = "Livro não encontrado." });
        if (string.IsNullOrWhiteSpace(_conferencia.Token)) return TmdbNaoConfigurado();

        try
        {
            // Títulos como "Duna: edição especial" ou "Coraline (Edição de bolso)" → pesquisa só "Duna" / "Coraline".
            var titulo = livro.Titulo.Split(':', '(')[0].Trim();
            var achados = await PesquisarNoTmdbAsync(titulo);
            if (achados is null) return TmdbRespondeuComErro();

            var catalogo = await _context.Filmes.ToListAsync();
            var vinculados = await _context.Adaptacoes.Where(a => a.IdLivro == idLivro).Select(a => a.IdFilme).ToListAsync();

            var sugestoes = new List<AdaptacaoSugerida>();
            foreach (var (filme, creditos) in achados)
            {
                var autores = ConferenciaAdaptacao.AutoresOriginais(creditos);
                if (!ConferenciaAdaptacao.AutorConfere(livro.Autor, autores)) continue; // não veio deste livro

                var noCatalogo = AcharNoCatalogo(catalogo, filme);
                sugestoes.Add(new AdaptacaoSugerida(filme.TmdbId, filme.Titulo, ConferenciaAdaptacao.Diretor(creditos),
                    filme.AnoLancamento, filme.PosterUrl, autores, noCatalogo?.IdFilme,
                    noCatalogo is not null && vinculados.Contains(noCatalogo.IdFilme)));
            }
            return Ok(sugestoes);
        }
        catch (Exception ex) when (ex is HttpRequestException or JsonException or TaskCanceledException)
        {
            return ErroNaApiExterna("TMDB", ex);
        }
    }

    // O filme do TMDB já está no nosso catálogo? Pelo código do TMDB ou, se foi salvo sem ele, pelo título e ano.
    private static Filme? AcharNoCatalogo(List<Filme> catalogo, FilmeExterno filme) =>
        catalogo.FirstOrDefault(f => f.TmdbId == filme.TmdbId)
        ?? catalogo.FirstOrDefault(f => f.TmdbId == null && f.AnoLancamento == filme.AnoLancamento &&
            f.Titulo.StartsWith(filme.Titulo, StringComparison.OrdinalIgnoreCase));

    // Um filme achado na pesquisa do TMDB + os créditos dele (diretor e autores da obra original).
    private record FilmeEncontrado(FilmeExterno Filme, TmdbCreditos? Creditos);

    // Pesquisa filmes no TMDB e busca os créditos de cada um.
    // Devolve null se o TMDB respondeu com erro (ex.: token inválido).
    private async Task<List<FilmeEncontrado>?> PesquisarNoTmdbAsync(string termo)
    {
        var client = _httpClientFactory.CreateClient("CatalogoExterno");
        var url = "https://api.themoviedb.org/3/search/movie?include_adult=false&language=pt-BR&page=1&query=" +
                  Uri.EscapeDataString(termo);
        using var response = await client.SendAsync(ConferenciaAdaptacao.CriarRequisicaoTmdb(url, _conferencia.Token!));
        if (!response.IsSuccessStatusCode) return null;

        // 1º) Desserializa a busca (DTOs em Models/Externos/TmdbDtos.cs), ainda sem o diretor.
        var resposta = await response.Content.ReadFromJsonAsync<TmdbBuscaResposta>();
        var filmes = (resposta?.Results ?? []).Take(12).Select(f => new FilmeExterno(
            f.Id.ToString(),
            f.Title ?? f.OriginalTitle ?? "Filme sem título",
            null,
            f.ReleaseDate is { Length: >= 4 } data && int.TryParse(data[..4], out var ano) ? ano : null,
            string.IsNullOrWhiteSpace(f.PosterPath) ? null : "https://image.tmdb.org/t/p/w500" + f.PosterPath))
            .ToList();

        // 2º) Diretor e autores originais vêm de outra rota do TMDB (/credits), uma chamada por filme.
        // Task.WhenAll dispara as 12 chamadas AO MESMO TEMPO e espera todas terminarem:
        // a busca demora o tempo da chamada mais lenta, e não a soma das 12.
        var creditos = await Task.WhenAll(filmes.Select(f => _conferencia.BuscarCreditosAsync(f.TmdbId)));
        return filmes.Select((f, i) => new FilmeEncontrado(f, creditos[i])).ToList();
    }

    private ObjectResult TmdbNaoConfigurado() => StatusCode(StatusCodes.Status503ServiceUnavailable, new
    {
        mensagem = "A integração TMDB ainda não foi configurada. Adicione o token de leitura em Tmdb:ReadAccessToken usando user-secrets; não coloque o token no JavaScript."
    });

    private ObjectResult TmdbRespondeuComErro() => StatusCode(StatusCodes.Status502BadGateway, new
    {
        mensagem = "O TMDB não aceitou a pesquisa. Verifique se o token de leitura é válido e está ativo."
    });

    // A API externa pode estar fora do ar, lenta ou devolver lixo: a tela recebe uma mensagem, não um erro 500.
    // TaskCanceledException = passou dos 20 s de timeout do HttpClient (configurado no Program.cs).
    private ObjectResult ErroNaApiExterna(string nomeDaApi, Exception ex) => ex is TaskCanceledException
        ? StatusCode(StatusCodes.Status504GatewayTimeout, new { mensagem = $"O {nomeDaApi} demorou demais para responder." })
        : StatusCode(StatusCodes.Status502BadGateway, new { mensagem = $"Não foi possível falar com o {nomeDaApi}. Tente novamente mais tarde." });
}

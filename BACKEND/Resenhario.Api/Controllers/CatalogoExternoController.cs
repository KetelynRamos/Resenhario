using System.Net.Http.Headers;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Resenhario.Api.Data;
using Resenhario.Api.Models.Externos;
using Resenhario.Api.Services;

namespace Resenhario.Api.Controllers;

// Integração com as APIs externas (Google Books e TMDB).
// O navegador chama a NOSSA API, e ela chama as APIs externas: assim as chaves
// ficam só no servidor e a tela recebe os dados já no formato que ela usa.
[ApiController]
[Route("api/CatalogoExterno")]
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

    public record FilmeExterno(string TmdbId, string Titulo, string? Diretor, int? AnoLancamento, string? PosterUrl);
    public record LivroExterno(string Id, string Titulo, string Autor, string? Sinopse, string? Isbn, string? CapaUrl, string? AnoPublicacao);

    // GET /api/Livro/buscar?q=duna → busca na Google Books API
    [HttpGet("livros")]
    [HttpGet("~/api/Livro/buscar")]
    public async Task<IActionResult> BuscarLivros([FromQuery] string? termo, [FromQuery] string? q, CancellationToken cancellationToken)
    {
        termo = string.IsNullOrWhiteSpace(q) ? termo : q;
        if (string.IsNullOrWhiteSpace(termo)) return BadRequest("Informe o título ou autor do livro.");
        if (termo.Trim().Length > 150) return BadRequest("A pesquisa deve ter no máximo 150 caracteres.");

        try
        {
            var url = "https://www.googleapis.com/books/v1/volumes?maxResults=12&printType=books&q=" + Uri.EscapeDataString(termo.Trim());
            var apiKey = _configuration["GoogleBooks:ApiKey"]; // chave fora do código (user-secrets)
            if (!string.IsNullOrWhiteSpace(apiKey)) url += "&key=" + Uri.EscapeDataString(apiKey);

            var client = _httpClientFactory.CreateClient("CatalogoExterno");
            using var response = await client.GetAsync(url, cancellationToken);
            if (!response.IsSuccessStatusCode)
                return StatusCode(StatusCodes.Status502BadGateway, new { mensagem = $"O Google Books respondeu com HTTP {(int)response.StatusCode}." });

            // Desserialização: o JSON vira objetos C# (DTOs em Models/Externos/GoogleBooksDtos.cs).
            var resposta = await response.Content.ReadFromJsonAsync<GoogleBooksResposta>(cancellationToken);

            var livros = (resposta?.Items ?? [])
                .Where(v => v.VolumeInfo is not null)
                .Select(v => ConverterLivro(v.Id, v.VolumeInfo!))
                .ToList();
            return Ok(livros);
        }
        // A API externa pode estar fora do ar, lenta ou devolver lixo: a tela recebe uma mensagem, não um erro 500.
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            return StatusCode(499, new { mensagem = "A pesquisa foi cancelada." });
        }
        catch (OperationCanceledException)
        {
            return StatusCode(StatusCodes.Status504GatewayTimeout, new { mensagem = "O Google Books demorou demais para responder." });
        }
        catch (HttpRequestException)
        {
            return StatusCode(StatusCodes.Status502BadGateway, new { mensagem = "Não foi possível conectar ao Google Books. Tente novamente mais tarde." });
        }
        catch (JsonException)
        {
            return StatusCode(StatusCodes.Status502BadGateway, new { mensagem = "O Google Books retornou uma resposta inválida." });
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

    // GET /api/Filme/buscar?q=duna → busca no TMDB (pôster e diretor)
    [HttpGet("filmes")]
    [HttpGet("~/api/Filme/buscar")]
    public async Task<IActionResult> BuscarFilmes([FromQuery] string? termo, [FromQuery] string? q, CancellationToken cancellationToken)
    {
        termo = string.IsNullOrWhiteSpace(q) ? termo : q;
        if (string.IsNullOrWhiteSpace(termo)) return BadRequest("Informe o título do filme.");
        if (termo.Trim().Length > 150) return BadRequest("A pesquisa deve ter no máximo 150 caracteres.");
        if (string.IsNullOrWhiteSpace(_conferencia.Token)) return TmdbNaoConfigurado();

        try
        {
            var achados = await PesquisarNoTmdbAsync(termo.Trim(), cancellationToken);
            if (achados is null) return TmdbRespondeuComErro();

            // "with" cria uma cópia do record trocando só o campo Diretor.
            return Ok(achados.Select(a => a.Filme with { Diretor = ConferenciaAdaptacao.Diretor(a.Creditos) }).ToList());
        }
        catch (Exception ex) when (ex is HttpRequestException or JsonException or OperationCanceledException)
        {
            return ErroDoTmdb(ex, cancellationToken);
        }
    }

    // Uma adaptação sugerida: o filme do TMDB, quem escreveu a obra original
    // e se o filme já está no nosso catálogo (e já vinculado ao livro).
    public record AdaptacaoSugerida(string TmdbId, string Titulo, string? Diretor, int? AnoLancamento, string? PosterUrl,
        List<string> AutoresOriginais, int? IdFilme, bool JaVinculado);

    // GET /api/Livro/5/adaptacoes-sugeridas → procura no TMDB os filmes baseados neste livro.
    // Pesquisa pelo título do livro e fica só com os filmes cujo autor original é o autor do livro:
    // assim o usuário não precisa saber de antemão que o livro virou filme.
    [HttpGet("~/api/Livro/{idLivro:int}/adaptacoes-sugeridas")]
    public async Task<IActionResult> SugerirAdaptacoes(int idLivro, CancellationToken cancellationToken)
    {
        var livro = await _context.Livros.FindAsync([idLivro], cancellationToken);
        if (livro is null) return NotFound(new { mensagem = "Livro não encontrado." });
        if (string.IsNullOrWhiteSpace(_conferencia.Token)) return TmdbNaoConfigurado();

        try
        {
            // Títulos como "Duna: edição especial" ou "Coraline (Edição de bolso)" → pesquisa só "Duna" / "Coraline".
            var titulo = livro.Titulo.Split(':', '(')[0].Trim();
            var achados = await PesquisarNoTmdbAsync(titulo, cancellationToken);
            if (achados is null) return TmdbRespondeuComErro();

            var doLivro = achados
                .Select(a => (a.Filme, a.Creditos, Autores: ConferenciaAdaptacao.AutoresOriginais(a.Creditos)))
                .Where(a => ConferenciaAdaptacao.AutorConfere(livro.Autor, a.Autores))
                .ToList();

            // Quais desses filmes já estão no catálogo e já foram vinculados a este livro?
            // Procura pelo código do TMDB ou, para filmes salvos sem ele, pelo título e ano.
            var tmdbIds = doLivro.Select(a => a.Filme.TmdbId).ToList();
            var anos = doLivro.Select(a => a.Filme.AnoLancamento).ToList();
            var candidatos = await _context.Filmes
                .Where(f => (f.TmdbId != null && tmdbIds.Contains(f.TmdbId)) || anos.Contains(f.AnoLancamento))
                .ToListAsync(cancellationToken);
            var vinculados = await _context.Adaptacoes
                .Where(a => a.IdLivro == idLivro)
                .Select(a => a.IdFilme)
                .ToListAsync(cancellationToken);

            return Ok(doLivro.Select(a =>
            {
                var idFilme = candidatos.FirstOrDefault(f => f.TmdbId == a.Filme.TmdbId)?.IdFilme
                    ?? candidatos.FirstOrDefault(f => f.TmdbId == null && f.AnoLancamento == a.Filme.AnoLancamento &&
                        f.Titulo.StartsWith(a.Filme.Titulo, StringComparison.OrdinalIgnoreCase))?.IdFilme;
                return new AdaptacaoSugerida(a.Filme.TmdbId, a.Filme.Titulo, ConferenciaAdaptacao.Diretor(a.Creditos),
                    a.Filme.AnoLancamento, a.Filme.PosterUrl, a.Autores, idFilme,
                    idFilme is not null && vinculados.Contains(idFilme.Value));
            }).ToList());
        }
        catch (Exception ex) when (ex is HttpRequestException or JsonException or OperationCanceledException)
        {
            return ErroDoTmdb(ex, cancellationToken);
        }
    }

    // Pesquisa filmes no TMDB e busca os créditos (diretor e autores originais) de cada um.
    // Devolve null se o TMDB respondeu com erro (ex.: token inválido).
    private async Task<List<(FilmeExterno Filme, TmdbCreditos? Creditos)>?> PesquisarNoTmdbAsync(string termo, CancellationToken cancellationToken)
    {
        var client = _httpClientFactory.CreateClient("CatalogoExterno");
        var url = "https://api.themoviedb.org/3/search/movie?include_adult=false&language=pt-BR&page=1&query=" +
                  Uri.EscapeDataString(termo);
        using var response = await client.SendAsync(ConferenciaAdaptacao.CriarRequisicaoTmdb(url, _conferencia.Token!), cancellationToken);
        if (!response.IsSuccessStatusCode) return null;

        // 1º) Desserializa a busca (DTOs em Models/Externos/TmdbDtos.cs), ainda sem o diretor.
        var resposta = await response.Content.ReadFromJsonAsync<TmdbBuscaResposta>(cancellationToken);
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
        var creditos = await Task.WhenAll(filmes.Select(f => _conferencia.BuscarCreditosAsync(f.TmdbId, cancellationToken)));
        return filmes.Select((f, i) => (f, creditos[i])).ToList();
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
    private ObjectResult ErroDoTmdb(Exception ex, CancellationToken cancellationToken)
    {
        if (ex is OperationCanceledException && cancellationToken.IsCancellationRequested)
            return StatusCode(499, new { mensagem = "A pesquisa foi cancelada." });
        if (ex is OperationCanceledException)
            return StatusCode(StatusCodes.Status504GatewayTimeout, new { mensagem = "O TMDB demorou demais para responder." });
        if (ex is JsonException)
            return StatusCode(StatusCodes.Status502BadGateway, new { mensagem = "O TMDB retornou uma resposta inválida." });
        return StatusCode(StatusCodes.Status502BadGateway, new { mensagem = "Não foi possível conectar ao TMDB. Tente novamente mais tarde." });
    }
}

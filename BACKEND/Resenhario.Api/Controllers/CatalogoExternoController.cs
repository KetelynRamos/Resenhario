using System.Net.Http.Headers;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using Resenhario.Api.Models.Externos;

namespace Resenhario.Api.Controllers;

// Integração com as APIs externas (Google Books, TMDB e TVmaze).
// O navegador chama a NOSSA API, e ela chama as APIs externas: assim as chaves
// ficam só no servidor e a tela recebe os dados já no formato que ela usa.
[ApiController]
[Route("api/CatalogoExterno")]
public class CatalogoExternoController : ControllerBase
{
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IConfiguration _configuration;

    // IHttpClientFactory: reaproveita as conexões HTTP em vez de criar "new HttpClient()"
    // a cada chamada (o que pode esgotar as portas do servidor). Configurado no Program.cs.
    public CatalogoExternoController(IHttpClientFactory httpClientFactory, IConfiguration configuration)
    {
        _httpClientFactory = httpClientFactory;
        _configuration = configuration;
    }

    public record FilmeExterno(string TmdbId, string Titulo, string? Diretor, int? AnoLancamento, string? PosterUrl);
    public record LivroExterno(string Id, string Titulo, string Autor, string? Sinopse, string? Isbn, string? CapaUrl, string? AnoPublicacao);
    public record SerieExterna(string FonteId, string Titulo, string? Sinopse, string? ImagemUrl, string? DataEstreia);

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

        var token = _configuration["Tmdb:ReadAccessToken"]; // token fora do código (user-secrets)
        if (string.IsNullOrWhiteSpace(token))
            return StatusCode(StatusCodes.Status503ServiceUnavailable, new
            {
                mensagem = "A integração TMDB ainda não foi configurada. Adicione o token de leitura em Tmdb:ReadAccessToken usando user-secrets; não coloque o token no JavaScript."
            });

        var client = _httpClientFactory.CreateClient("CatalogoExterno");

        try
        {
            var url = "https://api.themoviedb.org/3/search/movie?include_adult=false&language=pt-BR&page=1&query=" +
                      Uri.EscapeDataString(termo.Trim());
            using var response = await client.SendAsync(CriarRequisicaoTmdb(url, token), cancellationToken);
            if (!response.IsSuccessStatusCode)
                return StatusCode(StatusCodes.Status502BadGateway, new { mensagem = $"O TMDB respondeu com HTTP {(int)response.StatusCode}. Verifique se o token de leitura é válido e está ativo." });

            // 1º) Desserializa a busca (DTOs em Models/Externos/TmdbDtos.cs), ainda sem o diretor.
            var resposta = await response.Content.ReadFromJsonAsync<TmdbBuscaResposta>(cancellationToken);
            var filmes = (resposta?.Results ?? []).Take(12).Select(f => new FilmeExterno(
                f.Id.ToString(),
                f.Title ?? f.OriginalTitle ?? "Filme sem título",
                null,
                f.ReleaseDate is { Length: >= 4 } data && int.TryParse(data[..4], out var ano) ? ano : null,
                string.IsNullOrWhiteSpace(f.PosterPath) ? null : "https://image.tmdb.org/t/p/w500" + f.PosterPath))
                .ToList();

            // 2º) O diretor vem de outra rota do TMDB (/credits), uma chamada por filme.
            // Task.WhenAll dispara as 12 chamadas AO MESMO TEMPO e espera todas terminarem:
            // a busca demora o tempo da chamada mais lenta, e não a soma das 12.
            var diretores = await Task.WhenAll(filmes.Select(f =>
                BuscarDiretor(client, token, int.Parse(f.TmdbId), cancellationToken)));

            // "with" cria uma cópia do record trocando só o campo Diretor.
            return Ok(filmes.Select((f, i) => f with { Diretor = diretores[i] }).ToList());
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            return StatusCode(499, new { mensagem = "A pesquisa foi cancelada." });
        }
        catch (OperationCanceledException)
        {
            return StatusCode(StatusCodes.Status504GatewayTimeout, new { mensagem = "O TMDB demorou demais para responder." });
        }
        catch (HttpRequestException)
        {
            return StatusCode(StatusCodes.Status502BadGateway, new { mensagem = "Não foi possível conectar ao TMDB. Tente novamente mais tarde." });
        }
        catch (JsonException)
        {
            return StatusCode(StatusCodes.Status502BadGateway, new { mensagem = "O TMDB retornou uma resposta inválida." });
        }
    }

    // O TMDB exige o token no cabeçalho "Authorization: Bearer ...".
    private static HttpRequestMessage CriarRequisicaoTmdb(string url, string token)
    {
        var request = new HttpRequestMessage(HttpMethod.Get, url);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
        return request;
    }

    [HttpGet("series")]
    [HttpGet("~/api/Serie/buscar")]
    public async Task<IActionResult> BuscarSeries([FromQuery] string? termo, [FromQuery] string? q, CancellationToken cancellationToken)
    {
        termo = string.IsNullOrWhiteSpace(q) ? termo : q;
        if (string.IsNullOrWhiteSpace(termo)) return BadRequest("Informe o nome da série.");
        if (termo.Trim().Length > 150) return BadRequest("A pesquisa deve ter no máximo 150 caracteres.");
        try
        {
            var client = _httpClientFactory.CreateClient("CatalogoExterno");
            var url = "https://api.tvmaze.com/search/shows?q=" + Uri.EscapeDataString(termo.Trim());
            using var response = await client.GetAsync(url, cancellationToken);
            if (!response.IsSuccessStatusCode)
                return StatusCode(StatusCodes.Status502BadGateway, new { mensagem = $"O TVmaze respondeu com HTTP {(int)response.StatusCode}." });
            await using var stream = await response.Content.ReadAsStreamAsync(cancellationToken);
            using var json = await JsonDocument.ParseAsync(stream, cancellationToken: cancellationToken);
            var saida = new List<SerieExterna>();
            foreach (var item in json.RootElement.EnumerateArray().Take(12))
            {
                if (!item.TryGetProperty("show", out var show)) continue;
                var id = show.TryGetProperty("id", out var idElement) ? idElement.ToString() : null;
                if (string.IsNullOrWhiteSpace(id)) continue;
                var titulo = Texto(show, "name") ?? "Série";
                var sinopseHtml = Texto(show, "summary") ?? "";
                var sinopse = System.Text.RegularExpressions.Regex.Replace(sinopseHtml, "<[^>]*>", " ");
                sinopse = System.Net.WebUtility.HtmlDecode(System.Text.RegularExpressions.Regex.Replace(sinopse, "\\s+", " ")).Trim();
                string? imagem = null;
                if (show.TryGetProperty("image", out var image) && image.ValueKind == JsonValueKind.Object)
                    imagem = Texto(image, "medium") ?? Texto(image, "original");
                saida.Add(new SerieExterna("tvmaze:" + id, titulo, sinopse, imagem, Texto(show, "premiered")));
            }
            return Ok(saida);
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested) { return StatusCode(499, new { mensagem = "A pesquisa foi cancelada." }); }
        catch (OperationCanceledException) { return StatusCode(StatusCodes.Status504GatewayTimeout, new { mensagem = "O TVmaze demorou demais para responder." }); }
        catch (HttpRequestException) { return StatusCode(StatusCodes.Status502BadGateway, new { mensagem = "Não foi possível conectar ao TVmaze." }); }
        catch (JsonException) { return StatusCode(StatusCodes.Status502BadGateway, new { mensagem = "O TVmaze retornou uma resposta inválida." }); }
    }

    // Busca o diretor de um filme. Se falhar, devolve null: o filme aparece mesmo sem diretor.
    private static async Task<string?> BuscarDiretor(HttpClient client, string token, int id, CancellationToken cancellationToken)
    {
        if (id <= 0) return null;
        try
        {
            using var response = await client.SendAsync(
                CriarRequisicaoTmdb($"https://api.themoviedb.org/3/movie/{id}/credits?language=pt-BR", token), cancellationToken);
            if (!response.IsSuccessStatusCode) return null;
            var creditos = await response.Content.ReadFromJsonAsync<TmdbCreditos>(cancellationToken);
            return creditos?.Crew?.FirstOrDefault(p => string.Equals(p.Job, "Director", StringComparison.OrdinalIgnoreCase))?.Name;
        }
        catch (Exception ex) when (ex is HttpRequestException or JsonException)
        {
            return null;
        }
    }

    // Usado pela busca de séries (TVmaze), que continua lendo o JSON campo a campo.
    private static string? Texto(JsonElement elemento, string propriedade) =>
        elemento.TryGetProperty(propriedade, out var valor) && valor.ValueKind == JsonValueKind.String
            ? valor.GetString()
            : null;
}

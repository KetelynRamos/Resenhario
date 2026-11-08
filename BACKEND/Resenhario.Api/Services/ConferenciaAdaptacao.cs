using System.Globalization;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Resenhario.Api.Models.Externos;

namespace Resenhario.Api.Services;

// Confere no TMDB se um filme é mesmo adaptação de um livro.
// Os créditos de um filme (/movie/{id}/credits) trazem, além do diretor, quem escreveu
// a obra original: cargos como "Novel" (romance) ou "Book". Se esse nome bate com o
// autor do livro, a adaptação está confirmada. Usado pelo vínculo (AdaptacaoController)
// e pelas sugestões de adaptações (CatalogoExternoController).
public class ConferenciaAdaptacao
{
    // Cargos do TMDB que indicam o autor da obra que deu origem ao filme.
    private static readonly string[] CargosDeObraOriginal =
        ["Novel", "Book", "Author", "Original Story", "Short Story", "Characters", "Comic Book"];

    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IConfiguration _configuration;

    public ConferenciaAdaptacao(IHttpClientFactory httpClientFactory, IConfiguration configuration)
    {
        _httpClientFactory = httpClientFactory;
        _configuration = configuration;
    }

    // Token do TMDB (user-secrets ou variável de ambiente). Vazio = não dá para conferir.
    public string? Token => _configuration["Tmdb:ReadAccessToken"];

    // Busca os créditos de um filme. Devolve null se não deu para consultar
    // (sem token, TMDB fora do ar, filme sem código do TMDB...).
    public async Task<TmdbCreditos?> BuscarCreditosAsync(string? tmdbId)
    {
        if (string.IsNullOrWhiteSpace(Token) || !int.TryParse(tmdbId, out var id) || id <= 0) return null;
        try
        {
            var client = _httpClientFactory.CreateClient("CatalogoExterno");
            using var response = await client.SendAsync(
                CriarRequisicaoTmdb($"https://api.themoviedb.org/3/movie/{id}/credits", Token));
            if (!response.IsSuccessStatusCode) return null;
            return await response.Content.ReadFromJsonAsync<TmdbCreditos>();
        }
        catch (Exception ex) when (ex is HttpRequestException or JsonException or TaskCanceledException)
        {
            return null;
        }
    }

    // O TMDB exige o token no cabeçalho "Authorization: Bearer ...".
    public static HttpRequestMessage CriarRequisicaoTmdb(string url, string token)
    {
        var request = new HttpRequestMessage(HttpMethod.Get, url);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
        return request;
    }

    public static string? Diretor(TmdbCreditos? creditos) =>
        creditos?.Crew?.FirstOrDefault(p => string.Equals(p.Job, "Director", StringComparison.OrdinalIgnoreCase))?.Name;

    // Nomes de quem escreveu a obra original (sem repetir).
    public static List<string> AutoresOriginais(TmdbCreditos? creditos) =>
        (creditos?.Crew ?? [])
            .Where(p => !string.IsNullOrWhiteSpace(p.Name) &&
                        CargosDeObraOriginal.Contains(p.Job, StringComparer.OrdinalIgnoreCase))
            .Select(p => p.Name!)
            .Distinct()
            .ToList();

    // O autor do livro bate com algum autor original do filme?
    // Compara pelo SOBRENOME, sem acentos nem pontuação, porque cada fonte escreve o nome
    // de um jeito (ex.: "J.K. Rowling" e "J. K. Rowling").
    public static bool AutorConfere(string autorLivro, IEnumerable<string> autoresOriginais)
    {
        var palavrasDoLivro = Palavras(autorLivro);
        return autoresOriginais.Any(nome =>
        {
            var sobrenome = Palavras(nome).LastOrDefault();
            return sobrenome is { Length: >= 3 } && palavrasDoLivro.Contains(sobrenome);
        });
    }

    // "José Saramago" → ["jose", "saramago"]
    private static List<string> Palavras(string texto)
    {
        var semAcento = new StringBuilder();
        foreach (var letra in texto.Normalize(NormalizationForm.FormD))
        {
            if (CharUnicodeInfo.GetUnicodeCategory(letra) == UnicodeCategory.NonSpacingMark) continue; // tira o acento
            semAcento.Append(char.IsLetter(letra) ? char.ToLowerInvariant(letra) : ' ');
        }
        return semAcento.ToString().Split(' ', StringSplitOptions.RemoveEmptyEntries).ToList();
    }
}

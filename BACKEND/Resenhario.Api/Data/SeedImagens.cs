using System.Net.Http.Headers;
using Microsoft.EntityFrameworkCore;
using Resenhario.Api.Models.Externos;

namespace Resenhario.Api.Data;

// Completa capas (Google Books) e pôsteres (TMDB) dos dados de demonstração.
// Só busca o que está faltando e SALVA no banco: depois da primeira vez com internet,
// a apresentação não depende mais das APIs externas ao vivo.
// Se a API estiver fora do ar ou sem chave, apenas registra no log e segue em frente.
public static class SeedImagens
{
    // Os DTOs das APIs ficam em Models/Externos (os mesmos usados pelo CatalogoExternoController).

    // URLs de exemplo dos scripts antigos de teste contam como "sem imagem".
    private static bool SemImagem(string? url) =>
        string.IsNullOrWhiteSpace(url) || url.Contains("exemplo.com");

    public static async Task PreencherAsync(AppDbContext db, IHttpClientFactory httpFactory,
        IConfiguration config, ILogger logger)
    {
        var client = httpFactory.CreateClient("CatalogoExterno");
        // Limite total de 60 s para não travar a inicialização se a rede estiver lenta.
        using var limite = new CancellationTokenSource(TimeSpan.FromSeconds(60));

        await PreencherPosteresAsync(db, client, config["Tmdb:ReadAccessToken"], logger, limite.Token);
        await PreencherCapasAsync(db, client, config["GoogleBooks:ApiKey"], logger, limite.Token);
    }

    private static async Task PreencherPosteresAsync(AppDbContext db, HttpClient client, string? token,
        ILogger logger, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(token))
        {
            logger.LogInformation("Seed: sem token do TMDB; pôsteres de demonstração não foram buscados.");
            return;
        }

        int preenchidos = 0;
        foreach (var seed in SeedData.Filmes)
        {
            var filme = await db.Filmes.FirstOrDefaultAsync(f => f.Titulo == seed.Titulo && f.AnoLancamento == seed.Ano, ct);
            if (filme is null || !SemImagem(filme.PosterUrl)) continue;
            try
            {
                // Busca pelo título original + ano, que é o jeito mais certeiro no TMDB.
                var url = "https://api.themoviedb.org/3/search/movie?include_adult=false&query="
                          + Uri.EscapeDataString(seed.TituloOriginal) + "&year=" + seed.Ano;
                using var request = new HttpRequestMessage(HttpMethod.Get, url);
                request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
                using var resposta = await client.SendAsync(request, ct);
                if (!resposta.IsSuccessStatusCode)
                {
                    logger.LogWarning("Seed: TMDB respondeu HTTP {Status}; pôsteres interrompidos.", (int)resposta.StatusCode);
                    break;
                }
                var busca = await resposta.Content.ReadFromJsonAsync<TmdbBuscaResposta>(ct);
                var achado = busca?.Results?.FirstOrDefault(r => r.PosterPath != null);
                if (achado is null) continue;

                filme.PosterUrl = "https://image.tmdb.org/t/p/w500" + achado.PosterPath;
                filme.TmdbId ??= achado.Id.ToString();
                preenchidos++;
            }
            catch (Exception ex) when (ex is HttpRequestException or OperationCanceledException or System.Text.Json.JsonException)
            {
                logger.LogWarning("Seed: não foi possível consultar o TMDB ({Erro}). Seguindo sem pôsteres.", ex.Message);
                break;
            }
        }
        await db.SaveChangesAsync(CancellationToken.None);
        if (preenchidos > 0) logger.LogInformation("Seed: {Total} pôster(es) obtidos do TMDB.", preenchidos);
    }

    private static async Task PreencherCapasAsync(AppDbContext db, HttpClient client, string? apiKey,
        ILogger logger, CancellationToken ct)
    {
        int preenchidos = 0;
        foreach (var seed in SeedData.Livros)
        {
            var livro = await db.Livros.FirstOrDefaultAsync(l => l.Titulo == seed.Titulo, ct);
            if (livro is null || !SemImagem(livro.CapaUrl)) continue;
            try
            {
                var sobrenome = seed.Autor.Split(' ').Last();
                var url = "https://www.googleapis.com/books/v1/volumes?maxResults=5&printType=books&q="
                          + Uri.EscapeDataString($"intitle:{seed.Titulo} inauthor:{sobrenome}");
                if (!string.IsNullOrWhiteSpace(apiKey)) url += "&key=" + Uri.EscapeDataString(apiKey);

                using var resposta = await client.GetAsync(url, ct);
                if (!resposta.IsSuccessStatusCode)
                {
                    // 429 = cota esgotada. Para aqui e tenta de novo na próxima inicialização.
                    logger.LogWarning("Seed: Google Books respondeu HTTP {Status}; capas interrompidas.", (int)resposta.StatusCode);
                    break;
                }
                var busca = await resposta.Content.ReadFromJsonAsync<GoogleBooksResposta>(ct);
                var volume = busca?.Items?.FirstOrDefault(v => v.VolumeInfo?.ImageLinks?.Thumbnail != null);
                if (volume is null) continue;

                livro.CapaUrl = volume.VolumeInfo!.ImageLinks!.Thumbnail!.Replace("http://", "https://");
                // Guarda o ID do Google só se nenhum outro livro já usa esse volume: confere no banco
                // e também nas alterações ainda não salvas (db.Livros.Local), já que o SaveChanges é no fim.
                if (livro.GoogleBId is null && !db.Livros.Local.Any(l => l.GoogleBId == volume.Id)
                    && !await db.Livros.AnyAsync(l => l.GoogleBId == volume.Id, ct))
                    livro.GoogleBId = volume.Id;
                preenchidos++;
            }
            catch (Exception ex) when (ex is HttpRequestException or OperationCanceledException or System.Text.Json.JsonException)
            {
                logger.LogWarning("Seed: não foi possível consultar o Google Books ({Erro}). Seguindo sem capas.", ex.Message);
                break;
            }
        }
        await db.SaveChangesAsync(CancellationToken.None);
        if (preenchidos > 0) logger.LogInformation("Seed: {Total} capa(s) obtidas do Google Books.", preenchidos);
    }
}

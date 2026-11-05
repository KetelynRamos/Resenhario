using System.Text.Json.Serialization;

namespace Resenhario.Api.Models.Externos;

// DTOs da API do TMDB (The Movie Database).
// O TMDB usa nomes com sublinhado (poster_path); [JsonPropertyName] liga esse nome
// à nossa propriedade em C# (PosterPath).

// GET /3/search/movie → { "results": [ { "id": 438631, "title": "Duna", "poster_path": "/abc.jpg", ... } ] }
public record TmdbBuscaResposta(List<TmdbFilme>? Results);

public record TmdbFilme(
    int Id,
    string? Title,
    [property: JsonPropertyName("original_title")] string? OriginalTitle,
    [property: JsonPropertyName("release_date")] string? ReleaseDate,
    [property: JsonPropertyName("poster_path")] string? PosterPath);

// GET /3/movie/{id}/credits → { "crew": [ { "job": "Director", "name": "Denis Villeneuve" } ] }
public record TmdbCreditos(List<TmdbPessoa>? Crew);

public record TmdbPessoa(string? Job, string? Name);

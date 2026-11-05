namespace Resenhario.Api.Models.Externos;

// DTOs (Data Transfer Objects) da Google Books API.
// Têm só os campos do JSON que usamos; o System.Text.Json preenche cada record
// casando o nome da propriedade com o campo do JSON (sem diferenciar maiúsculas).
// Exemplo de resposta: { "items": [ { "id": "...", "volumeInfo": { "title": "...", "authors": [...] } } ] }

public record GoogleBooksResposta(List<GoogleVolume>? Items);

public record GoogleVolume(string Id, GoogleVolumeInfo? VolumeInfo);

public record GoogleVolumeInfo(
    string? Title,
    List<string>? Authors,
    string? Description,
    string? PublishedDate,
    List<GoogleIdentificador>? IndustryIdentifiers,
    GoogleImagens? ImageLinks);

public record GoogleIdentificador(string? Type, string? Identifier);

public record GoogleImagens(string? Thumbnail, string? SmallThumbnail);

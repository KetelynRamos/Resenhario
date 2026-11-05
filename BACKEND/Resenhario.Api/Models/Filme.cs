using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Resenhario.Api.Models;

[Table("Filmes")]
public class Filme
{
    [Key]
    public int IdFilme { get; set; }
    [StringLength(100)]
    public string? TmdbId { get; set; }

    [Required(ErrorMessage = "O título do filme é obrigatório.")]
    [StringLength(200, ErrorMessage = "O título pode ter no máximo 200 caracteres.")]
    public string Titulo { get; set; } = string.Empty;

    [StringLength(150)]
    public string? Diretor { get; set; }

    // 1888 é o ano do filme mais antigo conhecido.
    [Range(1888, 2100, ErrorMessage = "Ano de lançamento inválido.")]
    public int? AnoLancamento { get; set; }

    [StringLength(500)]
    public string? PosterUrl { get; set; }
}

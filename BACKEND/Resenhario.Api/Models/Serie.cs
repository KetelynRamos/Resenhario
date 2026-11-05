using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Resenhario.Api.Models;

[Table("Series")]
public class Serie
{
    [Key]
    public int IdSerie { get; set; }
    [Required(ErrorMessage = "O título da série é obrigatório.")]
    [StringLength(200, ErrorMessage = "O título pode ter no máximo 200 caracteres.")]
    public string Titulo { get; set; } = string.Empty;
    public string? Sinopse { get; set; }
    public string? ImagemUrl { get; set; }
    public string? DataEstreia { get; set; }
    public string? FonteId { get; set; }
}

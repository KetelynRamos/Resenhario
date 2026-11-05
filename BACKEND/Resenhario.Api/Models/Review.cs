
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Resenhario.Api.Models;

[Table("Reviews")]
public class Review
{
    [Key]
    public int IdReviews { get; set; }

    public int IdUsuario { get; set; }
    public int? IdLivro { get; set; }
    public int? IdAdaptacao { get; set; }
    [Range(1, 5, ErrorMessage = "A nota da obra deve estar entre 1 e 5 estrelas.")]
    public int? NotaLivro { get; set; }

    [StringLength(5000, ErrorMessage = "A resenha pode ter no máximo 5.000 caracteres.")]
    public string? Comentario { get; set; }
    public bool AssistiuFilme { get; set; }
    [Range(1, 5, ErrorMessage = "A fidelidade da adaptação deve estar entre 1 e 5 estrelas.")]
    public int? NotaFidelidade { get; set; }
    public string? Voto { get; set; }
    public DateTime DataCriacao { get; set; }
}
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Resenhario.Api.Models;

// Comentário de uma pessoa em uma resenha (tabela Comentarios, criada pelo script 10).
[Table("Comentarios")]
public class Comentario
{
    [Key]
    public int IdComentario { get; set; }
    public int IdReview { get; set; }
    public int IdUsuario { get; set; }

    [Required, StringLength(1000)]
    public string Texto { get; set; } = string.Empty;
    public DateTime DataCriacao { get; set; }
}

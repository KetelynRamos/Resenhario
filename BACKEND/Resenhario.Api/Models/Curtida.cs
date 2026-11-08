using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Resenhario.Api.Models;

// Uma pessoa curtiu uma resenha (tabela Curtidas, criada pelo script 10).
[Table("Curtidas")]
public class Curtida
{
    [Key]
    public int IdCurtida { get; set; }
    public int IdReview { get; set; }
    public int IdUsuario { get; set; }
    public DateTime DataCriacao { get; set; }
}

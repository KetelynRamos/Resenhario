
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Resenhario.Api.Models;

[Table("Usuarios")]
public class Usuario
{
    [Key]
    public int IdUsuario { get; set; }

    [Required, StringLength(150)]
    public string Nome { get; set; } = string.Empty;

    [Required, EmailAddress, StringLength(150)]
    public string Email { get; set; } = string.Empty;
    public string SenhaHash { get; set; } = string.Empty;
    public DateTime DataCadastro { get; set; }

    // ----- Perfil (script 10) -----
    [StringLength(280)]
    public string? Bio { get; set; }

    [StringLength(200)]
    public string? LivroFavorito { get; set; }

    // Avatar: caminho de um avatar pronto (/img/avatares/avatar-3.svg)
    // ou a foto enviada, guardada como texto "data:image/jpeg;base64,...".
    public string? Avatar { get; set; }

    // ----- Meta de leitura: quantos livros ler em 6 meses, a partir de MetaInicio -----
    [Range(1, 100)]
    public int? MetaLivros { get; set; }
    public DateTime? MetaInicio { get; set; }
}
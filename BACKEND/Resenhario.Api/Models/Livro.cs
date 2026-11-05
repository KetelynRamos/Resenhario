
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Resenhario.Api.Models;

[Table("Livros")]
public class Livro
{
    [Key]
    public int IdLivros { get; set; }

    [StringLength(100)]
    public string? GoogleBId { get; set; }

    // Data Annotations: o ASP.NET valida estas regras sozinho e responde 400 se falharem.
    // Os tamanhos máximos seguem as colunas do banco (01_criar_banco.sql).
    [Required(ErrorMessage = "O título do livro é obrigatório.")]
    [StringLength(200, ErrorMessage = "O título pode ter no máximo 200 caracteres.")]
    public string Titulo { get; set; } = string.Empty;

    [Required(ErrorMessage = "O autor do livro é obrigatório.")]
    [StringLength(150, ErrorMessage = "O nome do autor pode ter no máximo 150 caracteres.")]
    public string Autor { get; set; } = string.Empty;

    public string? Sinopse { get; set; }

    [StringLength(50)]
    public string? Isbn { get; set; }

    [StringLength(500)]
    public string? CapaUrl { get; set; }
}
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Resenhario.Api.Models;

[Table("Estantes")]
public class Estante
{
    [Key]
    public int IdEstante { get; set; }
    public int IdUsuario { get; set; }
    public int? IdLivros { get; set; }
    public int? IdFilme { get; set; }
    public int? IdSerie { get; set; }
    [StringLength(50)]
    public string Status { get; set; } = string.Empty;
    public DateTime DataAtualizacao { get; set; }

    // ----- Regras do domínio (POO: o próprio objeto sabe quais status aceita) -----
    // "static readonly": uma única lista compartilhada por todos os objetos Estante.
    public static readonly string[] StatusLivro = { "Quero ler", "Lendo", "Lido", "Abandonado" };
    public static readonly string[] StatusFilme = { "Quero ver", "Assistindo", "Assistido" };

    // São métodos (e não propriedades) para o EF Core não tentar salvá-los como colunas.
    public bool EhLivro() => IdLivros.HasValue;

    public string[] StatusPermitidos() => EhLivro() ? StatusLivro : StatusFilme;

    public bool StatusValido(string? status) => status is not null && StatusPermitidos().Contains(status);

    // Muda o status e registra quando isso aconteceu (usado no gráfico de leituras por mês).
    public void AtualizarStatus(string status)
    {
        Status = status;
        DataAtualizacao = DateTime.UtcNow;
    }
}

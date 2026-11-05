using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Resenhario.Api.Data;
using Resenhario.Api.Models;

namespace Resenhario.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ReviewController : ControllerBase
{
    private readonly AppDbContext _context;
    public ReviewController(AppDbContext context) => _context = context;

    public record ReviewResposta(int IdReviews, int IdUsuario, string NomeUsuario,
        int? IdLivro, string? Titulo, int? NotaLivro, string? Comentario, DateTime DataCriacao,
        int? IdAdaptacao, string? TituloFilme, int? NotaFidelidade,
        string? CapaUrl, string? PosterUrl, int? AnoFilme, double? MediaNotaLivro, int TotalResenhasLivro);

    [HttpGet]
    public async Task<ActionResult<IEnumerable<ReviewResposta>>> GetReviews()
    {
        var resultado = await ConsultarReviews(1, 100);
        return Ok(resultado.Itens);
    }

    // GET /api/Review/5 → 200 com a resenha ou 404
    [HttpGet("{id:int}")]
    public async Task<ActionResult<Review>> GetReview(int id)
    {
        var review = await _context.Reviews.FindAsync(id);
        return review is null ? NotFound() : Ok(review);
    }

    // GET /api/Review/feed?pagina=1&tamanho=10 → feed paginado (Skip/Take), mais recentes primeiro
    [HttpGet("feed")]
    public async Task<IActionResult> Feed([FromQuery] int pagina = 1, [FromQuery] int tamanho = 10)
    {
        pagina = Math.Max(1, pagina);
        tamanho = Math.Clamp(tamanho, 1, 30);
        var resultado = await ConsultarReviews(pagina, tamanho);
        return Ok(new { pagina, tamanho, total = resultado.Total, totalPaginas = (int)Math.Ceiling(resultado.Total / (double)tamanho), itens = resultado.Itens });
    }

    private async Task<(List<ReviewResposta> Itens, int Total)> ConsultarReviews(int pagina, int tamanho)
    {
        var total = await _context.Reviews.CountAsync();
        var resultado = await _context.Reviews
            .OrderByDescending(r => r.DataCriacao)
            .Skip((pagina - 1) * tamanho)
            .Take(tamanho)
            .Select(r => new ReviewResposta(
                r.IdReviews,
                r.IdUsuario,
                _context.Usuarios.Where(u => u.IdUsuario == r.IdUsuario).Select(u => u.Nome).FirstOrDefault() ?? "Usuário",
                r.IdLivro,
                _context.Livros.Where(l => l.IdLivros == r.IdLivro).Select(l => l.Titulo).FirstOrDefault() ?? "Obra",
                r.NotaLivro,
                r.Comentario,
                r.DataCriacao,
                r.IdAdaptacao,
                _context.Filmes.Where(f => _context.Adaptacoes.Any(a => a.IdAdaptacoes == r.IdAdaptacao && a.IdFilme == f.IdFilme))
                    .Select(f => f.Titulo).FirstOrDefault(),
                r.NotaFidelidade,
                // Imagens para os cards do feed (capa do livro e pôster do filme avaliado).
                _context.Livros.Where(l => l.IdLivros == r.IdLivro).Select(l => l.CapaUrl).FirstOrDefault(),
                _context.Filmes.Where(f => _context.Adaptacoes.Any(a => a.IdAdaptacoes == r.IdAdaptacao && a.IdFilme == f.IdFilme))
                    .Select(f => f.PosterUrl).FirstOrDefault(),
                _context.Filmes.Where(f => _context.Adaptacoes.Any(a => a.IdAdaptacoes == r.IdAdaptacao && a.IdFilme == f.IdFilme))
                    .Select(f => f.AnoLancamento).FirstOrDefault(),
                // Média da comunidade para o livro: permite comparar a nota deste leitor com a dos outros.
                _context.Reviews.Where(x => x.IdLivro == r.IdLivro && x.NotaLivro != null).Average(x => (double?)x.NotaLivro),
                _context.Reviews.Count(x => x.IdLivro == r.IdLivro && x.NotaLivro != null)))
            .ToListAsync();
        return (resultado, total);
    }

    // POST /api/Review → publica a resenha com AVALIAÇÃO DUPLA:
    //   NotaLivro (obrigatória, 1 a 5) = qualidade da obra;
    //   NotaFidelidade (opcional, 1 a 5) = o quanto o filme foi fiel, só se a pessoa escolheu uma adaptação.
    [Authorize]
    [HttpPost]
    public async Task<IActionResult> CriarReview([FromBody] Review review)
    {
        if (!int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var usuarioId))
            return Unauthorized();
        if (review.IdLivro is null || !await _context.Livros.AnyAsync(l => l.IdLivros == review.IdLivro))
            return BadRequest("Selecione um livro válido.");
        if (review.NotaLivro is null || review.NotaLivro < 1 || review.NotaLivro > 5)
            return BadRequest("A nota da obra deve estar entre 1 e 5 estrelas.");
        if (string.IsNullOrWhiteSpace(review.Comentario) || review.Comentario.Trim().Length > 5000)
            return BadRequest("Escreva uma resenha de até 5.000 caracteres.");

        // Regra de negócio: a adaptação escolhida tem que ser DESTE livro.
        if (review.IdAdaptacao.HasValue)
        {
            var adaptacao = await _context.Adaptacoes.FirstOrDefaultAsync(a =>
                a.IdAdaptacoes == review.IdAdaptacao.Value && a.IdLivro == review.IdLivro.Value);
            if (adaptacao is null) return BadRequest("A adaptação selecionada não pertence ao livro escolhido.");
            if (review.NotaFidelidade is null || review.NotaFidelidade < 1 || review.NotaFidelidade > 5)
                return BadRequest("Informe a fidelidade da adaptação entre 1 e 5 estrelas.");
            review.AssistiuFilme = true;
        }
        else
        {
            review.NotaFidelidade = null;
            review.AssistiuFilme = false;
        }

        review.IdUsuario = usuarioId; // o autor vem do token, nunca do corpo da requisição
        review.Comentario = review.Comentario.Trim();
        review.Voto = null;
        review.DataCriacao = DateTime.UtcNow;
        _context.Reviews.Add(review);
        await _context.SaveChangesAsync();
        // 201 Created: informa o endereço do novo recurso (cabeçalho Location).
        return CreatedAtAction(nameof(GetReview), new { id = review.IdReviews }, new { mensagem = "Resenha publicada.", review.IdReviews });
    }

    [Authorize]
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> DeletarReview(int id)
    {
        if (!int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var usuarioId))
            return Unauthorized();
        var review = await _context.Reviews.FirstOrDefaultAsync(r => r.IdReviews == id && r.IdUsuario == usuarioId);
        if (review is null) return NotFound();
        _context.Reviews.Remove(review);
        await _context.SaveChangesAsync();
        return NoContent();
    }
}

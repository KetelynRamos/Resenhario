using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Resenhario.Api.Data;
using Resenhario.Api.Models;

namespace Resenhario.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AdaptacaoController : ControllerBase
{
    private readonly AppDbContext _context;

    // Só entram no ranking adaptações com pelo menos esta quantidade de notas de fidelidade:
    // evita que um filme com uma única nota 5 fique à frente de outro avaliado por muita gente.
    public const int MinimoAvaliacoesRanking = 2;

    public AdaptacaoController(AppDbContext context) => _context = context;

    // Dados completos de uma adaptação para o card "Livro vs. Filme".
    public record AdaptacaoResposta(int IdAdaptacoes, int IdLivro, string TituloLivro,
        int IdFilme, string TituloFilme, string? PosterUrl, DateTime DataVinculo,
        string AutorLivro, string? CapaUrl, string? Diretor, int? AnoLancamento,
        double? MediaFidelidade, int TotalAvaliacoes, double? MediaNotaLivro, int TotalResenhasLivro);
    public record CriarAdaptacaoRequest(
        [Range(1, int.MaxValue, ErrorMessage = "Selecione um livro válido.")] int IdLivro,
        [Range(1, int.MaxValue, ErrorMessage = "Selecione um filme válido.")] int IdFilme);

    // GET /api/Adaptacao/5 → 200 com o vínculo ou 404
    [HttpGet("{id:int}")]
    public async Task<ActionResult<Adaptacao>> GetAdaptacao(int id)
    {
        var adaptacao = await _context.Adaptacoes.FindAsync(id);
        return adaptacao is null ? NotFound() : Ok(adaptacao);
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<AdaptacaoResposta>>> GetAdaptacoes()
    {
        var adaptacoes = await (
            from a in _context.Adaptacoes
            join l in _context.Livros on a.IdLivro equals l.IdLivros
            join f in _context.Filmes on a.IdFilme equals f.IdFilme
            orderby l.Titulo, f.Titulo
            select new AdaptacaoResposta(a.IdAdaptacoes, a.IdLivro, l.Titulo,
                a.IdFilme, f.Titulo, f.PosterUrl, a.DataVinculo,
                l.Autor, l.CapaUrl, f.Diretor, f.AnoLancamento,
                _context.Reviews.Where(r => r.IdAdaptacao == a.IdAdaptacoes && r.NotaFidelidade != null)
                    .Select(r => (double?)r.NotaFidelidade).Average(),
                _context.Reviews.Count(r => r.IdAdaptacao == a.IdAdaptacoes && r.NotaFidelidade != null),
                _context.Reviews.Where(r => r.IdLivro == a.IdLivro && r.NotaLivro != null)
                    .Select(r => (double?)r.NotaLivro).Average(),
                _context.Reviews.Count(r => r.IdLivro == a.IdLivro && r.NotaLivro != null))
        ).ToListAsync();
        return Ok(adaptacoes);
    }


    // Ranking das adaptações com a "avaliação dupla" da comunidade:
    // - MediaFidelidade: média das notas de fidelidade dadas a ESTA adaptação;
    // - MediaNotaLivro: média das notas de qualidade dadas ao LIVRO (média de aceitação da obra).
    [HttpGet("ranking")]
    public async Task<IActionResult> Ranking()
    {
        var ranking = await (
            from a in _context.Adaptacoes
            join l in _context.Livros on a.IdLivro equals l.IdLivros
            join f in _context.Filmes on a.IdFilme equals f.IdFilme
            select new
            {
                a.IdAdaptacoes,
                a.IdLivro,
                a.IdFilme,
                TituloLivro = l.Titulo,
                AutorLivro = l.Autor,
                l.CapaUrl,
                TituloFilme = f.Titulo,
                f.Diretor,
                f.AnoLancamento,
                f.PosterUrl,
                MediaFidelidade = _context.Reviews.Where(r => r.IdAdaptacao == a.IdAdaptacoes && r.NotaFidelidade != null)
                    .Select(r => (double?)r.NotaFidelidade).Average(),
                TotalAvaliacoes = _context.Reviews.Count(r => r.IdAdaptacao == a.IdAdaptacoes && r.NotaFidelidade != null),
                MediaNotaLivro = _context.Reviews.Where(r => r.IdLivro == a.IdLivro && r.NotaLivro != null)
                    .Select(r => (double?)r.NotaLivro).Average(),
                TotalResenhasLivro = _context.Reviews.Count(r => r.IdLivro == a.IdLivro && r.NotaLivro != null)
            })
        .Where(x => x.TotalAvaliacoes >= MinimoAvaliacoesRanking)
        .OrderByDescending(x => x.MediaFidelidade)
        .ThenByDescending(x => x.TotalAvaliacoes)
        .ThenByDescending(x => x.MediaNotaLivro) // desempate: o livro mais bem avaliado
        .ThenBy(x => x.TituloFilme)            // e, por fim, ordem alfabética (resultado sempre igual)
        .Take(20)
        .ToListAsync();
        return Ok(ranking);
    }

    [Authorize] // Só usuários logados podem alterar o catálogo.
    [HttpPost]
    public async Task<IActionResult> CriarAdaptacao([FromBody] CriarAdaptacaoRequest dados)
    {
        if (dados.IdLivro <= 0 || dados.IdFilme <= 0)
            return BadRequest("Selecione um livro e um filme válidos.");
        if (!await _context.Livros.AnyAsync(l => l.IdLivros == dados.IdLivro))
            return BadRequest("O livro selecionado não existe no catálogo.");
        if (!await _context.Filmes.AnyAsync(f => f.IdFilme == dados.IdFilme))
            return BadRequest("O filme selecionado não existe no catálogo.");

        var existente = await _context.Adaptacoes.FirstOrDefaultAsync(a =>
            a.IdLivro == dados.IdLivro && a.IdFilme == dados.IdFilme);
        if (existente is not null)
            return Conflict(new { mensagem = "Essa adaptação já está vinculada." });

        var adaptacao = new Adaptacao
        {
            IdLivro = dados.IdLivro,
            IdFilme = dados.IdFilme,
            DataVinculo = DateTime.UtcNow
        };
        _context.Adaptacoes.Add(adaptacao);
        await _context.SaveChangesAsync();
        return CreatedAtAction(nameof(GetAdaptacao), new { id = adaptacao.IdAdaptacoes }, new { mensagem = "Adaptação vinculada com sucesso.", adaptacao.IdAdaptacoes });
    }

    [Authorize] // Só usuários logados podem alterar o catálogo.
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> DeletarAdaptacao(int id)
    {
        var adaptacao = await _context.Adaptacoes.FindAsync(id);
        if (adaptacao is null) return NotFound();
        if (await _context.Reviews.AnyAsync(r => r.IdAdaptacao == id))
            return Conflict("Não é possível remover esta adaptação enquanto houver resenhas vinculadas.");
        _context.Adaptacoes.Remove(adaptacao);
        await _context.SaveChangesAsync();
        return NoContent();
    }
}

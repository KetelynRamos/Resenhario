using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Resenhario.Api.Data;
using Resenhario.Api.Models;

namespace Resenhario.Api.Controllers;

// CRUD do catálogo de livros (tabela Livros).
// Leitura é pública; criar, editar e excluir exigem login ([Authorize]).
[ApiController]
[Route("api/[controller]")]
public class LivroController : ControllerBase
{
    private readonly AppDbContext _context;

    // O AppDbContext chega pelo construtor (injeção de dependência configurada no Program.cs).
    public LivroController(AppDbContext context) => _context = context;

    // GET /api/Livro → 200 com a lista em ordem alfabética
    [HttpGet]
    public async Task<ActionResult<IEnumerable<Livro>>> GetLivros() =>
        Ok(await _context.Livros.OrderBy(l => l.Titulo).ToListAsync());

    // GET /api/Livro/5 → 200 com o livro ou 404 se não existir
    [HttpGet("{id:int}")]
    public async Task<ActionResult<Livro>> GetLivro(int id)
    {
        var livro = await _context.Livros.FindAsync(id);
        return livro is null ? NotFound() : Ok(livro);
    }

    // GET /api/Livro/5/medias → médias da comunidade: nota da obra e fidelidade de cada adaptação.
    [HttpGet("{id:int}/medias")]
    public async Task<IActionResult> GetMedias(int id)
    {
        var livro = await _context.Livros.FindAsync(id);
        if (livro is null) return NotFound();

        var notasLivro = _context.Reviews.Where(r => r.IdLivro == id && r.NotaLivro != null);
        var mediaNotaLivro = await notasLivro.AverageAsync(r => (double?)r.NotaLivro);
        var totalResenhas = await notasLivro.CountAsync();

        var adaptacoes = await (
            from a in _context.Adaptacoes
            join f in _context.Filmes on a.IdFilme equals f.IdFilme
            where a.IdLivro == id
            select new
            {
                a.IdAdaptacoes,
                TituloFilme = f.Titulo,
                f.PosterUrl,
                MediaFidelidade = _context.Reviews.Where(r => r.IdAdaptacao == a.IdAdaptacoes && r.NotaFidelidade != null)
                    .Select(r => (double?)r.NotaFidelidade).Average(),
                TotalAvaliacoes = _context.Reviews.Count(r => r.IdAdaptacao == a.IdAdaptacoes && r.NotaFidelidade != null)
            }).ToListAsync();

        return Ok(new { livro.IdLivros, livro.Titulo, mediaNotaLivro, totalResenhas, adaptacoes });
    }

    // POST /api/Livro → 201 Created (com o endereço do novo livro) ou 409 se já existir.
    // As Data Annotations do Model Livro já foram validadas antes de entrar aqui (400 se falharem).
    [Authorize]
    [HttpPost]
    public async Task<IActionResult> CriarLivro(Livro livro)
    {
        if (!string.IsNullOrWhiteSpace(livro.GoogleBId) &&
            await _context.Livros.AnyAsync(l => l.GoogleBId == livro.GoogleBId))
            return Conflict(new { mensagem = "Este livro já está no catálogo." });

        if (!string.IsNullOrWhiteSpace(livro.Isbn) &&
            await _context.Livros.AnyAsync(l => l.Isbn == livro.Isbn))
            return Conflict(new { mensagem = "Já existe um livro com este ISBN no catálogo." });

        _context.Livros.Add(livro);
        await _context.SaveChangesAsync();
        return CreatedAtAction(nameof(GetLivro), new { id = livro.IdLivros }, livro);
    }

    // PUT /api/Livro/5 → 204 No Content (atualizou, não há nada novo para devolver) ou 404
    [Authorize]
    [HttpPut("{id:int}")]
    public async Task<IActionResult> AtualizarLivro(int id, Livro livro)
    {
        var livroExistente = await _context.Livros.FindAsync(id);
        if (livroExistente is null) return NotFound();

        livroExistente.GoogleBId = livro.GoogleBId;
        livroExistente.Titulo = livro.Titulo;
        livroExistente.Autor = livro.Autor;
        livroExistente.Sinopse = livro.Sinopse;
        livroExistente.Isbn = livro.Isbn;
        livroExistente.CapaUrl = livro.CapaUrl;

        await _context.SaveChangesAsync();
        return NoContent();
    }

    // DELETE /api/Livro/5 → 204, 404 ou 409 (livro com vínculos)
    [Authorize]
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> DeletarLivro(int id)
    {
        var livro = await _context.Livros.FindAsync(id);
        if (livro is null) return NotFound();

        // Um livro com adaptações, resenhas ou em estantes não pode ser apagado
        // (as chaves estrangeiras do banco impediriam e a API daria erro 500).
        bool temVinculos = await _context.Adaptacoes.AnyAsync(a => a.IdLivro == id)
            || await _context.Reviews.AnyAsync(r => r.IdLivro == id)
            || await _context.Estantes.AnyAsync(e => e.IdLivros == id);
        if (temVinculos)
            return Conflict(new { mensagem = "Este livro tem adaptações, resenhas ou está em estantes e não pode ser excluído." });

        _context.Livros.Remove(livro);
        await _context.SaveChangesAsync();
        return NoContent();
    }
}

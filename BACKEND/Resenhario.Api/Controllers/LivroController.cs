using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Resenhario.Api.Data;
using Resenhario.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Resenhario.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class LivroController : ControllerBase
{
    private readonly AppDbContext _context;

    public LivroController(AppDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    public ActionResult<IEnumerable<Livro>> GetLivros()
    {
        return Ok(_context.Livros.ToList());
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<Livro>> GetLivro(int id)
    {
        var livro = await _context.Livros.FindAsync(id);
        return livro is null ? NotFound() : Ok(livro);
    }

    
[Authorize] // Só usuários logados podem alterar o catálogo.
[HttpPost]
public async Task<IActionResult> CriarLivro(Livro livro)
{
    // Verifica se o identificador externo já foi cadastrado.
    if (!string.IsNullOrWhiteSpace(livro.GoogleBId))
    {
        bool livroExiste = await _context.Livros
            .AnyAsync(l => l.GoogleBId == livro.GoogleBId);

        if (livroExiste)
        {
            return Conflict(new
            {
                mensagem = "Este livro já está no catálogo."
            });
        }
    }

    // Verifica se o ISBN já está cadastrado.
    if (!string.IsNullOrWhiteSpace(livro.Isbn))
    {
        bool isbnExiste = await _context.Livros
            .AnyAsync(l => l.Isbn == livro.Isbn);

        if (isbnExiste)
        {
            return Conflict(new
            {
                mensagem = "Já existe um livro com este ISBN no catálogo."
            });
        }
    }

    _context.Livros.Add(livro);
    await _context.SaveChangesAsync();

    return CreatedAtAction(
        nameof(GetLivro),
        new { id = livro.IdLivros },
        livro
    );
}

    [Authorize] // Só usuários logados podem alterar o catálogo.
    [HttpPut("{id}")]
    public IActionResult AtualizarLivro(int id, Livro livro)
    {
        var livroExistente = _context.Livros.Find(id);

        if (livroExistente == null)
        {
            return NotFound();
        }

        livroExistente.GoogleBId = livro.GoogleBId;
        livroExistente.Titulo = livro.Titulo;
        livroExistente.Autor = livro.Autor;
        livroExistente.Sinopse = livro.Sinopse;
        livroExistente.Isbn = livro.Isbn;
        livroExistente.CapaUrl = livro.CapaUrl;

        _context.SaveChanges();

        return NoContent();
    }

    [Authorize] // Só usuários logados podem alterar o catálogo.
    [HttpDelete("{id}")]
    public IActionResult DeletarLivro(int id)
    {
        var livro = _context.Livros.Find(id);

        if (livro == null)
        {
            return NotFound();
        }

        // Um livro com adaptações, resenhas ou em estantes não pode ser apagado
        // (as chaves estrangeiras do banco impediriam e a API daria erro 500).
        bool temVinculos = _context.Adaptacoes.Any(a => a.IdLivro == id)
            || _context.Reviews.Any(r => r.IdLivro == id)
            || _context.Estantes.Any(e => e.IdLivros == id);
        if (temVinculos)
        {
            return Conflict(new
            {
                mensagem = "Este livro tem adaptações, resenhas ou está em estantes e não pode ser excluído."
            });
        }

        _context.Livros.Remove(livro);
        _context.SaveChanges();

        return NoContent();
    }
}
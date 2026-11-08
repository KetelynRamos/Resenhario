using System.ComponentModel.DataAnnotations;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Resenhario.Api.Data;
using Resenhario.Api.Models;

namespace Resenhario.Api.Controllers;

// Interações do feed: curtir e comentar resenhas.
// As rotas ficam "dentro" da resenha: /api/Review/{idReview}/curtida e /api/Review/{idReview}/comentarios
[ApiController]
[Route("api/Review/{idReview:int}")]
public class ComunidadeController : ControllerBase
{
    private readonly AppDbContext _context;
    public ComunidadeController(AppDbContext context) => _context = context;

    public record ComentarioRequest(
        [Required(ErrorMessage = "Escreva um comentário.")]
        [StringLength(1000, ErrorMessage = "O comentário pode ter no máximo 1.000 caracteres.")] string Texto);

    public record ComentarioResposta(int IdComentario, int IdUsuario, string NomeUsuario, string? AvatarUsuario,
        string Texto, DateTime DataCriacao, bool EhMeu);

    // ----- Curtidas -----

    // POST /api/Review/5/curtida → 201 (curtiu), 404 (resenha não existe) ou 409 (já tinha curtido)
    [Authorize]
    [HttpPost("curtida")]
    public async Task<IActionResult> Curtir(int idReview)
    {
        if (!TentarObterUsuarioId(out var usuarioId)) return Unauthorized();
        if (!await _context.Reviews.AnyAsync(r => r.IdReviews == idReview)) return NotFound();
        if (await _context.Curtidas.AnyAsync(c => c.IdReview == idReview && c.IdUsuario == usuarioId))
            return Conflict(new { mensagem = "Você já curtiu esta resenha." });

        _context.Curtidas.Add(new Curtida { IdReview = idReview, IdUsuario = usuarioId, DataCriacao = DateTime.UtcNow });
        await _context.SaveChangesAsync();
        var total = await _context.Curtidas.CountAsync(c => c.IdReview == idReview);
        return StatusCode(StatusCodes.Status201Created, new { totalCurtidas = total });
    }

    // DELETE /api/Review/5/curtida → 204 (descurtiu) ou 404 (não tinha curtido)
    [Authorize]
    [HttpDelete("curtida")]
    public async Task<IActionResult> Descurtir(int idReview)
    {
        if (!TentarObterUsuarioId(out var usuarioId)) return Unauthorized();
        var curtida = await _context.Curtidas.FirstOrDefaultAsync(c => c.IdReview == idReview && c.IdUsuario == usuarioId);
        if (curtida is null) return NotFound();
        _context.Curtidas.Remove(curtida);
        await _context.SaveChangesAsync();
        return NoContent();
    }

    // ----- Comentários -----

    // GET /api/Review/5/comentarios → 200 com os comentários, do mais antigo para o mais novo
    [HttpGet("comentarios")]
    public async Task<IActionResult> ListarComentarios(int idReview)
    {
        if (!await _context.Reviews.AnyAsync(r => r.IdReviews == idReview)) return NotFound();
        int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var usuarioLogado);
        return Ok(await ConsultarComentarios(idReview, usuarioLogado).ToListAsync());
    }

    // POST /api/Review/5/comentarios → 201 com o comentário criado, 400 (texto inválido) ou 404
    [Authorize]
    [HttpPost("comentarios")]
    public async Task<IActionResult> Comentar(int idReview, ComentarioRequest dados)
    {
        if (!TentarObterUsuarioId(out var usuarioId)) return Unauthorized();
        if (!await _context.Reviews.AnyAsync(r => r.IdReviews == idReview)) return NotFound();
        var texto = dados.Texto.Trim();
        if (texto.Length == 0) return BadRequest(new { mensagem = "Escreva um comentário." });

        var comentario = new Comentario { IdReview = idReview, IdUsuario = usuarioId, Texto = texto, DataCriacao = DateTime.UtcNow };
        _context.Comentarios.Add(comentario);
        await _context.SaveChangesAsync();
        var criado = await ConsultarComentarios(idReview, usuarioId, comentario.IdComentario).FirstAsync();
        return CreatedAtAction(nameof(ListarComentarios), new { idReview }, criado);
    }

    // DELETE /api/Review/5/comentarios/12 → 204 ou 404 (não existe ou é de outra pessoa)
    [Authorize]
    [HttpDelete("comentarios/{idComentario:int}")]
    public async Task<IActionResult> ApagarComentario(int idReview, int idComentario)
    {
        if (!TentarObterUsuarioId(out var usuarioId)) return Unauthorized();
        var comentario = await _context.Comentarios.FirstOrDefaultAsync(c =>
            c.IdComentario == idComentario && c.IdReview == idReview && c.IdUsuario == usuarioId);
        if (comentario is null) return NotFound();
        _context.Comentarios.Remove(comentario);
        await _context.SaveChangesAsync();
        return NoContent();
    }

    // Filtros antes do select (o EF Core não traduz filtro sobre o record já montado).
    private IQueryable<ComentarioResposta> ConsultarComentarios(int idReview, int usuarioLogado, int? idComentario = null) =>
        from c in _context.Comentarios
        join u in _context.Usuarios on c.IdUsuario equals u.IdUsuario
        where c.IdReview == idReview && (idComentario == null || c.IdComentario == idComentario)
        orderby c.DataCriacao
        select new ComentarioResposta(c.IdComentario, u.IdUsuario, u.Nome,
            u.Avatar == null ? null
                : u.Avatar.StartsWith("data:") ? "/api/Usuario/" + u.IdUsuario + "/avatar?v=" + u.Avatar.Length
                : u.Avatar,
            c.Texto, c.DataCriacao, c.IdUsuario == usuarioLogado);

    private bool TentarObterUsuarioId(out int usuarioId) =>
        int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out usuarioId);
}

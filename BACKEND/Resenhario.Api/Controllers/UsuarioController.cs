using System.ComponentModel.DataAnnotations;
using System.Security.Claims;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Resenhario.Api.Data;

namespace Resenhario.Api.Controllers;

// Perfil do usuário logado: dados, avatar e meta de leitura.
[ApiController]
[Authorize]
[Route("api/[controller]")]
public class UsuarioController : ControllerBase
{
    private readonly AppDbContext _context;
    public UsuarioController(AppDbContext context) => _context = context;

    // Avatares prontos ficam em wwwroot/img/avatares (avatar-1.svg até avatar-8.svg).
    private static readonly Regex AvatarPronto = new(@"^/img/avatares/avatar-[1-8]\.svg$");
    // Foto enviada: imagem em texto base64, já reduzida no navegador (até ~220 KB).
    private static readonly Regex FotoEnviada = new(@"^data:image/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$");
    private const int TamanhoMaximoFoto = 300_000;

    public record PerfilResposta(int IdUsuario, string Nome, string Email, DateTime DataCadastro,
        string? Bio, string? LivroFavorito, string? Avatar, int? MetaLivros, DateTime? MetaInicio,
        int TotalResenhas, int CurtidasRecebidas);

    public record AtualizarPerfilRequest(
        [Required(ErrorMessage = "Informe seu nome.")]
        [StringLength(150, ErrorMessage = "O nome pode ter no máximo 150 caracteres.")] string Nome,
        [StringLength(280, ErrorMessage = "A frase pode ter no máximo 280 caracteres.")] string? Bio,
        [StringLength(200, ErrorMessage = "O livro favorito pode ter no máximo 200 caracteres.")] string? LivroFavorito);

    public record AvatarRequest(string? Avatar);

    public record MetaRequest([Range(1, 100, ErrorMessage = "Escolha uma meta entre 1 e 100 livros.")] int? MetaLivros);

    // Endereço público do avatar: o pronto é um arquivo do site; a foto é servida por GET /api/Usuario/{id}/avatar.
    // O "?v=" muda quando a foto muda, para o navegador não mostrar a antiga guardada em cache.
    public static string? AvatarPublico(int idUsuario, string? avatar) =>
        avatar is null ? null : avatar.StartsWith("data:") ? $"/api/Usuario/{idUsuario}/avatar?v={avatar.Length}" : avatar;

    // GET /api/Usuario/me → 200 com o perfil completo
    [HttpGet("me")]
    public async Task<ActionResult<PerfilResposta>> GetMeuUsuario()
    {
        if (!TentarObterUsuarioId(out var usuarioId)) return Unauthorized();
        var u = await _context.Usuarios.FindAsync(usuarioId);
        if (u is null) return NotFound();

        var totalResenhas = await _context.Reviews.CountAsync(r => r.IdUsuario == usuarioId);
        var curtidasRecebidas = await _context.Curtidas.CountAsync(c =>
            _context.Reviews.Any(r => r.IdReviews == c.IdReview && r.IdUsuario == usuarioId));

        return Ok(new PerfilResposta(u.IdUsuario, u.Nome, u.Email, u.DataCadastro, u.Bio, u.LivroFavorito,
            AvatarPublico(u.IdUsuario, u.Avatar), u.MetaLivros, u.MetaInicio, totalResenhas, curtidasRecebidas));
    }

    // PUT /api/Usuario/me → 204 (nome, frase e livro favorito)
    [HttpPut("me")]
    public async Task<IActionResult> AtualizarPerfil(AtualizarPerfilRequest dados)
    {
        if (!TentarObterUsuarioId(out var usuarioId)) return Unauthorized();
        var u = await _context.Usuarios.FindAsync(usuarioId);
        if (u is null) return NotFound();

        u.Nome = dados.Nome.Trim();
        u.Bio = string.IsNullOrWhiteSpace(dados.Bio) ? null : dados.Bio.Trim();
        u.LivroFavorito = string.IsNullOrWhiteSpace(dados.LivroFavorito) ? null : dados.LivroFavorito.Trim();
        await _context.SaveChangesAsync();
        return NoContent();
    }

    // PUT /api/Usuario/me/avatar → 204. Aceita um avatar pronto, uma foto (base64) ou null (remove).
    [HttpPut("me/avatar")]
    public async Task<IActionResult> AtualizarAvatar(AvatarRequest dados)
    {
        if (!TentarObterUsuarioId(out var usuarioId)) return Unauthorized();
        var u = await _context.Usuarios.FindAsync(usuarioId);
        if (u is null) return NotFound();

        var avatar = dados.Avatar;
        bool valido = avatar is null || AvatarPronto.IsMatch(avatar)
                      || (avatar.Length <= TamanhoMaximoFoto && FotoEnviada.IsMatch(avatar));
        if (!valido) return BadRequest(new { mensagem = "Escolha um dos avatares ou envie uma foto JPG ou PNG." });

        u.Avatar = avatar;
        await _context.SaveChangesAsync();
        return NoContent();
    }

    // PUT /api/Usuario/me/meta → 204. Começa uma meta nova (a contagem recomeça hoje) ou remove (null).
    [HttpPut("me/meta")]
    public async Task<IActionResult> AtualizarMeta(MetaRequest dados)
    {
        if (!TentarObterUsuarioId(out var usuarioId)) return Unauthorized();
        var u = await _context.Usuarios.FindAsync(usuarioId);
        if (u is null) return NotFound();

        u.MetaLivros = dados.MetaLivros;
        u.MetaInicio = dados.MetaLivros is null ? null : DateTime.UtcNow;
        await _context.SaveChangesAsync();
        return NoContent();
    }

    // GET /api/Usuario/5/avatar → a imagem do avatar (pública, usada no feed e nos comentários)
    [AllowAnonymous]
    [HttpGet("{id:int}/avatar")]
    public async Task<IActionResult> GetAvatar(int id)
    {
        var avatar = await _context.Usuarios.Where(u => u.IdUsuario == id).Select(u => u.Avatar).FirstOrDefaultAsync();
        if (avatar is null) return NotFound();
        if (AvatarPronto.IsMatch(avatar)) return Redirect(avatar);

        var match = FotoEnviada.Match(avatar);
        if (!match.Success) return NotFound();
        var bytes = Convert.FromBase64String(avatar[(avatar.IndexOf(',') + 1)..]);
        Response.Headers.CacheControl = "public, max-age=86400"; // o "?v=" do endereço garante a versão nova
        return File(bytes, $"image/{match.Groups[1].Value}");
    }

    // O ID do usuário vem do token JWT, nunca do corpo da requisição.
    private bool TentarObterUsuarioId(out int usuarioId) =>
        int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out usuarioId);
}

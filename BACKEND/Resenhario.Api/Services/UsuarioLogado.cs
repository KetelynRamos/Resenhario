using System.Security.Claims;

namespace Resenhario.Api.Services;

// Quem está fazendo a requisição? O ID vem de dentro do token JWT (claim NameIdentifier),
// nunca do corpo da requisição: por isso cada pessoa só mexe no que é dela.
public static class UsuarioLogado
{
    // Devolve 0 quando ninguém está logado (em rotas com [Authorize] sempre há alguém).
    public static int Id(ClaimsPrincipal usuario) =>
        int.TryParse(usuario.FindFirstValue(ClaimTypes.NameIdentifier), out var id) ? id : 0;
}

using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Resenhario.Api.Data;
using Resenhario.Api.Models;
using Resenhario.Api.Services;

namespace Resenhario.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AdaptacaoController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly ConferenciaAdaptacao _conferencia;

    // Só entram no ranking adaptações com pelo menos esta quantidade de notas de fidelidade:
    // evita que um filme com uma única nota 5 fique à frente de outro avaliado por muita gente.
    public const int MinimoAvaliacoesRanking = 2;

    public AdaptacaoController(AppDbContext context, ConferenciaAdaptacao conferencia)
    {
        _context = context;
        _conferencia = conferencia;
    }

    // Dados completos de uma adaptação para o card "Livro vs. Filme".
    public record AdaptacaoResposta(int IdAdaptacoes, int IdLivro, string TituloLivro,
        int IdFilme, string TituloFilme, string? PosterUrl, DateTime DataVinculo,
        string AutorLivro, string? CapaUrl, string? Diretor, int? AnoLancamento,
        double? MediaFidelidade, int TotalAvaliacoes, double? MediaNotaLivro, int TotalResenhasLivro);
    public record CriarAdaptacaoRequest(
        [Range(1, int.MaxValue, ErrorMessage = "Selecione um livro válido.")] int IdLivro,
        [Range(1, int.MaxValue, ErrorMessage = "Selecione um filme válido.")] int IdFilme,
        bool VincularMesmoAssim = false); // true quando a pessoa viu o aviso do TMDB e quis continuar

    // Resultado da conferência no TMDB: "confirmada", "nao-confere" ou "nao-conferida"
    // (sem token, TMDB fora do ar ou filme sem código do TMDB).
    public record ConferenciaResposta(string Situacao, List<string> AutoresOriginais, string Mensagem);

    // Consulta usada pela lista e pela busca por ID: junta livro, filme e as médias da comunidade.
    // O filtro (where) e a ordem (orderby) vêm ANTES do select: o EF Core não traduz para SQL
    // um filtro aplicado sobre o record já montado.
    private IQueryable<AdaptacaoResposta> ConsultarAdaptacoes(int? id = null) =>
        from a in _context.Adaptacoes
        join l in _context.Livros on a.IdLivro equals l.IdLivros
        join f in _context.Filmes on a.IdFilme equals f.IdFilme
        where id == null || a.IdAdaptacoes == id
        orderby l.Titulo, f.Titulo
        select new AdaptacaoResposta(a.IdAdaptacoes, a.IdLivro, l.Titulo,
            a.IdFilme, f.Titulo, f.PosterUrl, a.DataVinculo,
            l.Autor, l.CapaUrl, f.Diretor, f.AnoLancamento,
            _context.Reviews.Where(r => r.IdAdaptacao == a.IdAdaptacoes && r.NotaFidelidade != null)
                .Select(r => (double?)r.NotaFidelidade).Average(),
            _context.Reviews.Count(r => r.IdAdaptacao == a.IdAdaptacoes && r.NotaFidelidade != null),
            _context.Reviews.Where(r => r.IdLivro == a.IdLivro && r.NotaLivro != null)
                .Select(r => (double?)r.NotaLivro).Average(),
            _context.Reviews.Count(r => r.IdLivro == a.IdLivro && r.NotaLivro != null));

    // GET /api/Adaptacao/5 → 200 com livro, filme e médias, ou 404
    [HttpGet("{id:int}")]
    public async Task<ActionResult<AdaptacaoResposta>> GetAdaptacao(int id)
    {
        var adaptacao = await ConsultarAdaptacoes(id).FirstOrDefaultAsync();
        return adaptacao is null ? NotFound() : Ok(adaptacao);
    }

    // GET /api/Adaptacao → 200 com todas, em ordem de livro e filme
    [HttpGet]
    public async Task<ActionResult<IEnumerable<AdaptacaoResposta>>> GetAdaptacoes() =>
        Ok(await ConsultarAdaptacoes().ToListAsync());

    // Ranking das adaptações com a "avaliação dupla" da comunidade (MediaFidelidade do filme
    // e MediaNotaLivro do livro). São poucas adaptações: buscamos todas com a mesma consulta
    // da lista e filtramos/ordenamos na memória com LINQ.
    [HttpGet("ranking")]
    public async Task<IActionResult> Ranking()
    {
        var todas = await ConsultarAdaptacoes().ToListAsync();
        var ranking = todas
            .Where(a => a.TotalAvaliacoes >= MinimoAvaliacoesRanking)
            .OrderByDescending(a => a.MediaFidelidade)
            .ThenByDescending(a => a.TotalAvaliacoes)
            .ThenByDescending(a => a.MediaNotaLivro) // desempate: o livro mais bem avaliado
            .ThenBy(a => a.TituloFilme)              // e, por fim, ordem alfabética (resultado sempre igual)
            .Take(20)
            .ToList();
        return Ok(ranking);
    }

    [Authorize] // Só usuários logados podem alterar o catálogo.
    [HttpPost]
    public async Task<IActionResult> CriarAdaptacao([FromBody] CriarAdaptacaoRequest dados)
    {
        if (dados.IdLivro <= 0 || dados.IdFilme <= 0)
            return BadRequest("Selecione um livro e um filme válidos.");
        var livro = await _context.Livros.FindAsync(dados.IdLivro);
        if (livro is null)
            return BadRequest("O livro selecionado não existe no catálogo.");
        var filme = await _context.Filmes.FindAsync(dados.IdFilme);
        if (filme is null)
            return BadRequest("O filme selecionado não existe no catálogo.");

        var existente = await _context.Adaptacoes.FirstOrDefaultAsync(a =>
            a.IdLivro == dados.IdLivro && a.IdFilme == dados.IdFilme);
        if (existente is not null)
            return Conflict(new { mensagem = "Essa adaptação já está vinculada." });

        // O sistema não confia só no usuário: confere no TMDB se o filme veio deste livro.
        // Se o TMDB diz que não, devolve 409 com o aviso; a tela pergunta e, se a pessoa
        // confirmar, manda de novo com VincularMesmoAssim = true. Sem TMDB, o vínculo segue normal.
        var conferencia = await Conferir(livro, filme);
        if (conferencia.Situacao == "nao-confere" && !dados.VincularMesmoAssim)
            return Conflict(new { mensagem = conferencia.Mensagem, precisaConfirmar = true, conferencia.AutoresOriginais });

        var adaptacao = new Adaptacao
        {
            IdLivro = dados.IdLivro,
            IdFilme = dados.IdFilme,
            DataVinculo = DateTime.UtcNow
        };
        _context.Adaptacoes.Add(adaptacao);
        await _context.SaveChangesAsync();
        return CreatedAtAction(nameof(GetAdaptacao), new { id = adaptacao.IdAdaptacoes }, new { mensagem = "Adaptação vinculada com sucesso.", adaptacao.IdAdaptacoes, conferencia.Situacao });
    }

    // GET /api/Adaptacao/5/conferencia → o TMDB confirma que este filme veio deste livro?
    // Mostrado como selo na página do duelo.
    [HttpGet("{id:int}/conferencia")]
    public async Task<IActionResult> GetConferencia(int id)
    {
        var adaptacao = await _context.Adaptacoes.FindAsync(id);
        if (adaptacao is null) return NotFound();
        var livro = await _context.Livros.FindAsync(adaptacao.IdLivro);
        var filme = await _context.Filmes.FindAsync(adaptacao.IdFilme);
        if (livro is null || filme is null) return NotFound();
        return Ok(await Conferir(livro, filme));
    }

    private async Task<ConferenciaResposta> Conferir(Livro livro, Filme filme)
    {
        var creditos = await _conferencia.BuscarCreditosAsync(filme.TmdbId);
        if (creditos is null)
            return new ConferenciaResposta("nao-conferida", [], "Não foi possível conferir este vínculo no TMDB agora.");

        var autores = ConferenciaAdaptacao.AutoresOriginais(creditos);
        if (ConferenciaAdaptacao.AutorConfere(livro.Autor, autores))
            return new ConferenciaResposta("confirmada", autores, $"Confirmado: o filme é baseado na obra de {string.Join(", ", autores)}.");

        var mensagem = autores.Count == 0
            ? $"Não encontramos sinal de que “{filme.Titulo}” seja baseado em um livro."
            : $"Pelo que encontramos, “{filme.Titulo}” é baseado na obra de {string.Join(", ", autores)}, e não de {livro.Autor}.";
        return new ConferenciaResposta("nao-confere", autores, mensagem);
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

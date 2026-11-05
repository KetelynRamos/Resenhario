using Microsoft.EntityFrameworkCore;
using Resenhario.Api.Models;

namespace Resenhario.Api.Data;

// Dados de demonstração (seed) para o marco de testes e para a apresentação.
// É IDEMPOTENTE: antes de inserir, verifica se o registro já existe. Rodar de novo
// não duplica nada; só completa o que estiver faltando.
public static class SeedData
{
    // Senha de todos os usuários de demonstração (documentada no ROTEIRO_DEMO).
    public const string SenhaDemo = "Resenhario2026";

    // Records simples só para deixar as listas abaixo fáceis de ler.
    public record LivroSeed(string Titulo, string Autor, string Sinopse);
    public record FilmeSeed(string LivroTitulo, string Titulo, string TituloOriginal, string Diretor, int Ano);
    private record UsuarioSeed(string Nome, string Email);
    private record EstanteSeed(string Email, string LivroTitulo, string Status, int DiasAtras);
    private record ReviewSeed(string Email, string LivroTitulo, int NotaLivro,
        string? FilmeTitulo, int? NotaFidelidade, string Comentario, int HorasAtras);

    public static readonly LivroSeed[] Livros =
    [
        new("O Senhor dos Anéis: A Sociedade do Anel", "J.R.R. Tolkien", "Frodo herda um anel de poder e parte com oito companheiros para destruí-lo antes que Sauron o recupere."),
        new("O Hobbit", "J.R.R. Tolkien", "Bilbo Bolseiro deixa o conforto do Condado para ajudar treze anões a recuperar um tesouro guardado por um dragão."),
        new("Orgulho e Preconceito", "Jane Austen", "Elizabeth Bennet e o orgulhoso Sr. Darcy precisam superar primeiras impressões na Inglaterra do século XIX."),
        new("O Grande Gatsby", "F. Scott Fitzgerald", "Nick Carraway observa as festas de Jay Gatsby e sua obsessão por Daisy na Nova York dos anos 1920."),
        new("Duna", "Frank Herbert", "No planeta desértico Arrakis, Paul Atreides se envolve numa luta por poder, religião e pela especiaria mais valiosa do universo."),
        new("Jogos Vorazes", "Suzanne Collins", "Katniss Everdeen se oferece no lugar da irmã para um reality show em que só um jovem pode sair vivo."),
        new("A Culpa é das Estrelas", "John Green", "Hazel e Augustus se conhecem num grupo de apoio para jovens com câncer e vivem um amor intenso e breve."),
        new("O Iluminado", "Stephen King", "Jack Torrance aceita cuidar de um hotel isolado durante o inverno, e o lugar começa a despertar o pior dele."),
        new("Harry Potter e a Pedra Filosofal", "J.K. Rowling", "Um garoto descobre que é bruxo e começa seus estudos em Hogwarts, onde um mistério envolve uma pedra lendária."),
        new("Me Chame Pelo Seu Nome", "André Aciman", "Num verão no norte da Itália, Elio se apaixona por Oliver, um estudante americano hospedado na casa da família."),
        new("Ensaio sobre a Cegueira", "José Saramago", "Uma epidemia de cegueira branca se espalha por uma cidade e revela o melhor e o pior do ser humano."),
        new("Cidade de Deus", "Paulo Lins", "A formação do conjunto habitacional carioca e a escalada da violência entre os anos 1960 e 1980."),
        new("Lavoura Arcaica", "Raduan Nassar", "André foge da casa da família de imigrantes libaneses e, ao voltar, confronta a autoridade do pai."),
        new("O Auto da Compadecida", "Ariano Suassuna", "João Grilo e Chicó aplicam golpes no sertão nordestino até enfrentarem um julgamento celestial."),
        new("Clube da Luta", "Chuck Palahniuk", "Um homem com insônia conhece Tyler Durden e funda um clube secreto de lutas que sai do controle."),
        new("O Poderoso Chefão", "Mario Puzo", "A saga da família Corleone e a transformação de Michael, o filho que não queria entrar para a máfia."),
        new("Laranja Mecânica", "Anthony Burgess", "O jovem violento Alex passa por um tratamento experimental que pretende curá-lo da maldade."),
        new("Ainda Estou Aqui", "Marcelo Rubens Paiva", "O autor reconstrói a história da mãe, Eunice Paiva, após o desaparecimento do marido durante a ditadura."),
        new("Extraordinário", "R. J. Palacio", "Auggie, um garoto com uma síndrome facial, vai à escola pela primeira vez aos dez anos."),
        new("Garota Exemplar", "Gillian Flynn", "No dia do quinto aniversário de casamento, Amy desaparece, e todas as suspeitas recaem sobre o marido.")
    ];

    public static readonly FilmeSeed[] Filmes =
    [
        new("O Senhor dos Anéis: A Sociedade do Anel", "O Senhor dos Anéis: A Sociedade do Anel", "The Lord of the Rings: The Fellowship of the Ring", "Peter Jackson", 2001),
        new("O Hobbit", "O Hobbit: Uma Jornada Inesperada", "The Hobbit: An Unexpected Journey", "Peter Jackson", 2012),
        new("Orgulho e Preconceito", "Orgulho e Preconceito", "Pride & Prejudice", "Joe Wright", 2005),
        new("O Grande Gatsby", "O Grande Gatsby", "The Great Gatsby", "Baz Luhrmann", 2013),
        new("Duna", "Duna", "Dune", "Denis Villeneuve", 2021),
        new("Duna", "Duna (1984)", "Dune", "David Lynch", 1984),
        new("Jogos Vorazes", "Jogos Vorazes", "The Hunger Games", "Gary Ross", 2012),
        new("A Culpa é das Estrelas", "A Culpa é das Estrelas", "The Fault in Our Stars", "Josh Boone", 2014),
        new("O Iluminado", "O Iluminado", "The Shining", "Stanley Kubrick", 1980),
        new("Harry Potter e a Pedra Filosofal", "Harry Potter e a Pedra Filosofal", "Harry Potter and the Philosopher's Stone", "Chris Columbus", 2001),
        new("Me Chame Pelo Seu Nome", "Me Chame Pelo Seu Nome", "Call Me by Your Name", "Luca Guadagnino", 2017),
        new("Ensaio sobre a Cegueira", "Ensaio sobre a Cegueira", "Blindness", "Fernando Meirelles", 2008),
        new("Cidade de Deus", "Cidade de Deus", "Cidade de Deus", "Fernando Meirelles e Kátia Lund", 2002),
        new("Lavoura Arcaica", "Lavoura Arcaica", "Lavoura Arcaica", "Luiz Fernando Carvalho", 2001),
        new("O Auto da Compadecida", "O Auto da Compadecida", "O Auto da Compadecida", "Guel Arraes", 2000),
        new("Clube da Luta", "Clube da Luta", "Fight Club", "David Fincher", 1999),
        new("O Poderoso Chefão", "O Poderoso Chefão", "The Godfather", "Francis Ford Coppola", 1972),
        new("Laranja Mecânica", "Laranja Mecânica", "A Clockwork Orange", "Stanley Kubrick", 1971),
        new("Ainda Estou Aqui", "Ainda Estou Aqui", "Ainda Estou Aqui", "Walter Salles", 2024),
        new("Extraordinário", "Extraordinário", "Wonder", "Stephen Chbosky", 2017),
        new("Garota Exemplar", "Garota Exemplar", "Gone Girl", "David Fincher", 2014)
    ];

    // Usuários fictícios com os nomes da equipe.
    private static readonly UsuarioSeed[] Usuarios =
    [
        new("Alejandro Leon", "alejandro@resenhario.dev"),
        new("John Barbosa", "john@resenhario.dev"),
        new("Lucas Borges", "lucas@resenhario.dev"),
        new("Ketelyn Zaleski", "ketelyn@resenhario.dev"),
        new("Matheus Vieira", "matheus@resenhario.dev"),
        new("Vinicius Pereira", "vinicius@resenhario.dev")
    ];

    // Itens de estante além dos livros resenhados (que entram automaticamente como "Lido").
    private static readonly EstanteSeed[] EstantesExtras =
    [
        new("alejandro@resenhario.dev", "Garota Exemplar", "Lendo", 3),
        new("alejandro@resenhario.dev", "O Poderoso Chefão", "Quero ler", 12),
        new("alejandro@resenhario.dev", "Clube da Luta", "Abandonado", 40),
        new("john@resenhario.dev", "Ainda Estou Aqui", "Quero ler", 5),
        new("john@resenhario.dev", "Laranja Mecânica", "Lendo", 9),
        new("lucas@resenhario.dev", "Duna", "Quero ler", 2),
        new("lucas@resenhario.dev", "Extraordinário", "Abandonado", 55),
        new("lucas@resenhario.dev", "O Grande Gatsby", "Lendo", 7),
        new("ketelyn@resenhario.dev", "Me Chame Pelo Seu Nome", "Lendo", 4),
        new("ketelyn@resenhario.dev", "O Iluminado", "Quero ler", 15),
        new("matheus@resenhario.dev", "Lavoura Arcaica", "Quero ler", 6),
        new("matheus@resenhario.dev", "Ensaio sobre a Cegueira", "Lendo", 10),
        new("matheus@resenhario.dev", "O Auto da Compadecida", "Abandonado", 70),
        new("vinicius@resenhario.dev", "Cidade de Deus", "Lendo", 1),
        new("vinicius@resenhario.dev", "O Senhor dos Anéis: A Sociedade do Anel", "Quero ler", 20)
    ];

    // Resenhas com avaliação dupla: nota da obra (1 a 5) e, se viu o filme, fidelidade (1 a 5).
    private static readonly ReviewSeed[] Reviews =
    [
        new("ketelyn@resenhario.dev", "Ainda Estou Aqui", 5, "Ainda Estou Aqui", 5, "Saí do cinema direto para a livraria. O filme é contido e respeita o silêncio do livro: a Eunice do Marcelo Rubens Paiva está toda ali.", 2),
        new("vinicius@resenhario.dev", "Duna", 5, "Duna", 4, "Villeneuve acertou o tom e o tamanho do deserto. Mas o livro tem política e religião que o filme só sugere. Leiam!", 5),
        new("john@resenhario.dev", "Duna", 4, "Duna (1984)", 2, "A versão do Lynch é uma curiosidade: corta e inventa muita coisa. Vale como comparação depois de ler o livro.", 20),
        new("lucas@resenhario.dev", "Cidade de Deus", 5, "Cidade de Deus", 4, "O romance é bem mais longo e cheio de personagens; o filme condensa tudo com uma montagem genial. Os dois são obrigatórios.", 30),
        new("matheus@resenhario.dev", "O Iluminado", 4, "O Iluminado", 2, "Filme incrível, adaptação infiel. O Jack do livro luta contra o hotel; o do Kubrick já chega louco. Entendo por que o King não gostou.", 46),
        new("alejandro@resenhario.dev", "O Senhor dos Anéis: A Sociedade do Anel", 5, "O Senhor dos Anéis: A Sociedade do Anel", 5, "Adaptação de referência. O Tom Bombadil faz falta, mas quase tudo que importa está na tela.", 60),
        new("ketelyn@resenhario.dev", "Orgulho e Preconceito", 5, "Orgulho e Preconceito", 4, "O filme de 2005 é romântico e lindo, mas simplifica a ironia da Austen. A Elizabeth do livro é ainda mais afiada.", 72),
        new("vinicius@resenhario.dev", "O Grande Gatsby", 4, "O Grande Gatsby", 3, "Luhrmann transformou as festas em videoclipe. Fiel na trama, menos na melancolia do Nick.", 90),
        new("lucas@resenhario.dev", "Jogos Vorazes", 4, "Jogos Vorazes", 4, "A narração em primeira pessoa da Katniss faz falta no filme, mas a arena ficou bem fiel.", 100),
        new("john@resenhario.dev", "Harry Potter e a Pedra Filosofal", 5, "Harry Potter e a Pedra Filosofal", 5, "Talvez a adaptação mais literal da saga. Ótima porta de entrada para a criançada começar a ler.", 120),
        new("matheus@resenhario.dev", "A Culpa é das Estrelas", 4, "A Culpa é das Estrelas", 5, "Chorei duas vezes: no livro e no filme. Os diálogos foram praticamente copiados.", 140),
        new("alejandro@resenhario.dev", "Ensaio sobre a Cegueira", 5, "Ensaio sobre a Cegueira", 3, "O Meirelles fez um filme corajoso, mas a prosa do Saramago, sem nomes e sem travessões, é quase impossível de filmar.", 160),
        new("ketelyn@resenhario.dev", "Lavoura Arcaica", 5, "Lavoura Arcaica", 5, "Raro caso em que o filme é tão poético quanto o livro. O texto do Raduan é dito em voz alta, quase inteiro.", 180),
        new("vinicius@resenhario.dev", "O Auto da Compadecida", 5, "O Auto da Compadecida", 4, "Guel Arraes juntou outras peças do Suassuna na história, mas o espírito do João Grilo e do Chicó está perfeito.", 200),
        new("lucas@resenhario.dev", "Me Chame Pelo Seu Nome", 4, "Me Chame Pelo Seu Nome", 4, "O filme é mais contido que o livro, e o epílogo do Aciman, anos depois, não está na tela.", 230),
        new("john@resenhario.dev", "Clube da Luta", 4, "Clube da Luta", 4, "Fincher mudou o final e, curiosamente, o próprio Palahniuk disse que preferiu o do filme.", 260),
        new("matheus@resenhario.dev", "O Poderoso Chefão", 4, "O Poderoso Chefão", 5, "O livro tem subtramas que o Coppola cortou com razão. Aqui o filme melhora o material original.", 290),
        new("alejandro@resenhario.dev", "Laranja Mecânica", 4, "Laranja Mecânica", 3, "Kubrick usou a edição americana, sem o último capítulo. Quem só viu o filme não conhece o final do Burgess.", 320),
        new("ketelyn@resenhario.dev", "Extraordinário", 5, "Extraordinário", 4, "O livro alterna narradores e o filme manteve isso de um jeito bonito. Ótimo para ler em família.", 350),
        new("vinicius@resenhario.dev", "Garota Exemplar", 4, "Garota Exemplar", 5, "A própria Gillian Flynn escreveu o roteiro, então a fidelidade é altíssima. As reviravoltas funcionam nos dois.", 380),
        new("lucas@resenhario.dev", "O Hobbit", 5, "O Hobbit: Uma Jornada Inesperada", 2, "Um livro curto virou três filmes longos. Muita coisa foi inventada só para esticar a história.", 410),
        new("john@resenhario.dev", "O Senhor dos Anéis: A Sociedade do Anel", 4, "O Senhor dos Anéis: A Sociedade do Anel", 4, "Li depois de ver o filme e me surpreendi com quanta coisa a mais tem. O filme é fiel no espírito.", 440),
        new("matheus@resenhario.dev", "Duna", 5, "Duna", 5, "Para mim é a adaptação mais fiel possível de um livro tão denso. A cena da caixa de dor é idêntica.", 470),
        new("alejandro@resenhario.dev", "Ainda Estou Aqui", 5, "Ainda Estou Aqui", 4, "O livro fala mais da vida do Marcelo; o filme coloca a Eunice no centro. Escolheu um foco e acertou.", 500),
        new("ketelyn@resenhario.dev", "Cidade de Deus", 4, "Cidade de Deus", 4, "O livro é mais duro de ler do que o filme de assistir, mas entender a origem dos personagens muda tudo.", 530),
        new("vinicius@resenhario.dev", "Harry Potter e a Pedra Filosofal", 4, "Harry Potter e a Pedra Filosofal", 4, "O Pirraça e algumas aulas ficaram de fora, mas nada que estrague. Releitura obrigatória.", 560),
        new("lucas@resenhario.dev", "O Iluminado", 5, "O Iluminado", 3, "O livro é muito mais assustador. Lá o hotel é um personagem; no filme, o terror está no Jack.", 600),
        new("matheus@resenhario.dev", "Orgulho e Preconceito", 4, "Orgulho e Preconceito", 4, "Comprimir o livro em duas horas cobra seu preço, mas a fotografia compensa.", 640),
        new("john@resenhario.dev", "Ensaio sobre a Cegueira", 5, null, null, "Ainda não vi o filme. O livro me deixou sem dormir: leitura obrigatória.", 680),
        new("alejandro@resenhario.dev", "Lavoura Arcaica", 4, null, null, "Leitura exigente, de frases longas e muito lirismo. Agora quero ver o filme.", 700),
        new("ketelyn@resenhario.dev", "Jogos Vorazes", 5, "Jogos Vorazes", 3, "Senti falta do Haymitch mais sombrio do livro. Mas a Jennifer Lawrence é a Katniss.", 720),
        new("vinicius@resenhario.dev", "Me Chame Pelo Seu Nome", 5, null, null, "Livro sensível e quente como o verão italiano. Ainda vou assistir ao filme.", 740)
    ];

    public static async Task PopularAsync(AppDbContext db)
    {
        var agora = DateTime.UtcNow;

        // 1. Usuários (chave: e-mail). A senha é guardada com BCrypt, como no cadastro.
        foreach (var u in Usuarios)
        {
            if (!await db.Usuarios.AnyAsync(x => x.Email == u.Email))
                db.Usuarios.Add(new Usuario
                {
                    Nome = u.Nome,
                    Email = u.Email,
                    SenhaHash = BCrypt.Net.BCrypt.HashPassword(SenhaDemo),
                    DataCadastro = agora.AddDays(-90)
                });
        }

        // 2. Livros (chave: título).
        foreach (var l in Livros)
        {
            if (!await db.Livros.AnyAsync(x => x.Titulo == l.Titulo))
                db.Livros.Add(new Livro { Titulo = l.Titulo, Autor = l.Autor, Sinopse = l.Sinopse });
        }

        // 3. Filmes (chave: título + ano). Pôster fica vazio: o SeedImagens busca no TMDB.
        foreach (var f in Filmes)
        {
            if (!await db.Filmes.AnyAsync(x => x.Titulo == f.Titulo && x.AnoLancamento == f.Ano))
                db.Filmes.Add(new Filme { Titulo = f.Titulo, Diretor = f.Diretor, AnoLancamento = f.Ano });
        }
        await db.SaveChangesAsync(); // salva para os IDs gerados pelo banco ficarem disponíveis

        // Dicionários para achar os IDs pelo título/e-mail.
        var idUsuario = await db.Usuarios.ToDictionaryAsync(u => u.Email, u => u.IdUsuario);
        var idLivro = (await db.Livros.ToListAsync())
            .GroupBy(l => l.Titulo).ToDictionary(g => g.Key, g => g.First().IdLivros);
        var idFilme = (await db.Filmes.ToListAsync())
            .GroupBy(f => (f.Titulo, f.AnoLancamento)).ToDictionary(g => g.Key, g => g.First().IdFilme);

        // 4. Adaptações: vínculo Livro ↔ Filme (chave: par livro + filme).
        foreach (var f in Filmes)
        {
            int livro = idLivro[f.LivroTitulo], filme = idFilme[(f.Titulo, f.Ano)];
            if (!await db.Adaptacoes.AnyAsync(a => a.IdLivro == livro && a.IdFilme == filme))
                db.Adaptacoes.Add(new Adaptacao { IdLivro = livro, IdFilme = filme, DataVinculo = agora.AddDays(-60) });
        }
        await db.SaveChangesAsync();

        var adaptacoes = await db.Adaptacoes.ToListAsync();
        int? IdAdaptacao(string livroTitulo, string? filmeTitulo)
        {
            if (filmeTitulo is null) return null;
            var filme = Filmes.First(f => f.LivroTitulo == livroTitulo && f.Titulo == filmeTitulo);
            int livro = idLivro[livroTitulo], idF = idFilme[(filme.Titulo, filme.Ano)];
            return adaptacoes.First(a => a.IdLivro == livro && a.IdFilme == idF).IdAdaptacoes;
        }

        // 5. Resenhas (chave: usuário + livro).
        foreach (var r in Reviews)
        {
            int usuario = idUsuario[r.Email], livro = idLivro[r.LivroTitulo];
            if (await db.Reviews.AnyAsync(x => x.IdUsuario == usuario && x.IdLivro == livro)) continue;
            var idAdaptacao = IdAdaptacao(r.LivroTitulo, r.FilmeTitulo);
            db.Reviews.Add(new Review
            {
                IdUsuario = usuario,
                IdLivro = livro,
                IdAdaptacao = idAdaptacao,
                NotaLivro = r.NotaLivro,
                NotaFidelidade = r.NotaFidelidade,
                AssistiuFilme = idAdaptacao.HasValue,
                Comentario = r.Comentario,
                DataCriacao = agora.AddHours(-r.HorasAtras)
            });
        }

        // 6. Estantes (chave: usuário + livro). Quem resenhou um livro o tem como "Lido";
        //    as datas ficam espalhadas por alguns meses para o gráfico de leituras por mês.
        var estantes = Reviews.Select(r => new EstanteSeed(r.Email, r.LivroTitulo, "Lido", r.HorasAtras / 6))
            .Concat(EstantesExtras);
        foreach (var e in estantes)
        {
            int usuario = idUsuario[e.Email], livro = idLivro[e.LivroTitulo];
            if (!await db.Estantes.AnyAsync(x => x.IdUsuario == usuario && x.IdLivros == livro))
                db.Estantes.Add(new Estante
                {
                    IdUsuario = usuario,
                    IdLivros = livro,
                    Status = e.Status,
                    DataAtualizacao = agora.AddDays(-e.DiasAtras)
                });
        }
        await db.SaveChangesAsync();
    }
}

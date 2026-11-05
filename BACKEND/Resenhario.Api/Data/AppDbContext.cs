using Microsoft.EntityFrameworkCore;
using Resenhario.Api.Models;

namespace Resenhario.Api.Data
{
    // Ponte entre as classes C# e o banco MySQL (Entity Framework Core).
    // Cada DbSet<T> representa uma tabela: _context.Livros.ToListAsync() vira um SELECT na tabela Livros.
    public class AppDbContext : DbContext
    {
        public AppDbContext(DbContextOptions<AppDbContext> options)
            : base(options)
        {
        }

        public DbSet<Usuario> Usuarios { get; set; } = null!;
        public DbSet<Livro> Livros { get; set; } = null!;
        public DbSet<Filme> Filmes { get; set; } = null!;
        public DbSet<Adaptacao> Adaptacoes { get; set; } = null!;
        public DbSet<Estante> Estantes { get; set; } = null!;
        public DbSet<Review> Reviews { get; set; } = null!;
        public DbSet<Serie> Series { get; set; } = null!;
    }
}

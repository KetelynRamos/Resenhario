# Roteiro da apresentação: Resenhário (5–7 minutos)

Fluxo ao vivo: **login → busca no Google Books → estante → filme no TMDB → vínculo Livro ↔ Filme → resenha com dupla nota → feed → ranking → estatísticas.**

Cada passo tem **o que fazer**, **o que falar** e **o que fazer se der errado**. Os dados digitados ao vivo já estão definidos, para ninguém improvisar.

---

## Antes do dia

### Na véspera (30 min)

- [ ] Rodar a API **com internet e com as chaves do TMDB e do Google Books** (veja o `LEIA-ME.md`, seção 3) e conferir no terminal: `Seed: ... pôster(es) obtidos do TMDB` e `Seed: ... capa(s) obtidas do Google Books`. As imagens ficam salvas no banco.
- [ ] Abrir `http://localhost:5131/api/saude` e conferir `"banco": "conectado"` com o host do **Aiven**.
- [ ] **Preparar o plano B:** em *Livros*, pesquisar `O Pequeno Príncipe` e clicar em **Adicionar ao catálogo**; em *Filmes*, pesquisar `O Pequeno Príncipe` e adicionar o filme de **2015**. **Não vincular** os dois: o vínculo fica para a demo, caso a internet falhe.
- [ ] Conferir que **Coraline** **não** está no catálogo (é o livro do plano A).
- [ ] **Gravar um vídeo de tela** do roteiro inteiro (o Xbox Game Bar do Windows grava com `Win + Alt + R`). É o plano C.
- [ ] Combinar quem fala em cada passo (sugestão na tabela abaixo).

### 30 minutos antes

> **Com o link público** ([`PUBLICAR_ONLINE.md`](PUBLICAR_ONLINE.md)): basta abrir `https://SEU-ENDERECO.onrender.com/api/saude` **5 minutos antes**, porque o plano gratuito "acorda" em cerca de 1 minuto, e deixar a aba aberta. Os itens de terminal abaixo só são necessários para rodar localmente, que vira o **plano B**.

- [ ] Console do Aiven: serviço **Running** (planos gratuitos podem desligar sem uso; se estiver desligado, *Power on* e esperar).
- [ ] `cd BACKEND/Resenhario.Api` e `dotnet run --launch-profile http`; deixar o terminal aberto.
- [ ] `http://localhost:5131/api/saude` → `"banco": "conectado"`.
- [ ] Navegador em **tela cheia** (F11), zoom em 110–125% para o projetor, **sem** outras abas. Deixar abertas só: o site (`http://localhost:5131`) e o Swagger (`/swagger`), numa segunda aba.
- [ ] Sair de qualquer conta logada (menu → *Olá, …* → **Sair da conta**).
- [ ] Celular com **roteador/hotspot** pronto, caso a rede da sala caia.

---

## O roteiro

| Tempo | Passo | Quem fala (sugestão) |
|---|---|---|
| 0:00–0:45 | 1. Abertura na home | Alejandro |
| 0:45–1:15 | 2. Login | Ketelyn |
| 1:15–2:15 | 3. Google Books + estante | Vinicius |
| 2:15–3:15 | 4. TMDB + vínculo Livro ↔ Filme | John |
| 3:15–4:15 | 5. Resenha com dupla nota | Lucas |
| 4:15–5:00 | 6. Feed da comunidade | Matheus |
| 5:00–6:15 | 7. Ranking e estatísticas | Ketelyn |
| 6:15–7:00 | 8. Encerramento | Alejandro |

### 1. Abertura, na página inicial (0:00–0:45)

**Fazer:** mostrar a home sem login. Rolar devagar até "Quem fez jus ao livro?".

**Falar:**
> "Muita gente assiste a um filme sem saber que ele veio de um livro. O Resenhário usa o interesse pelo filme como porta de entrada para a leitura: o filme acabou, a história continua no livro. O card 'Livro vs. Filme' é o nosso diferencial: a nota do livro de um lado, o quanto o filme foi fiel do outro, sempre pela média da comunidade."

### 2. Login (0:45–1:15)

**Fazer:** clicar em **Entrar** → e-mail `ketelyn@resenhario.dev`, senha `Resenhario2026` → **Entrar**. O menu passa a mostrar "Olá, Ketelyn".

**Falar:**
> "A senha nunca é guardada como texto: ela vira um hash com BCrypt. No login, a API devolve um token JWT, e as rotas da estante e das resenhas só aceitam requisições com esse token."

**Se der errado:** "Sessão expirou" → entrar de novo. "Não foi possível falar com o servidor" → o terminal da API foi fechado; rodar `dotnet run --launch-profile http` de novo.

### 3. Busca no Google Books e estante (1:15–2:15)

**Fazer:** menu **Livros** → pesquisar `Coraline Neil Gaiman` → mostrar os cards aparecendo (skeleton enquanto carrega) → no resultado de **Coraline**, clicar em **Adicionar ao catálogo** → rolar até o catálogo e clicar em **＋ Minha estante** no card de Coraline.

**Falar:**
> "A busca passa pelo nosso backend, que chama a Google Books API com o HttpClient criado pelo IHttpClientFactory e converte o JSON em objetos. Se a API do Google estiver fora do ar, o try/catch devolve uma mensagem amigável e a tela não quebra."

**Se der errado** (erro 429 ou sem internet): aparece a mensagem de erro na tela, e isso já demonstra o tratamento de falha. Falar: *"a API externa caiu, e a tela continua funcionando"*. Seguir com **O Pequeno Príncipe**, que já está no catálogo (plano B).

### 4. Filme no TMDB e vínculo Livro ↔ Filme (2:15–3:15)

**Fazer:** menu **Filmes** → pesquisar `Coraline` → no filme de **2009** (Henry Selick), clicar em **Adicionar ao catálogo** → em **Ligar livro e adaptação**, escolher Livro **Coraline** e Filme **Coraline (2009)** → **Vincular**. O novo card "Livro vs. Filme" aparece em *Adaptações vinculadas*.

**Falar:**
> "O TMDB nos dá o pôster e o diretor. O token do TMDB fica só no servidor, guardado com user-secrets, fora do GitHub. A tabela Adaptacoes liga um livro a um filme, e um mesmo livro pode ter várias adaptações, como Duna, que tem a versão de 1984 e a de 2021."

**Se der errado:** TMDB fora → vincular **O Pequeno Príncipe** ao filme de 2015 já salvo (plano B). Se nem isso: mostrar o card de **Duna** já vinculado e seguir.

### 5. Resenha com dupla nota (3:15–4:15)

**Fazer:** menu **Resenhar** → Livro **Coraline** → **5 estrelas** → "Viu alguma adaptação?" **Coraline** → aparece a caixa de fidelidade → **4 estrelas** → texto:
> *O livro é mais assustador e a Coraline é mais sozinha; o filme criou o Wybie, mas manteve o clima e a Outra Mãe. Vale ler depois de assistir.*

→ **Publicar resenha**.

**Falar:**
> "Essa é a avaliação dupla do escopo: uma nota para a qualidade do livro e outra para a fidelidade do filme. A API valida as duas notas entre 1 e 5 com Data Annotations: se alguém mandar 7 pelo Swagger, recebe 400 Bad Request."

**Se der errado:** mensagem de validação → conferir se as estrelas foram marcadas. Plano B: resenhar **O Pequeno Príncipe**.

### 6. Feed da comunidade (4:15–5:00)

**Fazer:** menu **Feed**: a resenha da Ketelyn aparece no topo, "agora mesmo", com o selo **"✨ Primeira resenha deste livro na comunidade"**. Rolar até a resenha do **John sobre Duna (1984)**.

**Falar:**
> "O feed mostra as últimas resenhas com a nota do livro, a fidelidade do filme e um comparativo entre leitores: o John deu 4 para Duna, e a média da comunidade é 4,7, então ele gostou menos que a média. É o comparativo entre leitores que o escopo pede."

### 7. Ranking e estatísticas (5:00–6:15)

**Fazer:** menu **Ranking** → mostrar o pódio (**Ainda Estou Aqui** em 1º) → depois **Minha estante** → mostrar os números e os dois gráficos → trocar o status de um livro (ex.: *Me Chame Pelo Seu Nome* de **Lendo** para **Lido**) e mostrar o gráfico atualizando → clicar no filtro **Lido**.

**Falar:**
> "O ranking é calculado no banco com a média das notas de fidelidade. Para evitar que um filme com uma única nota fique em primeiro, só entram adaptações com pelo menos duas avaliações; por isso Coraline, que acabou de receber a primeira nota, ainda não aparece aqui. Na estante, o PUT atualiza o status e a API responde 204 No Content, e os gráficos são feitos com Chart.js."

### 8. Encerramento (6:15–7:00)

**Fazer (se sobrar tempo):** mostrar a aba do **Swagger** com as rotas da API.

**Falar:**
> "O sistema é uma API REST em ASP.NET Core com .NET 10, Entity Framework Core e MySQL na nuvem, com front em HTML, CSS e JavaScript consumindo a API por fetch. Tudo que mostramos está documentado no repositório. Obrigado!"

---

## Plano B: se algo falhar

| Problema | O que fazer |
|---|---|
| **Sem internet na sala** | 1) Hotspot do celular. 2) Sem internet de jeito nenhum: trocar para o **banco local** (abaixo) e pular as buscas, usando **O Pequeno Príncipe** (já no catálogo) para o vínculo e a resenha. As capas viram placeholders desenhados, e o site continua funcionando. |
| **Google Books com erro (429) ou fora** | A mensagem amigável aparece: aproveitar para falar do `try/catch`. Seguir com O Pequeno Príncipe. |
| **TMDB fora** | Mesmo procedimento: vincular O Pequeno Príncipe ao filme de 2015 já salvo. |
| **Banco do Aiven não responde** (`/api/saude` com "sem conexão") | Ver o `motivo`. Serviço desligado → *Power on* no console do Aiven (leva alguns minutos). Sem tempo: trocar para o banco local. |
| **API não sobe** | Conferir `dotnet --version` (precisa ser 10.x) e usar `dotnet run --launch-profile http`. |
| **Gráficos não aparecem** | Ctrl+F5 (o Chart.js tem cópia local em `wwwroot/lib`). |
| **Nada funciona** | Plano C: passar o **vídeo gravado na véspera** e narrar por cima. |

### Trocar para o banco local (2 minutos)

Pré-requisito (fazer na véspera): MySQL local com os scripts `01`, `05`, `08` e `09` rodados e a API iniciada uma vez apontando para ele, para o seed preencher os dados.

```powershell
cd BACKEND/Resenhario.Api
dotnet user-secrets set "ConnectionStrings:DefaultConnection" "server=localhost;port=3306;database=resenhario_db;user=root;password=SUA_SENHA;"
dotnet run --launch-profile http
```

Depois da apresentação, volte a string de conexão para a do Aiven.

---

## Perguntas rápidas que podem surgir durante a demo

- **"E se eu chamar o DELETE pelo Swagger sem login?"** → 401 Unauthorized: as rotas de escrita têm `[Authorize]`.
- **"E se o TMDB cair?"** → o `try/catch` captura a `HttpRequestException` e a API responde 502 com mensagem; a tela mostra o aviso e o resto do site continua.
- **"De onde vêm os dados?"** → Do *seed* (`Data/SeedData.cs`), que popula o banco sem duplicar registros, e das buscas reais no Google Books e no TMDB.

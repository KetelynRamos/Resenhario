# Publicar o Resenhário com um link público (Render)

Objetivo: ter um endereço como **`https://resenhario.onrender.com`** que abre o site em qualquer computador ou celular, sem rodar nada na máquina da apresentação.

**Como funciona:** o Render (serviço de hospedagem com plano gratuito) baixa o código do GitHub, monta o projeto usando o `Dockerfile` que está na raiz do repositório e deixa a API (que também serve as páginas) no ar. O banco continua sendo o **MySQL do Aiven**.

```
navegador ──► Render (API + site, plano Free) ──► Aiven (MySQL)
                     └──► TMDB e Google Books
```

Tempo total: uns 20 minutos, a maior parte esperando o primeiro build.

---

## Antes de começar

- [ ] O código desta versão está na branch **`main`** do GitHub (Pull Request mesclado).
- [ ] O banco do **Aiven já está populado**: você rodou a API localmente apontando para o Aiven e o `/api/saude` mostrou `"livros": 20`. Se também rodou com as chaves do TMDB e do Google, as capas e os pôsteres já estão salvos no banco.
- [ ] Você tem em mãos: os dados de conexão do Aiven (host, porta, senha), o token do TMDB e a chave do Google Books.

## Passo 1: gerar uma chave JWT para o servidor

Fora do modo de desenvolvimento, a API **exige** uma chave secreta própria para assinar os logins. Gere uma no PowerShell:

```powershell
[guid]::NewGuid().ToString("N") + [guid]::NewGuid().ToString("N")
```

Copie o resultado (64 letras e números). Ele vai na variável `Jwt__Key` do Passo 3. Não reutilize a chave de desenvolvimento.

## Passo 2: criar o serviço no Render

1. Entre em **render.com** → **Get Started** → **GitHub**. Use a conta que tem acesso ao repositório `KetelynRamos/resenhario`.
2. No painel, clique em **+ New** → **Web Service**.
3. Em *Connect a repository*, escolha **KetelynRamos/resenhario**. Se ele não aparecer, clique em **Configure account** / *Configure GitHub App* e libere o acesso do Render a esse repositório.
4. Preencha:

| Campo | Valor |
|---|---|
| **Name** | `resenhario` (vira o endereço `resenhario.onrender.com`; se o nome já existir, o Render acrescenta um sufixo) |
| **Language** / Runtime | **Docker** |
| **Branch** | `main` |
| **Region** | A mais próxima da região do serviço no Aiven (veja no console do Aiven, em *Cloud*). Ex.: Aiven em `us-east` → Render **Ohio** ou **Virginia (US East)** |
| **Root Directory** | deixe em branco |
| **Dockerfile Path** | `./Dockerfile` (padrão) |
| **Instance Type** | **Free** |

## Passo 3: variáveis de ambiente (os segredos)

Ainda nessa tela, em **Environment Variables**, clique em **+ Add Environment Variable** para cada linha. No Render, **não use aspas**: cole só o valor.

| NAME | VALUE |
|---|---|
| `ConnectionStrings__DefaultConnection` | `server=HOST;port=PORTA;database=resenhario_db;user=avnadmin;password=SENHA;SslMode=Required;` |
| `Jwt__Key` | a chave gerada no Passo 1 |
| `Tmdb__ReadAccessToken` | o token longo do TMDB (`eyJ...`) |
| `GoogleBooks__ApiKey` | a chave do Google (`AIza...`) |
| `Seed__Habilitado` | `false` (o banco já está populado; deixa o site acordar mais rápido) |
| `Swagger__Habilitado` | `true` (mostra a API em `/swagger` na defesa) |

Os dois sublinhados (`__`) são de propósito: é assim que o .NET lê `ConnectionStrings:DefaultConnection` a partir de uma variável de ambiente.

Esses valores ficam guardados no Render, **não no GitHub**, pela mesma lógica do `user-secrets`.

## Passo 4: publicar

1. Clique em **Deploy Web Service** (ou *Create Web Service*).
2. Acompanhe a aba **Logs**. O primeiro build leva de **5 a 10 minutos**, porque baixa o .NET e compila o projeto.
3. Quando aparecer **"Your service is live 🎉"** e, nos logs, `Now listening on: http://0.0.0.0:...` e `Hosting environment: Production`, está no ar.
4. O endereço aparece no topo da página do serviço, por exemplo `https://resenhario.onrender.com`.

## Passo 5: conferir

| Abrir | Deve aparecer |
|---|---|
| `https://SEU-ENDERECO.onrender.com/api/saude` | `"banco": "conectado"`, `"livros": 20` |
| `https://SEU-ENDERECO.onrender.com` | A home com o hero e os cards |
| `https://SEU-ENDERECO.onrender.com/paginas/login.html` | Login com `ketelyn@resenhario.dev` / `Resenhario2026` |
| `https://SEU-ENDERECO.onrender.com/swagger` | As rotas da API |

Esse é o **link público para a entrega**. Coloque-o no `LEIA-ME.md` e na documentação final.

---

## Importante sobre o plano gratuito

- **O site "dorme" depois de cerca de 15 minutos sem acesso.** A primeira visita depois disso leva **cerca de 1 minuto** para acordar (aparece uma tela de carregamento do Render). Depois fica rápido.
- **No dia da apresentação:** abra o link e o `/api/saude` **uns 5 minutos antes** e deixe a aba aberta. Confira também se o serviço do **Aiven** está *Running*.
- **Atualizações:** cada vez que algo entrar na `main` do GitHub, o Render publica de novo sozinho (*Auto-Deploy*), levando uns minutos.
- **A conta Free tem um limite de horas por mês.** Para um projeto acadêmico, sobra.

## Se algo der errado

| Sintoma | O que fazer |
|---|---|
| Build falha nos logs | Confira se o *Dockerfile Path* é `./Dockerfile` e a branch é `main`. Copie a mensagem de erro dos logs para investigar. |
| Logs mostram `Configure Jwt:Key com pelo menos 32 bytes` | Falta a variável `Jwt__Key`, ou ela está curta. Gere de novo (Passo 1), salve em **Environment** e clique em **Manual Deploy → Deploy latest commit**. |
| `/api/saude` mostra `"sem conexão"` | Revise a `ConnectionStrings__DefaultConnection` (host, porta, senha, `SslMode=Required`). Veja se o Aiven está *Running*. Se vocês restringiram IPs no Aiven (*Allowed IP addresses*), libere `0.0.0.0/0`. |
| Site abre, mas sem livros | O banco do Aiven está vazio. Defina `Seed__Habilitado` = `true`, publique uma vez, confira o `/api/saude` e volte para `false`. |
| Busca de filmes diz "TMDB não configurado" | Falta `Tmdb__ReadAccessToken` (o token **longo**). |
| Demora para abrir | É o plano gratuito acordando (veja acima). Espere cerca de 1 minuto. |

Depois de mudar qualquer variável no Render, ele reinicia o serviço sozinho. Se não reiniciar, use **Manual Deploy → Deploy latest commit**.

## Alternativa: Azure App Service (Azure for Students)

Se a equipe preferir um serviço da Microsoft: o **Azure for Students** dá créditos sem cartão com o e-mail da universidade, e o App Service roda ASP.NET Core direto, sem Docker. As variáveis são as mesmas da tabela do Passo 3, cadastradas em *Configuration → Application settings*. O Render foi escolhido aqui por ser mais simples de configurar a partir do GitHub.

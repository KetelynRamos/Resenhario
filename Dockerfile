# Imagem do Resenhário para publicar na nuvem (ex.: Render).
# Etapa 1 (build): usa o SDK do .NET 10 para compilar e publicar o projeto.
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
# Copia primeiro só o .csproj: assim o "restore" (download dos pacotes) fica em cache
# e não roda de novo quando só o código muda.
COPY BACKEND/Resenhario.Api/Resenhario.Api.csproj BACKEND/Resenhario.Api/
RUN dotnet restore BACKEND/Resenhario.Api/Resenhario.Api.csproj
COPY BACKEND/Resenhario.Api/ BACKEND/Resenhario.Api/
RUN dotnet publish BACKEND/Resenhario.Api/Resenhario.Api.csproj -c Release -o /app --no-restore

# Etapa 2 (execução): imagem menor, só com o runtime do ASP.NET e o resultado do publish.
FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app
COPY --from=build /app .
ENV ASPNETCORE_ENVIRONMENT=Production
EXPOSE 8080
# O serviço de hospedagem informa a porta na variável PORT; sem ela, usa 8080.
# Segredos (banco, Jwt:Key, TMDB, Google Books) entram como variáveis de ambiente no painel do serviço.
CMD ["sh", "-c", "dotnet Resenhario.Api.dll --urls http://0.0.0.0:${PORT:-8080}"]

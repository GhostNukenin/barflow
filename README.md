# BarFlow · Bahia Resenha & Bar

Sistema web de pedidos que liga o garçom à cozinha em tempo real, sem papel.

- **Frontend:** Angular 22 (`frontend/`)
- **Backend:** ASP.NET Core 10 + EF Core + SignalR (`backend/BarFlow.Api/`)
- **Banco:** PostgreSQL 17 em Docker (`docker-compose.yml`)

## Como rodar

Pré-requisitos: Docker Desktop, .NET SDK 10 e Node 22+.

### Jeito rápido (uma janela só)

```powershell
.\iniciar.ps1
```

O script sobe o Postgres, compila o Angular para dentro da API e inicia a API.
Depois é só abrir **http://localhost:5204**. Celulares e tablets na mesma rede usam
`http://IP-DO-COMPUTADOR:5204` (o script mostra o endereço).

Na **primeira execução** o script cria dois arquivos locais com senhas e chave aleatórias
e mostra no terminal a **senha inicial dos usuários**:

| Arquivo (não versionado) | Conteúdo | Modelo |
|---|---|---|
| `.env` | senha do PostgreSQL | `.env.example` |
| `backend/BarFlow.Api/appsettings.Local.json` | conexão com o banco, `Jwt:Key`, senha inicial dos usuários | `appsettings.Local.example.json` |

Esses arquivos estão no `.gitignore`: **nenhuma senha ou chave fica no repositório.**
Em produção, os mesmos valores podem vir de variáveis de ambiente
(`ConnectionStrings__Default`, `Jwt__Key`, `Seed__DefaultPassword`).

### Modo desenvolvimento (com recarregamento automático)

Rode o `iniciar.ps1` uma vez para gerar os arquivos de segredos (ou crie-os a partir dos modelos). Depois:

```powershell
docker compose up -d                                   # banco
cd backend\BarFlow.Api; dotnet watch run               # API em http://localhost:5204
cd frontend; npm start                                 # Angular em http://localhost:4200
```

O Angular repassa `/api` e `/hubs` para a API (`frontend/proxy.conf.json`).
Para testar no celular durante o desenvolvimento: `npm run start:lan` e abra `http://IP:4200`.

Na primeira execução a API cria as tabelas (migrations) e o cardápio de exemplo.

## Usuários iniciais

Todos começam com a mesma senha, a de `Seed:DefaultPassword` em `appsettings.Local.json`
(gerada e exibida pelo `iniciar.ps1` na primeira execução).
**Troque as senhas em Gestão → Usuários antes de usar no bar.**

| Login     | Perfil  | O que faz |
|-----------|---------|-----------|
| `garcom`  | Garçom  | Escolhe a mesa, monta o pedido, envia, acompanha e marca entregue |
| `cozinha` | Cozinha | Quadro com Novos / Em preparo / Prontos, cronômetro e alerta sonoro |
| `caixa`   | Caixa   | Contas por mesa, taxa de serviço, registro de pagamento |
| `gestor`  | Gestor  | Tudo acima + indicadores, cardápio, histórico, usuários e configurações |

## Fluxo

1. **Garçom** escolhe a mesa, toca nos produtos, adiciona observações e envia.
2. A **cozinha** recebe na hora (SignalR), com aviso sonoro, e a tela confirma o recebimento ao servidor.
3. A cozinha marca **Em preparo** e depois **Pronto**; o garçom recebe aviso (som + vibração) e marca **Entregue**.
4. O **caixa** vê a conta consolidada da mesa e registra o pagamento (Pix, crédito, débito, dinheiro).

## Indicador principal

**Tempo entre o garçom enviar o pedido e ele aparecer na tela da cozinha.**

Cada pedido guarda os horários de cada etapa:

| Campo | Momento |
|-------|---------|
| `StartedAt` | garçom começou a montar o pedido (escolheu a mesa) |
| `CreatedAt` | servidor recebeu o pedido (garçom tocou em "Enviar") |
| `KitchenReceivedAt` | uma tela da cozinha confirmou que o pedido apareceu |
| `PreparationStartedAt` / `ReadyAt` / `DeliveredAt` | demais etapas |

Em **Gestão → Indicadores**, o tempo médio é comparado com a referência do processo
antigo no papel, configurável em **Gestão → Configurações** (padrão: 3 min). Cronometre
alguns pedidos no papel antes de implantar para ter uma comparação real.

Obs.: se nenhuma tela da cozinha estiver aberta, o pedido só conta como "chegou" quando
alguém abrir a tela. Isso é proposital, porque mede quando a cozinha de fato viu o pedido.

## Estrutura

```
backend/BarFlow.Api/
  Controllers/   Auth, Users, Categories/Products, Orders, Cashier, Reports, Settings
  Hubs/          OrdersHub (tempo real) + OrderNotifier
  Domain/        Entidades e enums
  Data/          DbContext, Seed, Migrations
frontend/src/app/
  core/          API, autenticação, SignalR, formatação
  layout/        Cabeçalho com navegação por perfil
  pages/         login, garcom, cozinha, caixa, gestor/*
```

## Banco de dados

- Conexão em `backend/BarFlow.Api/appsettings.Local.json` (porta **5433** no host, para não conflitar com outro Postgres).
- Nova migration depois de mudar entidades:
  `cd backend; dotnet dotnet-ef migrations add NomeDaMudanca --project BarFlow.Api -o Data/Migrations`
- Zerar tudo (apaga os dados!): `docker compose down -v`

## Antes de colocar em produção

- Trocar as senhas dos usuários em Gestão → Usuários.
- Guardar uma cópia segura do `.env` e do `appsettings.Local.json`: sem eles a API não conecta no banco.
- Liberar a porta 5204 no firewall do Windows para os aparelhos da rede acessarem.

## Próximos passos sugeridos

- Separar setores (bar × cozinha) por categoria, cada um com sua tela.
- Impressão de comanda na cozinha.
- Multi-bar (coluna `BarId` nas tabelas + login por estabelecimento).
- PWA instalável no celular do garçom.

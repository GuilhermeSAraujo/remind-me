# 🤖 Remind Me Bot

Bot de lembretes via WhatsApp com inteligência artificial para processamento de linguagem natural.

## 📋 Sobre o Projeto

Sistema de lembretes que permite aos usuários criarem, listarem e deletarem lembretes através de mensagens naturais no WhatsApp. Utiliza Google Gemini AI para entender as intenções do usuário e extrair informações de data/hora.

### ✨ Funcionalidades

- ✅ **Criar lembretes** com linguagem natural
- 📋 **Listar lembretes** pendentes
- 🗑️ **Deletar lembretes** específicos
- 🔄 **Lembretes recorrentes** (diário, semanal, mensal, anual)
- 🤖 **IA para processamento** de mensagens
- ⚡ **Rate limiting** inteligente (free/premium)
- 🎯 **Sistema de usuários** com planos

## 🏗️ Arquitetura

O projeto segue uma **Feature-Based Architecture** com separação clara de responsabilidades:

```
src/
├── config/          # Configurações (env, database)
├── domain/          # Lógica de negócio (reminders, users)
├── integrations/    # Integrações externas (whatsapp, ai)
├── api/             # Camada HTTP (middlewares)
├── services/        # Serviços transversais (rate-limiter)
├── jobs/            # Cron jobs (scheduler)
└── shared/          # Código compartilhado (utils)
```

📖 **Documentação completa:**
- [ARCHITECTURE.md](./ARCHITECTURE.md) - Arquitetura detalhada
- [STRUCTURE.md](./STRUCTURE.md) - Estrutura visual e fluxos
- [MIGRATION.md](./MIGRATION.md) - Guia de migração

## 🚀 Como Usar

### Pré-requisitos

- Node.js 20+
- MongoDB
- WPPConnect API rodando
- Google Gemini API Key

### Instalação

```bash
# Clone o repositório
git clone <repo-url>
cd remind-me

# Instale as dependências
npm install

# Configure as variáveis de ambiente
cp .env.example .env
# Edite o .env com suas credenciais
```

### Variáveis de Ambiente

```env
SECRET_KEY=sua-chave-secreta
MONGODB_URI=mongodb://localhost:27017/remind-me
GOOGLE_API_KEY=sua-api-key-do-gemini
WPPCONNECT_API_URL=http://localhost:21465
PORT=3030

# Teste Local (opcional - apenas para desenvolvimento)
LOCAL_TEST_MODE=true
LOCAL_TEST_GROUP_ID=120363422632897939@g.us
```

#### Modo de Teste Local

Para testar o bot localmente sem impactar usuários em produção, você pode habilitar o modo de teste:

1. **LOCAL_TEST_MODE**: Define se o bot deve responder apenas a um grupo específico
   - `true`: Ativa o modo de teste (apenas processa mensagens do grupo especificado)
   - `false` ou ausente: Processa todas as mensagens normalmente

2. **LOCAL_TEST_GROUP_ID**: ID do grupo de teste do WhatsApp
   - Formato: `120363422632897939@g.us`
   - Para obter o ID do grupo: use ferramentas de debug do WhatsApp ou logs do bot

**⚠️ Importante**: Em produção, certifique-se de que `LOCAL_TEST_MODE` está definido como `false` ou não está presente no `.env`.

### Desenvolvimento

```bash
npm run dev
```

### Produção

```bash
# Build
npm run build

# Start
npm start
```

### Docker

```bash
docker-compose up -d
```

## 💬 Como Usar o Bot

### Criar Lembrete

Envie mensagens naturais como:
- "Me lembre de tomar creatina todo dia às 9h"
- "Lembrete para comprar pão às 14h"
- "Agende reunião amanhã 15:30"

### Listar Lembretes

Envie:
- "Listar lembretes"
- "Mostrar meus lembretes"
- "Ver lembretes"

### Deletar Lembrete

Responda a mensagem do lembrete com:
- "Apagar"
- "Deletar"
- "Remover"

## 🛠️ Tecnologias

- **Runtime**: Node.js + TypeScript
- **Framework HTTP**: Hono
- **Database**: MongoDB + Mongoose
- **AI**: Google Gemini 2.5 Flash-Lite
- **WhatsApp**: WPPConnect
- **Cron**: node-cron
- **Validação**: Zod (@t3-oss/env-core)

## 📊 Estrutura de Dados

### User
```typescript
{
  phoneNumber: string;
  name: string;
  isPremium: boolean;
  premiumExpiresAt?: Date;
  aiUsage: {
    tokens: Array<{
      timestamp: Date;
      count: number;
      operation: 'classify' | 'extract';
    }>;
  };
}
```

### Reminder
```typescript
{
  userPhoneNumber: string;
  title: string;
  scheduledTime: Date;
  messageId: string;
  recurrence_type: "daily" | "weekly" | "monthly" | "yearly" | "none";
  recurrence_interval: number;
  status: "pending" | "sent" | "cancelled";
}
```

## 🔒 Rate Limiting

### Usuários Free
- 5 requisições de IA por 24h
- Máximo 5 lembretes pendentes
- Janela deslizante de 24h

### Usuários Premium
- Requisições ilimitadas
- Lembretes ilimitados
- Sem restrições

## 📈 Melhorias Futuras

- [ ] Testes unitários e integração
- [ ] Path aliases no TypeScript
- [ ] Logging estruturado (Winston/Pino)
- [ ] Health checks e métricas
- [ ] Suporte a múltiplos idiomas
- [ ] Interface web para gerenciamento
- [ ] Notificações push
- [ ] Integração com calendários

## 🤝 Contribuindo

1. Fork o projeto
2. Crie uma branch (`git checkout -b feature/amazing-feature`)
3. Commit suas mudanças (`git commit -m 'Add amazing feature'`)
4. Push para a branch (`git push origin feature/amazing-feature`)
5. Abra um Pull Request

## 📝 Scripts Disponíveis

```bash
npm run dev          # Desenvolvimento com hot reload
npm run build        # Build para produção
npm start            # Inicia servidor em produção
npm test             # Executa testes (TODO)
```

## 📄 Licença

ISC

## 👤 Autor

**GuilhermeSAraujo**

---

⭐ Se este projeto te ajudou, considere dar uma estrela!


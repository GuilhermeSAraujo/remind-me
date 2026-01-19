#!/bin/bash

# Script para restart apenas do remind-bot-api
# Uso: ./restart-bot.sh

set -e  # Para execução se houver erro

echo "=========================================="
echo "🤖 RESTART DO REMIND-BOT-API"
echo "=========================================="
echo ""

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Função para printar com cor
print_step() {
    echo -e "${BLUE}➜${NC} $1"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

# 1. Para apenas o remind-bot-api
print_step "Parando remind-bot-api..."
sudo docker compose stop remind-bot-api
print_success "Bot parado"

# 2. Remove o container
print_step "Removendo container..."
sudo docker compose rm -f remind-bot-api
print_success "Container removido"

# 3. Remove a imagem antiga
print_step "Removendo imagem antiga..."
sudo docker rmi remind-me-remind-bot-api 2>/dev/null || true
print_success "Imagem removida"

# 4. Git pull
print_step "Atualizando código do repositório..."
git fetch --all
CURRENT_BRANCH=$(git branch --show-current)
print_warning "Branch atual: $CURRENT_BRANCH"

# Force update: discard local changes and match remote
git reset --hard origin/$CURRENT_BRANCH
print_success "Código atualizado"

# 5. Limpa cache do Node.js
print_step "Limpando cache do Node.js..."
# rm -rf node_modules
rm -rf dist
print_success "Cache limpo"

# 6. Reinstala dependências
# print_step "Reinstalando dependências..."
# npm install
# print_success "Dependências instaladas"

# 7. Rebuild apenas o remind-bot-api
print_step "Rebuilding remind-bot-api..."
sudo docker compose build --no-cache remind-bot-api
print_success "Build completo"

# 8. Inicia apenas o remind-bot-api
print_step "Iniciando remind-bot-api..."
sudo docker compose up -d remind-bot-api
print_success "Bot iniciado"

echo ""
echo "=========================================="
echo -e "${GREEN}✓ RESTART DO BOT FINALIZADO!${NC}"
echo "=========================================="
echo ""

# Mostra status dos containers
print_step "Status dos containers:"
sudo docker compose ps

echo ""
print_warning "Próximos passos:"
echo "  1. Verifique os logs: sudo docker compose logs -f remind-bot-api"
echo "  2. O wpp-interface-api permaneceu rodando normalmente"
echo ""


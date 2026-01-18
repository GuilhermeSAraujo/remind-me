#!/bin/bash

# Script para restart completo do sistema
# Uso: ./restart-fresh.sh

set -e  # Para execução se houver erro

echo "=========================================="
echo "🔄 RESTART COMPLETO DO SISTEMA"
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

# 1. Para todos os containers
print_step "Parando todos os containers..."
docker-compose down 2>/dev/null || true
print_success "Containers parados"

# 2. Remove containers órfãos
print_step "Removendo containers órfãos..."
docker-compose rm -f 2>/dev/null || true
print_success "Containers removidos"

# 3. Remove imagens relacionadas
print_step "Removendo imagens Docker antigas..."
sudo docker rmi remind-bot-api wpp-interface-api 2>/dev/null || true
sudo docker rmi $(sudo docker images -f "dangling=true" -q) 2>/dev/null || true
print_success "Imagens removidas"

# 4. Limpa volumes não utilizados
print_step "Limpando volumes não utilizados..."
sudo docker volume prune -f
print_success "Volumes limpos"

# 5. Git pull
print_step "Atualizando código do repositório..."
git fetch --all
CURRENT_BRANCH=$(git branch --show-current)
print_warning "Branch atual: $CURRENT_BRANCH"

# Verifica se há mudanças locais
if [[ -n $(git status -s) ]]; then
    print_warning "Há mudanças locais não commitadas!"
    read -p "Deseja fazer stash das mudanças? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        git stash
        print_success "Mudanças em stash"
    fi
fi

git pull origin $CURRENT_BRANCH
print_success "Código atualizado"

# 6. Limpa node_modules e dist
print_step "Limpando cache do Node.js..."
rm -rf node_modules
rm -rf dist
print_success "Cache do Node limpo"

# 7. Reinstala dependências
print_step "Reinstalando dependências..."
npm install
print_success "Dependências instaladas"

# 8. Limpa tokens do WhatsApp (fresh start total)
print_step "Limpando tokens do WhatsApp..."
if [ -d "../wpp-interface-api/wppconnect_tokens" ]; then
    rm -rf ../wpp-interface-api/wppconnect_tokens/*
    print_success "Tokens do WhatsApp removidos"
    print_warning "Você precisará escanear o QR code novamente!"
else
    print_warning "Diretório de tokens não encontrado, pulando..."
fi

# 9. Rebuild completo
print_step "Rebuilding containers..."
sudo docker-compose build --no-cache
print_success "Build completo"

# 10. Inicia tudo
print_step "Iniciando containers..."
sudo docker-compose up -d
print_success "Containers iniciados"

echo ""
echo "=========================================="
echo -e "${GREEN}✓ RESTART COMPLETO FINALIZADO!${NC}"
echo "=========================================="
echo ""

# Mostra status dos containers
print_step "Status dos containers:"
sudo docker-compose ps

echo ""
print_warning "Próximos passos:"
echo "  1. Aguarde alguns segundos para os containers iniciarem"
echo "  2. Escaneie o QR code do WhatsApp"
echo "  3. Verifique os logs: docker-compose logs -f"
echo ""


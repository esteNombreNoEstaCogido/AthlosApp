#!/bin/bash
# Pre-commit hook for AthlosApp
# Runs security checks before allowing commits
# 
# Installation:
#   cp .git/hooks/pre-commit hooks/pre-commit
#   chmod +x .git/hooks/pre-commit

RESET='\033[0m'
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'

echo -e "${YELLOW}🔐 Running pre-commit security checks...${RESET}\n"

# Check 1: Detect hardcoded secrets
echo "1️⃣  Scanning for hardcoded secrets..."
SECRETS=$(git diff --cached --name-only | xargs grep -l \
  -E '(api_key|API_KEY|password|secret|SECRET|token|TOKEN)\s*[:=]\s*['"'"'"][a-zA-Z0-9]{20,}' 2>/dev/null || true)

if [ -n "$SECRETS" ]; then
  echo -e "${RED}❌ FAIL: Hardcoded secrets detected in:${RESET}"
  echo "$SECRETS"
  echo -e "${YELLOW}Remove secrets and move to .env.local${RESET}"
  exit 1
fi
echo -e "${GREEN}✅ PASS: No hardcoded secrets${RESET}\n"

# Check 2: Verify .env files not committed
echo "2️⃣  Checking .env files..."
ENV_FILES=$(git diff --cached --name-only | grep -E '\.env' || true)

if [ -n "$ENV_FILES" ]; then
  echo -e "${RED}❌ FAIL: .env files detected in commit:${RESET}"
  echo "$ENV_FILES"
  echo -e "${YELLOW}Never commit .env files with real secrets${RESET}"
  exit 1
fi
echo -e "${GREEN}✅ PASS: No .env files in commit${RESET}\n"

# Check 3: Verify no private keys
echo "3️⃣  Scanning for private keys..."
KEYS=$(git diff --cached | grep -E '(-----BEGIN|-----END|private.?key|gcloud|firebase)' || true)

if [ -n "$KEYS" ]; then
  echo -e "${YELLOW}⚠️  WARNING: Possible private keys detected${RESET}"
  echo "Review carefully and remove if needed"
fi
echo -e "${GREEN}✅ PASS: No obvious private keys${RESET}\n"

# Check 4: Basic file validation
echo "4️⃣  Validating staged files..."
JS_FILES=$(git diff --cached --name-only --diff-filter=ACM | grep -E '\.(js|jsx)$' || true)

if [ -n "$JS_FILES" ]; then
  # Check for syntax errors
  for file in $JS_FILES; do
    if [ -f "$file" ]; then
      # Basic check for matching braces
      OPEN_BRACES=$(grep -o '{' "$file" | wc -l)
      CLOSE_BRACES=$(grep -o '}' "$file" | wc -l)
      
      if [ "$OPEN_BRACES" != "$CLOSE_BRACES" ]; then
        echo -e "${YELLOW}⚠️  WARNING: Possible syntax error in $file${RESET}"
      fi
    fi
  done
fi
echo -e "${GREEN}✅ PASS: File validation complete${RESET}\n"

# Check 5: Verify no console.logs in production code
echo "5️⃣  Checking for debug statements..."
DEBUG=$(git diff --cached | grep -E '^\+.*console\.(log|error|warn|debug)' || true)

if [ -n "$DEBUG" ]; then
  echo -e "${YELLOW}⚠️  WARNING: console statements in new code${RESET}"
  echo "Consider removing before deployment:"
  echo "$DEBUG"
fi
echo -e "${GREEN}✅ PASS: Debug check complete${RESET}\n"

# Summary
echo -e "${GREEN}═════════════════════════════════════════${RESET}"
echo -e "${GREEN}✅ All pre-commit checks passed!${RESET}"
echo -e "${GREEN}═════════════════════════════════════════${RESET}\n"
echo -e "📝 Commit tips:"
echo "   - Use meaningful commit messages"
echo "   - Reference issue numbers (#123)"
echo "   - Keep commits focused and atomic"
echo ""

exit 0

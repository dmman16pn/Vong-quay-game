SHELL  := /bin/bash
PATH   := $(HOME)/.npm-global/bin:$(PATH)
URL    := https://vong-quay-game.vercel.app

.PHONY: deploy start db logs status

# ─────────────────────────────────────────────
# Deploy: commit → push GitHub → chờ Vercel xong
# ─────────────────────────────────────────────
deploy:
	@echo "📦 Kiểm tra thay đổi..."
	@git add -A
	@if git diff --staged --quiet; then \
		echo "⚠️  Không có thay đổi mới"; \
	else \
		git commit -m "deploy: $(shell date '+%d/%m/%Y %H:%M')"; \
	fi
	@echo "⬆️  Đang push lên GitHub..."
	@git push origin main
	@echo ""
	@echo "⏳ Đợi Vercel build"
	@sleep 8
	@$(MAKE) --no-print-directory _wait_deploy
	@echo ""
	@echo "✅ Deploy thành công!"
	@echo "🌐 $(URL)"

# Vòng lặp chờ deploy xong (tối đa ~3 phút)
_wait_deploy:
	@for i in $$(seq 1 18); do \
		STATUS=$$(vercel ls vong-quay-game --token "$$(cat ~/.vercel/auth.json 2>/dev/null | python3 -c 'import sys,json; print(json.load(sys.stdin).get("token",""))' 2>/dev/null)" 2>/dev/null | awk 'NR==2{print $$3}'); \
		if [ "$$STATUS" = "READY" ]; then \
			echo "   → Build xong! ($$STATUS)"; exit 0; \
		elif [ "$$STATUS" = "ERROR" ]; then \
			echo "   ❌ Build lỗi! Vào vercel.com để xem log"; exit 1; \
		else \
			printf "   ⏳ Đang build... (%ds)\r" $$((i * 10)); \
			sleep 10; \
		fi \
	done; \
	echo "   ⚠️  Timeout - kiểm tra tại vercel.com"

# Kiểm tra trạng thái deploy mới nhất
status:
	@echo "📊 Deployment gần nhất:"
	@vercel ls vong-quay-game 2>/dev/null | head -5 || echo "Chạy 'make deploy' trước"
	@echo ""
	@echo "🌐 Kiểm tra live:"
	@STATUS=$$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 $(URL)); \
	if [ "$$STATUS" = "200" ] || [ "$$STATUS" = "302" ]; then \
		echo "   ✅ Site đang hoạt động (HTTP $$STATUS)"; \
	else \
		echo "   ❌ Site lỗi (HTTP $$STATUS)"; \
	fi

# Chạy local
start:
	@node server.js

# Khởi động MongoDB Docker
db:
	@echo "🐳 Khởi động MongoDB Docker..."
	@docker compose up -d
	@echo "✅ MongoDB đang chạy tại localhost:27017"

# Xem log MongoDB
logs:
	@docker compose logs -f mongodb

SHELL := /bin/bash
URL   := https://vong-quay-game.vercel.app

.PHONY: deploy start db logs status

# Deploy: commit + push → Vercel tự động build
deploy:
	@git add -A
	@if git diff --staged --quiet; then \
		echo "⚠️  Không có thay đổi mới"; \
	else \
		git commit -m "deploy: $(shell date '+%d/%m/%Y %H:%M')"; \
		echo "✅ Đã commit"; \
	fi
	@git push origin main
	@echo "🚀 Đã push! Vercel đang build tự động (~30 giây)"
	@echo "🌐 $(URL)"

# Kiểm tra site có hoạt động không
status:
	@STATUS=$$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 $(URL)); \
	if [ "$$STATUS" = "200" ] || [ "$$STATUS" = "302" ]; then \
		echo "✅ Site đang hoạt động (HTTP $$STATUS)"; \
	else \
		echo "❌ Site lỗi (HTTP $$STATUS)"; \
	fi

# Chạy local
start:
	@node server.js

# Khởi động MongoDB Docker
db:
	@docker compose up -d && echo "✅ MongoDB đang chạy tại localhost:27017"

# Xem log MongoDB
logs:
	@docker compose logs -f mongodb

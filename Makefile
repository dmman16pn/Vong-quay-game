.PHONY: deploy start db logs

# Deploy: commit + push GitHub → Vercel tự động deploy
deploy:
	@echo "📦 Kiểm tra thay đổi..."
	@git add -A
	@if git diff --staged --quiet; then \
		echo "⚠️  Không có thay đổi mới, vẫn push lên Vercel..."; \
	else \
		git commit -m "deploy: $(shell date '+%d/%m/%Y %H:%M')"; \
	fi
	@git push origin main
	@echo ""
	@echo "✅ Đã push lên GitHub!"
	@echo "🚀 Vercel đang deploy tự động..."
	@echo "🌐 https://vong-quay-game.vercel.app"

# Chạy local (cần Docker DB đang chạy)
start:
	@node server.js

# Khởi động MongoDB local bằng Docker
db:
	@echo "🐳 Khởi động MongoDB Docker..."
	@docker compose up -d
	@echo "✅ MongoDB đang chạy tại localhost:27017"

# Xem log MongoDB
logs:
	@docker compose logs -f mongodb

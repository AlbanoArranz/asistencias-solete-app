.PHONY: dev backend-install backend-run mobile-install mobile-start smoke demo-seed

dev:
	./scripts/dev.sh

backend-install:
	cd backend && python3 -m venv .venv && . .venv/bin/activate && pip install -r requirements.txt

backend-run:
	cd backend && . .venv/bin/activate && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

mobile-install:
	cd mobile && npm install

mobile-start:
	cd mobile && npx expo start

smoke:
	./scripts/smoke.sh

demo-seed:
	./scripts/demo-seed.sh

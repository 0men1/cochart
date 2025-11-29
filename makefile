.PHONY: dev build

dev:
	docker-compose up --build

test:
	cd apps/server && go test ./...
	cd apps/web && npm test

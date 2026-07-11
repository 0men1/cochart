.PHONY: dev build test

dev:
	docker-compose up --build

test:
	cd apps/web && npm test

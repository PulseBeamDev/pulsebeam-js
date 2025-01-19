.PHONY: e2e

install:
	npm install

test:
	$(MAKE) -C peer
	npm run build -w peer
	npx playwright test --project=local

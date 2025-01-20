.PHONY: e2e

bump:
	$(MAKE) -C peer bump VERSION=$(VERSION)

install:
	npm install
	npx playwright install-deps
	npx playwright install

test:
	$(MAKE) -C peer
	npm run build -w peer
	npx playwright test --project=local

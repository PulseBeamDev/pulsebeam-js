.PHONY: e2e

bump:
	$(MAKE) -C peer bump

install:
	npm install

test:
	$(MAKE) -C peer
	npm run build -w peer
	npx playwright test --project=local

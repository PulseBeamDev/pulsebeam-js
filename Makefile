.PHONY: e2e

install:
	npm install

test:
	$(MAKE) -C peer
	npx playwright test --project=local

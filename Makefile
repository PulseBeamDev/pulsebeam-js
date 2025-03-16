.PHONY: e2e

ci:
	npm ci

bump:
	$(MAKE) -C peer bump VERSION=$(VERSION)

publish:
	$(MAKE) -C peer publish

install:
	npm install
	npx playwright install-deps
	npx playwright install

test:
	$(MAKE) -C peer test
	npm run build -w peer
	npx playwright test --project=local -j 1
	
test-flaky:
	make test
	npx playwright test --project=local --repeat-each 15 -j 1

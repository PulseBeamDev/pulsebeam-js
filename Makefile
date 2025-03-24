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

test-local:
	PULSEBEAM_BASE_URL=http://localhost:3000 npx playwright test --project=local -j 2

test-flaky:
	for i in `seq 100`; do echo $i; make test-local || break; done

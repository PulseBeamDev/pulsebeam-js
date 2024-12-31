.PHONY: e2e

install:
	npm install

e2e:
	npx playwright test --project=local

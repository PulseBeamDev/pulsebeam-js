.PHONY: e2e

install:
	npm install
	npm run build -w @pulsebeam/peer
	npm run build -w @pulsebeam/demo-react

e2e:
	npx playwright test --project=local

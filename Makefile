.PHONY: e2e

install:
	npm install
	npm run build -w @pulsebeam/peer
	npm run build -w @pulsebeam/demo-react
	npx playwright install chrome

e2e:
	npx playwright test --project=local

VERSION := $(shell git describe --tags --abbrev=0)

bump:
	bash bump.bash

test: 
	npx vitest run

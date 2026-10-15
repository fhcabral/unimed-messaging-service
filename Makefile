.PHONY: setup dev stop build

setup:
	node scripts/project.mjs setup

dev:
	node scripts/project.mjs dev

stop:
	node scripts/project.mjs stop

build:
	node scripts/project.mjs build

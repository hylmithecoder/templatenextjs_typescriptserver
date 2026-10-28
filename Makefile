.PHONY: build build-web embed-web build-bin run start-bin db-setup db-seed test lint

BINARY_OUT := build/app
# Cross-compile target for `bun build --compile`, e.g. bun-linux-x64-musl for Alpine.
BUN_TARGET ?= bun-linux-x64-musl

build-web:
	STATIC_EXPORT=true bun run next build

embed-web:
	bun run server/scripts/embed-static.ts

build-bin: embed-web
	mkdir -p build
	bun build --compile --minify --bytecode $(if $(BUN_TARGET),--target=$(BUN_TARGET)) server/index.ts --outfile $(BINARY_OUT)
	ls -lh $(BINARY_OUT)

build: build-web build-bin

run:
	bun run server/dev.ts

start-bin:
	./$(BINARY_OUT)

db-setup:
	bun run server/database/scheme.ts

db-seed:
	bun run server/database/seeder.ts

test:
	bun test --timeout 30000

lint:
	bun run lint

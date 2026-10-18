# =====================================================================
# TypeScript + WebGL2, gebuendelt mit Bun.
#
# Aufbau wie in der C++-Fassung: lib3d/ bildet die Bibliothek,
# apps/<name>/ je eine Anwendung, tests/ die Tests. Statt Objektdateien und
# Binaries entstehen pro App gebuendelte Web-Artefakte in dist/<name>/.
#
# Jede App wird ueber ihre eigene index.html gebaut; Bun loest darin die
# passende ./main.ts (und die lib3d-Importe) auf.
# =====================================================================

BUN ?= bun

BUILD := dist

APP_NAMES := vorlage beispiel instanzen ray rocket
APP_OUT   := $(addprefix $(BUILD)/,$(APP_NAMES))

LIB_SRCS := $(wildcard lib3d/*.ts)

# Externe Mesh-Assets je App (z. B. apps/rocket/rocket.obj). Sie werden von
# der App per Text-Import ("with { type: \"text\" }") in das Bundle eingebettet;
# die Datei hier nur als Abhaengigkeit, damit Aenderungen einen Rebuild ausloesen.
APP_ASSETS := $(wildcard apps/*/*.obj)

.PHONY: all build test clean

all: build

build: $(APP_OUT)

# Eine App -> ein Ausgabeordner mit index.html + gebuendeltem JS.
$(BUILD)/%: apps/%/index.html apps/%/main.ts $(LIB_SRCS) $(APP_ASSETS)
	rm -rf $@
	mkdir -p $@
	$(BUN) build apps/$*/index.html --outdir $@ --target browser

build-%: $(BUILD)/%
	@:

test:
	$(BUN) run tests/lib3d_test.ts

# Dev-Server je App: Bun buendelt im Speicher und liefert aus.
run-%:
	$(BUN) --hot apps/$*/index.html

clean:
	rm -rf $(BUILD)

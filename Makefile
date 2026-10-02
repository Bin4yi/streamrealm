# StreamRealm: one command to run everything.  `make setup` once, then `make dev`.
PY ?= python
VENV = server/.venv
ifeq ($(OS),Windows_NT)
  VPY = $(VENV)/Scripts/python
else
  VPY = $(VENV)/bin/python
endif

.PHONY: setup dev server app test data experiment

setup:
	$(PY) -m venv $(VENV)
	$(VPY) -m pip install -r server/requirements.txt
	cd app && npm install

server:
	cd server && ../$(VPY) -m uvicorn app.main:app --reload --port 8000

app:
	cd app && npx expo start --web

dev:
	$(MAKE) -j2 server app

test:
	cd server && ../$(VPY) -m pytest -q
	cd app && npx tsc --noEmit && npx jest

data:
	$(VPY) scripts/fetch_streams.py --city coimbra
	$(VPY) scripts/build_tiles.py --city coimbra

experiment:
	$(VPY) scripts/simulate_coverage.py

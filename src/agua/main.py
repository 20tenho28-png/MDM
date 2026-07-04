from __future__ import annotations

import logging

from fastapi import FastAPI

from agua.web.routes import router

logging.basicConfig(level=logging.INFO)


def create_app() -> FastAPI:
    app = FastAPI(title="MDM — Mapa de Água")
    app.include_router(router)
    return app


app = create_app()

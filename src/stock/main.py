from __future__ import annotations

import logging

from fastapi import FastAPI

from stock.web.routes import router

logging.basicConfig(level=logging.INFO)


def create_app() -> FastAPI:
    app = FastAPI(title="MDM — Gestão de Stock")
    app.include_router(router)
    return app


app = create_app()

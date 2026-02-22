# backend/app/__init__.py

from fastapi import FastAPI

app = FastAPI()

from . import routes

app.include_router(routes.router)
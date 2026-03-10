from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response

from app.api.health import router as health_router
from app.api.v1.router import router as v1_router
from app.config import get_settings, parse_cors_origins
from app.core.exceptions import ApiError
from app.core.middleware import RequestIDMiddleware

settings = get_settings()
allowed_origins = set(parse_cors_origins(settings.cors_origins))
app = FastAPI(title=settings.app_name, version="0.1.0")
app.add_middleware(RequestIDMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=list(allowed_origins),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def cors_preflight_fallback(request: Request, call_next):
    origin = request.headers.get("origin")
    if request.method == "OPTIONS" and origin in allowed_origins:
        return Response(
            status_code=200,
            headers={
                "Access-Control-Allow-Origin": origin,
                "Access-Control-Allow-Credentials": "true",
                "Access-Control-Allow-Methods": request.headers.get(
                    "access-control-request-method", "GET,POST,PUT,PATCH,DELETE,OPTIONS"
                ),
                "Access-Control-Allow-Headers": request.headers.get(
                    "access-control-request-headers", "content-type,authorization,x-api-key"
                ),
                "Vary": "Origin",
            },
        )

    response = await call_next(request)
    if origin in allowed_origins:
        response.headers.setdefault("Access-Control-Allow-Origin", origin)
        response.headers.setdefault("Access-Control-Allow-Credentials", "true")
        response.headers.setdefault("Vary", "Origin")
    return response


@app.exception_handler(ApiError)
async def api_error_handler(request: Request, exc: ApiError) -> JSONResponse:
    request_id = getattr(request.state, "request_id", None)
    detail = exc.detail
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": {
                "code": detail["code"],
                "message": detail["message"],
                "status": exc.status_code,
                "request_id": request_id,
            }
        },
    )


@app.exception_handler(Exception)
async def unhandled_error_handler(request: Request, _: Exception) -> JSONResponse:
    request_id = getattr(request.state, "request_id", None)
    return JSONResponse(
        status_code=500,
        content={
            "error": {
                "code": "INTERNAL_SERVER_ERROR",
                "message": "Unexpected server error",
                "status": 500,
                "request_id": request_id,
            }
        },
    )


app.include_router(health_router)
app.include_router(v1_router, prefix=settings.api_v1_prefix)

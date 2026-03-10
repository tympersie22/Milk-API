from fastapi import APIRouter

from app.api.v1 import admin, auth, ownership, property, reports, risk

router = APIRouter()
router.include_router(auth.router)
router.include_router(property.router)
router.include_router(ownership.router)
router.include_router(risk.router)
router.include_router(reports.router)
router.include_router(admin.router)

from fastapi import APIRouter

from app.api.v1.endpoints import account, auth, clinics, health, invitations, profile

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(health.router)
api_router.include_router(auth.router)
api_router.include_router(profile.router)
api_router.include_router(account.router)
api_router.include_router(clinics.router)
api_router.include_router(invitations.router)

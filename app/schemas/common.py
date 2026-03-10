from pydantic import BaseModel


class ErrorDetail(BaseModel):
    code: str
    message: str
    status: int
    request_id: str | None = None


class ErrorResponse(BaseModel):
    error: ErrorDetail


class PaginationMeta(BaseModel):
    page: int
    per_page: int
    total: int

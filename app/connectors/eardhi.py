from app.connectors.base import BaseConnector
from app.data.mainland_seed import MAINLAND_SAMPLE_PROPERTIES


class EArdhiConnector(BaseConnector):
    """Stub connector for e-Ardhi via GovESB; returns mock mainland records."""

    def __init__(self) -> None:
        self._records = {item["title_number"]: item for item in MAINLAND_SAMPLE_PROPERTIES}

    def get_property_by_title(self, title_number: str) -> dict | None:
        record = self._records.get(title_number)
        return dict(record) if record else None

    def list_properties(self) -> list[dict]:
        return [dict(item) for item in self._records.values()]

    def provider_name(self) -> str:
        return "eardhi_stub"

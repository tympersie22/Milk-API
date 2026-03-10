from app.connectors.base import BaseConnector
from app.data.zanzibar_seed import ZANZIBAR_CORRIDOR_PROPERTIES


class BPRAConnector(BaseConnector):
    def __init__(self) -> None:
        self._index = {item["title_number"]: item for item in ZANZIBAR_CORRIDOR_PROPERTIES}

    def get_property_by_title(self, title_number: str) -> dict | None:
        record = self._index.get(title_number)
        return dict(record) if record else None

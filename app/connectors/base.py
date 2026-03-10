from abc import ABC, abstractmethod


class BaseConnector(ABC):
    @abstractmethod
    def get_property_by_title(self, title_number: str) -> dict | None:
        raise NotImplementedError

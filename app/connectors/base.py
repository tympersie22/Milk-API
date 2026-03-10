from abc import ABC, abstractmethod


class BaseConnector(ABC):
    @abstractmethod
    def get_property_by_title(self, title_number: str) -> dict | None:
        raise NotImplementedError

    def list_properties(self) -> list[dict]:
        return []

    def provider_name(self) -> str:
        return self.__class__.__name__.lower()

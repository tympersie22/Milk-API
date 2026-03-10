from app.connectors.base import BaseConnector


class EArdhiConnector(BaseConnector):
    """Stub connector for e-Ardhi via GovESB; returns mock mainland records."""

    def __init__(self) -> None:
        self._records = {
            "MLD-DAR-0001": {
                "title_number": "MLD-DAR-0001",
                "region": "mainland",
                "district": "Kinondoni",
                "ward": "Mikocheni",
                "area_name": "Mikocheni",
                "street": "Old Bagamoyo Road",
                "land_type": "residential",
                "ownership_type": "granted_right_of_occupancy",
                "area_sqm": 1200.0,
                "foreign_eligible": False,
                "zipa_registered": False,
                "coastal_buffer_zone": False,
                "heritage_zone": False,
                "data_source": "eardhi",
                "data_confidence": 0.82,
                "centroid": (39.2583, -6.7647),
            }
        }

    def get_property_by_title(self, title_number: str) -> dict | None:
        return self._records.get(title_number)

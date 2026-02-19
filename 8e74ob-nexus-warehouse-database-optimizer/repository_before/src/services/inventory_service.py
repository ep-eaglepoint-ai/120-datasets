
# // filename: src/services/inventory_service.py

from sqlalchemy.orm import Session
from src.db.models import Pallet

class InventoryService:
    def __init__(self, db_session: Session):
        self.db = db_session

    def get_pallet_location(self, target_sku: str):
        """
        Finds a pallet location by its SKU.
        PROBLEM: Table lacks indexing on 'sku', leading to full table scans.
        """
        return self.db.query(Pallet).filter(Pallet.sku == target_sku).first()

    def list_pallets_in_zone(self, zone: str):
        """
        Retrieves all pallets for a specific warehouse zone.
        PROBLEM: Returns 10,000+ records at once, causing memory pressure
        and slow response times on the frontend API.
        """
        return self.db.query(Pallet).filter(Pallet.zone_code == zone).all()
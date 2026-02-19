
# // filename: src/db/models.py

from sqlalchemy import Column, Integer, String, DateTime, Float, func, Index
from sqlalchemy.orm import declarative_base

Base = declarative_base()

class Pallet(Base):
    """
    Database schema for physical inventory pallets.
    Total Rows in Production: ~5,000,000
    """
    __tablename__ = 'pallets'
    
    # Primary Key with auto-increment
    id = Column(Integer, primary_key=True)
    
    # Unique identifier assigned by the manufacturer
    pallet_uuid = Column(String(36), nullable=False)
    
    # Stock Keeping Unit - queried thousands of times per minute
    sku = Column(String(20), nullable=False)
    
    # Geographic warehouse code (e.g., 'ZONE-NORTH-B')
    zone_code = Column(String(50), nullable=False)
    
    # Current shelf level (1-15)
    shelf_level = Column(Integer)
    
    # ISO Timestamp of the last time a robot scanned this pallet
    last_scanned = Column(DateTime, default=func.now())
    
    __table_args__ = (
        Index('ix_pallets_sku_btree', 'sku'),
        Index('ix_pallets_zone_code_btree', 'zone_code'),
    )



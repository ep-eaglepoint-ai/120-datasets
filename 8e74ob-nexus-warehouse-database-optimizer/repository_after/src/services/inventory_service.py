# // filename: src/services/inventory_service.py

from sqlalchemy.orm import Session
from sqlalchemy import text
from src.db.models import Pallet
from typing import Dict, Any, List, Optional

DEFAULT_LIMIT = 100
MAX_LIMIT = 1000


class PaginatedResponse:
    """Response structure with pagination metadata"""
    def __init__(self, data: List[Any], total_count: int, limit: int, offset: int):
        self.data = data
        self.total_count = total_count
        self.limit = limit
        self.offset = offset
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'data': self.data,
            'metadata': {
                'total_count': self.total_count,
                'limit': self.limit,
                'offset': self.offset
            }
        }


class InventoryService:
    def __init__(self, db_session: Session):
        self.db = db_session

    def get_pallet_location(self, target_sku: str) -> Optional[Pallet]:
        """
        Finds a pallet location by its SKU.
        OPTIMIZED: Uses B-Tree index on 'sku' column for O(log N) lookups.
        """
        return self.db.query(Pallet).filter(Pallet.sku == target_sku).first()

    def list_pallets_in_zone(self, zone: str, limit: int = None, offset: int = None) -> PaginatedResponse:
        """
        Retrieves pallets for a specific warehouse zone with pagination.
        OPTIMIZED: Uses limit/offset pagination to prevent memory pressure.
        
        Args:
            zone: The warehouse zone code to filter by
            limit: Maximum number of records to return (default: 100, max: 1000)
            offset: Number of records to skip (default: 0)
            
        Returns:
            PaginatedResponse with data and metadata (total_count, limit, offset)
        """
        if limit is None or limit <= 0:
            limit = DEFAULT_LIMIT
        if limit > MAX_LIMIT:
            limit = MAX_LIMIT
        
        if offset is None or offset < 0:
            offset = 0
        
        total_count = self.db.query(Pallet).filter(Pallet.zone_code == zone).count()
        
        if offset >= total_count:
            return PaginatedResponse(data=[], total_count=total_count, limit=limit, offset=offset)
        
        data = (
            self.db.query(Pallet)
            .filter(Pallet.zone_code == zone)
            .order_by(Pallet.id)
            .offset(offset)
            .limit(limit)
            .all()
        )
        
        return PaginatedResponse(data=data, total_count=total_count, limit=limit, offset=offset)

    def verify_index_usage(self, target_sku: str) -> Dict[str, Any]:
        """
        Validates that the query engine uses the index for SKU lookups.
        Uses EXPLAIN to check for 'Index Scan' in the query plan.
        
        Returns:
            Dict with 'uses_index' boolean and 'explain_output' string
        """
        dialect = self.db.bind.dialect.name
        if dialect == 'sqlite':
            explain_query = text("EXPLAIN QUERY PLAN SELECT * FROM pallets WHERE sku = :sku")
        elif dialect == 'postgresql':
            explain_query = text("EXPLAIN SELECT * FROM pallets WHERE sku = :sku")
        else:
            return {'uses_index': False, 'explain_output': 'EXPLAIN not implemented for dialect: ' + dialect}
        result = self.db.execute(explain_query, {'sku': target_sku})
        rows = result.fetchall()
        explain_output = '\n'.join([str(row) for row in rows])
        
        uses_index = ('INDEX' in explain_output.upper() or 
                      'Index Scan' in explain_output or 
                      'Index Only Scan' in explain_output)
        
        return {
            'uses_index': uses_index,
            'explain_output': explain_output
        }
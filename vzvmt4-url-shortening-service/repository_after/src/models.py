from sqlalchemy import Column, Integer, String, Index
from sqlalchemy.orm import declarative_base
from pydantic import BaseModel, Field

Base = declarative_base()

class DBURL(Base):
    __tablename__ = "urls"

    id = Column(Integer, primary_key=True, index=True)
    target_url = Column(String, unique=True, index=True, nullable=False)
    short_code = Column(String, unique=True, index=True, nullable=True) 


class URLItem(BaseModel):
    target_url: str = Field(..., min_length=1)

class URLResponse(BaseModel):
    target_url: str
    short_code: str
    short_url: str

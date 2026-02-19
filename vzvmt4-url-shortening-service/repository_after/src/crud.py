from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from src.models import DBURL
from src.services import generate_short_code

def get_url_by_target(db: Session, target_url: str):
    return db.query(DBURL).filter(DBURL.target_url == target_url).first()

def get_url_by_short_code(db: Session, short_code: str):
    return db.query(DBURL).filter(DBURL.short_code == short_code).first()

def create_short_url(db: Session, target_url: str) -> DBURL:
    existing = get_url_by_target(db, target_url)
    if existing:
        return existing

    new_url = DBURL(target_url=target_url)
    db.add(new_url)
    try:
        db.flush()
        code = generate_short_code(new_url.id)
        new_url.short_code = code
        db.commit()
        db.refresh(new_url)
        return new_url
    except IntegrityError:
        db.rollback()
        existing = get_url_by_target(db, target_url)
        if existing:
            return existing
        raise
    except ValueError:
        db.rollback()
        raise

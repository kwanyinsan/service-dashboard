from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

DATABASE_URL = "sqlite:///./service-dashboard.db"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class Service(Base):
    __tablename__ = "services"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    url = Column(String, unique=True)
    status = Column(Integer, nullable=True)
    latency = Column(Float, nullable=True)
    last_checked = Column(DateTime, nullable=True)


class PingHistory(Base):
    __tablename__ = "ping_history"

    id = Column(Integer, primary_key=True)
    service_id = Column(
        Integer,
        ForeignKey("services.id"),
        nullable=False,
        index=True,
    )
    latency = Column(Float, nullable=True)
    status = Column(Integer, nullable=True)
    timestamp = Column(DateTime, nullable=False)


Base.metadata.create_all(bind=engine)


def seed_initial_data():
    """Insert default services if the table is empty."""
    db = SessionLocal()
    try:
        if db.query(Service).count() == 0:
            defaults = [
                ("Google", "https://www.google.com"),
                ("GitHub", "https://github.com"),
                ("Stack Overflow", "https://stackoverflow.com"),
                ("Wikipedia", "https://www.wikipedia.org"),
                ("Reddit", "https://www.reddit.com"),
                ("YouTube", "https://www.youtube.com"),
                ("Amazon", "https://www.amazon.com"),
                ("Cloudflare", "https://www.cloudflare.com"),
            ]
            for name, url in defaults:
                db.add(Service(name=name, url=url))
            db.commit()
    finally:
        db.close()


seed_initial_data()

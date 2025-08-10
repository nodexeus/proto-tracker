from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os

# Construct database URL from environment variables
SQLALCHEMY_DATABASE_URL = "postgresql://{}:{}@{}:{}/{}".format(
    os.getenv('DB_USERNAME', 'postgres'),
    os.getenv('DB_PASS', 'postgres'),
    os.getenv('DB_HOST', 'postgres'),
    os.getenv('DB_PORT', '5432'),
    os.getenv('DB_NAME', 'protodb')
)

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={},
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

from alembic import context
from sqlalchemy import MetaData

from app.config import database_url
from app.database import make_engine

# No business models in the foundation.
metadata = MetaData()

if context.is_offline_mode():
    context.configure(url=database_url(), target_metadata=metadata, literal_binds=True)
    with context.begin_transaction():
        context.run_migrations()
else:
    engine = make_engine(database_url())
    try:
        with engine.connect() as connection:
            context.configure(connection=connection, target_metadata=metadata)
            with context.begin_transaction():
                context.run_migrations()
    finally:
        engine.dispose()

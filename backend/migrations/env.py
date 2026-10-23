from alembic import context

from app.auth.models import Base
from app.config import database_url
from app.database import make_engine
from app.planning import models as planning_models  # noqa: F401

metadata = Base.metadata

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

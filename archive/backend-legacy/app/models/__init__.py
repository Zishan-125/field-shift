"""
Import every model module here, once. main.py's lifespan calls
Base.metadata.create_all() for the local demo DB — but SQLAlchemy only
knows about a model class if its module has actually been imported
somewhere by the time that runs. Without this file, adding
signal_reading.py wouldn't do anything until some other code happened
to import it, which is exactly the kind of "works on my machine
because I imported field.py which happened to load first" bug this
file exists to prevent.
"""

from app.models.field import Field, ShiftScore  # noqa: F401
from app.models.signal_reading import SignalReading  # noqa: F401
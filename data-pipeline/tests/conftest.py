import sys
from pathlib import Path

# data-pipeline/ has a hyphen, so it is not importable as a package:
# put it on sys.path so tests can `import rotation.feasibility`.
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

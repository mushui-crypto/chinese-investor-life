from pathlib import Path
from sys import argv
from zipfile import ZIP_DEFLATED, ZipFile

folder = Path(argv[1])
archive = Path(argv[2])

with ZipFile(archive, 'w', compression=ZIP_DEFLATED, compresslevel=1) as output:
    for path in sorted(folder.rglob('*')):
        if path.is_file() and not any(part.startswith('._') for part in path.parts):
            output.write(path, path.relative_to(folder.parent))

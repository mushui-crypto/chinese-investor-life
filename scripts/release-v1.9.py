"""Package the verified v1.9 static build without replacing an earlier archive."""
import hashlib
import json
import os
from datetime import datetime, timezone
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED

root = Path(__file__).resolve().parent.parent
os.chdir(root)
report_dir = Path('reports/v1.9')
sha = lambda p: hashlib.sha256(Path(p).read_bytes()).hexdigest()
old = json.loads(Path('reports/v1.8/release-manifest.json').read_text())
prior = {**old['previousArchiveHashes'], old['archive']: old['sha256']}
for name, expected in prior.items():
    assert sha(name) == expected, f'Prior archive changed: {name}'

assert json.loads(Path('dist/package.json').read_text())['version'] == '1.9.0'
assert '# pass 176\n' in (report_dir / 'tests.txt').read_text()
assert '# fail 0\n' in (report_dir / 'tests.txt').read_text()
app_mtime = max(p.stat().st_mtime for p in Path('src').rglob('*') if p.is_file() and p.suffix in ['.js', '.css'])
checks = []
for p in sorted((report_dir / 'release').rglob('*.json')):
    r = json.loads(p.read_text())
    assert r['passed'] and not r.get('errors'), str(p)
    assert datetime.fromisoformat(r['date'].replace('Z', '+00:00')).timestamp() >= app_mtime, 'Stale browser report: ' + str(p)
    checks.append({'report': str(p), 'checks': len(r['checks']), 'testedUrl': r['url'], 'date': r.get('date')})
assert len(checks) == 9 and sum(c['checks'] for c in checks) == 508
migrations = []
for v in range(9):
    p = report_dir / f'save-compat-v1.{v}.json'
    r = json.loads(p.read_text())
    assert r['passed']
    migrations.append({'version': f'1.{v}', 'scenarios': len(r['checks']), 'report': str(p)})

critical = ['index.html', 'src/main.js', 'src/behavior.css', 'src/ui/behavior-panel.js',
            'src/ui/market-desks.js', 'src/game/behavior.js', 'src/game/behavior-events.js',
            'src/game/debt-calendar.js', 'src/game/core.js', 'src/game/survival.js',
            'src/game/market-play.js', 'src/game/narrative.js', 'src/game/storage.js',
            'src/ui/desk-navigation.js', 'src/ui/play-guide-panel.js', 'src/play-guide.css',
            'src/game/play-guide.js', 'src/ui/crypto-terminal.js', 'src/ui/gambling-hall.js',
            'docs/V1.9_自主迭代验收.md']
for p in Path('src').rglob('*'):
    if p.is_file() and p.suffix != '.png':
        assert sha(p) == sha(Path('dist') / p), str(p)
for p in critical:
    assert sha(p) == sha(Path('dist') / p), p

simulation = json.loads((report_dir / 'flow-simulation.json').read_text())
assert simulation['passed'] and len(simulation['runs']) == 36 and not simulation['errors']
assert all(r['age'] == 80 for r in simulation['runs'])
exploration = json.loads((report_dir / 'exploration.json').read_text())
assert exploration['passed'] and not exploration['errors'] and len(exploration['runs']) == 24
archive = Path('中国式赌狗-v1.9.zip')
with ZipFile(archive, 'x', compression=ZIP_DEFLATED, compresslevel=9) as z:
    for p in sorted(Path('dist').rglob('*')):
        if p.is_file():
            z.write(p, str(p.relative_to('dist')))
with ZipFile(archive) as z:
    assert z.testzip() is None
    launcher_executable = bool((z.getinfo('启动游戏.command').external_attr >> 16) & 0o111)
    assert launcher_executable
    files = len(z.infolist())

manifest = {
    'version': '1.9.0', 'createdAt': datetime.now(timezone.utc).isoformat(),
    'archive': str(archive), 'bytes': archive.stat().st_size, 'sha256': sha(archive),
    'zipIntegrity': 'passed', 'launcherExecutable': launcher_executable, 'files': files,
    'exploratoryRuns': 24, 'exploratoryActions': sum(r['steps'] for r in exploration['runs']),
    'fullLifeSimulations': 36, 'simulationSteps': sum(r['steps'] for r in simulation['runs']),
    'contentValidationChecks': 10648, 'unitTests': 176, 'browserChecks': checks, 'browserChecksTotal': 508,
    'migrations': migrations, 'previousArchivesUnchanged': True, 'previousArchiveHashes': prior,
    'behaviorEvents': 13, 'behaviorChoices': 39, 'baseEvents': 219, 'endings': 29,
    'criticalFiles': {p: sha(p) for p in critical},
}
(report_dir / 'release-manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
print(json.dumps({k: manifest[k] for k in ['archive', 'bytes', 'sha256', 'unitTests', 'browserChecksTotal']}, ensure_ascii=False, indent=2))

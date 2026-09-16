"""Apply or reverse an explicit static-file release with hash drift checks.

python deploy-scoped.py check|apply|rollback MANIFEST PAYLOAD BACKUP
Manifest: root, sourceCommit, before {relative: sha256}, files {relative: sha256}.
Payload is an extracted, committed release. Backups must be outside the web root.
"""
import argparse, hashlib, json, os, shutil, stat, datetime
from pathlib import Path, PurePosixPath

def digest(path): return hashlib.sha256(path.read_bytes()).hexdigest()

def inventory(root):
    result={}
    for item in sorted(root.rglob('*')):
        if item.is_symlink(): raise RuntimeError(f'Symlink refused: {item}')
        if item.is_file(): result[item.relative_to(root).as_posix()]=digest(item)
    return result

def safe_file(root,name):
    part=PurePosixPath(name)
    if not name or part.is_absolute() or '..' in part.parts or '\\' in name:
        raise RuntimeError(f'Unsafe relative path: {name}')
    path=root.joinpath(*part.parts)
    if not path.resolve().is_relative_to(root) or path.is_symlink():
        raise RuntimeError(f'Unsafe target: {path}')
    return path

def atomic_write(path,body,mode=0o644):
    # The host's umask can otherwise leave new public asset directories unreadable.
    # Set modes only on directories this release creates; preserve existing ones.
    missing=[];directory=path.parent
    while not directory.exists():
        missing.append(directory);directory=directory.parent
    for directory in reversed(missing):
        directory.mkdir();os.chmod(directory,0o755)
    temporary=path.with_name(path.name+'.scoped-release.tmp')
    with temporary.open('xb') as stream:
        stream.write(body);stream.flush();os.fsync(stream.fileno())
    os.chmod(temporary,mode)
    os.replace(temporary,path)

def release(mode,manifest,payload,backup):
    root=Path(manifest['root']).resolve(); payload=payload.resolve();backup=backup.resolve()
    assert root.is_dir(), 'Target does not exist'
    assert not backup.is_relative_to(root), 'Backup must be outside the published directory'
    before=manifest['before']; wanted=manifest['files']
    assert wanted and all(len(h)==64 for h in [*before.values(),*wanted.values()])
    for name in set(before)|set(wanted): safe_file(root,name)
    expected={**before,**wanted}
    if mode=='rollback':
        assert inventory(root)==expected, 'Live files changed after release; rollback refused'
        receipt=json.loads((backup/'manifest.json').read_text())
        assert receipt==manifest, 'Backup belongs to another release'
        for name in wanted:
            path=safe_file(root,name)
            if name in before:
                original=safe_file(backup/'files',name)
                assert digest(original)==before[name], 'Backup checksum mismatch'
                atomic_write(path,original.read_bytes())
            else: path.unlink()
        assert inventory(root)==before, 'Rollback verification failed'
        return {'status':'rolled back','root':str(root),'sourceCommit':manifest['sourceCommit']}
    assert inventory(root)==before, 'Live files changed after capture; deployment refused'
    for name,sha in wanted.items():
        source=safe_file(payload,name)
        assert source.is_file() and digest(source)==sha, f'Payload checksum mismatch: {name}'
    if mode=='check':
        return {'status':'ready','files':len(wanted),'untouched':len(set(before)-set(wanted)),'sourceCommit':manifest['sourceCommit']}
    backup.mkdir(parents=True,exist_ok=False,mode=0o700)
    (backup/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
    os.chmod(backup/'manifest.json',0o600)
    for name in wanted:
        if name in before:
            destination=safe_file(backup/'files',name);destination.parent.mkdir(parents=True,exist_ok=True)
            shutil.copy2(safe_file(root,name),destination);os.chmod(destination,0o600)
    # Publish all dependencies before entry HTML, and the cache activation last.
    order=sorted(wanted,key=lambda p:(3 if p.endswith('/sw.js') else 2 if p=='index.html' else 1 if p.endswith('.html') else 0,p))
    installed=[]
    try:
        for name in order:
            path=safe_file(root,name)
            assert (digest(path) if path.exists() else None)==before.get(name), f'Concurrent change: {name}'
            atomic_write(path,safe_file(payload,name).read_bytes());installed.append(name)
        assert inventory(root)==expected, 'Post-deployment checksum mismatch'
    except Exception:
        for name in reversed(installed):
            path=safe_file(root,name)
            if digest(path)!=wanted[name]: raise RuntimeError(f'Concurrent change during rollback: {name}')
            if name in before: atomic_write(path,safe_file(backup/'files',name).read_bytes())
            else: path.unlink()
        raise
    result={'status':'deployed','root':str(root),'sourceCommit':manifest['sourceCommit'],'files':len(wanted),'untouchedVerified':len(set(before)-set(wanted)),'backup':str(backup),'verifiedAt':datetime.datetime.now(datetime.timezone.utc).isoformat()}
    (backup/'receipt.json').write_text(json.dumps(result,indent=2)+'\n')
    return result

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('mode',choices=['check','apply','rollback'])
    parser.add_argument('manifest',type=Path);parser.add_argument('payload',type=Path);parser.add_argument('backup',type=Path)
    args=parser.parse_args()
    print(json.dumps(release(args.mode,json.loads(args.manifest.read_text()),args.payload,args.backup),indent=2))

"""A18-13 QA-only gate for REAL primary IndexedDB destructive restore.
Only for an isolated copy of index.html. No operational merge.
"""
from pathlib import Path

ATOMIC_ANCHOR = "function v22RestoreOnlyIfUnchanged(items,images,p,baseline,targetDb=db,announce=true){\n"
ATOMIC_GUARD = "const A1813_SAFE_TO_RESTORE=false; // isolated QA: immutable; no operational restore authorization.\nfunction v22RestoreOnlyIfUnchanged(items,images,p,baseline,targetDb=db,announce=true){\n // Fail closed BEFORE opening the primary destructive readwrite transaction.\n // A separate IDBDatabase handle to the SAME store name must be blocked too.\n if(A1813_SAFE_TO_RESTORE!==true&&(!targetDb||targetDb.name===DB))\n  return Promise.reject(Object.assign(Error('복원 보류: 원자적 변경 이력 검증 전에는 기록·사진을 교체할 수 없습니다.'),{code:'A1813_RESTORE_DISABLED'}));\n"
PROBE_ANCHOR = "// ===== v2.3: photo CONTENT fingerprint preflight (additional defense, not a lock) ====="
PROBE_HOOK = "// A18-13 isolated QA-only direct-call proof: bypass button/file handlers to reach actual\n// core restore functions. Only synthetic local test data; never a product API.\nObject.defineProperty(window,'__wrongA1813Probe',{configurable:false,value:async(kind,alternateHandle=false)=>{\n let handle=db,own=false;\n if(alternateHandle){\n  handle=await new Promise((resolve,reject)=>{\n   const req=indexedDB.open(DB);req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);\n  });own=true;\n }\n try{\n  const oldState=await v22CaptureRestoreBaseline(handle);\n  const photos=await v23CapturePhotoFingerprints(handle);\n  try{\n   const args=[[],{},{nickname:'A18-13 합성',grade:3,subject:'math'},oldState,photos,handle,false];\n   if(kind==='directAtomic')await v22RestoreOnlyIfUnchanged(args[0],args[1],args[2],args[3],handle,false);\n   else if(kind==='directPhoto')await v23RestoreWithPhotoCheck(...args);\n   else if(kind==='directClear')await v213ClearOnlyIfUnchanged(oldState,photos,handle,false);\n   else throw Error('unknown isolated QA proof kind');\n   return {blocked:false,code:'UNSAFE_RESTORE_RETURNED',kind,alternateHandle};\n  }catch(error){return {blocked:true,code:String(error?.code||''),kind,alternateHandle};}\n }finally{if(own)handle.close()}\n}});\n"

def patch(source: str) -> str:
    for before,after in ((ATOMIC_ANCHOR,ATOMIC_GUARD),
                         (PROBE_ANCHOR,PROBE_HOOK+PROBE_ANCHOR)):
        if source.count(before)!=1 or source.count(after):
            raise ValueError('unexpected base source or already patched')
        source=source.replace(before,after,1)
    return source

def unpatch(source: str) -> str:
    for before,after in reversed(((ATOMIC_ANCHOR,ATOMIC_GUARD),
                                  (PROBE_ANCHOR,PROBE_HOOK+PROBE_ANCHOR))):
        if source.count(after)!=1:
            raise ValueError('guard changed or incomplete; fail closed')
        source=source.replace(after,before,1)
    return source

if __name__ == '__main__':
    import sys
    if len(sys.argv)!=2:
        raise SystemExit('Usage: python qa/a18_13_core_restore_gate.py <isolated index.html>')
    path=Path(sys.argv[1]);old=path.read_text(encoding='utf-8')
    revised=patch(old)
    if unpatch(revised)!=old: raise ValueError('reverse failed')
    path.write_text(revised,encoding='utf-8')
    print('A1813_APPLIED_REVERSIBLE_QA_ONLY')

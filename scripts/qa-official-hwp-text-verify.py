#!/usr/bin/env python3
"""Independent text audit for the 13 candidate standards using downloaded MOE 2022-33 HWP.
The official ZIP is downloaded by the adjacent probe into RUNNER_TEMP.
Never copy original ZIP/HWP, child data or user files to the public repo/artifact.
This does NOT endorse the AI concept-to-curriculum mapping.
"""
import hashlib
import io
import json
import os
from pathlib import Path
import re
import struct
import sys
import zipfile
import zlib

OUT=Path("source-snapshot-output/qa23-math-standard-source-review.json")
ZIP=Path(os.environ.get("RUNNER_TEMP", "/tmp")) / "qa23-official-2022-subjects.zip"

def normalized(text):
    # Unicode letters and punctuation remain untouched; only whitespace/control removed.
    return "".join(c for c in text if c.isprintable() and not c.isspace())

def text_from_hwp(data):
    import olefile
    with olefile.OleFileIO(io.BytesIO(data)) as ole:
        if not ole.exists("FileHeader"):
            raise ValueError("Not a HWP5 compound file: FileHeader missing")
        header=ole.openstream("FileHeader").read()
        compressed=bool(int.from_bytes(header[36:40], "little")&1)
        streams=[name for name in ole.listdir(streams=True)
                 if len(name)>=2 and name[0]=="BodyText" and name[1].startswith("Section")]
        if not streams:
            raise ValueError("HWP BodyText Section streams missing")
        paragraphs=[]
        record_count=0
        for name in streams:
            blob=ole.openstream(name).read()
            if compressed:
                try: blob=zlib.decompress(blob, -15)
                except zlib.error: blob=zlib.decompress(blob)
            pos=0
            while pos+4<=len(blob):
                header32=struct.unpack_from("<I",blob,pos)[0];pos+=4
                tag=header32&0x3ff
                size=(header32>>20)&0xfff
                if size==0xfff:
                    if pos+4>len(blob):raise ValueError("Truncated HWP extended record")
                    size=struct.unpack_from("<I",blob,pos)[0];pos+=4
                if size<0 or pos+size>len(blob):raise ValueError("Invalid HWP record length")
                payload=blob[pos:pos+size];pos+=size
                record_count+=1
                # 67 is HWPTAG_PARA_TEXT. Untrusted controls are filtered for source matching.
                if tag==67:
                    paragraphs.append(payload.decode("utf-16le",errors="replace"))
        if not paragraphs:
            raise ValueError("No HWP paragraph text records")
        return "\n".join(paragraphs),{"sections":len(streams),"records":record_count,"paragraphs":len(paragraphs),"compressed":compressed}

def corrected_zip_name(info):
    # Korean filename stored as CP949 without the ZIP UTF-8 filename bit is exposed as CP437.
    if info.flag_bits & 0x800:
        return info.filename
    try: return info.filename.encode("cp437").decode("cp949")
    except (UnicodeError,ValueError): return info.filename

def run():
    result={
        "version":"qa23-moe-hwp-text-audit-v01",
        "status":"NOT_VERIFIED",
        "official_zip_retrieved":ZIP.exists(),
        "official_13_standard_texts_verified":False,
        "ai_concept_to_standard_mapping_expert_approved":False,
        "children_data_included":False,
        "final_education_approval":False,
    }
    try:
        if not ZIP.is_file():raise FileNotFoundError("Official ZIP missing from runner temp; cannot audit")
        archive=ZIP.read_bytes()
        result["official_zip_sha256"]=hashlib.sha256(archive).hexdigest()
        with zipfile.ZipFile(io.BytesIO(archive)) as z:
            candidates=[(info,corrected_zip_name(info)) for info in z.infolist()
                if not info.is_dir() and re.search(r"\[\s*별책\s*8\s*\]",corrected_zip_name(info)) 
                and corrected_zip_name(info).lower().endswith(".hwp")]
            if len(candidates)!=1:raise ValueError(f"Expected one official math annex HWP, found {len(candidates)}")
            item,name=candidates[0]
            if item.file_size>10*1024*1024:raise ValueError("Math annex HWP exceeds safe size")
            original=z.read(item)
            result["annex"]="[별책8] 수학과 교육과정"
            result["annex_file_name"]=name
            result["annex_hwp_bytes"]=len(original)
            result["annex_hwp_sha256"]=hashlib.sha256(original).hexdigest()
        text,meta=text_from_hwp(original)
        result["extraction"]=meta
        html=Path("index.html").read_text(encoding="utf-8")
        mat=re.search(r'<script\s+id="curriculum-candidate-data"\s+type="application/json">([\s\S]*?)</script>',html)
        if not mat:raise ValueError("Missing embedded source mapping candidate data")
        rows=json.loads(mat.group(1))
        if len(rows)!=13:raise ValueError(f"Expected exactly 13 mapping rows, found {len(rows)}")
        body=normalized(text)
        matched,missing=[],[]
        for row in rows:
            code=row["standard_code"]
            official_sentence=row["source_pdf_text"]
            expected=normalized(code+official_sentence)
            # The source HWP can insert formatting controls between code and sentence.
            # Require both source parts in close proximity, never text-only loose matches.
            found=expected in body
            if not found:
                indices=[m.start() for m in re.finditer(re.escape(normalized(code)),body)]
                found=any(normalized(official_sentence) in body[i+len(code):i+len(code)+320] for i in indices)
            (matched if found else missing).append({"code":code,"concept_id":row["concept_id"]})
        result["candidate_rows"]=len(rows)
        result["unique_codes"]=len(set(row["standard_code"] for row in rows))
        result["exact_code_and_text_matches"]=len(matched)
        result["unmatched"]=missing
        result["status"]="OFFICIAL_MOE_TEXT_13_OF_13_MATCHED" if not missing else "OFFICIAL_MOE_TEXT_PARTIAL_MISMATCH"
        result["official_13_standard_texts_verified"]=not missing
    except Exception as e:
        result.update({"status":"OFFICIAL_TEXT_NOT_VERIFIED","error_type":type(e).__name__,"error":str(e)[:350]})
    OUT.parent.mkdir(parents=True,exist_ok=True)
    OUT.write_text(json.dumps(result,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print("QA23_OFFICIAL_HWP_TEXT="+json.dumps(result,ensure_ascii=False))
    # This step is a source-research probe. Must not falsely convert partial results to approval.
    return 0

if __name__=="__main__":sys.exit(run())


# // filename: ingest_processor.py

import os
from datetime import datetime
# External persistence interface (mocks)
from infra import storage, monitoring, db

# /**
#  * LEGACY MONOLITHIC INGESTION
#  * Processes diverse genomic files by manually checking headers and branching.
#  */
async def process_raw_file(file_path, sequencer_id, batch_user):
    file_ext = os.path.splitext(file_path)[1].upper()
    raw_content = await storage.read_file(file_path)
    processed_records = []

    # PROBLEM: Monolithic loop with internal format branching
    for line in raw_content.split('\n'):
        if not line.strip(): continue
        
        # FORMAT: FASTQ (@header, sequence, +, quality)
        if file_ext == '.FASTQ':
            if line.startswith('@'):
                meta = {"id": line[1:], "type": "FASTQ", "seq_id": sequencer_id}
                # Manual slicing for following lines - highly fragile
                # This expects 4 lines per record, but lacks a state machine
                processed_records.append(meta)
        
        # FORMAT: FASTA (>header, sequence)
        elif file_ext == '.FASTA':
            if line.startswith('>'):
                meta = {"id": line[1:], "type": "FASTA", "created_at": datetime.now().isoformat()}
                processed_records.append(meta)
        
        # DATA VALIDATION (Implicit in logic)
        if len(processed_records) > 1000:
            # Periodic flush to DB to avoid OOM
            await db.save_batch('sequence_data', processed_records)
            processed_records = []

    # PROBLEM: Swallows all exceptions at the end; no visibility on partial success
    if processed_records:
        await db.save_batch('sequence_data', processed_records)
    
    await monitoring.log_event("INGEST_COMPLETE", {"user": batch_user})
    return True
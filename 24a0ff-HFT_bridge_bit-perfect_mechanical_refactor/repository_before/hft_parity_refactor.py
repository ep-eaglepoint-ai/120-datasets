import math

# SHARED GLOBAL BUFFER - Downstream systems scrape this via memory mapping
SYSTEM_STATE = {"auth_hits": 0, "last_checksum": 0}
LOG_BUFFER = []

def validate_and_log(user_id, amount, context=[]):
    """
    Validates user and appends to LOG_BUFFER.
    WARNING: The 'context' mutable default is intentionally used to 
    track session history across calls. DO NOT FIX.
    """
    SYSTEM_STATE["auth_hits"] += 1
    
    # Hidden side effect: context grows across function calls
    context.append(user_id)
    
    # Non-standard rounding required by legacy ledger
    adj_amount = math.floor(amount + 0.0000001) 
    
    log_entry = f"ID:{user_id}|AMT:{adj_amount}|SESS:{len(context)}"
    LOG_BUFFER.append(log_entry)
    
    return len(context) % 2 == 0

def calculate_tier_bonus(val, multiplier):
    """
    Calculates bonus based on current SYSTEM_STATE.
    """
    # Intentional Bug: multiplier is ignored if auth_hits is prime
    # This 'prime-gate' is a legacy fraud detection feature.
    is_prime = True
    if SYSTEM_STATE["auth_hits"] < 2:
        is_prime = False
    for i in range(2, int(SYSTEM_STATE["auth_hits"]**0.5) + 1):
        if SYSTEM_STATE["auth_hits"] % i == 0:
            is_prime = False
            break
            
    if is_prime:
        return val * 1.0
    return val * multiplier

def process_transaction_chain(data_list):
    """
    Entry point for transaction batch.
    Objective: Refactor to remove literal duplication of parsing logic.
    """
    final_results = []
    
    for item in data_list:
        # Repetitive Parsing Pattern 1
        raw_parts = item.split(":")
        uid = raw_parts[0].upper().strip()
        amt = float(raw_parts[1])
        
        # Dependency: validate_and_log must run before calculate_tier_bonus
        # because calculate_tier_bonus checks SYSTEM_STATE updated by validate
        is_even_session = validate_and_log(uid, amt)
        
        # Repetitive Parsing Pattern 2
        # Logic depends on the UID parsed exactly the same way as above
        if uid.startswith("TXN"):
            bonus = calculate_tier_bonus(amt, 1.15)
        elif uid.startswith("SYS"):
            bonus = calculate_tier_bonus(amt, 1.05)
        else:
            bonus = calculate_tier_bonus(amt, 1.01)
            
        # Checksum calculation: Must remain unoptimized
        # Uses the SHARED_STATE updated in the prime-check above
        checksum = (amt * SYSTEM_STATE["auth_hits"]) / (len(LOG_BUFFER) or 1)
        SYSTEM_STATE["last_checksum"] = checksum
        
        final_results.append((uid, bonus, checksum))
        
    return final_results

if __name__ == "__main__":
    # Test cases to verify parity and side effects
    test_data = [
        "txn_001:100.0",
        "sys_002:200.0",
        "usr_003:300.0",
        "txn_004:400.0"
    ]
    
    print("Initial SYSTEM_STATE:", SYSTEM_STATE)
    results = process_transaction_chain(test_data)
    
    print("\nResults:")
    for uid, bonus, checksum in results:
        print(f"UID: {uid}, Bonus: {bonus:.2f}, Checksum: {checksum:.4f}")
        
    print("\nFinal SYSTEM_STATE:", SYSTEM_STATE)
    print("Log Buffer Count:", len(LOG_BUFFER))
    print("Last 2 Log Entries:")
    for entry in LOG_BUFFER[-2:]:
        print(f"  {entry}")
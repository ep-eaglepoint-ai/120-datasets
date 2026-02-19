
# // filename: src/finance/ledger_processor.py

import uuid
import math
from decimal import Decimal, ROUND_HALF_UP

# External exception used for domain-specific failures
class LedgerError(Exception): 
    """Base exception for all ledger-related failures."""
    pass

class AtomicLedgerProcessor:
    """
    Manages internal account balances with strict idempotency and consistency checks.
    
    Data Shapes:
    - accounts: dict[str, Decimal] mapping account_id to current balance.
    - processed_tx: set[str] containing UUID strings of completed transactions.
    - pending_locks: dict[str, float] mapping account_id to a timestamp.
    """
    
    def __init__(self, initial_accounts=None):
        # Stores account balances using Decimal to avoid floating point issues
        self.accounts = initial_accounts or {}
        self.processed_tx = set()
        self.transaction_log = []

    def execute_transfer(self, tx_id, sender_id, receiver_id, amount_str):
        """
        Executes a transfer between two accounts.
        Must be idempotent based on tx_id.
        """
        if tx_id in self.processed_tx:
            return {"status": "SUCCESS", "msg": "ALREADY_PROCESSED"}

        if sender_id not in self.accounts or receiver_id not in self.accounts:
            raise LedgerError("INVALID_ACCOUNT_ID")

        if sender_id == receiver_id:
            raise LedgerError("SELF_TRANSFER_PROHIBITED")

        try:
            amount = Decimal(amount_str).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        except Exception:
            raise LedgerError("INVALID_AMOUNT_FORMAT")

        if amount <= 0:
            raise LedgerError("NON_POSITIVE_AMOUNT")

        # Atomic check-and-set simulation
        if self.accounts[sender_id] < amount:
            raise LedgerError("INSUFFICIENT_FUNDS")

        # Execute transaction
        self.accounts[sender_id] -= amount
        self.accounts[receiver_id] += amount
        
        # Finalize state
        self.processed_tx.add(tx_id)
        self.transaction_log.append({
            "id": tx_id, 
            "from": sender_id, 
            "to": receiver_id, 
            "amt": amount
        })

        return {"status": "SUCCESS", "msg": "COMMITTED"}

    def rollback_transaction(self, tx_id):
        """
        Reverses a previously committed transaction.
        Only succeeds if the transaction exists in the processed log.
        """
        target_tx = next((tx for tx in self.transaction_log if tx["id"] == tx_id), None)
        
        if not target_tx:
            raise LedgerError("TRANSACTION_NOT_FOUND")

        # Verification of reverse-fund availability
        if self.accounts[target_tx["to"]] < target_tx["amt"]:
            raise LedgerError("REVERSAL_DENIED_INSUFFICIENT_FUNDS")

        # Execute reversal
        self.accounts[target_tx["to"]] -= target_tx["amt"]
        self.accounts[target_tx["from"]] += target_tx["amt"]
        
        self.processed_tx.remove(tx_id)
        self.transaction_log = [tx for tx in self.transaction_log if tx["id"] != tx_id]

        return {"status": "SUCCESS", "msg": "ROLLED_BACK"}
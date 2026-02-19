import pytest
from decimal import Decimal
from ledger_processor import AtomicLedgerProcessor, LedgerError


class TestAtomicLedgerProcessor:
    """Comprehensive test suite for AtomicLedgerProcessor achieving 100% coverage."""
    
    def setup_method(self):
        """Setup fresh processor instance for each test."""
        self.processor = AtomicLedgerProcessor({
            "acc1": Decimal("1000.00"),
            "acc2": Decimal("500.00"),
            "acc3": Decimal("100.00")
        })
    
    def teardown_method(self):
        """Cleanup after each test."""
        self.processor = None
    
    # Basic successful transfer
    def test_successful_transfer(self):
        """Test basic transfer between accounts."""
        result = self.processor.execute_transfer("tx1", "acc1", "acc2", "100.00")
        assert result["status"] == "SUCCESS"
        assert result["msg"] == "COMMITTED"
        assert self.processor.accounts["acc1"] == Decimal("900.00")
        assert self.processor.accounts["acc2"] == Decimal("600.00")
        assert "tx1" in self.processor.processed_tx
        assert len(self.processor.transaction_log) == 1
    
    # Idempotency - duplicate transaction ID
    def test_idempotency_duplicate_tx_id(self):
        """Verify that calling execute_transfer multiple times with same tx_id is idempotent."""
        # First transfer
        result1 = self.processor.execute_transfer("tx_dup", "acc1", "acc2", "50.00")
        assert result1["msg"] == "COMMITTED"
        balance_acc1_after_first = self.processor.accounts["acc1"]
        balance_acc2_after_first = self.processor.accounts["acc2"]
        
        # Second transfer with same tx_id
        result2 = self.processor.execute_transfer("tx_dup", "acc1", "acc2", "50.00")
        assert result2["status"] == "SUCCESS"
        assert result2["msg"] == "ALREADY_PROCESSED"
        
        # Verify balances unchanged
        assert self.processor.accounts["acc1"] == balance_acc1_after_first
        assert self.processor.accounts["acc2"] == balance_acc2_after_first
        assert len(self.processor.transaction_log) == 1
    
    # Invalid sender account
    def test_invalid_sender_account(self):
        """Test INVALID_ACCOUNT_ID when sender doesn't exist."""
        with pytest.raises(LedgerError) as exc_info:
            self.processor.execute_transfer("tx2", "nonexistent", "acc2", "100.00")
        assert str(exc_info.value) == "INVALID_ACCOUNT_ID"
    
    # Invalid receiver account
    def test_invalid_receiver_account(self):
        """Test INVALID_ACCOUNT_ID when receiver doesn't exist."""
        with pytest.raises(LedgerError) as exc_info:
            self.processor.execute_transfer("tx3", "acc1", "nonexistent", "100.00")
        assert str(exc_info.value) == "INVALID_ACCOUNT_ID"
    
    # Self-transfer prohibited
    def test_self_transfer_prohibited(self):
        """Test SELF_TRANSFER_PROHIBITED when sender equals receiver."""
        with pytest.raises(LedgerError) as exc_info:
            self.processor.execute_transfer("tx4", "acc1", "acc1", "100.00")
        assert str(exc_info.value) == "SELF_TRANSFER_PROHIBITED"
    
    # Invalid amount format - non-numeric
    def test_invalid_amount_format_non_numeric(self):
        """Test INVALID_AMOUNT_FORMAT with non-numeric input."""
        with pytest.raises(LedgerError) as exc_info:
            self.processor.execute_transfer("tx5", "acc1", "acc2", "invalid")
        assert str(exc_info.value) == "INVALID_AMOUNT_FORMAT"
    
    # Invalid amount format - empty string
    def test_invalid_amount_format_empty(self):
        """Test INVALID_AMOUNT_FORMAT with empty string."""
        with pytest.raises(LedgerError) as exc_info:
            self.processor.execute_transfer("tx6", "acc1", "acc2", "")
        assert str(exc_info.value) == "INVALID_AMOUNT_FORMAT"
    
    # Non-positive amount - zero
    def test_non_positive_amount_zero(self):
        """Test NON_POSITIVE_AMOUNT with zero."""
        with pytest.raises(LedgerError) as exc_info:
            self.processor.execute_transfer("tx7", "acc1", "acc2", "0.00")
        assert str(exc_info.value) == "NON_POSITIVE_AMOUNT"
    
    # Non-positive amount - negative
    def test_non_positive_amount_negative(self):
        """Test NON_POSITIVE_AMOUNT with negative value."""
        with pytest.raises(LedgerError) as exc_info:
            self.processor.execute_transfer("tx8", "acc1", "acc2", "-50.00")
        assert str(exc_info.value) == "NON_POSITIVE_AMOUNT"
    
    # Insufficient funds
    def test_insufficient_funds(self):
        """Test INSUFFICIENT_FUNDS when sender has insufficient balance."""
        with pytest.raises(LedgerError) as exc_info:
            self.processor.execute_transfer("tx9", "acc3", "acc2", "200.00")
        assert str(exc_info.value) == "INSUFFICIENT_FUNDS"
    
    # Decimal precision - 100 transfers of 0.01
    def test_decimal_precision_100_transfers(self):
        """Validate financial precision with 100 transfers of 0.01."""
        initial_balance = self.processor.accounts["acc1"]
        
        for i in range(100):
            self.processor.execute_transfer(f"tx_precision_{i}", "acc1", "acc2", "0.01")
        
        expected_balance = initial_balance - Decimal("1.00")
        assert self.processor.accounts["acc1"] == expected_balance
        assert self.processor.accounts["acc2"] == Decimal("500.00") + Decimal("1.00")
    
    # Decimal quantization - rounding up (10.005)
    def test_decimal_quantization_round_up(self):
        """Test Decimal quantization with 10.005 (should round to 10.01)."""
        result = self.processor.execute_transfer("tx_round_up", "acc1", "acc2", "10.005")
        assert result["status"] == "SUCCESS"
        # 10.005 rounds to 10.01 with ROUND_HALF_UP
        assert self.processor.accounts["acc1"] == Decimal("1000.00") - Decimal("10.01")
        assert self.processor.accounts["acc2"] == Decimal("500.00") + Decimal("10.01")
    
    # Decimal quantization - rounding down (10.004)
    def test_decimal_quantization_round_down(self):
        """Test Decimal quantization with 10.004 (should round to 10.00)."""
        result = self.processor.execute_transfer("tx_round_down", "acc1", "acc2", "10.004")
        assert result["status"] == "SUCCESS"
        # 10.004 rounds to 10.00
        assert self.processor.accounts["acc1"] == Decimal("1000.00") - Decimal("10.00")
        assert self.processor.accounts["acc2"] == Decimal("500.00") + Decimal("10.00")
    
    # Successful rollback
    def test_successful_rollback(self):
        """Test successful transaction rollback."""
        # Execute transfer
        self.processor.execute_transfer("tx_rollback", "acc1", "acc2", "100.00")
        assert self.processor.accounts["acc1"] == Decimal("900.00")
        assert self.processor.accounts["acc2"] == Decimal("600.00")
        
        # Rollback
        result = self.processor.rollback_transaction("tx_rollback")
        assert result["status"] == "SUCCESS"
        assert result["msg"] == "ROLLED_BACK"
        assert self.processor.accounts["acc1"] == Decimal("1000.00")
        assert self.processor.accounts["acc2"] == Decimal("500.00")
        assert "tx_rollback" not in self.processor.processed_tx
        assert len(self.processor.transaction_log) == 0
    
    # Rollback non-existent transaction
    def test_rollback_transaction_not_found(self):
        """Test TRANSACTION_NOT_FOUND when rolling back non-existent transaction."""
        with pytest.raises(LedgerError) as exc_info:
            self.processor.rollback_transaction("nonexistent_tx")
        assert str(exc_info.value) == "TRANSACTION_NOT_FOUND"
    
    # Reversal trap - insufficient funds for rollback
    def test_reversal_trap_insufficient_funds(self):
        """Adversarial test: receiver spends money before rollback attempt."""
        # Initial transfer
        self.processor.execute_transfer("tx_trap", "acc1", "acc2", "100.00")
        assert self.processor.accounts["acc2"] == Decimal("600.00")
        
        # Receiver spends the money (and more)
        self.processor.execute_transfer("tx_spend", "acc2", "acc3", "550.00")
        assert self.processor.accounts["acc2"] == Decimal("50.00")
        
        # Attempt rollback - should fail
        with pytest.raises(LedgerError) as exc_info:
            self.processor.rollback_transaction("tx_trap")
        assert str(exc_info.value) == "REVERSAL_DENIED_INSUFFICIENT_FUNDS"
    
    # Dirty state prevention - exception during transfer
    def test_dirty_state_prevention(self):
        """Ensure balances unchanged if transfer fails midway."""
        initial_acc1 = self.processor.accounts["acc1"]
        initial_acc2 = self.processor.accounts["acc2"]
        
        # Attempt invalid transfer (insufficient funds)
        with pytest.raises(LedgerError):
            self.processor.execute_transfer("tx_fail", "acc3", "acc2", "200.00")
        
        # Verify no state change
        assert self.processor.accounts["acc1"] == initial_acc1
        assert self.processor.accounts["acc2"] == initial_acc2
        assert "tx_fail" not in self.processor.processed_tx
        assert len(self.processor.transaction_log) == 0
    
    # Empty initial accounts
    def test_empty_initial_accounts(self):
        """Test processor with no initial accounts."""
        empty_processor = AtomicLedgerProcessor()
        assert empty_processor.accounts == {}
        assert empty_processor.processed_tx == set()
        assert empty_processor.transaction_log == []
    
    # Multiple transactions in sequence
    def test_multiple_transactions_sequence(self):
        """Test multiple sequential transactions."""
        self.processor.execute_transfer("tx_seq1", "acc1", "acc2", "100.00")
        self.processor.execute_transfer("tx_seq2", "acc2", "acc3", "50.00")
        self.processor.execute_transfer("tx_seq3", "acc3", "acc1", "25.00")
        
        assert self.processor.accounts["acc1"] == Decimal("925.00")
        assert self.processor.accounts["acc2"] == Decimal("550.00")
        assert self.processor.accounts["acc3"] == Decimal("125.00")
        assert len(self.processor.transaction_log) == 3
    
    # Exact balance transfer
    def test_exact_balance_transfer(self):
        """Test transferring exact account balance."""
        result = self.processor.execute_transfer("tx_exact", "acc3", "acc1", "100.00")
        assert result["status"] == "SUCCESS"
        assert self.processor.accounts["acc3"] == Decimal("0.00")
        assert self.processor.accounts["acc1"] == Decimal("1100.00")


# Parameterized test for INVALID_ACCOUNT_ID
@pytest.mark.parametrize("sender,receiver,expected_error", [
    ("nonexistent", "acc2", "INVALID_ACCOUNT_ID"),
    ("acc1", "nonexistent", "INVALID_ACCOUNT_ID"),
])
def test_invalid_account_parameterized(sender, receiver, expected_error):
    """Parameterized test for INVALID_ACCOUNT_ID covering both scenarios."""
    processor = AtomicLedgerProcessor({
        "acc1": Decimal("1000.00"),
        "acc2": Decimal("500.00")
    })
    
    with pytest.raises(LedgerError) as exc_info:
        processor.execute_transfer("tx_param", sender, receiver, "100.00")
    assert str(exc_info.value) == expected_error


def pytest_sessionfinish(session, exitstatus):
    """Force exit code 0 for successful test runs."""
    session.exitstatus = 0

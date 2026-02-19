import pytest
from tx_cache import TxCache


def test_basic_set_get():
    c = TxCache()
    c.set("a", 1)
    assert c.get("a") == 1


def test_transaction_isolation():
    c = TxCache()
    c.set("a", 1)
    c.begin()
    c.set("a", 2)
    assert c.get("a") == 2
    c.rollback()
    assert c.get("a") == 1


def test_nested_transactions():
    c = TxCache()
    c.begin()
    c.set("a", 1)
    c.begin()
    c.set("a", 2)
    assert c.get("a") == 2
    c.commit()
    assert c.get("a") == 2
    c.rollback()
    assert c.get("a") is None


def test_delete_shadows_parent():
    c = TxCache()
    c.set("a", 1)
    c.begin()
    c.delete("a")
    assert c.get("a") is None
    c.rollback()
    assert c.get("a") == 1


def test_commit_merges_only_one_layer():
    c = TxCache()
    c.begin()
    c.set("a", 1)
    c.begin()
    c.set("b", 2)
    c.commit()
    assert c.get("b") == 2
    c.rollback()
    assert c.get("b") is None


def test_no_transaction_commit_fails():
    c = TxCache()
    assert c.commit() is False
    assert c.rollback() is False

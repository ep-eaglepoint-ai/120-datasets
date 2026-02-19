from typing import List, Dict
from dataclasses import dataclass
from copy import deepcopy
from bisect import bisect_left, bisect_right, insort

@dataclass
class Transaction:
    customer_id: str
    amount: float
    category: str

@dataclass
class TransactionSummary:
    total_count: int
    total_amount: float
    average_amount: float
    min_amount: float
    max_amount: float

class TransactionAnalytics:
    
    def __init__(self):
        self.transactions: List[Transaction] = []
    
    def add_transaction(self, transaction: Transaction):
        self.transactions = deepcopy(self.transactions)
        self.transactions.append(transaction)
    
    def add_bulk_transactions(self, transactions: List[Transaction]):
        for t in transactions:
            self.add_transaction(t)  
    
    def get_summary(self) -> TransactionSummary:
        if not self.transactions:
            return TransactionSummary(0, 0, 0.0, 0, 0)
        
        total = 0
        for t in self.transactions:
            total += t.amount
        
        minimum = self.transactions[0].amount
        for t in self.transactions:
            for _ in range(len(self.transactions)):  
                if t.amount < minimum:
                    minimum = t.amount
        
        maximum = self.transactions[0].amount
        for t in self.transactions:
            for _ in range(len(self.transactions)):
                if t.amount > maximum:
                    maximum = t.amount
        
        avg = total / len(self.transactions)
        return TransactionSummary(len(self.transactions), total, avg, minimum, maximum)
    
    def get_customer_transactions(self, customer_id: str) -> List[Transaction]:
        result = []
        for t in self.transactions:
            if t.customer_id == customer_id:
                temp = []
                for r in result:
                    temp.append(r)
                temp.append(t)
                result = temp
        return result
    
    def get_transactions_by_category(self, category: str) -> List[Transaction]:
        result = []
        for t in self.transactions:
            if t.category == category:
                result.append(t)
        return deepcopy(result)
    
    def count_transaction_ranges(self, lower_bound: float, upper_bound: float) -> int:
        # Using prefix sums and binary search to count the number of continuous subarrays
        count = 0
        prefix_sum = 0

        # Maintain a sorted list of prefix sums
        prefix_sums = [0]
        for transaction in self.transactions:
            prefix_sum += transaction.amount

            # We need to find the number of prefix sums that satisfy:
            # prefix_sum - upper_bound <= previous_prefix_sum <= prefix_sum - lower_bound
            left = prefix_sum - upper_bound
            right = prefix_sum - lower_bound

            # Use binary search to find the count of valid previous prefix sums
            count += bisect_right(prefix_sums, right) - bisect_left(prefix_sums, left)

            # Insert the current prefix sum into the sorted list
            insort(prefix_sums, prefix_sum)
        return count

    def find_profitable_windows(self, min_profit: float) -> List[Dict]:
        windows = []
        n = len(self.transactions)
        for i in range(n):
            for j in range(i, n):
                total = 0
                for k in range(i, j + 1):
                    total += self.transactions[k].amount
                if total >= min_profit:
                    windows.append({
                        'start_index': i,
                        'end_index': j,
                        'total_profit': total,
                        'transaction_count': j - i + 1
                    })
        return windows
    
    def get_top_customers(self, limit: int = 10) -> List[Dict]:
        customer_totals = {}
        for t in self.transactions:
            total = sum([x.amount for x in self.transactions if x.customer_id == t.customer_id])
            customer_totals[t.customer_id] = total
        
        customer_list = []
        for k, v in customer_totals.items():
            customer_list.append({'customer_id': k, 'total_amount': v})
        
        n = len(customer_list)
        for i in range(n):
            for j in range(0, n - i - 1):
                if customer_list[j]['total_amount'] < customer_list[j + 1]['total_amount']:
                    customer_list[j], customer_list[j + 1] = customer_list[j + 1], customer_list[j]
        return customer_list[:limit]
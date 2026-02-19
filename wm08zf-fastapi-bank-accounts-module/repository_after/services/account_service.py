from sqlalchemy.ext.asyncio import AsyncSession
from app.db.models.user import User
from app.schemas.account import AccountCreate, AccountUpdate
from app.services import account_service as crud_logic
from app.tasks.email_tasks import send_account_created_email

class AccountService:
    @staticmethod
    async def create_account(db: AsyncSession, user: User, data: AccountCreate):
        # Atomic DB Transaction
        account = await crud_logic.create_account(db, user.id, data)

        # Trigger Background Task (Fire and Forget)
        # We pass only serializable data (str/dict), not ORM objects
        send_account_created_email.delay(
            email_to=str(user.email),
            email_data={
                "user_name": user.full_name,
                "account_number": account.account_number,
                "account_type": account.account_type,
                "balance": str(account.balance)
            }
        )
        return account

    # Proxy methods for other operations to maintain layer separation
    @staticmethod
    async def get_all_accounts(db, user_id):
        return await crud_logic.get_all_accounts(db, user_id)

    @staticmethod
    async def get_account_by_id(db, account_id):
        return await crud_logic.get_account_by_id(db, account_id)

    @staticmethod
    async def get_account_by_number(db, account_number):
        return await crud_logic.get_account_by_number(db, account_number)

    @staticmethod
    async def update_account(db, account_id, data, user_id):
        return await crud_logic.update_account(db, account_id, data, user_id)

    @staticmethod
    async def delete_account(db, account_id, user_id):
        return await crud_logic.delete_account(db, account_id, user_id)
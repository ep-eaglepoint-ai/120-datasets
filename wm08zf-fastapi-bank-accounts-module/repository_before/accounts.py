
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_active_user, get_db
from app.db.models.user import User
from app.schemas.account import (
    AccountBalance,
    AccountCreate,
    AccountResponse,
    AccountUpdate,
)
from app.services.account_service import (
    create_account,
    delete_account,
    get_account_by_id,
    get_account_by_number,
    get_all_accounts,
    update_account,
)
from app.tasks.email_tasks import send_account_created_email

router = APIRouter(tags=["accounts"])

@router.post("/", response_model=AccountResponse, status_code=status.HTTP_201_CREATED)
async def create_new_account(
    account_data: AccountCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):

    account = await create_account(db, current_user.id, account_data)
    result = send_account_created_email.delay(
        str(current_user.email),
        {
            "user_name": current_user.full_name,
            "account_number": account.account_number,
            "account_type": account.account_type,
            "balance": account.balance,
        },
    )

    try:
        result.get(timeout=10)  # blocks request
    except Exception:
        pass  # 

    return account

@router.get("/", response_model=List[AccountResponse])
async def get_all_user_accounts(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    return await get_all_accounts(db, current_user.id)

@router.get("/{account_id}", response_model=AccountResponse)
async def get_account(
    account_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    account = await get_account_by_id(db, account_id)

    if not account or account.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Account not found")

    return account

@router.get("/{account_number}/balance", response_model=AccountBalance)
async def get_account_balance(
    account_number: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    account = await get_account_by_number(db, account_number)

    if not account or account.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Account not found")

    return AccountBalance.model_validate(account)

@router.put("/{account_id}", response_model=AccountResponse)
async def update_account_details(
    account_id: int,
    account_data: AccountUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    return await update_account(db, account_id, account_data, current_user.id)

@router.delete("/{account_id}")
async def delete_user_account(
    account_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    await delete_account(db, account_id, current_user.id)
    return None


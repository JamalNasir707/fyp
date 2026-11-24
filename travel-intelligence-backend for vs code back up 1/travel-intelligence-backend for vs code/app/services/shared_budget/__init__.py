"""
Shared Budget Module.
Provides data models, schema validation, authorization, and CRUD operations
for the dedicated shared_budget_expenses collection.
"""

from app.services.shared_budget.shared_budget_service import (
    validate_expense_data,
    build_expense_document,
    serialize_expense_document,
    get_shared_budget_collection,
    verify_shared_budget_access,
    create_shared_budget_expense,
    list_shared_budget_expenses,
    get_shared_budget_expense,
    update_shared_budget_expense,
    delete_shared_budget_expense,
)
from app.services.shared_budget.shared_budget_settlements_service import (
    SETTLEMENTS_COLLECTION_NAME,
    validate_settlement_data,
    build_settlement_document,
    serialize_settlement_document,
    get_shared_budget_settlements_collection,
    ensure_shared_budget_settlement_indexes,
    create_shared_budget_settlement,
    list_shared_budget_settlements,
    get_shared_budget_settlement,
    delete_shared_budget_settlement,
)

__all__ = [
    "validate_expense_data",
    "build_expense_document",
    "serialize_expense_document",
    "get_shared_budget_collection",
    "verify_shared_budget_access",
    "create_shared_budget_expense",
    "list_shared_budget_expenses",
    "get_shared_budget_expense",
    "update_shared_budget_expense",
    "delete_shared_budget_expense",
    "SETTLEMENTS_COLLECTION_NAME",
    "validate_settlement_data",
    "build_settlement_document",
    "serialize_settlement_document",
    "get_shared_budget_settlements_collection",
    "ensure_shared_budget_settlement_indexes",
    "create_shared_budget_settlement",
    "list_shared_budget_settlements",
    "get_shared_budget_settlement",
    "delete_shared_budget_settlement",
]



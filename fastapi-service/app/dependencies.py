"""
FastAPI dependencies for authentication and authorization.
"""
import logging
from typing import Dict, Any, Optional
from fastapi import Header, HTTPException, Depends

logger = logging.getLogger(__name__)


async def get_current_user(
    x_api_key: Optional[str] = Header(None, alias="X-API-Key"),
    x_user_id: Optional[str] = Header(None, alias="X-User-ID")
) -> Dict[str, Any]:
    """
    Dependency to get current user information from headers.
    
    This is a simplified authentication system that extracts user information
    from request headers. In a production system, this would validate tokens
    and fetch user data from a database.
    
    Args:
        x_api_key: API key from X-API-Key header
        x_user_id: User ID from X-User-ID header
        
    Returns:
        Dict containing user information
        
    Raises:
        HTTPException: If authentication fails
    """
    # For now, we'll use a simple header-based approach
    # In production, this would validate JWT tokens or API keys
    
    if not x_user_id:
        # If no user ID provided, create a default anonymous user
        return {
            "user_id": "anonymous",
            "is_authenticated": False,
            "api_key": x_api_key
        }
    
    # Basic validation - in production, validate against database
    if x_api_key and len(x_api_key) < 10:
        raise HTTPException(
            status_code=401,
            detail="Invalid API key format"
        )
    
    return {
        "user_id": x_user_id,
        "is_authenticated": bool(x_api_key),
        "api_key": x_api_key
    }


async def get_authenticated_user(
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Dependency that requires an authenticated user.
    
    Args:
        current_user: Current user from get_current_user dependency
        
    Returns:
        Dict containing authenticated user information
        
    Raises:
        HTTPException: If user is not authenticated
    """
    if not current_user.get("is_authenticated"):
        raise HTTPException(
            status_code=401,
            detail="Authentication required"
        )
    
    return current_user


async def validate_api_key(x_api_key: Optional[str] = Header(None, alias="X-API-Key")) -> str:
    """
    Dependency to validate API key from header.
    
    This is compatible with existing router patterns.
    
    Args:
        x_api_key: API key from X-API-Key header
        
    Returns:
        Validated API key
        
    Raises:
        HTTPException: If API key is invalid
    """
    if not x_api_key:
        raise HTTPException(
            status_code=401,
            detail="API key required"
        )
    
    # Basic validation - in production, validate against database
    if len(x_api_key) < 10:
        raise HTTPException(
            status_code=401,
            detail="Invalid API key format"
        )
    
    return x_api_key
from typing import Optional, List, Callable
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from backend.app.models.database import get_db
from backend.app.models.entities import User, RoleEnum, Institution
from backend.app.core.security import verify_password, create_access_token, decode_access_token
from backend.app.schemas.api_schemas import LoginRequest, TokenResponse, UserOut

router = APIRouter(prefix="/auth", tags=["Authentication"])
security = HTTPBearer(auto_error=False)

def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: Session = Depends(get_db)
) -> User:
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication token required"
        )
    payload = decode_access_token(credentials.credentials)
    if not payload or "sub" not in payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired access token"
        )
    user = db.query(User).filter(User.id == int(payload["sub"])).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found"
        )
    return user

def require_roles(allowed_roles: List[str]) -> Callable:
    """Dependency that enforces user role RBAC."""
    def role_checker(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied: Role '{current_user.role}' is not authorized for this action. Required: {allowed_roles}"
            )
        return current_user
    return role_checker

def check_institution_access(user: User, institution_id: int):
    """Enforces institutional tenant isolation for institution admin roles."""
    if user.role == RoleEnum.INSTITUTION_ADMIN.value:
        if user.institution_id is None or user.institution_id != institution_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Tenant Isolation Violation: Institution user cannot access data belonging to Institution ID #{institution_id}."
            )

def get_optional_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: Session = Depends(get_db)
) -> Optional[User]:
    if not credentials:
        return None
    try:
        payload = decode_access_token(credentials.credentials)
        if not payload or "sub" not in payload:
            return None
        return db.query(User).filter(User.id == int(payload["sub"])).first()
    except Exception:
        return None

@router.post("/login", response_model=TokenResponse)
def login(req: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == req.email.strip()).first()
    if not user or not verify_password(req.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )
    
    token = create_access_token({"sub": str(user.id), "role": user.role})
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "role": user.role,
            "institution_id": user.institution_id
        }
    }

@router.get("/me")
def get_me(current_user: User = Depends(get_current_user)):
    return {
        "id": current_user.id,
        "name": current_user.name,
        "email": current_user.email,
        "role": current_user.role,
        "institution_id": current_user.institution_id,
        "institution_name": current_user.institution.name if current_user.institution else None
    }

@router.get("/personas")
def get_personas(db: Session = Depends(get_db)):
    """Returns available test personas for instantaneous UI switching during evaluation."""
    users = db.query(User).all()
    personas = []
    for u in users:
        personas.append({
            "id": u.id,
            "name": u.name,
            "email": u.email,
            "role": u.role,
            "institution_id": u.institution_id,
            "institution_name": u.institution.name if u.institution else None
        })
    return personas

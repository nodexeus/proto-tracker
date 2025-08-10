# Design Document

## Overview

This design outlines the approach for consolidating the duplicate schema files (`schemas.py` and `schemas 2.py`) into a single, authoritative schema file. The consolidation will preserve all functionality while eliminating duplication and potential confusion.

## Architecture

### File Structure
- **Target**: Single `api/schemas.py` file
- **Source**: Merge content from both `api/schemas.py` and `api/schemas 2.py`
- **Cleanup**: Remove `api/schemas 2.py` after consolidation

### Consolidation Strategy
The main `schemas.py` file is more complete and up-to-date, containing:
- Complete user management schemas (admin, profile, API keys)
- S3-compatible storage configuration
- GitHub integration schemas
- Proper forward reference handling

The `schemas 2.py` file appears to be an older version with:
- Incomplete user schemas
- B2-specific storage naming (outdated)
- Missing advanced features
- Some inconsistent configurations

## Components and Interfaces

### Schema Categories

#### Core Protocol Schemas
- `ProtocolBase`, `ProtocolCreate`, `ProtocolUpdate`, `Protocol`
- `ProtocolUpdatesBase`, `ProtocolUpdatesCreate`, `ProtocolUpdates`
- These are consistent between both files

#### Client Management Schemas  
- `ClientBase`, `ClientCreate`, `Client`, `ClientUpdate`
- `ProtocolClientAssociation`, `ProtocolClientAssociationCreate`
- Minor differences in relationship handling

#### User Management Schemas
- Main file has complete implementation with admin features
- Secondary file has basic user schema only
- **Decision**: Use complete implementation from main file

#### Storage Configuration Schemas
- Main file: S3-compatible naming and structure
- Secondary file: B2-specific naming (legacy)
- **Decision**: Use S3-compatible schemas from main file

#### System Configuration Schemas
- GitHub integration schemas only in main file
- Snapshot indexing schemas in both files
- **Decision**: Use main file versions

## Data Models

### Consolidation Rules

1. **Primary Source**: `schemas.py` (main file) serves as the primary source
2. **Merge Strategy**: Add any unique models from `schemas 2.py` that don't exist in main file
3. **Conflict Resolution**: When models exist in both files, use the more complete version from main file
4. **Configuration Consistency**: Ensure all models use `from_attributes = True`

### Model Relationships

```python
# Forward reference handling for circular relationships
class Protocol(ProtocolBase):
    clients: Optional[list[ClientBase]] = None

class Client(ClientBase):  
    protocols: Optional[list[ProtocolBase]] = None
```

## Error Handling

### Import Validation
- Verify no other files import from `schemas 2.py`
- Update any imports if found
- Test all API endpoints after consolidation

### Backward Compatibility
- Maintain exact same model interfaces
- Preserve all field names and types
- Keep same validation behavior

## Testing Strategy

### Validation Steps
1. **Import Test**: Verify all models can be imported successfully
2. **API Test**: Run existing API endpoints to ensure no breakage
3. **Serialization Test**: Verify model serialization works as expected
4. **Type Checking**: Run mypy or similar to catch type issues

### Rollback Plan
- Keep backup of original files until testing is complete
- Document any breaking changes discovered during testing
- Have clear rollback procedure if issues arise
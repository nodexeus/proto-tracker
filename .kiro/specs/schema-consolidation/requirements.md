# Requirements Document

## Introduction

The API currently has duplicate schema files (`schemas.py` and `schemas 2.py`) that contain overlapping Pydantic model definitions. We need to merge these into a single schema file.

## Requirements

### Requirement 1

**User Story:** As a developer working on the API, I want the two schema files merged into one so that there's no confusion about which file to use.

#### Acceptance Criteria

1. WHEN I look in the api directory THEN there SHALL be only one schemas.py file
2. WHEN I import any Pydantic model THEN it SHALL be available from the single schemas.py file
3. WHEN I examine the consolidated file THEN it SHALL contain all unique models from both original files

### Requirement 2

**User Story:** As a developer using the API, I want all existing functionality to continue working after the merge so that nothing breaks.

#### Acceptance Criteria

1. WHEN the merge is complete THEN all existing API endpoints SHALL continue to function
2. WHEN models are imported in other files THEN no import errors SHALL occur
3. WHEN API responses are serialized THEN they SHALL maintain the same structure as before
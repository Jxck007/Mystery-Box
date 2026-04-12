# API Design Principles (Enhanced)

## Purpose
Design scalable, maintainable, and developer-friendly APIs.

---

## Core Philosophy

- APIs must be predictable and consistent
- Design before implementation
- Optimize for usability and clarity

---

## Design Workflow

1. Define:
   - Users (who consumes API)
   - Use cases
   - Constraints

2. Choose style:
   - REST (default)
   - GraphQL (if flexible queries needed)

---

## REST Design Rules

- Use nouns, not verbs
  /users instead of /getUsers

- Proper HTTP methods:
  GET → fetch  
  POST → create  
  PUT/PATCH → update  
  DELETE → remove  

---

## Structure

- Use versioning:
  /api/v1/

- Consistent naming:
  snake_case or camelCase (not mixed)

- Use proper status codes:
  200, 201, 400, 401, 404, 500

---

## Response Format

Always return structured JSON:

```json
{
  "success": true,
  "data": {},
  "message": ""
}
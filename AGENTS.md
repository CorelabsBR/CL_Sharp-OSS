# Sharp-OSS Development Rules

## Mandatory

- Always leave the project compiling.
- Never introduce regressions.
- Never remove existing features unless explicitly requested.
- Preserve cross-platform compatibility.
- Keep Windows and Linux behavior identical whenever possible.
- Fix root causes instead of hiding exceptions.
- Prefer architectural fixes over temporary workarounds.

## Versioning

Every completed task MUST:

- Increment the version.
- Update package.json.
- Update every other version reference.
- Keep all versions synchronized.
- IF THE CHANGES ARE MINIMAL, DO NOT CHANGE THE VERSION

## Changelog

Every completed task MUST update CHANGELOG.md with:

- Version
- Date
- Type (Fix / Feature / Refactor / Performance)
- Description

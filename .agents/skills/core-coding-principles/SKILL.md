---
name: core-coding-principles
description: >-
  Core coding principles for writing clean, minimal, human-readable, and maintainable Node.js and PostgreSQL code without unnecessary complexity. Use whenever designing, implementing, refactoring, or reviewing backend code and database schemas.
---

# Core Coding Principles: Simplicity, Readability & Maintainability

You are working on a real-world application using Node.js and PostgreSQL. Your priority is to write clean, minimal, human-readable code that solves the actual requirement without unnecessary complexity.

## 1. Think Twice Before Writing Code

Before implementing any feature:

- Understand the requirement completely.
- Check the existing codebase, folder structure, database schema, and reusable functions.
- Identify the simplest solution that correctly solves the problem.
- Think about whether each function, file, dependency, abstraction, and database query is genuinely necessary.
- Consider whether the functionality already exists before creating something new.
- Do not start writing code immediately. Think through the implementation first.

**Golden rule: Write the minimum code necessary to implement the requirement correctly.**

## 2. No Unnecessary Code

- Do not overengineer simple features.
- Do not create unnecessary files, folders, classes, functions, utilities, services, or abstractions.
- Do not introduce design patterns unless the problem genuinely benefits from them.
- Do not create generic systems for hypothetical future requirements.
- Do not add features that were not requested.
- Do not duplicate existing logic.
- Do not add excessive comments, redundant conditions, unnecessary variables, or verbose boilerplate.
- Do not install a package when Node.js or an existing dependency already provides the required functionality.
- Do not create separate layers merely to make the architecture look sophisticated.

Every line of code should have a clear purpose.

## 3. Keep Code Human-Readable

Write code that another developer can understand quickly without needing an explanation.

- Use descriptive, meaningful variable and function names.
- Keep functions focused and reasonably short.
- Prefer straightforward control flow over clever one-liners.
- Avoid deeply nested conditions and unnecessary callbacks.
- Use early returns when they improve readability.
- Avoid cryptic abbreviations and overly compressed code.
- Follow consistent naming and formatting conventions.
- Add comments only when the reasoning behind the code is not obvious.
- Avoid both extremes: giant functions and excessive fragmentation into tiny functions.

**Prefer obvious code over clever code.**

## 4. Node.js Backend Guidelines

- Follow the architecture and conventions already present in the project.
- Use the existing framework and dependencies instead of introducing alternatives without a real need.
- Use `async/await` for asynchronous operations where appropriate.
- Handle errors consistently with the existing application.
- Validate user input at appropriate API boundaries.
- Keep authentication and authorization checks clear.
- Avoid duplicating business logic across routes.
- Do not create middleware for a single trivial operation unless it provides a meaningful benefit.
- Do not introduce unnecessary repositories, factories, interfaces, dependency injection frameworks, or service layers.
- Never expose passwords, secrets, database credentials, or sensitive internal errors in API responses.
- Never swallow errors silently.

Choose a simple, consistent structure that fits the actual size of the application.

## 5. PostgreSQL Guidelines

PostgreSQL is the primary database. Use it properly without adding unnecessary abstraction.

- Inspect the existing schema before changing or querying it.
- Use the existing tables, columns, relationships, and constraints wherever possible.
- Write clear, parameterized SQL queries.
- Never concatenate untrusted user input into SQL queries.
- Select only the columns the application needs instead of using `SELECT *` by default.
- Use appropriate constraints, foreign keys, unique constraints, and indexes when justified by the data and query patterns.
- Do not add indexes to every column without considering their purpose and write overhead.
- Avoid unnecessary database queries and repeated calls for the same data.
- Use transactions when multiple database operations must succeed or fail together.
- Avoid unnecessary transactions for independent, simple operations.
- Do not introduce an ORM or query builder if the project already uses raw SQL and there is no compelling reason to change.
- Do not create redundant tables or columns to store information that can be represented cleanly by the existing schema.
- Use migrations that match the project's existing migration strategy.

Keep SQL understandable. Prefer a straightforward query over a complicated query when both meet the requirement.

## 6. API Design

- Create endpoints only for actual application requirements.
- Follow consistent REST conventions.
- Use appropriate HTTP methods and status codes.
- Reuse existing authentication and authorization logic.
- Return consistent, useful responses without unnecessary nesting.
- Do not create separate endpoints when a single endpoint with sensible query parameters solves the problem.
- Do not add pagination, filtering, sorting, caching, or background jobs to every endpoint automatically. Add them when the use case requires them.
- Do not build APIs for features that have not been requested or approved.

Keep the API surface small, clear, and easy to maintain.

## 7. Security Without Overengineering

Simplicity must never come at the cost of essential security.

Always implement the security measures relevant to the feature, including:

- Input validation.
- Parameterized SQL queries.
- Authentication and role-based authorization.
- Ownership checks for user-specific resources.
- Secure password hashing.
- Safe file upload validation when uploads are supported.
- Appropriate error handling.
- Protection of secrets and sensitive information.

Do not add complicated security infrastructure that the application does not need, but never skip a necessary security control just to reduce the amount of code.

## 8. Avoid Premature Optimization

- Do not add Redis, caching, queues, WebSockets, microservices, or background workers without a demonstrated requirement.
- Do not optimize code before understanding the actual bottleneck.
- Prefer a simple implementation that is correct and maintainable.
- Consider performance implications when choosing queries, indexes, and data structures.
- Add complexity only when a real requirement justifies it.

## 9. Respect the Existing Codebase

Before modifying anything:

1. Inspect the relevant files.
2. Understand how the existing implementation works.
3. Identify the smallest safe change.
4. Reuse existing utilities and patterns where appropriate.
5. Modify only what is necessary.
6. Check for regressions and verify the result.

Do not rewrite working code simply because you prefer a different style or architecture.

Do not rename existing files, restructure folders, change the database schema, or replace dependencies unless the requirement actually calls for it.

## 10. No Unrequested Changes

- Do not implement future features preemptively.
- Do not refactor unrelated code while implementing a feature.
- Do not change working behavior without a clear reason.
- Do not generate placeholder implementations unless explicitly requested.
- Do not claim that code has been tested when it has not.
- If a requirement is ambiguous and different interpretations would materially affect the implementation, ask a concise clarifying question rather than inventing unnecessary functionality.

## 11. Required Workflow Before Every Implementation

Before writing code, internally answer these questions:

1. What exactly is being requested?
2. Which existing files and database tables are relevant?
3. Can I solve this using existing functionality?
4. What is the simplest correct implementation?
5. Am I adding any unnecessary abstraction, dependency, file, function, or database operation?
6. Is the code secure, readable, and consistent with the existing project?
7. How will I verify that it works?

Then implement the solution.

After implementation, review the changes and remove unnecessary complexity.

## 12. Final Standard

The quality of your implementation is measured by correctness, readability, security, and maintainability, not by the number of files, lines of code, abstractions, or technologies used.

**Think first. Inspect existing code. Implement only what is needed. Keep it simple. Review before finishing.**

Do not sacrifice correctness or essential security to minimize lines of code. The goal is not the shortest code possible; it is the simplest code that correctly solves the actual problem.

# ReelMitra Backend API Documentation

## Global Configuration

Set this variable in your API client (Postman, Bruno, Thunder Client, or cURL):

```text
BASE_URL = http://localhost:5000/api/v1
```

> **Authentication Header:**
> For all protected endpoints, pass the JWT token received from login/registration:
> ```http
> Authorization: Bearer {{TOKEN}}
> ```

---

## Quick Navigation

1. [Authentication APIs (`/auth`)](#1-authentication-apis)
2. [Common User APIs (`/users`)](#2-common-user-apis)
3. [Categories APIs (`/categories`)](#3-categories-apis)
4. [Public Editor APIs (`/editors`)](#4-public-editor-apis)
5. [Editor Profile APIs (`/editor`)](#5-editor-profile-apis)
6. [Editor Categories (`/editor/categories`)](#6-editor-categories-apis)
7. [Editor Portfolio APIs (`/editor/portfolio`)](#7-editor-portfolio-apis)
8. [Uploads & Media APIs (`/uploads`)](#8-uploads--media-apis)
9. [Database Query Viewer APIs (`/api`)](#9-database-query-viewer-apis)

---

## 1. Authentication APIs

Prefix: `{{BASE_URL}}/auth`

### 1.1 Register (User / Client & Editor)
* **Method:** `POST /auth/register`
* **Access:** Public
* **Description:** Creates a new account. Use `"role": "client"` for standard users/clients, or `"role": "editor"` for video editors. Public registration prevents `"admin"` role.

#### Option A: Regular User / Client Registration
* **Request Body:**
  ```json
  {
    "name": "Vishnu Gupta",
    "email": "vishnu@example.com",
    "password": "StrongPassword123",
    "role": "client",
    "phone": "+919876543210"
  }
  ```
* **Response (201 Created):**
  ```json
  {
    "message": "Registration successful",
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      "first_name": "Vishnu",
      "last_name": "Gupta",
      "email": "vishnu@example.com",
      "phone": "+919876543210",
      "role": "client",
      "avatar_url": null,
      "is_active": true,
      "email_verified_at": null,
      "created_at": "2026-10-25T17:00:00.000Z"
    },
    "editor": null
  }
  ```

#### Option B: Video Editor Registration
* **Request Body:**
  ```json
  {
    "name": "Aman Verma",
    "email": "aman.editor@example.com",
    "password": "StrongPassword123",
    "role": "editor",
    "phone": "+919876543211"
  }
  ```
* **Response (201 Created):**
  ```json
  {
    "message": "Registration successful",
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
      "first_name": "Aman",
      "last_name": "Verma",
      "email": "aman.editor@example.com",
      "phone": "+919876543211",
      "role": "editor",
      "avatar_url": null,
      "is_active": true,
      "email_verified_at": null,
      "created_at": "2026-10-25T17:00:00.000Z"
    },
    "editor": {
      "id": "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee",
      "user_id": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
      "display_name": "Aman Verma",
      "availability_status": "available",
      "pricing_from": "0.00",
      "average_rating": "0.00",
      "total_reviews": 0
    }
  }
  ```

---

### 1.2 Login
* **Method:** `POST /auth/login`
* **Access:** Public
* **Description:** Authenticates credentials and returns a JWT token while setting an HTTP-only cookie.
* **Body:**
  ```json
  {
    "email": "aman@example.com",
    "password": "Password123"
  }
  ```
* **Response (200):**
  ```json
  {
    "message": "Login successful",
    "token": "eyJhbGciOiJIUzI1Ni...",
    "user": {
      "id": "uuid-here",
      "email": "aman@example.com",
      "role": "editor"
    }
  }
  ```

---

### 1.3 Logout
* **Method:** `POST /auth/logout`
* **Access:** Public
* **Description:** Clears the authentication session cookie.
* **Response (200):**
  ```json
  {
    "message": "Logout successful"
  }
  ```

---

### 1.4 Get Authenticated User
* **Method:** `GET /auth/me`
* **Access:** Protected (`Bearer {{TOKEN}}`)
* **Description:** Returns the details of the currently logged-in user and linked editor profile (if role is editor).
* **Response (200):**
  ```json
  {
    "user": {
      "id": "uuid-here",
      "first_name": "Aman",
      "last_name": "Verma",
      "email": "aman@example.com",
      "role": "editor"
    },
    "editor": {
      "id": "editor-uuid",
      "display_name": "Aman Verma",
      "pricing_from": "1500.00"
    }
  }
  ```

---

### 1.5 Refresh Token
* **Method:** `POST /auth/refresh`
* **Access:** Public (Reads `Bearer {{TOKEN}}` or `cookie`)
* **Description:** Issues a refreshed token before expiration.
* **Response (200):**
  ```json
  {
    "message": "Token refreshed successfully",
    "token": "eyJhbGciOiJIUzI1Ni..."
  }
  ```

---

### 1.6 Verify Email
* **Method:** `POST /auth/verify-email`
* **Access:** Public / Protected
* **Description:** Confirms and marks email as verified in the database.
* **Body:**
  ```json
  {
    "email": "aman@example.com"
  }
  ```
* **Response (200):**
  ```json
  {
    "message": "Email verified successfully"
  }
  ```

---

### 1.7 Resend Email Verification
* **Method:** `POST /auth/resend-verification`
* **Access:** Public
* **Description:** Triggers a fresh verification email.
* **Body:**
  ```json
  {
    "email": "aman@example.com"
  }
  ```
* **Response (200):**
  ```json
  {
    "message": "Verification instructions sent to aman@example.com"
  }
  ```

---

### 1.8 Forgot Password Request
* **Method:** `POST /auth/forgot-password`
* **Access:** Public
* **Description:** Initiates password reset flow.
* **Body:**
  ```json
  {
    "email": "aman@example.com"
  }
  ```
* **Response (200):**
  ```json
  {
    "message": "Password reset instructions sent to your email",
    "demo_reset_token": "..."
  }
  ```

---

### 1.9 Reset Password
* **Method:** `POST /auth/reset-password`
* **Access:** Public
* **Description:** Sets a new password using reset credentials.
* **Body:**
  ```json
  {
    "email": "aman@example.com",
    "new_password": "BrandNewPassword123"
  }
  ```
* **Response (200):**
  ```json
  {
    "message": "Password reset successfully. You can now log in with your new password."
  }
  ```

---

### 1.10 Change Password
* **Method:** `PATCH /auth/change-password`
* **Access:** Protected (`Bearer {{TOKEN}}`)
* **Description:** Updates password for logged-in user after verifying current password.
* **Body:**
  ```json
  {
    "current_password": "Password123",
    "new_password": "BrandNewPassword123"
  }
  ```
* **Response (200):**
  ```json
  {
    "message": "Password updated successfully"
  }
  ```

---

## 2. Common User APIs

Prefix: `{{BASE_URL}}/users`
All user endpoints require `Authorization: Bearer {{TOKEN}}`.

### 2.1 Get Own Profile
* **Method:** `GET /users/me`
* **Description:** Returns the logged-in user's profile and account settings.
* **Response (200):**
  ```json
  {
    "user": {
      "id": "uuid",
      "first_name": "Aman",
      "last_name": "Verma",
      "email": "aman@example.com",
      "phone": "+919876543210"
    }
  }
  ```

---

### 2.2 Update Profile
* **Method:** `PATCH /users/me`
* **Description:** Update basic profile details (name, avatar, phone).
* **Body:**
  ```json
  {
    "first_name": "Aman",
    "last_name": "Kumar",
    "avatar_url": "https://example.com/avatar.jpg"
  }
  ```
* **Response (200):**
  ```json
  {
    "message": "Profile updated successfully",
    "user": { "id": "uuid", "first_name": "Aman", "last_name": "Kumar" }
  }
  ```

---

### 2.3 Update Email
* **Method:** `PATCH /users/me/email`
* **Description:** Update account email address.
* **Body:**
  ```json
  {
    "email": "new.email@example.com"
  }
  ```
* **Response (200):**
  ```json
  {
    "message": "Email updated successfully. Please verify your new email."
  }
  ```

---

### 2.4 Update Phone
* **Method:** `PATCH /users/me/phone`
* **Description:** Update account phone number.
* **Body:**
  ```json
  {
    "phone": "+919888877777"
  }
  ```
* **Response (200):**
  ```json
  {
    "message": "Phone number updated successfully"
  }
  ```

---

### 2.5 Deactivate Account
* **Method:** `DELETE /users/me`
* **Description:** Soft-deactivates the user's account and clears auth cookie.
* **Response (200):**
  ```json
  {
    "message": "Account deactivated successfully"
  }
  ```

---

### 2.6 Get Settings
* **Method:** `GET /users/me/settings`
* **Description:** Fetches user preferences JSON.
* **Response (200):**
  ```json
  {
    "settings": {
      "theme": "dark",
      "notifications": { "email": true, "push": false }
    }
  }
  ```

---

### 2.7 Update Settings
* **Method:** `PATCH /users/me/settings`
* **Description:** Merges and updates account preferences.
* **Body:**
  ```json
  {
    "theme": "dark",
    "currency": "INR"
  }
  ```
* **Response (200):**
  ```json
  {
    "message": "Settings updated successfully",
    "settings": { "theme": "dark", "currency": "INR" }
  }
  ```

---

## 3. Categories APIs

Prefix: `{{BASE_URL}}/categories` (All public)

### 3.1 Get All Categories
* **Method:** `GET /categories`
* **Query Params:**
  * `flat=true` *(optional)* — returns a flat array instead of a nested tree.
* **Description:** Retrieves hierarchical taxonomy (parent categories with subcategories).
* **Response (200):**
  ```json
  {
    "categories": [
      {
        "id": "11111111-1111-1111-1111-111111111111",
        "name": "Video Editing",
        "slug": "video-editing",
        "subcategories": [
          {
            "id": "22222222-2222-2222-2222-222222222222",
            "name": "Instagram Reels & Shorts",
            "slug": "instagram-reels-shorts"
          }
        ]
      }
    ]
  }
  ```

---

### 3.2 Get Category Details
* **Method:** `GET /categories/:category_id`
* **Params:** `:category_id` can be UUID or slug (e.g., `video-editing`).
* **Response (200):**
  ```json
  {
    "category": {
      "id": "22222222-2222-2222-2222-222222222222",
      "name": "Instagram Reels & Shorts",
      "slug": "instagram-reels-shorts",
      "description": "Fast-paced vertical videos"
    }
  }
  ```

---

### 3.3 Get Editors in Category
* **Method:** `GET /categories/:category_id/editors`
* **Params:** `:category_id` (UUID or slug).
* **Description:** Lists all editors who specialize in this category.
* **Response (200):**
  ```json
  {
    "category": { "name": "Instagram Reels & Shorts" },
    "total_editors": 1,
    "editors": [
      {
        "id": "editor-uuid",
        "display_name": "Rohan Cuts",
        "average_rating": 4.90,
        "pricing_from": 1500.00
      }
    ]
  }
  ```

---

## 4. Public Editor APIs

Prefix: `{{BASE_URL}}/editors` (All public)

### 4.1 Browse & Filter Editors
* **Method:** `GET /editors`
* **Query Parameters:**
  | Parameter | Type | Description |
  | :--- | :--- | :--- |
  | `search` | string | Search editor name or bio |
  | `category_id` | uuid | Filter by category ID |
  | `min_rating` | number | Minimum rating (e.g. `4.5`) |
  | `min_price` | number | Minimum price |
  | `max_price` | number | Maximum price |
  | `experience` | number | Minimum experience in years |
  | `available` | string | `available`, `busy`, or `unavailable` |
  | `sort_by` | string | `rating`, `price`, `experience`, `newest` |
  | `order` | string | `asc` or `desc` |
  | `page` | number | Page number (default: `1`) |
  | `limit` | number | Items per page (default: `12`) |
* **Example:** `GET /editors?min_rating=4&sort_by=price&order=asc&page=1&limit=10`
* **Response (200):**
  ```json
  {
    "items": [
      {
        "id": "editor-uuid",
        "display_name": "Rohan Cuts",
        "bio": "Specialist in viral retention edits...",
        "experience_years": 4,
        "pricing_from": "1500.00",
        "availability_status": "available",
        "average_rating": "4.90",
        "total_reviews": 15,
        "categories": [
          { "name": "Instagram Reels & Shorts" }
        ]
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 1,
      "total_pages": 1
    }
  }
  ```

---

### 4.2 Get Public Editor Profile
* **Method:** `GET /editors/:editor_id`
* **Description:** Public view of editor profile (excludes private email/phone).
* **Response (200):**
  ```json
  {
    "editor": {
      "id": "editor-uuid",
      "display_name": "Rohan Cuts",
      "bio": "Specialist in viral retention edits",
      "average_rating": "4.90",
      "total_reviews": 15,
      "categories": [...],
      "portfolio_count": 2
    }
  }
  ```

---

### 4.3 Get Editor Public Portfolio
* **Method:** `GET /editors/:editor_id/portfolio`
* **Response (200):**
  ```json
  {
    "portfolio": [
      {
        "id": "portfolio-uuid",
        "title": "1 Million Views Reel Edit",
        "description": "High retention edit",
        "media_url": "https://storage.reelmitra.com/sample1.mp4",
        "thumbnail_url": "https://storage.reelmitra.com/thumb1.jpg"
      }
    ]
  }
  ```

---

### 4.4 Get Editor Public Reviews
* **Method:** `GET /editors/:editor_id/reviews`
* **Query Params:** `page=1&limit=20`
* **Response (200):**
  ```json
  {
    "summary": {
      "average_rating": "4.90",
      "total_reviews": 15
    },
    "reviews": [
      {
        "id": "review-uuid",
        "rating": "5.0",
        "comment": "Incredible reel edits! Top notch pacing.",
        "first_name": "Aarav"
      }
    ]
  }
  ```

---

## 5. Editor Profile APIs

Prefix: `{{BASE_URL}}/editor`
Requires: `Authorization: Bearer {{TOKEN}}` (with `editor` role)

### 5.1 Editor Onboarding
* **Method:** `POST /editor/onboarding`
* **Body:**
  ```json
  {
    "display_name": "Rohan Cuts",
    "bio": "Specialist in viral retention edits and pacing.",
    "experience_years": 4,
    "pricing_from": 1500.00,
    "category_ids": ["22222222-2222-2222-2222-222222222222"]
  }
  ```
* **Response (200):**
  ```json
  {
    "message": "Editor onboarding completed successfully",
    "profile": { ... },
    "categories": [ ... ]
  }
  ```

---

### 5.2 Get Own Editor Profile
* **Method:** `GET /editor/profile`
* **Response (200):**
  ```json
  {
    "profile": {
      "id": "editor-uuid",
      "display_name": "Rohan Cuts",
      "bio": "Specialist in viral retention edits",
      "pricing_from": "1500.00",
      "availability_status": "available"
    },
    "categories": [...],
    "portfolio_count": 2
  }
  ```

---

### 5.3 Update Editor Profile
* **Method:** `PATCH /editor/profile`
* **Body:**
  ```json
  {
    "bio": "Updated bio: 5+ years experience with Premiere Pro & After Effects",
    "pricing_from": 2000.00
  }
  ```
* **Response (200):**
  ```json
  {
    "message": "Editor profile updated successfully"
  }
  ```

---

### 5.4 Profile Completion Tracker
* **Method:** `GET /editor/profile/completion`
* **Description:** Returns profile completion percentage and checklist of missing fields.
* **Response (200):**
  ```json
  {
    "completion_percentage": 100,
    "checklist": {
      "has_display_name": true,
      "has_bio": true,
      "has_pricing": true,
      "has_categories": true,
      "has_portfolio": true
    },
    "missing_fields": []
  }
  ```

---

### 5.5 Update Availability
* **Method:** `PATCH /editor/availability`
* **Body:**
  ```json
  {
    "availability_status": "available"
  }
  ```
  *(Allowed values: `"available"`, `"busy"`, `"unavailable"`)*
* **Response (200):**
  ```json
  {
    "message": "Availability updated successfully",
    "availability_status": "available"
  }
  ```

---

## 6. Editor Categories APIs

Prefix: `{{BASE_URL}}/editor/categories`
Requires: `Authorization: Bearer {{TOKEN}}` (`editor` role)

### 6.1 Get Selected Categories
* **Method:** `GET /editor/categories`
* **Response (200):**
  ```json
  {
    "categories": [
      {
        "id": "22222222-2222-2222-2222-222222222222",
        "name": "Instagram Reels & Shorts",
        "experience_years": 4
      }
    ]
  }
  ```

---

### 6.2 Update / Replace Categories
* **Method:** `PUT /editor/categories`
* **Body:**
  ```json
  {
    "category_ids": [
      "22222222-2222-2222-2222-222222222222",
      "33333333-3333-3333-3333-333333333333"
    ]
  }
  ```
* **Response (200):**
  ```json
  {
    "message": "Categories updated successfully",
    "categories": [...]
  }
  ```

---

## 7. Editor Portfolio APIs

Prefix: `{{BASE_URL}}/editor/portfolio`
Requires: `Authorization: Bearer {{TOKEN}}` (`editor` role)

### 7.1 Add Portfolio Item
* **Method:** `POST /editor/portfolio`
* **Body:**
  ```json
  {
    "title": "Viral Gym Reel",
    "description": "Sound design and retention cuts",
    "media_url": "https://storage.reelmitra.com/gym.mp4",
    "thumbnail_url": "https://storage.reelmitra.com/gym_thumb.jpg",
    "category_id": "22222222-2222-2222-2222-222222222222",
    "sort_order": 1
  }
  ```
* **Response (201):**
  ```json
  {
    "message": "Portfolio item added successfully",
    "item": { "id": "portfolio-uuid", "title": "Viral Gym Reel" }
  }
  ```

---

### 7.2 Get Own Portfolio Items
* **Method:** `GET /editor/portfolio`
* **Response (200):**
  ```json
  {
    "portfolio": [
      { "id": "portfolio-uuid", "title": "Viral Gym Reel", "sort_order": 1 }
    ]
  }
  ```

---

### 7.3 Get Specific Portfolio Item
* **Method:** `GET /editor/portfolio/:item_id`
* **Response (200):**
  ```json
  {
    "item": {
      "id": "portfolio-uuid",
      "title": "Viral Gym Reel",
      "description": "...",
      "media_url": "https://storage.reelmitra.com/gym.mp4"
    }
  }
  ```

---

### 7.4 Update Portfolio Item
* **Method:** `PATCH /editor/portfolio/:item_id`
* **Body:**
  ```json
  {
    "title": "Viral Gym Reel (Final Cut)",
    "description": "Updated color grade and sound effects"
  }
  ```
* **Response (200):**
  ```json
  {
    "message": "Portfolio item updated successfully",
    "item": { ... }
  }
  ```

---

### 7.5 Delete Portfolio Item
* **Method:** `DELETE /editor/portfolio/:item_id`
* **Description:** Deletes item permanently (ownership verified).
* **Response (200):**
  ```json
  {
    "message": "Portfolio item deleted successfully"
  }
  ```

---

### 7.6 Reorder Portfolio Items
* **Method:** `PATCH /editor/portfolio/reorder`
* **Body:**
  ```json
  {
    "items": [
      { "id": "uuid-item-1", "sort_order": 1 },
      { "id": "uuid-item-2", "sort_order": 2 }
    ]
  }
  ```
* **Response (200):**
  ```json
  {
    "message": "Portfolio reordered successfully",
    "portfolio": [...]
  }
  ```

---

## 8. Uploads & Media APIs

Prefix: `{{BASE_URL}}/uploads`
Requires: `Authorization: Bearer {{TOKEN}}`

### 8.1 Initiate File Upload
* **Method:** `POST /uploads/initiate`
* **Description:** Registers upload metadata and provides an authorized direct upload URL.
* **Body:**
  ```json
  {
    "file_name": "raw_footage_4k.mp4",
    "mime_type": "video/mp4",
    "size_bytes": 104857600,
    "media_type": "video"
  }
  ```
* **Response (201):**
  ```json
  {
    "message": "Upload initiated successfully",
    "upload_id": "media-file-uuid",
    "storage_key": "uploads/user-id/17300000_raw_footage_4k.mp4",
    "upload_url": "https://storage.reelmitra.com/direct/media-file-uuid",
    "expires_in": 3600
  }
  ```

---

### 8.2 Get Upload Status
* **Method:** `GET /uploads/:upload_id`
* **Response (200):**
  ```json
  {
    "upload_id": "media-file-uuid",
    "status": "pending",
    "file_name": "raw_footage_4k.mp4",
    "size_bytes": 104857600
  }
  ```

---

### 8.3 Complete & Verify Upload
* **Method:** `POST /uploads/:upload_id/complete`
* **Description:** Called after frontend completes sending file bytes to storage.
* **Response (200):**
  ```json
  {
    "message": "Upload marked as completed",
    "media_file": {
      "id": "media-file-uuid",
      "upload_status": "uploaded"
    }
  }
  ```

---

## 9. Database Query Viewer APIs

Prefix: `http://localhost:5000/api`

### 9.1 List All Tables
* **Method:** `GET /api/tables`
* **Access:** Public (Used by Viewer Sidebar)
* **Response (200):**
  ```json
  {
    "tables": [
      "categories",
      "conversations",
      "editor_categories",
      "editor_profiles",
      "media_files",
      "messages",
      "order_deliverables",
      "order_status_history",
      "orders",
      "payments",
      "portfolio_items",
      "reviews",
      "users"
    ]
  }
  ```

---

### 9.2 Execute SQL Query
* **Method:** `POST /api/query`
* **Access:** Public (Used by Viewer Editor)
* **Body:**
  ```json
  {
    "query": "SELECT id, name, slug FROM categories LIMIT 5;"
  }
  ```
* **Response (200):**
  ```json
  {
    "columns": ["id", "name", "slug"],
    "rows": [ ... ],
    "rowCount": 5,
    "executionTimeMs": 35,
    "command": "SELECT"
  }
  ```
* **Error Response (400):**
  ```json
  {
    "error": "relation \"non_existing\" does not exist",
    "executionTimeMs": 28
  }
  ```

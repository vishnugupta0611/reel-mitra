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
8. [Uploads & Cloudinary Media APIs (`/uploads`)](#8-uploads--cloudinary-media-apis)
9. [Orders, Deliverables & Reviews APIs (`/orders`)](#9-orders-deliverables--reviews-apis)
10. [Razorpay Payments APIs (`/payments`)](#10-razorpay-payments-apis)
11. [Editor Wallet, Payout Accounts & RazorpayX Withdrawals (`/editor/earnings`, `/editor/payout-accounts`, `/payouts`)](#11-editor-wallet-payout-accounts--razorpayx-withdrawals)
12. [Client–Editor Messaging APIs (`/conversations`)](#12-clienteditor-messaging-apis)
13. [Database Query Viewer APIs (`/api`)](#13-database-query-viewer-apis)

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

## 8. Uploads & Cloudinary Media APIs

Prefix: `{{BASE_URL}}/uploads`
Requires: `Authorization: Bearer {{TOKEN}}`

### 8.1 Initiate Signed Cloudinary Upload
* **Method:** `POST /uploads/initiate`
* **Description:** Creates a `media_files` row and returns Cloudinary signed upload parameters for direct browser/mobile uploads (large videos/images).
* **Body:**
  ```json
  {
    "file_name": "raw_footage_4k.mp4",
    "mime_type": "video/mp4",
    "size_bytes": 104857600,
    "folder": "orders",
    "order_id": "optional-order-uuid"
  }
  ```
* **Response (201):**
  ```json
  {
    "message": "Cloudinary upload initiated",
    "upload_id": "media-file-uuid",
    "storage_key": "reelmitra/orders/user-id/17300000_raw_footage_4k",
    "upload_url": "https://api.cloudinary.com/v1_1/<cloud_name>/video/upload",
    "resource_type": "video",
    "cloudinary": {
      "timestamp": 1730000000,
      "signature": "...",
      "folder": "reelmitra/orders/user-id",
      "public_id": "17300000_raw_footage_4k",
      "api_key": "...",
      "cloud_name": "..."
    }
  }
  ```

---

### 8.2 Direct Server Upload (Multipart)
* **Method:** `POST /uploads/file`
* **Content-Type:** `multipart/form-data`
* **Fields:** `file` (max 100 MB), `folder` (`avatars` | `portfolio` | `orders` | `deliverables` | `chat` | `general`), `order_id` *(optional)*
* **Response (201):**
  ```json
  {
    "message": "File uploaded to Cloudinary successfully",
    "url": "https://res.cloudinary.com/.../image/upload/.../avatar.jpg",
    "public_id": "reelmitra/avatars/user-id/...",
    "media_file": { "id": "media-file-uuid", "upload_status": "uploaded" }
  }
  ```

---

### 8.3 Get Upload Status
* **Method:** `GET /uploads/:upload_id`
* **Response (200):**
  ```json
  {
    "upload_id": "media-file-uuid",
    "status": "pending",
    "file_name": "raw_footage_4k.mp4",
    "file_url": null,
    "size_bytes": 104857600
  }
  ```

---

### 8.4 Complete Direct Cloudinary Upload
* **Method:** `POST /uploads/:upload_id/complete`
* **Description:** Stores the returned Cloudinary `secure_url` and marks upload as `uploaded`.
* **Body:**
  ```json
  {
    "secure_url": "https://res.cloudinary.com/.../video/upload/v1/raw_footage_4k.mp4",
    "public_id": "reelmitra/orders/user-id/17300000_raw_footage_4k",
    "size_bytes": 104857600
  }
  ```

---

### 8.5 Delete Media File
* **Method:** `DELETE /uploads/:upload_id`
* **Description:** Deletes the Cloudinary asset and database record (owner/admin only).

---

## 9. Orders, Deliverables & Reviews APIs

Prefix: `{{BASE_URL}}/orders`
Requires: `Authorization: Bearer {{TOKEN}}`

### 9.1 Create Order (Pre-Saves 20% Commission Split)
* **Method:** `POST /orders`
* **Body:**
  ```json
  {
    "editor_id": "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee",
    "category_id": "22222222-2222-2222-2222-222222222222",
    "title": "Instagram Reels Edit",
    "brief": "High retention vertical video with captions and SFX",
    "requested_deadline": "2026-11-20T12:00:00.000Z",
    "amount": 2500,
    "currency": "INR",
    "revision_limit": 2
  }
  ```
* **Response (201):** Returns created `order` with saved `amount` (`2500.00`), `commission_percent` (`20.00`), `platform_fee` (`500.00`), `editor_amount` (`2000.00`), `status` (`"pending"`).

---

### 9.2 List My Orders
* **Method:** `GET /orders`
* **Query Params:** `status` *(optional)*

---

### 9.3 Get Order Details
* **Method:** `GET /orders/:id`
* **Description:** Returns `order`, `timeline`, `deliverables`, `payments`, and `earning` (order client/editor/admin only).

---

### 9.4 Editor Accept Order
* **Method:** `PATCH /orders/:id/accept`

---

### 9.5 Cancel Order
* **Method:** `PATCH /orders/:id/cancel`

---

### 9.6 Editor Submit Deliverable
* **Method:** `POST /orders/:id/deliverables`
* **Body:** `{ "media_file_id": "uuid", "deliverable_type": "preview" }` or `{ "media_url": "https://res.cloudinary.com/...", "file_name": "final.mp4", "deliverable_type": "final" }` (`preview` | `revision` | `final`)

---

### 9.7 Client Request Revision
* **Method:** `PATCH /orders/:id/request-revision`
* **Body:** `{ "note": "Make intro hook faster" }`

---

### 9.8 Client Complete Order
* **Method:** `PATCH /orders/:id/complete`
* **Description:** Marks paid order as `completed` and unlocks `editor_earnings.status` from `'pending'` to `'available'`.

---

### 9.9 Client Submit Review
* **Method:** `POST /orders/:id/review`
* **Body:** `{ "rating": 4.5, "comment": "Clean edit and timely delivery" }`

---

## 10. Razorpay Payments APIs

Prefix: `{{BASE_URL}}/payments`

### 10.1 Create Razorpay Order
* **Method:** `POST /payments/create-order`
* **Access:** Protected (`Bearer {{TOKEN}}`, order's client)
* **Body:** `{ "order_id": "order-uuid" }`
* **Description:** Reads `orders.amount` from DB, creates a Razorpay Order, and stores a `payments` record (`status: "created"`).

---

### 10.2 Verify Payment Signature
* **Method:** `POST /payments/verify`
* **Access:** Protected (`Bearer {{TOKEN}}`, order's client)
* **Body:**
  ```json
  {
    "razorpay_order_id": "order_RzpId...",
    "razorpay_payment_id": "pay_RzpId...",
    "razorpay_signature": "hmac_sha256_hex"
  }
  ```
* **Description:** Verifies HMAC-SHA256 signature and confirms payment status via Razorpay API; marks payment `captured`, sets `orders.status = 'in_progress'`, and records `editor_earnings` (`status: 'pending'`).

---

### 10.3 Razorpay / RazorpayX Webhook
* **Method:** `POST /payments/webhook` *(or `POST /payouts/webhook`)*
* **Access:** Public (verified via `x-razorpay-signature` header against raw JSON body using `RAZORPAY_WEBHOOK_SECRET` or `RAZORPAYX_WEBHOOK_SECRET`)
* **Events Handled:**
  * Payment Gateway: `payment.captured`, `payment.failed`, `refund.processed`, `payment.refunded`
  * RazorpayX Payouts: `payout.queued`, `payout.pending`, `payout.processing`, `payout.processed`, `payout.failed`, `payout.reversed`, `payout.rejected`
  * RazorpayX Validations: `fund_account.validation.completed`, `fund_account.validation.failed`

---

## 11. Editor Wallet, Payout Accounts & RazorpayX Withdrawals

Requires: `Authorization: Bearer {{TOKEN}}` (`editor` role)

### 11.1 View Editor Wallet & Earnings Ledger
* **Method:** `GET /editor/earnings` *(alias: `GET /editor/wallet`)*
* **Response (200):**
  ```json
  {
    "summary": {
      "total_earned": "2000.00",
      "pending_amount": "0.00",
      "available_balance": "1500.00",
      "reserved_amount": "500.00",
      "withdrawn_amount": "0.00",
      "minimum_withdrawal_amount": "100.00"
    },
    "items": [ ... ]
  }
  ```

---

### 11.2 Setup Editor Payout Account (Bank Account or UPI VPA)
* **Method:** `POST /editor/payout-accounts`
* **Description:** Creates/reuses a RazorpayX Contact (`POST /v1/contacts`), creates a Fund Account (`POST /v1/fund_accounts`), stores `pending_verification` in `editor_payout_accounts`, and automatically runs penny-drop validation ONLY when `RAZORPAYX_AUTO_VALIDATE=true` (falling back cleanly to `pending_verification` if validation API/IP allowlisting is unavailable).
* **Body (Bank Account):**
  ```json
  {
    "account_type": "bank_account",
    "account_holder_name": "Rohan Verma",
    "account_number": "123456789012",
    "ifsc": "HDFC0001234"
  }
  ```
* **Body (UPI / VPA):**
  ```json
  {
    "account_type": "vpa",
    "vpa_address": "rohanverma@okhdfcbank"
  }
  ```
* **Response (201):** Returns `{ "message": "...", "payout_account": { "id": "...", "razorpay_contact_id": "cont_...", "razorpay_fund_account_id": "fa_...", "account_type": "bank_account", "account_status": "pending_verification", "account_label": "****9012 (HDFC0001234)" } }`.

---

### 11.3 List Editor Payout Accounts
* **Method:** `GET /editor/payout-accounts`

---

### 11.4 Manually Validate Payout Account (Penny-Drop / VPA Validation)
* **Method:** `POST /editor/payout-accounts/:id/validate`
* **Description:** Calls RazorpayX Fund Account Validation (`POST /v1/fund_accounts/validations`). Prevents duplicate concurrent requests (`409`). Marks `verified` ONLY when RazorpayX confirms `status: 'completed'` and `results.account_status: 'active'`.

---

### 11.5 Withdraw Available Balance via RazorpayX Payouts
* **Method:** `POST /payouts/withdraw`
* **Body:**
  ```json
  {
    "amount": 500,
    "payout_account_id": "optional-verified-payout-account-uuid",
    "mode": "IMPS"
  }
  ```
  *(Modes: `IMPS`, `NEFT`, `RTGS` for bank accounts; `UPI` for VPA. Requires verified payout account and `amount >= MIN_WITHDRAWAL_AMOUNT`.)*
* **Description:** Acquires a transactional wallet lock (`FOR UPDATE`), checks `available_balance`, reserves funds in `payouts`, and calls RazorpayX `POST /v1/payouts` with `X-Payout-Idempotency`. Definitive failures/reversals release reserved balance automatically.

---

### 11.6 List My Withdrawal Payouts
* **Method:** `GET /payouts`
* **Response (200):** Returns `{ "wallet": { ... }, "payouts": [ ... ] }`.

---

### 11.7 Sync Payout Status from RazorpayX
* **Method:** `POST /payouts/:id/sync`
* **Description:** Fetches `GET /v1/payouts/:razorpay_payout_id` and updates `status`, `utr`, `failure_reason`, and `completed_at` idempotently.

---

## 12. Client–Editor Messaging APIs

Prefix: `{{BASE_URL}}/conversations`
Requires: `Authorization: Bearer {{TOKEN}}`

### 12.1 Start or Get Conversation
* **Method:** `POST /conversations`
* **Body:** `{ "editor_id": "editor-profile-uuid", "order_id": "optional-order-uuid" }` (or `{ "client_id": "user-uuid" }` when called by an editor, or `{ "order_id": "order-uuid" }`).

---

### 12.2 List My Conversations
* **Method:** `GET /conversations`

---

### 12.3 Get Conversation Messages
* **Method:** `GET /conversations/:id/messages`
* **Query Params:** `page=1&limit=50`

---

### 12.4 Send Text or Cloudinary Media Message
* **Method:** `POST /conversations/:id/messages`
* **Body:**
  ```json
  {
    "message_text": "Check this reference cut",
    "media_file_id": "optional-media-file-uuid",
    "media_url": "https://res.cloudinary.com/.../video/upload/.../clip.mp4"
  }
  ```

---

## 13. Database Query Viewer APIs

Prefix: `http://localhost:5000/api`

### 13.1 List All Tables
* **Method:** `GET /api/tables`
* **Access:** Public (Used by Viewer Sidebar)
* **Response (200):**
  ```json
  {
    "tables": [
      "categories",
      "conversations",
      "editor_categories",
      "editor_earnings",
      "editor_payout_accounts",
      "editor_profiles",
      "media_files",
      "messages",
      "order_deliverables",
      "order_status_history",
      "orders",
      "payments",
      "payouts",
      "portfolio_items",
      "reviews",
      "users"
    ]
  }
  ```

---

### 13.2 Execute SQL Query
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
